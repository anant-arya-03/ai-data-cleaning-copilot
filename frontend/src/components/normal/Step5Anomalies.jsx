import React, { useState } from 'react';
import axios from 'axios';
import { ChevronRight, Target, AlertTriangle, Trash2, Flag, Download } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Step5Anomalies({ apiUrl, onContinue, colTypes, setDatasetInfo }) {
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
      setResult(null); // Clear results after action
    } catch (err) {
      alert("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">5</span>
          Anomaly Detection
        </h3>
        <button
          onClick={onContinue}
          className="flex items-center bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Continue to Export <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="mb-6 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <p className="text-slate-300 text-sm mb-4">
          Uses Scikit-Learn's <span className="font-mono text-primary">IsolationForest</span> on numeric columns to detect outliers.
        </p>

        {numericCols.length < 2 ? (
          <div className="p-4 bg-warning/20 border border-warning text-warning rounded-lg flex items-center">
             <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
             <span>Need at least 2 numeric columns for anomaly detection. Found: {numericCols.length}</span>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-400 mb-2 flex justify-between">
                <span>Contamination (Expected % of anomalies)</span>
                <span className="text-primary font-bold">{(contamination * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0.01" max="0.20" step="0.01"
                value={contamination}
                onChange={(e) => setContamination(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <button
              onClick={handleDetect}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition flex items-center whitespace-nowrap min-w-[160px] justify-center"
            >
              {loading ? 'Detecting...' : <><Target className="w-4 h-4 mr-2" /> Run Detection</>}
            </button>
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">
           Analyzing {numericCols.length} columns: {numericCols.slice(0, 5).join(', ')}{numericCols.length > 5 ? '...' : ''}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/20 border border-danger text-danger rounded-lg flex items-start">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-white">Detection Complete</h4>
              <p className="text-slate-400">
                Found <span className="text-rose-400 font-bold">{result.anomaly_count}</span> anomalies
                out of {result.total_analyzed} valid rows ({result.percentage.toFixed(2)}%).
              </p>
            </div>
            <div className="flex space-x-3">
               <button onClick={() => handleAction('flag')} disabled={actionLoading || result.anomaly_count===0} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium text-sm flex items-center transition disabled:opacity-50">
                  <Flag className="w-4 h-4 mr-2"/> Flag Rows
               </button>
               <button onClick={() => handleAction('remove')} disabled={actionLoading || result.anomaly_count===0} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-sm flex items-center transition disabled:opacity-50">
                  <Trash2 className="w-4 h-4 mr-2"/> Remove Rows
               </button>
            </div>
          </div>

          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700 h-[400px]">
             <h4 className="font-bold text-slate-300 mb-2">Anomaly Scatter Plot (PCA reduced if &gt;2 cols)</h4>
             <ResponsiveContainer width="100%" height="90%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" dataKey="x" name={result.x_label} stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                  <YAxis type="number" dataKey="y" name={result.y_label} stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff'}} />
                  <Scatter name="Data" data={result.scatter_data}>
                    {result.scatter_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.is_anomaly ? '#ef4444' : '#0ea5e9'} fillOpacity={entry.is_anomaly ? 1 : 0.5} />
                    ))}
                  </Scatter>
                </ScatterChart>
             </ResponsiveContainer>
          </div>

          {result.anomaly_count > 0 && (
              <div className="border border-rose-900/50 rounded-lg overflow-hidden">
                <div className="bg-rose-900/20 px-4 py-2 border-b border-rose-900/50 text-sm font-bold text-rose-200">
                  Preview Anomalous Rows (First 10)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900 text-slate-300">
                      <tr>
                        <th className="px-4 py-2">Row Index</th>
                        {Object.keys(result.anomalies[0]).filter(k => k !== '_index').slice(0, 8).map(k => (
                           <th key={k} className="px-4 py-2 truncate max-w-[150px]">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.anomalies.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-800 bg-rose-900/10">
                          <td className="px-4 py-2 font-mono text-xs">{row._index}</td>
                          {Object.keys(row).filter(k => k !== '_index').slice(0, 8).map(k => (
                            <td key={k} className="px-4 py-2 truncate max-w-[150px]">{String(row[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
