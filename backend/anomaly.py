import pandas as pd
import numpy as np
import re
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA

def detect_anomalies(df: pd.DataFrame, numeric_cols: list, contamination: float = 0.05) -> dict:
    if len(numeric_cols) < 2:
        return {
            "error": "Need at least 2 numeric columns for anomaly detection.",
            "anomalies": [],
            "scatter_data": []
        }

    if len(df) < 5:
         return {
            "error": "Need at least 5 rows for anomaly detection.",
            "anomalies": [],
            "scatter_data": []
        }

    # Drop rows with NaNs in the selected columns for training the model
    # (IsolationForest doesn't handle NaNs)
    df_clean = df.dropna(subset=numeric_cols).copy()

    if len(df_clean) < 5:
        return {
            "error": "Not enough rows without missing values in the selected numeric columns.",
            "anomalies": [],
            "scatter_data": []
        }

    X = df_clean[numeric_cols].values

    # Run Isolation Forest
    clf = IsolationForest(contamination=contamination, random_state=42)
    preds = clf.fit_predict(X)

    df_clean['is_anomaly'] = preds == -1

    # PCA for visualization if > 2 columns
    if len(numeric_cols) > 2:
        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X)
        df_clean['Component 1'] = X_pca[:, 0]
        df_clean['Component 2'] = X_pca[:, 1]
        x_col = 'Component 1'
        y_col = 'Component 2'
    else:
        x_col = numeric_cols[0]
        y_col = numeric_cols[1]

    # Prepare scatter plot data
    scatter_data = []
    for idx, row in df_clean.iterrows():
        scatter_data.append({
            "id": int(idx),
            "x": float(row[x_col] if len(numeric_cols) > 2 else row[numeric_cols[0]]),
            "y": float(row[y_col] if len(numeric_cols) > 2 else row[numeric_cols[1]]),
            "is_anomaly": bool(row['is_anomaly'])
        })

    # Prepare anomaly rows data
    anomaly_df = df_clean[df_clean['is_anomaly']].copy()

    anomalies = []
    for idx, row in anomaly_df.iterrows():
        row_dict = {"_index": int(idx)}
        for col in df.columns:
            val = row[col] if col in row else df.loc[idx, col]
            # convert np types to native python for json serialization
            if pd.isna(val):
                row_dict[col] = None
            elif isinstance(val, (np.int64, np.int32)):
                row_dict[col] = int(val)
            elif isinstance(val, (np.float64, np.float32)):
                row_dict[col] = float(val)
            else:
                row_dict[col] = str(val)
        anomalies.append(row_dict)

    return {
        "total_analyzed": len(df_clean),
        "anomaly_count": len(anomalies),
        "percentage": float(len(anomalies) / len(df_clean) * 100) if len(df_clean) > 0 else 0,
        "x_label": "Component 1" if len(numeric_cols) > 2 else numeric_cols[0],
        "y_label": "Component 2" if len(numeric_cols) > 2 else numeric_cols[1],
        "scatter_data": scatter_data,
        "anomalies": anomalies
    }

def apply_rename_rules(col_name: str) -> str:
    # Rule 1: snake_case
    new_name = re.sub(r'(?<!^)(?=[A-Z])', '_', col_name).lower()
    new_name = re.sub(r'[^a-zA-Z0-9]', '_', new_name)
    new_name = re.sub(r'_+', '_', new_name).strip('_')

    # Rule 2: Remove leading numbers
    new_name = re.sub(r'^\d+_', '', new_name)
    new_name = re.sub(r'^\d+', '', new_name)

    # Rule 3: Expand common abbreviations
    abbreviations = {
        r'_nm$': '_name',
        r'^nm_': 'name_',
        r'_dt$': '_date',
        r'^dt_': 'date_',
        r'_ts$': '_timestamp',
        r'_amt$': '_amount',
        r'_cnt$': '_count',
        r'_cd$': '_code',
        r'_id$': '_id',
        r'_num$': '_number',
        r'_desc$': '_description',
        r'_qty$': '_quantity',
        r'_pct$': '_percentage',
        r'_str$': '_string',
        r'_val$': '_value',
        r'_ind$': '_indicator',
        r'_flg$': '_flag'
    }

    for pattern, replacement in abbreviations.items():
        new_name = re.sub(pattern, replacement, new_name)

    # Remove obvious single letter prefixes like 'c_name' -> 'name' if not c_id
    if re.match(r'^[a-z]_', new_name) and not new_name.endswith('_id'):
         new_name = new_name[2:]

    if not new_name:
        new_name = "column"

    return new_name

def get_rename_suggestions(df: pd.DataFrame) -> list:
    suggestions = []

    for col in df.columns:
        suggested = apply_rename_rules(col)

        # Avoid duplicate suggestions
        base_suggested = suggested
        counter = 1
        existing_suggestions = [s['suggested'] for s in suggestions]
        while suggested in existing_suggestions or (suggested in df.columns and suggested != col):
             suggested = f"{base_suggested}_{counter}"
             counter += 1

        suggestions.append({
            "original": col,
            "suggested": suggested,
            "accepted": suggested != col # Only check by default if it actually changed
        })

    return suggestions
