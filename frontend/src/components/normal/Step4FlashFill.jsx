import React, { useState } from 'react';
import axios from 'axios';
import { Zap, CheckCircle, AlertTriangle, Wand2 } from 'lucide-react';
import { cn } from '../../utils';

export default function Step4FlashFill({ apiUrl, colTypes, setColTypes }) {
  const [selectedCol, setSelectedCol] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedCol) return;
    setLoading(true);
    setError('');
    setSuggestions([]);
    setApplyResult(null);

    try {
      const res = await axios.post(`${apiUrl}/flashfill/suggest`, { column: selectedCol });
      setSuggestions(res.data.suggestions);
      if (res.data.suggestions.length === 0) {
        setError("No suitable transformations found for this column.");
      }
    } catch (err) {
      setError("Failed to generate suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (transformId) => {
    setApplyLoading(true);
    setError('');

    try {
      const res = await axios.post(`${apiUrl}/flashfill/apply`, {
        column: selectedCol,
        transform_id: transformId
      });
      setApplyResult(res.data);
      // Let the main layout update its preview
    } catch (err) {
      setError("Failed to apply transformation.");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="card-panel">
        <h3 className="card-title text-slate-800">
          <Wand2 className="w-5 h-5 mr-2 text-indigo-500" />
          Intelligent FlashFill
        </h3>

        <p className="text-sm text-slate-500 mb-6 font-medium">Select a column to generate automatic rule-based transformations. A new column will be appended to your data table.</p>

        <div className="flex flex-col gap-4 mb-6">
          <select
            value={selectedCol}
            onChange={(e) => { setSelectedCol(e.target.value); setSuggestions([]); setApplyResult(null); setError(''); }}
            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium"
          >
            <option value="">-- Select a column --</option>
            {colTypes && Object.keys(colTypes).map(c => (
              <option key={c} value={c}>{c} ({colTypes[c].type})</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={!selectedCol || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition shadow-sm shadow-indigo-600/30 flex items-center justify-center"
          >
            {loading ? 'Analyzing...' : <><Zap className="w-4 h-4 mr-2 fill-current" /> Get Top Suggestions</>}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start text-sm shadow-sm font-medium">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {applyResult && (
        <div className="card-panel bg-emerald-50 border-emerald-200 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center mb-3">
             <CheckCircle className="w-6 h-6 text-emerald-600 mr-2 flex-shrink-0" />
             <h4 className="font-bold text-emerald-800 text-lg">Transformation Applied</h4>
          </div>
          <p className="text-sm font-medium text-emerald-700 mb-3">New column created: <span className="font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 ml-1">{applyResult.new_column}</span></p>
          <div className="flex gap-2">
            <span className="bg-white border border-emerald-200 text-emerald-600 font-bold px-3 py-1.5 rounded-lg text-sm shadow-sm">
              {applyResult.success_count} Succeeded
            </span>
            <span className="bg-white border border-rose-200 text-rose-500 font-bold px-3 py-1.5 rounded-lg text-sm shadow-sm">
              {applyResult.fail_count} Failed (NULL)
            </span>
          </div>
        </div>
      )}

      {suggestions.length > 0 && !applyResult && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in">
          <h4 className="font-bold text-slate-700 uppercase tracking-wide text-xs">Top Suggestions</h4>

          <div className="grid grid-cols-1 gap-4">
            {suggestions.map((sug, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="font-bold text-slate-800 text-md">{sug.name}</h5>
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded-full font-bold border border-indigo-100 shadow-sm whitespace-nowrap">
                    {sug.confidence}% Match
                  </span>
                </div>

                <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="mb-2 block font-semibold text-slate-600">Preview:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sug.preview.map((val, i) => (
                      <span key={i} className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[10px] text-slate-600 max-w-[120px] truncate shadow-sm" title={String(val)}>
                        {val === null || val === undefined ? 'null' : String(val)}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleApply(sug.id)}
                  disabled={applyLoading}
                  className="w-full bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white border border-slate-200 hover:border-indigo-600 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm mt-auto"
                >
                  Apply to Dataset
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
