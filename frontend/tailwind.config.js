/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc", // slate-50 (light clean background)
        surface: "#ffffff",
        primary: "#4f46e5", // Indigo-600
        primaryHover: "#4338ca", // Indigo-700
        success: "#10b981", // Emerald-500
        danger: "#ef4444", // Rose-500
        warning: "#f59e0b", // Amber-500
        textMain: "#1e293b", // Slate-800
        textMuted: "#64748b", // Slate-500
        borderMain: "#e2e8f0", // Slate-200
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
