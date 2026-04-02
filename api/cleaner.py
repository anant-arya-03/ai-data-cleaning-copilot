import pandas as pd
import numpy as np
import io
import re

def detect_column_types(df: pd.DataFrame) -> dict:
    types = {}
    for col in df.columns:
        # Default to text
        col_type = "text"

        # Check missing rate
        missing_rate = df[col].isna().mean()

        if df[col].dtype in ['int64', 'float64', 'Int64', 'Float64']:
            # Check if it's boolean-like (0, 1) or ID-like
            if df[col].dropna().nunique() <= 2 and set(df[col].dropna().unique()).issubset({0, 1, 0.0, 1.0}):
                col_type = "boolean"
            elif df[col].dtype == 'int64' and df[col].nunique() == len(df[col]) and df[col].min() >= 0:
                col_type = "id"
            else:
                col_type = "numeric"
        elif df[col].dtype == 'bool':
            col_type = "boolean"
        elif df[col].dtype == 'datetime64[ns]' or pd.core.dtypes.common.is_datetime_or_timedelta_dtype(df[col]):
            col_type = "datetime"
        else:
            # String / Object
            non_null_series = df[col].dropna()

            if len(non_null_series) == 0:
                col_type = "text"
            else:
                # Check boolean
                unique_vals = set(non_null_series.astype(str).str.lower().unique())
                if unique_vals.issubset({'true', 'false', 'yes', 'no', 't', 'f', 'y', 'n', '0', '1'}):
                    col_type = "boolean"
                else:
                    # Check if date
                    try:
                        # Only try parsing if it looks date-like (e.g. contains -, /, or year) to avoid false positives
                        if non_null_series.str.contains(r'\d{2,4}[-/]\d{1,2}[-/]\d{1,4}').any():
                             pd.to_datetime(non_null_series, errors='raise')
                             col_type = "datetime"
                    except:
                        pass

                    if col_type != "datetime":
                        # Pattern matching for email, phone, url
                        emails = non_null_series.str.contains(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
                        if emails.mean() > 0.8:
                            col_type = "email"
                        else:
                            urls = non_null_series.str.contains(r'^https?://')
                            if urls.mean() > 0.8:
                                col_type = "url"
                            else:
                                phones = non_null_series.str.contains(r'^\+?\d[\d\-\s()]{7,}\d$')
                                if phones.mean() > 0.8:
                                    col_type = "phone"
                                else:
                                    # Categorical vs Text
                                    n_unique = non_null_series.nunique()
                                    if n_unique <= 20 or n_unique / len(non_null_series) < 0.05:
                                        col_type = "categorical"
                                    elif n_unique == len(df) or n_unique == len(non_null_series):
                                        col_type = "id"
                                    else:
                                        col_type = "text"

        types[col] = {
            "type": col_type,
            "missing_rate": float(missing_rate),
            "high_missing_warning": bool(missing_rate > 0.5 and col_type in ["text", "categorical"])
        }
    return types

def generate_profile(df: pd.DataFrame, col_types: dict) -> dict:
    profile = {
        "summary": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "total_missing": int(df.isna().sum().sum()),
            "total_missing_percent": float(df.isna().sum().sum() / (df.shape[0] * df.shape[1])) * 100 if df.size > 0 else 0,
            "duplicate_rows": int(df.duplicated().sum()),
            "memory_usage_kb": float(df.memory_usage(deep=True).sum() / 1024),
        },
        "columns": [],
        "type_distribution": {
            "numeric": sum(1 for c in col_types.values() if c["type"] == "numeric"),
            "categorical": sum(1 for c in col_types.values() if c["type"] == "categorical"),
            "text": sum(1 for c in col_types.values() if c["type"] == "text"),
            "datetime": sum(1 for c in col_types.values() if c["type"] == "datetime"),
            "boolean": sum(1 for c in col_types.values() if c["type"] == "boolean"),
            "other": sum(1 for c in col_types.values() if c["type"] not in ["numeric", "categorical", "text", "datetime", "boolean"]),
        },
        "correlations": []
    }

    # Column details
    for col in df.columns:
        c_type = col_types[col]["type"]
        non_nulls = df[col].dropna()
        col_info = {
            "name": col,
            "type": c_type,
            "missing_count": int(df[col].isna().sum()),
            "missing_percent": float(df[col].isna().mean() * 100),
            "unique_count": int(non_nulls.nunique()),
            "samples": non_nulls.astype(str).head(3).tolist(),
            "distribution": []
        }

        # Sparkline data for distribution
        if len(non_nulls) > 0:
            if c_type == "numeric":
                try:
                    hist, bins = np.histogram(non_nulls, bins=10)
                    col_info["distribution"] = hist.tolist()
                except:
                    pass
            elif c_type in ["categorical", "boolean", "text", "email", "phone"]:
                counts = non_nulls.value_counts().head(10)
                col_info["distribution"] = counts.tolist()

        profile["columns"].append(col_info)

    # Correlation matrix for numeric only
    numeric_cols = [c for c, t in col_types.items() if t["type"] == "numeric" and pd.api.types.is_numeric_dtype(df[c])]
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr().fillna(0).round(3)
        for i, col1 in enumerate(numeric_cols):
            for j, col2 in enumerate(numeric_cols):
                profile["correlations"].append({
                    "col1": col1,
                    "col2": col2,
                    "value": float(corr_matrix.iloc[i, j])
                })

    return profile

def apply_missing_strategy(df: pd.DataFrame, col: str, strategy: str, value: str = None, col_types: dict = None) -> dict:
    if col not in df.columns:
        raise ValueError(f"Column {col} not found")

    before_missing = int(df[col].isna().sum())
    c_type = col_types[col]["type"] if col_types and col in col_types else "text"

    # SAFETY CHECK: prevent "mean" or "median" on non-numeric
    if strategy in ["mean", "median", "interpolate"]:
        if not pd.api.types.is_numeric_dtype(df[col]):
            # Try converting first (e.g., if it's strings of numbers)
            try:
                df[col] = pd.to_numeric(df[col])
            except:
                raise ValueError(f"Strategy '{strategy}' cannot be applied to non-numeric column '{col}'. Please choose Mode or Fixed Value instead.")

    if strategy == "mean":
        df[col] = df[col].fillna(df[col].mean())
    elif strategy == "median":
        df[col] = df[col].fillna(df[col].median())
    elif strategy == "mode":
        mode_val = df[col].mode()
        if not mode_val.empty:
            df[col] = df[col].fillna(mode_val[0])
    elif strategy == "fixed":
        if value is None:
            raise ValueError("Value must be provided for 'fixed' strategy")
        # Try to cast value to appropriate type
        if c_type == "numeric":
            try:
                val = float(value)
            except:
                val = value
            df[col] = df[col].fillna(val)
        else:
            df[col] = df[col].fillna(value)
    elif strategy == "drop":
        df = df.dropna(subset=[col]).copy()
        df.reset_index(drop=True, inplace=True)
    elif strategy == "ffill":
        df[col] = df[col].ffill()
    elif strategy == "bfill":
        df[col] = df[col].bfill()
    elif strategy == "interpolate":
        df[col] = df[col].interpolate()
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    after_missing = int(df[col].isna().sum())

    return {
        "df": df,
        "rows_affected": before_missing - after_missing,
        "before_missing": before_missing,
        "after_missing": after_missing
    }
