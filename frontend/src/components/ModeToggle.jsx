import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils';
import { Leaf, Globe } from 'lucide-react';

export default function ModeToggle({ activeMode, onChange }) {
  return (
    <div className="flex flex-col items-center space-y-2 mb-6">
      <div className="flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner relative">
        {/* Animated background pill */}
        <motion.div
          className="absolute h-full rounded-full bg-white shadow-md border border-slate-200"
          layoutId="activeTabPillLight"
          initial={false}
          animate={{
            x: activeMode === 'normal' ? 0 : '100%',
            width: '50%'
          }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          style={{ originX: 0 }}
        />

        <button
          onClick={() => onChange('normal')}
          className={cn(
            "relative flex items-center justify-center space-x-2 px-8 py-2.5 rounded-full font-medium transition-colors w-56 z-10 text-sm",
            activeMode === 'normal' ? "text-primary font-bold" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Leaf className="w-4 h-4" />
          <span>Data Cleaning</span>
        </button>

        <button
          onClick={() => onChange('codemix')}
          className={cn(
            "relative flex items-center justify-center space-x-2 px-8 py-2.5 rounded-full font-medium transition-colors w-56 z-10 text-sm",
            activeMode === 'codemix' ? "text-primary font-bold" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Globe className="w-4 h-4" />
          <span>Code-Mix NLP</span>
        </button>
      </div>

      <p className="text-sm text-slate-500 h-5 transition-opacity duration-300">
        {activeMode === 'normal'
          ? "Powered by AI Data Cleaning Copilot. Clean, transform, and export."
          : "Powered by custom Code-Mix models. Auto-route classification & sentiment."}
      </p>
    </div>
  );
}
