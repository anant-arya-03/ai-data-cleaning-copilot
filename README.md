# AI Data Cleaning Copilot + Code-Mix NLP Suite

A production-grade, two-mode web application for advanced data cleaning and NLP analysis.

## Setup Instructions

### 1. Start the NLP Model API
`cd /app`
`python unified_api.py`

*Wait for "Model ready" messages for all 3 models. API runs on http://localhost:5000.*

### 2. Start the Backend
Open a new terminal:
`cd /app/backend`
`pip install -r requirements.txt`
`uvicorn main:app --reload --port 8000`

### 3. Start the Frontend
Open another terminal:
`cd /app/frontend`
`npm install`
Run the dev script (e.g. via vite directly or package json).

### Switching Modes
Use the toggle at the top of the app to switch between:
- Normal Data Cleaning (no API needed)
- Code-Mix NLP Analysis (requires unified_api.py running)
