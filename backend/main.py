from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import json

from cleaner import detect_column_types, generate_profile, apply_missing_strategy
from flashfill import get_suggestions, apply_transformation
from anomaly import detect_anomalies, get_rename_suggestions
from models1 import load_models, smart_predict, predict_batch, predict_misinfo, predict_fakenews, predict_emosen, predict_all, analyse_text

app = FastAPI(title="AI Data Cleaning Copilot Backend")

# Initialize models at startup
app.state.nlp_models = None

@app.on_event("startup")
def startup_event():
    # Attempt to load models, but don't crash if paths don't exist yet
    try:
        app.state.nlp_models = load_models()
    except Exception as e:
        print(f"Warning: Could not initialize all NLP models on startup: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for the current dataset and state
# (In a real production app with multiple users, use Redis or a DB. We use memory as per requirements.)
current_state = {
    "df": None,
    "col_types": None,
    "filename": None,
}

class ColumnTypeOverride(BaseModel):
    column: str
    new_type: str

class MissingValueRequest(BaseModel):
    column: str
    strategy: str
    value: Optional[str] = None

class FlashFillSuggestRequest(BaseModel):
    column: str

class FlashFillApplyRequest(BaseModel):
    column: str
    transform_id: str

class AnomalyRequest(BaseModel):
    contamination: float

class AnomalyActionRequest(BaseModel):
    action: str # "remove" or "flag"
    indices: List[int]

class RenameApplyRequest(BaseModel):
    renames: Dict[str, str] # {original: new_name}

class NlpRequest(BaseModel):
    text: str

class NlpBatchRequest(BaseModel):
    texts: List[str]

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/nlp/health")
def nlp_health():
    if app.state.nlp_models is None:
         return {"status": "offline", "message": "Models not loaded"}
    return {"status": "online"}

@app.post("/nlp/predict/{model_type}")
def nlp_predict(model_type: str, req: NlpRequest):
    if app.state.nlp_models is None:
        # Load them on demand if failed on startup
        app.state.nlp_models = load_models()

    text = req.text
    models = app.state.nlp_models

    if model_type == "misinfo":
        return predict_misinfo(text, models)
    elif model_type == "fakenews":
        return predict_fakenews(text, models)
    elif model_type == "emosen":
        return predict_emosen(text, models)
    elif model_type == "all":
        return predict_all(text, models)
    elif model_type == "smart":
        return smart_predict(text, models)
    elif model_type == "text":
        return {"text_analysis": analyse_text(text)}
    else:
        raise HTTPException(status_code=400, detail="Unknown model type")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 200MB)")

    try:
        # Check for empty file
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        # Parse CSV
        df = pd.read_csv(io.BytesIO(content))

        if len(df) == 0:
             raise HTTPException(status_code=400, detail="File has no rows")

        # Handle duplicate column names
        if len(df.columns) != len(set(df.columns)):
             cols=pd.Series(df.columns)
             for dup in cols[cols.duplicated()].unique():
                 cols[cols[cols == dup].index.values.tolist()] = [dup + '_' + str(i) if i != 0 else dup for i in range(sum(cols == dup))]
             df.columns = cols

        current_state["df"] = df
        current_state["filename"] = file.filename
        current_state["col_types"] = detect_column_types(df)

        preview = df.head(10).fillna("").to_dict(orient="records")

        return {
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "preview": preview,
            "col_types": current_state["col_types"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/override_type")
def override_type(req: ColumnTypeOverride):
    if current_state["df"] is None:
        raise HTTPException(status_code=400, detail="No dataset loaded")
    if req.column not in current_state["col_types"]:
        raise HTTPException(status_code=400, detail="Column not found")

    current_state["col_types"][req.column]["type"] = req.new_type
    return {"status": "success", "col_types": current_state["col_types"]}

@app.get("/profile")
def get_profile():
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    return generate_profile(current_state["df"], current_state["col_types"])

@app.get("/duplicates")
def get_duplicates():
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    df = current_state["df"]
    dups = df[df.duplicated(keep=False)]
    return {
        "count": len(df[df.duplicated()]),
        "rows": dups.fillna("").head(50).to_dict(orient="records") # Limit to 50 for preview
    }

@app.post("/remove_duplicates")
def remove_duplicates():
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    df = current_state["df"]
    before = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    current_state["df"] = df
    after = len(df)
    return {"removed": before - after}

@app.post("/missing_strategy")
def apply_missing(req: MissingValueRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    try:
        res = apply_missing_strategy(current_state["df"], req.column, req.strategy, req.value, current_state["col_types"])
        current_state["df"] = res["df"]
        return {
            "rows_affected": res["rows_affected"],
            "before": res["before_missing"],
            "after": res["after_missing"],
            "preview": current_state["df"][[req.column]].head(10).fillna("").to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/flashfill/suggest")
def flashfill_suggest(req: FlashFillSuggestRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    if req.column not in current_state["col_types"]:
         raise HTTPException(status_code=400, detail="Column not found")

    c_type = current_state["col_types"][req.column]["type"]
    suggestions = get_suggestions(current_state["df"], req.column, c_type)
    return {"suggestions": suggestions}

@app.post("/flashfill/apply")
def flashfill_apply(req: FlashFillApplyRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    try:
        res = apply_transformation(current_state["df"], req.column, req.transform_id)
        current_state["df"] = res["df"]

        # update col_types for new column
        current_state["col_types"] = detect_column_types(current_state["df"])

        return {
            "new_column": res["new_column"],
            "success_count": res["success_count"],
            "fail_count": res["fail_count"]
        }
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))

@app.post("/anomalies/detect")
def anomalies_detect(req: AnomalyRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")

    df = current_state["df"]
    # Get numeric cols that actually have numeric dtype
    numeric_cols = [c for c, t in current_state["col_types"].items() if t["type"] == "numeric" and pd.api.types.is_numeric_dtype(df[c])]

    res = detect_anomalies(df, numeric_cols, req.contamination)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])

    return res

@app.post("/anomalies/action")
def anomalies_action(req: AnomalyActionRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")

    df = current_state["df"]

    if req.action == "remove":
        df = df.drop(index=req.indices).reset_index(drop=True)
    elif req.action == "flag":
        df['is_anomaly'] = False
        df.loc[req.indices, 'is_anomaly'] = True

    current_state["df"] = df
    current_state["col_types"] = detect_column_types(df)
    return {"status": "success"}

@app.get("/rename/suggest")
def rename_suggest():
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")
    return {"suggestions": get_rename_suggestions(current_state["df"])}

@app.post("/rename/apply")
def rename_apply(req: RenameApplyRequest):
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")

    current_state["df"] = current_state["df"].rename(columns=req.renames)
    current_state["col_types"] = detect_column_types(current_state["df"])
    return {"status": "success", "new_columns": list(current_state["df"].columns)}

@app.get("/export/data")
def export_data():
    if current_state["df"] is None:
         raise HTTPException(status_code=400, detail="No dataset loaded")

    df = current_state["df"]

    # We can return JSON here and let frontend handle CSV/Excel via libraries like Papaparse/SheetJS
    # This is often easier for completely self-contained browser downloads

    # Need to handle NaN/Inf for JSON serialization
    df_clean = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    # Convert datetime to string
    for col in df_clean.select_dtypes(include=['datetime64', 'datetimetz']).columns:
         df_clean[col] = df_clean[col].astype(str).replace({'NaT': None})

    return {
        "filename": f"cleaned_{current_state['filename']}",
        "data": df_clean.to_dict(orient="records"),
        "columns": list(df_clean.columns)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
