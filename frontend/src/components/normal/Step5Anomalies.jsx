import React, { useState } from 'react';
import axios from 'axios';
import { Target, AlertTriangle, Trash2, Flag, Activity } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Step5Anomalies({ apiUrl, colTypes, setDatasetInfo }) {
  const [contamination, setContamination] = useState(0.05);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const numericCols = colTypes ? Object.keys(colTypes).filter(c => colTypes[c].type === 'numeric') : [];

  const handleDetect = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(`${apiUrl}/anomalies/detect`, { contamination });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to run anomaly detection.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (!result || !result.anomalies.length) return;

    if (action === 'remove' && !window.confirm(`Are you sure you want to remove ${result.anomaly_count} anomalous rows?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const indices = result.anomalies.map(a => a._index);
      await axios.post(`${apiUrl}/anomalies/action`, { action, indices });

      if (action === 'remove') {
         setDatasetInfo(prev => ({...prev, rows: prev.rows - result.anomaly_count}));
      }

      alert(action === 'remove' ? 'Anomalies removed successfully.' : 'Anomalies flagged successfully. A new column is_anomaly has been created.');
      setResult(null);
    } catch (err) {
      alert("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="card-panel">
        <h3 className="card-title text-slate-800">
          <Activity className="w-5 h-5 mr-2 text-indigo-500" />
          Anomaly Detection
        </h3>

        <p className="text-sm text-slate-500 mb-6 font-medium">Uses Scikit-Learn's IsolationForest on numeric columns to detect outliers.</p>

        {numericCols.length < 2 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg flex items-center shadow-sm">
             <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
             <span className="font-bold text-sm">Need at least 2 numeric columns for anomaly detection. Found: {numericCols.length}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 flex justify-between">
                <span>Contamination (Expected %)</span>
                <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">{(contamination * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.01" max="0.20" step="0.01"
                value={contamination}
                onChange={(e) => setContamination(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-colors"
              />
            </div>
            <button
              onClick={handleDetect}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold transition shadow-sm flex justify-center items-center"
            >
              {loading ? 'Detecting...' : <><Target className="w-4 h-4 mr-2 fill-current" /> Run Detection</>}
            </button>
            <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 text-center font-medium">
               Analyzing {numericCols.length} columns: {numericCols.slice(0, 5).join(', ')}{numericCols.length > 5 ? '...' : ''}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start text-sm shadow-sm font-medium">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in">

          <div className="card-panel border-l-4 border-l-indigo-500 py-4 px-5">
            <h4 className="text-lg font-bold text-slate-800">Detection Complete</h4>
            <p className="text-slate-600 mt-1 font-medium">
              Found <span className="text-rose-500 font-bold text-lg">{result.anomaly_count}</span> anomalies
              out of {result.total_analyzed} valid rows ({result.percentage.toFixed(2)}%).
            </p>
          </div>

          <div className="card-panel h-64 p-3">
             <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wide mb-2 px-2">Anomaly Scatter Plot (PCA reduced if &gt;2 cols)</h4>
             <ResponsiveContainer width="100%" height="90%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="x" name={result.x_label} stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis type="number" dataKey="y" name={result.y_label} stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                  <Scatter name="Data" data={result.scatter_data}>
                    {result.scatter_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.is_anomaly ? '#ef4444' : '#6366f1'} fillOpacity={entry.is_anomaly ? 1 : 0.6} />
                    ))}
                  </Scatter>
                </ScatterChart>
             </ResponsiveContainer>
          </div>

          {result.anomaly_count > 0 && (
             <div className="flex gap-3">
                <button onClick={() => handleAction('flag')} disabled={actionLoading} className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-sm shadow-sm transition flex items-center justify-center">
                   <Flag className="w-4 h-4 mr-2"/> Flag Rows
                </button>
                <button onClick={() => handleAction('remove')} disabled={actionLoading} className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-sm shadow-sm transition flex items-center justify-center">
                   <Trash2 className="w-4 h-4 mr-2"/> Remove Rows
                </button>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
