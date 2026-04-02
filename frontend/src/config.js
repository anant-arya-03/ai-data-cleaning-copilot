// Vercel deployment handles routing under /api.
// During local dev, Vercel CLI (vercel dev) handles this rewrite.
// If running manually (uvicorn + vite), fall back to the uvicorn port + /api prefix.
export const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';
export const NLP_API_URL = `${API_URL}/nlp`;
