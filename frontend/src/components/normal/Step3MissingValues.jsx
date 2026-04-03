import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Settings, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { cn } from '../../utils';

const ALLOWED_STRATEGIES = {
  numeric: ['mean', 'median', 'mode', 'fixed', 'drop', 'interpolate', 'ffill', 'bfill'],
  categorical: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  text: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  email: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  phone: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  url: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  id: ['mode', 'fixed', 'drop', 'ffill', 'bfill'],
  boolean: ['mode', 'fixed', 'drop'],
  datetime: ['ffill', 'bfill', 'fixed', 'drop']
};

const STRATEGY_LABELS = {
  mean: "Mean",
  median: "Median",
  mode: "Mode (Most frequent)",
  fixed: "Fixed Value",
  drop: "Drop Rows",
  interpolate: "Interpolate",
  ffill: "Forward Fill",
  bfill: "Backward Fill"
};

export default function Step3MissingValues({ apiUrl, colTypes, profileData, setProfileData, onRefreshPreview }) {
  const [selectedCol, setSelectedCol] = useState('');
  const [strategy, setStrategy] = useState('');
  const [fixedValue, setFixedValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const missingColumns = useMemo(() => {
    if (!profileData) return [];
    return profileData.columns.filter(c => c.missing_count > 0).sort((a, b) => b.missing_count - a.missing_count);
  }, [profileData]);

  const activeColType = selectedCol && colTypes ? colTypes[selectedCol]?.type : null;

  const availableStrategies = useMemo(() => {
    if (!activeColType) return [];
    return ALLOWED_STRATEGIES[activeColType] || ALLOWED_STRATEGIES['text'];
  }, [activeColType]);

  const handleApply = async () => {
    if (!selectedCol || !strategy) return;
    if (strategy === 'fixed' && fixedValue === '') {
      setError("Please enter a fixed value.");
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(`${apiUrl}/missing_strategy`, {
        column: selectedCol,
        strategy: strategy,
        value: strategy === 'fixed' ? fixedValue : null
      });

      setResult({
        col: selectedCol,
        ...res.data
      });

      setSelectedCol('');
      setStrategy('');
      setFixedValue('');

      const profRes = await axios.get(`${apiUrl}/profile`);
      setProfileData(profRes.data);
      onRefreshPreview(); // Refresh the main table

    } catch (err) {
      setError(err.response?.data?.detail || "Failed to apply strategy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-panel">
         <h3 className="card-title text-slate-800">
           <Database className="w-5 h-5 mr-2 text-indigo-500" />
           Columns Needing Attention
         </h3>

         {missingColumns.length === 0 ? (
           <div className="text-center py-8 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm">
             <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
             <p className="font-bold">All clean!</p>
             <p className="text-sm">No missing values found in the dataset.</p>
           </div>
         ) : (
           <div className="space-y-2">
             {missingColumns.map(c => (
               <div
                 key={c.name}
                 onClick={() => { setSelectedCol(c.name); setStrategy(''); setResult(null); setError(''); }}
                 className={cn("p-3 rounded-lg border cursor-pointer transition shadow-sm", selectedCol === c.name ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500" : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md")}
               >
                 <div className="flex justify-between items-center mb-1">
                   <span className={cn("font-bold truncate mr-2", selectedCol === c.name ? "text-indigo-700" : "text-slate-700")}>{c.name}</span>
                   <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full font-bold uppercase text-slate-500">{colTypes[c.name]?.type || 'unknown'}</span>
                 </div>
                 <div className="text-sm font-medium text-rose-500 bg-rose-50 inline-block px-2 rounded">
                   {c.missing_count.toLocaleString()} NULL ({c.missing_percent.toFixed(1)}%)
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {selectedCol && (
        <div className="card-panel animate-in fade-in slide-in-from-bottom-2">
           <h3 className="card-title text-slate-800">
             <Settings className="w-5 h-5 mr-2 text-indigo-500" />
             Apply Strategy
           </h3>

           <div className="space-y-4">
             <div>
               <label className="block text-sm font-bold text-slate-600 mb-1">Strategy for {selectedCol} ({activeColType})</label>
               <select
                 value={strategy}
                 onChange={(e) => setStrategy(e.target.value)}
                 className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
               >
                 <option value="">-- Select a strategy --</option>
                 {availableStrategies.map(s => (
                   <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                 ))}
               </select>
             </div>

             {strategy === 'fixed' && (
               <div>
                 <label className="block text-sm font-bold text-slate-600 mb-1">Fixed Value</label>
                 <input
                   type={activeColType === 'numeric' ? 'number' : 'text'}
                   value={fixedValue}
                   onChange={(e) => setFixedValue(e.target.value)}
                   placeholder="Enter value..."
                   className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                 />
               </div>
             )}

             <button
               onClick={handleApply}
               disabled={loading || !strategy}
               className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold transition shadow-sm shadow-indigo-600/30"
             >
               {loading ? 'Processing...' : 'Apply Strategy'}
             </button>

             {error && (
               <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start text-sm shadow-sm font-medium">
                 <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 text-rose-500" />
                 <span>{error}</span>
               </div>
             )}
           </div>
        </div>
      )}

      {result && (
        <div className="card-panel bg-emerald-50 border-emerald-200 animate-in fade-in zoom-in duration-300">
           <div className="flex items-center text-emerald-700 mb-3">
             <CheckCircle className="w-5 h-5 mr-2" />
             <h4 className="font-bold text-lg">Applied to {result.col}</h4>
           </div>

           <div className="grid grid-cols-3 gap-3 mb-4 text-center">
             <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
               <div className="text-xl font-bold text-slate-700">{result.rows_affected}</div>
               <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Updated</div>
             </div>
             <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
               <div className="text-xl font-bold text-rose-500">{result.before}</div>
               <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Before</div>
             </div>
             <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
               <div className="text-xl font-bold text-emerald-600">{result.after}</div>
               <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Remaining</div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
