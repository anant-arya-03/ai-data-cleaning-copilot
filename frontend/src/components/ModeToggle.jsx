import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils';
import { Sparkles, Globe } from 'lucide-react';

export default function ModeToggle({ activeMode, onChange }) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 shadow-inner relative">
        {/* Animated background pill */}
        <motion.div
          className="absolute h-full rounded-lg bg-slate-800"
          layoutId="activeTabPill"
          initial={false}
          animate={{
            x: activeMode === 'normal' ? 0 : '100%',
            backgroundColor: activeMode === 'normal' ? '#0ea5e9' : '#4f46e5',
            width: '50%'
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ originX: 0 }}
        />

        <button
          onClick={() => onChange('normal')}
          className={cn(
            "relative flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors w-64 z-10",
            activeMode === 'normal' ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Sparkles className="w-5 h-5" />
          <span>Normal Data Cleaning</span>
        </button>

        <button
          onClick={() => onChange('codemix')}
          className={cn(
            "relative flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors w-64 z-10",
            activeMode === 'codemix' ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Globe className="w-5 h-5" />
          <span>Code-Mix NLP Analysis</span>
        </button>
      </div>

      <p className="text-sm text-slate-400 h-5 transition-opacity duration-300">
        {activeMode === 'normal'
          ? "Advanced CSV data cleaning with automated type detection and transformations."
          : "Upload a CSV with text columns and run NLP analysis using pre-trained models."}
      </p>
    </div>
  );
}
