# AI Data Cleaning Copilot + Code-Mix NLP Suite

A production-grade, two-mode web application for advanced data cleaning and NLP analysis.

## Setup Instructions

### 1. Start the Backend
`cd /app/backend`
`pip install -r requirements.txt`
`uvicorn main:app --reload --port 8000`
*The backend will automatically load the NLP models directly via models1.py.*

### 2. Start the Frontend
Open another terminal:
`cd /app/frontend`
`npm install`
`npm run dev`

### Switching Modes
Use the toggle at the top of the app to switch between:
- Normal Data Cleaning
- Code-Mix NLP Analysis

## Deployment to Render

This repository includes a `render.yaml` Blueprint file, making it easy to deploy on [Render.com](https://render.com).

1. Create a Render account and connect your GitHub repository.
2. In the Render dashboard, click **New+** -> **Blueprint**.
3. Select this repository.
4. Render will automatically detect the backend (FastAPI) and frontend (React/Vite static site) from the `render.yaml` file.
5. Click **Apply** to deploy both services simultaneously. Render will automatically link the frontend to the deployed backend URL.
