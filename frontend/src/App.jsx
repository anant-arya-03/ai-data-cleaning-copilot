import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModeToggle from './components/ModeToggle';
import NormalModeApp from './components/normal/NormalModeApp';
import CodeMixApp from './components/codemix/CodeMixApp';
import { cn } from './utils';

function App() {
  const [mode, setMode] = useState('normal'); // 'normal' or 'codemix'

  return (
    <div className="min-h-screen bg-background text-slate-800 font-sans selection:bg-primary selection:text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center space-y-4">
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">
            AI Data Cleaning Copilot
          </h1>
          <ModeToggle activeMode={mode} onChange={setMode} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-4 mt-6">
        <AnimatePresence mode="wait">
          {mode === 'normal' ? (
            <motion.div
              key="normal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <NormalModeApp />
            </motion.div>
          ) : (
            <motion.div
              key="codemix"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CodeMixApp />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
