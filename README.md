# AI Data Cleaning Copilot + Code-Mix NLP Suite

A production-grade, two-mode web application for advanced data cleaning and NLP analysis.

## Setup Instructions

### 1. Start the Backend
`cd /app/api`
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

## Deployment to Vercel

This repository includes a `vercel.json` file for easy deployment on [Vercel](https://vercel.com).

1. Create a Vercel account and connect your GitHub repository.
2. Import the repository into Vercel.
3. Vercel will automatically detect the Vite frontend and the Python Serverless Functions in the `/api` directory.
4. Click **Deploy**.

> **⚠️ CRITICAL WARNING FOR VERCEL DEPLOYMENT:**
> This application uses `torch`, `transformers`, and large pre-trained NLP models.
> Vercel's **Hobby (Free) Tier** has a strict **250MB limit** for serverless function sizes.
> The PyTorch library alone exceeds this limit.
> To deploy this project successfully on Vercel, you will either need a **Vercel Pro/Enterprise plan** with increased limits, OR you must host the ML models separately (e.g., on a dedicated GPU VPS or AWS) and have Vercel simply call out to that API.
