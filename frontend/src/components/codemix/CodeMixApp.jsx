import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, ServerCrash, Globe } from 'lucide-react';
import SingleTextAnalysis from './SingleTextAnalysis';
import BatchAnalysis from './BatchAnalysis';
import { cn } from '../../utils';
import { NLP_API_URL, API_URL } from '../../config';

export default function CodeMixApp() {
  const [apiStatus, setApiStatus] = useState('checking'); // checking, online, offline
  const [activeTab, setActiveTab] = useState('single'); // single, batch

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const res = await axios.get(`${NLP_API_URL}/health`, { timeout: 3000 });
      setApiStatus(res.data.status);
    } catch (err) {
      setApiStatus('offline');
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-160px)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-card">
        <div className="flex space-x-2 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('single')}
            className={cn("px-5 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'single' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}
          >
            Single Text Analysis
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={cn("px-5 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'batch' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}
          >
            Batch CSV Analysis
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={checkApiStatus} className="text-xs text-slate-500 hover:text-indigo-600 font-semibold flex items-center transition-colors">
             <Activity className="w-4 h-4 mr-1.5" /> Refresh Models
          </button>

          <div className={cn(
             "flex items-center text-sm font-bold px-3 py-1.5 rounded-full border shadow-sm",
             apiStatus === 'online' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
             apiStatus === 'checking' ? "bg-slate-100 text-slate-600 border-slate-300" :
             "bg-rose-50 text-rose-700 border-rose-200"
          )}>
             {apiStatus === 'online' && <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>}
             {apiStatus === 'checking' && <span className="w-2 h-2 rounded-full bg-slate-400 mr-2"></span>}
             {apiStatus === 'offline' && <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>}
             {apiStatus === 'online' ? 'Models Loaded' : apiStatus === 'checking' ? 'Checking...' : 'Models Offline'}
          </div>
        </div>
      </div>

      {apiStatus === 'offline' && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl flex items-start shadow-sm">
          <ServerCrash className="w-8 h-8 text-rose-500 mr-4 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-rose-800 mb-1">NLP Models Not Loaded</h3>
            <p className="text-rose-600 mb-2 font-medium">The NLP models failed to load. Please ensure paths in <code>models1.py</code> are correct and models are downloaded.</p>
          </div>
        </div>
      )}

      {/* Main Content Area - Fill height */}
      <div className={cn("flex-1 min-h-0 transition-opacity duration-300", apiStatus !== 'online' ? 'opacity-50 pointer-events-none' : 'opacity-100')}>
        {activeTab === 'single' ? (
          <SingleTextAnalysis apiUrl={NLP_API_URL} />
        ) : (
            <BatchAnalysis />
        )}
      </div>
    </div>
  );
}
