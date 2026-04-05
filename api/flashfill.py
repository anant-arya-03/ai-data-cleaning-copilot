import pandas as pd
import numpy as np
import re

def get_suggestions(df: pd.DataFrame, col: str, c_type: str) -> list:
    if col not in df.columns:
        return []

    s = df[col].dropna()
    if len(s) == 0:
        return []

    suggestions = []

    if c_type in ["text", "categorical", "id"]:
        # Text transformations
        suggestions.append({
            "id": "uppercase",
            "name": "Convert to UPPERCASE",
            "confidence": 95,
            "preview": s.astype(str).str.upper().head(5).tolist()
        })
        suggestions.append({
            "id": "lowercase",
            "name": "Convert to lowercase",
            "confidence": 95,
            "preview": s.astype(str).str.lower().head(5).tolist()
        })
        suggestions.append({
            "id": "titlecase",
            "name": "Convert to Title Case",
            "confidence": 90,
            "preview": s.astype(str).str.title().head(5).tolist()
        })
        suggestions.append({
            "id": "extract_numbers",
            "name": "Extract numbers only",
            "confidence": 85 if s.astype(str).str.contains(r'\d').any() else 20,
            "preview": s.astype(str).apply(lambda x: re.sub(r'\D', '', x) if pd.notnull(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "remove_special",
            "name": "Remove special characters",
            "confidence": 80,
            "preview": s.astype(str).apply(lambda x: re.sub(r'[^a-zA-Z0-9\s]', '', x) if pd.notnull(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "first_word",
            "name": "Extract first word",
            "confidence": 75 if s.astype(str).str.contains(r'\s').mean() > 0.5 else 30,
            "preview": s.astype(str).apply(lambda x: x.split()[0] if pd.notnull(x) and str(x).strip() else x).head(5).tolist()
        })
        suggestions.append({
            "id": "last_word",
            "name": "Extract last word",
            "confidence": 70 if s.astype(str).str.contains(r'\s').mean() > 0.5 else 20,
            "preview": s.astype(str).apply(lambda x: x.split()[-1] if pd.notnull(x) and str(x).strip() else x).head(5).tolist()
        })
        suggestions.append({
            "id": "remove_whitespace",
            "name": "Remove extra whitespace",
            "confidence": 60,
            "preview": s.astype(str).apply(lambda x: re.sub(r'\s+', ' ', str(x)).strip() if pd.notnull(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "split_delimiter",
            "name": "Split by delimiter (take first)",
            "confidence": 50,
            "preview": s.astype(str).apply(lambda x: re.split(r'[,;|/]', str(x))[0].strip() if pd.notnull(x) and re.search(r'[,;|/]', str(x)) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "word_length",
            "name": "Count word length",
            "confidence": 40,
            "preview": s.astype(str).apply(lambda x: len(str(x)) if pd.notnull(x) else x).head(5).tolist()
        })

    elif c_type == "numeric":
        s_num = pd.to_numeric(s, errors='coerce').dropna()
        if len(s_num) > 0:
            min_val = s_num.min()
            max_val = s_num.max()
            range_val = max_val - min_val if max_val != min_val else 1
            mean_val = s_num.mean()
            std_val = s_num.std() if s_num.std() > 0 else 1

            suggestions.append({
                "id": "normalize",
                "name": "Normalize (0-1 min-max scaling)",
                "confidence": 90,
                "preview": ((s_num - min_val) / range_val).round(4).head(5).tolist()
            })
            suggestions.append({
                "id": "standardize",
                "name": "Standardize (z-score)",
                "confidence": 85,
                "preview": ((s_num - mean_val) / std_val).round(4).head(5).tolist()
            })
            if (s_num > -1).all():
                suggestions.append({
                    "id": "log1p",
                    "name": "Log transform (log1p)",
                    "confidence": 80 if s_num.skew() > 1 else 40,
                    "preview": np.log1p(s_num).round(4).head(5).tolist()
                })
            suggestions.append({
                "id": "integer_part",
                "name": "Extract integer part",
                "confidence": 95 if (s_num % 1 != 0).any() else 10,
                "preview": np.floor(s_num).astype(int).head(5).tolist()
            })
            suggestions.append({
                "id": "bin_5",
                "name": "Bin into 5 equal buckets",
                "confidence": 75,
                "preview": pd.cut(s_num, bins=5, labels=False, duplicates='drop').head(5).tolist()
            })
            suggestions.append({
                "id": "round_2",
                "name": "Round to 2 decimal places",
                "confidence": 70 if (s_num % 1 != 0).any() else 5,
                "preview": s_num.round(2).head(5).tolist()
            })

    elif c_type == "email":
        suggestions.append({
            "id": "extract_domain",
            "name": "Extract domain",
            "confidence": 95,
            "preview": s.astype(str).apply(lambda x: x.split('@')[-1] if pd.notnull(x) and '@' in str(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "extract_username",
            "name": "Extract username",
            "confidence": 90,
            "preview": s.astype(str).apply(lambda x: x.split('@')[0] if pd.notnull(x) and '@' in str(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "mask_email",
            "name": "Mask email",
            "confidence": 85,
            "preview": s.astype(str).apply(lambda x: str(x)[:2] + "***@" + str(x).split('@')[-1] if pd.notnull(x) and '@' in str(x) and len(str(x).split('@')[0]) >= 2 else x).head(5).tolist()
        })

    elif c_type == "phone":
        suggestions.append({
            "id": "mask_phone",
            "name": "Mask last 4 digits",
            "confidence": 90,
            "preview": s.astype(str).apply(lambda x: re.sub(r'\d{4}$', '****', str(x)) if pd.notnull(x) else x).head(5).tolist()
        })
        suggestions.append({
            "id": "extract_country_code",
            "name": "Extract country code",
            "confidence": 85 if s.astype(str).str.startswith('+').mean() > 0.5 else 30,
            "preview": s.astype(str).apply(lambda x: x.split('-')[0] if pd.notnull(x) and '-' in str(x) and str(x).startswith('+') else x).head(5).tolist()
        })

    elif c_type == "datetime":
        try:
            s_dt = pd.to_datetime(s, errors='coerce').dropna()
            if len(s_dt) > 0:
                suggestions.append({
                    "id": "extract_year",
                    "name": "Extract year",
                    "confidence": 95,
                    "preview": s_dt.dt.year.head(5).tolist()
                })
                suggestions.append({
                    "id": "extract_month",
                    "name": "Extract month",
                    "confidence": 90,
                    "preview": s_dt.dt.month.head(5).tolist()
                })
                suggestions.append({
                    "id": "extract_dayofweek",
                    "name": "Extract day of week",
                    "confidence": 85,
                    "preview": s_dt.dt.day_name().head(5).tolist()
                })
                suggestions.append({
                    "id": "extract_hour",
                    "name": "Extract hour",
                    "confidence": 80 if s_dt.dt.hour.max() > 0 else 10,
                    "preview": s_dt.dt.hour.head(5).tolist()
                })
                suggestions.append({
                    "id": "days_since",
                    "name": "Calculate days since today",
                    "confidence": 75,
                    "preview": (pd.Timestamp.today() - s_dt).dt.days.head(5).tolist()
                })
                suggestions.append({
                    "id": "format_ymd",
                    "name": "Format as YYYY-MM-DD",
                    "confidence": 80,
                    "preview": s_dt.dt.strftime('%Y-%m-%d').head(5).tolist()
                })
        except:
            pass

    # Sort by confidence descending and take top 3
    suggestions.sort(key=lambda x: x["confidence"], reverse=True)
    return suggestions[:3]

def apply_transformation(df: pd.DataFrame, col: str, transform_id: str) -> dict:
    new_col = f"{col}_transformed"
    s = df[col]

    # Store success/fail counts
    success_count = 0
    fail_count = 0

    def safe_apply(val, func):
        nonlocal success_count, fail_count
        if pd.isna(val):
            return np.nan
        try:
            res = func(val)
            success_count += 1
            return res
        except Exception:
            fail_count += 1
            return np.nan

    if transform_id == "uppercase":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).upper()))
    elif transform_id == "lowercase":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).lower()))
    elif transform_id == "titlecase":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).title()))
    elif transform_id == "extract_numbers":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: re.sub(r'\D', '', str(v))))
    elif transform_id == "remove_special":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: re.sub(r'[^a-zA-Z0-9\s]', '', str(v))))
    elif transform_id == "first_word":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).split()[0] if str(v).strip() else ""))
    elif transform_id == "last_word":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).split()[-1] if str(v).strip() else ""))
    elif transform_id == "remove_whitespace":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: re.sub(r'\s+', ' ', str(v)).strip()))
    elif transform_id == "split_delimiter":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: re.split(r'[,;|/]', str(v))[0].strip() if re.search(r'[,;|/]', str(v)) else v))
    elif transform_id == "word_length":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: len(str(v))))

    # Numeric
    elif transform_id in ["normalize", "standardize", "log1p", "integer_part", "bin_5", "round_2"]:
        s_num = pd.to_numeric(s, errors='coerce')
        if transform_id == "normalize":
            min_val = s_num.min()
            range_val = s_num.max() - min_val if s_num.max() != min_val else 1
            df[new_col] = (s_num - min_val) / range_val
        elif transform_id == "standardize":
            mean_val = s_num.mean()
            std_val = s_num.std() if s_num.std() > 0 else 1
            df[new_col] = (s_num - mean_val) / std_val
        elif transform_id == "log1p":
            df[new_col] = s_num.apply(lambda x: safe_apply(x, lambda v: np.log1p(max(0, v)) if v > -1 else np.nan))
        elif transform_id == "integer_part":
            df[new_col] = s_num.apply(lambda x: safe_apply(x, lambda v: int(np.floor(v))))
        elif transform_id == "bin_5":
            df[new_col] = pd.cut(s_num, bins=5, labels=False, duplicates='drop')
        elif transform_id == "round_2":
            df[new_col] = s_num.round(2)

        success_count = s_num.notna().sum()
        fail_count = len(s) - success_count - s.isna().sum()

    # Email
    elif transform_id == "extract_domain":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).split('@')[-1] if '@' in str(v) else np.nan))
    elif transform_id == "extract_username":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).split('@')[0] if '@' in str(v) else np.nan))
    elif transform_id == "mask_email":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v)[:2] + "***@" + str(v).split('@')[-1] if '@' in str(v) and len(str(v).split('@')[0]) >= 2 else np.nan))

    # Phone
    elif transform_id == "mask_phone":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: re.sub(r'\d{4}$', '****', str(v))))
    elif transform_id == "extract_country_code":
        df[new_col] = s.apply(lambda x: safe_apply(x, lambda v: str(v).split('-')[0] if '-' in str(v) and str(v).startswith('+') else np.nan))

    # Datetime
    elif transform_id in ["extract_year", "extract_month", "extract_dayofweek", "format_ymd", "extract_hour", "days_since"]:
        s_dt = pd.to_datetime(s, errors='coerce')
        if transform_id == "extract_year":
            df[new_col] = s_dt.dt.year
        elif transform_id == "extract_month":
            df[new_col] = s_dt.dt.month
        elif transform_id == "extract_dayofweek":
            df[new_col] = s_dt.dt.day_name()
        elif transform_id == "extract_hour":
            df[new_col] = s_dt.dt.hour
        elif transform_id == "days_since":
            df[new_col] = (pd.Timestamp.today() - s_dt).dt.days
        elif transform_id == "format_ymd":
            df[new_col] = s_dt.dt.strftime('%Y-%m-%d')

        success_count = s_dt.notna().sum()
        fail_count = len(s) - success_count - s.isna().sum()
    else:
        raise ValueError(f"Unknown transformation: {transform_id}")

    return {
        "df": df,
        "new_column": new_col,
        "success_count": int(success_count),
        "fail_count": int(fail_count)
    }
