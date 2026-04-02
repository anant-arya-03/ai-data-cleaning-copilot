import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { ChevronRight, Settings, AlertTriangle, CheckCircle, Database } from 'lucide-react';

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

export default function Step3MissingValues({ apiUrl, onContinue, colTypes, profileData, setProfileData }) {
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
    // Fallback to text strategies if type is unknown
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

      // Reset selections
      setSelectedCol('');
      setStrategy('');
      setFixedValue('');

      // Refresh profile to update remaining missing counts
      const profRes = await axios.get(`${apiUrl}/profile`);
      setProfileData(profRes.data);

    } catch (err) {
      setError(err.response?.data?.detail || "Failed to apply strategy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">3</span>
          Fix Missing Values
        </h3>
        <button
          onClick={onContinue}
          className="flex items-center bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Continue to FlashFill <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Missing Summary */}
        <div className="col-span-1 bg-slate-800/30 border border-slate-700 p-4 rounded-lg">
          <h4 className="font-bold text-slate-300 mb-4 flex items-center">
            <Database className="w-4 h-4 mr-2" /> Columns needing attention
          </h4>

          {missingColumns.length === 0 ? (
            <div className="text-center py-8 text-success bg-success/10 rounded-lg border border-success/20">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">All clean!</p>
              <p className="text-sm">No missing values found in the dataset.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {missingColumns.map(c => (
                <div
                  key={c.name}
                  onClick={() => { setSelectedCol(c.name); setStrategy(''); setResult(null); setError(''); }}
                  className={`p-3 rounded border cursor-pointer transition ${
                    selectedCol === c.name
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium truncate mr-2">{c.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-900 rounded">{colTypes[c.name]?.type || 'unknown'}</span>
                  </div>
                  <div className="text-sm text-rose-400">
                    {c.missing_count.toLocaleString()} missing ({c.missing_percent.toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Controls & Results */}
        <div className="col-span-1 md:col-span-2 space-y-4">

          <div className="bg-slate-800/50 border border-slate-700 p-5 rounded-lg">
            <h4 className="font-bold text-slate-300 mb-4 flex items-center">
              <Settings className="w-4 h-4 mr-2" /> Apply Strategy
            </h4>

            {!selectedCol ? (
              <div className="text-center py-10 text-slate-400">
                <Settings className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Select a column from the left to fix missing values.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Strategy for {selectedCol} ({activeColType})</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Select a strategy --</option>
                    {availableStrategies.map(s => (
                      <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {strategy === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Fixed Value</label>
                    <input
                      type={activeColType === 'numeric' ? 'number' : 'text'}
                      value={fixedValue}
                      onChange={(e) => setFixedValue(e.target.value)}
                      placeholder="Enter value..."
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                <button
                  onClick={handleApply}
                  disabled={loading || !strategy}
                  className="w-full bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:hover:bg-primary text-white py-2 rounded-lg font-medium transition"
                >
                  {loading ? 'Processing...' : 'Apply Strategy'}
                </button>

                {error && (
                  <div className="p-3 bg-danger/20 border border-danger text-danger rounded-lg flex items-start text-sm">
                    <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Panel */}
          {result && (
            <div className="bg-success/10 border border-success/30 p-5 rounded-lg animate-in fade-in zoom-in duration-300">
              <div className="flex items-center text-success mb-3">
                <CheckCircle className="w-5 h-5 mr-2" />
                <h4 className="font-bold">Successfully applied to {result.col}</h4>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div className="bg-slate-900/50 p-2 rounded">
                  <div className="text-2xl font-bold text-white">{result.rows_affected}</div>
                  <div className="text-xs text-slate-400 uppercase">Rows Updated</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded">
                  <div className="text-2xl font-bold text-rose-400">{result.before}</div>
                  <div className="text-xs text-slate-400 uppercase">Missing Before</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded">
                  <div className="text-2xl font-bold text-success">{result.after}</div>
                  <div className="text-xs text-slate-400 uppercase">Missing After</div>
                </div>
              </div>

              <div className="text-sm">
                <p className="font-medium text-slate-400 mb-2">Sample Preview (First 5 rows):</p>
                <div className="flex flex-wrap gap-2">
                   {result.preview.slice(0,5).map((row, idx) => (
                      <span key={idx} className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                         {String(row[result.col])}
                      </span>
                   ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
