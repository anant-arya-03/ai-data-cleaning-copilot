import React, { useState } from 'react';
import axios from 'axios';
import { ChevronRight, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

export default function Step4FlashFill({ apiUrl, onContinue, colTypes, setColTypes }) {
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
      // We don't fetch colTypes here since backend doesn't return full types object in this endpoint easily,
      // but parent can trigger a refresh if needed, or we just trust the new column is text/numeric.
    } catch (err) {
      setError("Failed to apply transformation.");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">4</span>
          Intelligent FlashFill
        </h3>
        <button
          onClick={onContinue}
          className="flex items-center bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Continue to Anomalies <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <p className="text-slate-400 mb-6">Select a column to generate automatic rule-based transformations. A new column will be created; your original data remains untouched.</p>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <select
            value={selectedCol}
            onChange={(e) => { setSelectedCol(e.target.value); setSuggestions([]); setApplyResult(null); setError(''); }}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Select a column to analyze --</option>
            {colTypes && Object.keys(colTypes).map(c => (
              <option key={c} value={c}>{c} ({colTypes[c].type})</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!selectedCol || loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition flex items-center justify-center min-w-[200px]"
        >
          {loading ? 'Analyzing...' : <><Zap className="w-4 h-4 mr-2" /> Analyze & Suggest</>}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/20 border border-danger text-danger rounded-lg flex items-start">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {applyResult && (
        <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg flex items-start animate-in fade-in zoom-in duration-300">
          <CheckCircle className="w-6 h-6 text-success mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-success mb-1">Transformation Applied Successfully!</h4>
            <p className="text-sm text-slate-300">New column created: <span className="font-mono bg-slate-900 px-1 rounded text-primary">{applyResult.new_column}</span></p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-emerald-400 font-medium">{applyResult.success_count} succeeded</span>
              <span className="text-rose-400 font-medium">{applyResult.fail_count} skipped (set to null)</span>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && !applyResult && (
        <div className="space-y-4">
          <h4 className="font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2">Top Suggestions</h4>
          <div className="grid grid-cols-1 gap-4">
            {suggestions.map((sug, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-500 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h5 className="font-bold text-white text-lg">{sug.name}</h5>
                    <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-1 rounded font-medium">
                      {sug.confidence}% Match
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">
                    <span className="mb-1 block">Preview (first 5 rows):</span>
                    <div className="flex flex-wrap gap-2">
                      {sug.preview.map((val, i) => (
                        <span key={i} className="bg-slate-900 px-2 py-1 rounded border border-slate-700 font-mono text-xs max-w-[150px] truncate" title={String(val)}>
                          {val === null || val === undefined ? 'null' : String(val)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleApply(sug.id)}
                  disabled={applyLoading}
                  className="bg-slate-700 hover:bg-primary text-white px-6 py-2 rounded-lg font-medium transition whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
