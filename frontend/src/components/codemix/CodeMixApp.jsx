import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, ServerCrash, CheckCircle2 } from 'lucide-react';
import SingleTextAnalysis from './SingleTextAnalysis';
import BatchAnalysis from './BatchAnalysis';

const NLP_API_URL = 'http://localhost:5000';
const BACKEND_API_URL = 'http://localhost:8000'; // For file parsing if needed

export default function CodeMixApp() {
  const [apiStatus, setApiStatus] = useState('checking'); // checking, online, offline
  const [activeTab, setActiveTab] = useState('single'); // single, batch

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      await axios.get(`${NLP_API_URL}/health`, { timeout: 3000 });
      setApiStatus('online');
    } catch (err) {
      setApiStatus('offline');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-slate-700 shadow-sm">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Single Text Analysis
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'batch' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Batch CSV Analysis
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={checkApiStatus} className="text-xs text-slate-400 hover:text-white flex items-center">
             <Activity className="w-3 h-3 mr-1" /> Refresh
          </button>
          {apiStatus === 'checking' && (
            <span className="flex items-center text-slate-400 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse mr-2"></span> Checking API...
            </span>
          )}
          {apiStatus === 'online' && (
            <span className="flex items-center text-success text-sm font-medium bg-success/10 px-3 py-1 rounded-full border border-success/30">
              <span className="w-2.5 h-2.5 rounded-full bg-success mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> API Connected
            </span>
          )}
          {apiStatus === 'offline' && (
            <span className="flex items-center text-danger text-sm font-medium bg-danger/10 px-3 py-1 rounded-full border border-danger/30">
              <span className="w-2.5 h-2.5 rounded-full bg-danger mr-2 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> API Offline
            </span>
          )}
        </div>
      </div>

      {apiStatus === 'offline' && (
        <div className="bg-danger/10 border-l-4 border-danger p-6 rounded-r-xl flex items-start">
          <ServerCrash className="w-8 h-8 text-danger mr-4 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-danger mb-1">Flask API is not running</h3>
            <p className="text-slate-300 mb-2">The Code-Mix NLP Suite requires the local Python API to be running on port 5000.</p>
            <div className="bg-slate-900 p-3 rounded text-sm font-mono text-slate-300 inline-block border border-slate-700">
              python unified_api.py
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`transition-opacity duration-300 ${apiStatus !== 'online' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {activeTab === 'single' ? (
          <SingleTextAnalysis apiUrl={NLP_API_URL} />
        ) : (
          <BatchAnalysis apiUrl={NLP_API_URL} backendUrl={BACKEND_API_URL} />
        )}
      </div>
    </div>
  );
}
