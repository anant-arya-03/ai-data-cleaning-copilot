// Use VITE_API_URL environment variable if provided (e.g., pointing to Render)
// Otherwise, fall back to /api in production (if using Vercel rewrites) or localhost for dev.
export const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api');

export const NLP_API_URL = `${API_URL}/nlp`;
