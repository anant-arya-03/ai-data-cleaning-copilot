import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChevronRight, Database, Columns, AlertCircle, Copy, Cpu, LayoutDashboard, Trash2, Eye } from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Step2Profile({ apiUrl, onContinue, profileData, setProfileData, colTypes, datasetInfo, setDatasetInfo }) {
  const [loading, setLoading] = useState(true);
  const [duplicateData, setDuplicateData] = useState(null);
  const [removingDups, setRemovingDups] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchDuplicates();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${apiUrl}/profile`);
      setProfileData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDuplicates = async () => {
    try {
      const res = await axios.get(`${apiUrl}/duplicates`);
      setDuplicateData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveDuplicates = async () => {
    setRemovingDups(true);
    try {
      const res = await axios.post(`${apiUrl}/remove_duplicates`);
      alert(`Successfully removed ${res.data.removed} duplicate rows.`);
      setDatasetInfo(prev => ({...prev, rows: prev.rows - res.data.removed}));
      fetchProfile();
      fetchDuplicates();
      setShowDupModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingDups(false);
    }
  };

  if (loading || !profileData) {
    return (
      <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-lg"></div>)}
        </div>
        <div className="h-64 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  const { summary, columns, type_distribution } = profileData;

  const pieData = Object.entries(type_distribution)
    .filter(([_, val]) => val > 0)
    .map(([name, value]) => ({ name, value }));

  const missingData = columns
    .map(c => ({ name: c.name, missing: c.missing_percent }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 10); // top 10

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">2</span>
          Data Profile Dashboard
        </h3>
        <button
          onClick={onContinue}
          className="flex items-center bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg font-medium transition-colors"
        >
          Continue to Missing Values <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <Database className="w-6 h-6 text-primary mb-2" />
          <span className="text-2xl font-bold">{summary.total_rows.toLocaleString()}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">Total Rows</span>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <Columns className="w-6 h-6 text-purple-400 mb-2" />
          <span className="text-2xl font-bold">{summary.total_columns}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">Columns</span>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-6 h-6 text-warning mb-2" />
          <span className="text-2xl font-bold">{summary.total_missing.toLocaleString()}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">Missing Vals ({summary.total_missing_percent.toFixed(1)}%)</span>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <Copy className="w-6 h-6 text-rose-400 mb-2" />
          <span className="text-2xl font-bold">{summary.duplicate_rows.toLocaleString()}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">Duplicate Rows</span>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <Cpu className="w-6 h-6 text-emerald-400 mb-2" />
          <span className="text-2xl font-bold">{(summary.memory_usage_kb / 1024).toFixed(2)}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider">Memory (MB)</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
             <LayoutDashboard className="w-4 h-4 mr-2"/> Top Missing Value %
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missingData} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Bar dataKey="missing" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                  {missingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.missing > 20 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
             <LayoutDashboard className="w-4 h-4 mr-2"/> Column Types
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {profileData.correlations && profileData.correlations.length > 0 && (
        <div className="mb-8 bg-slate-800/30 p-4 rounded-lg border border-slate-700">
          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
            <LayoutDashboard className="w-4 h-4 mr-2"/> Correlation Heatmap (Numeric Columns)
          </h4>
          <div className="overflow-x-auto">
             <div className="inline-block min-w-max">
               {(() => {
                 // Get unique columns for axes
                 const cols = Array.from(new Set(profileData.correlations.map(c => c.col1)));
                 return (
                   <div className="grid gap-1 text-xs text-center" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(60px, 1fr))` }}>
                      <div></div>
                      {cols.map(c => <div key={c} className="font-bold text-slate-400 rotate-45 transform origin-bottom-left truncate w-16 mb-2">{c}</div>)}

                      {cols.map(rowCol => (
                        <React.Fragment key={rowCol}>
                           <div className="font-bold text-slate-400 text-right pr-2 self-center truncate max-w-[100px]">{rowCol}</div>
                           {cols.map(colCol => {
                              const corr = profileData.correlations.find(c => c.col1 === rowCol && c.col2 === colCol);
                              const val = corr ? corr.value : 0;
                              // color scale from blue (-1) to red (+1)
                              const r = val > 0 ? Math.round(239 * val) : 0;
                              const b = val < 0 ? Math.round(239 * Math.abs(val)) : 0;
                              const a = Math.abs(val) > 0.1 ? Math.abs(val) : 0.1;
                              const bg = val > 0 ? `rgba(239, 68, 68, ${a})` : `rgba(14, 165, 233, ${a})`;
                              return (
                                <div key={colCol} className="w-12 h-10 flex items-center justify-center rounded border border-slate-800" style={{ backgroundColor: bg }} title={`${rowCol} vs ${colCol}: ${val.toFixed(2)}`}>
                                   {val.toFixed(2)}
                                </div>
                              )
                           })}
                        </React.Fragment>
                      ))}
                   </div>
                 );
               })()}
             </div>
          </div>
        </div>
      )}

      {/* Duplicate Actions */}
      {duplicateData && duplicateData.count > 0 && (
        <div className="bg-rose-900/20 border border-rose-900/50 p-4 rounded-lg flex items-center justify-between mb-8">
          <div className="flex items-center text-rose-200">
            <Copy className="w-5 h-5 mr-3" />
            <div>
              <p className="font-medium">Found {duplicateData.count} exact duplicate rows</p>
              <p className="text-sm opacity-80">Removing duplicates is recommended before further cleaning.</p>
            </div>
          </div>
          <div className="flex space-x-3">
             <button onClick={() => setShowDupModal(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium text-sm transition flex items-center">
                <Eye className="w-4 h-4 mr-2"/> Preview
             </button>
             <button onClick={handleRemoveDuplicates} disabled={removingDups} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-sm transition flex items-center disabled:opacity-50">
                <Trash2 className="w-4 h-4 mr-2"/> {removingDups ? "Removing..." : "Remove All"}
             </button>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">Column Details</h4>
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900 text-slate-300 sticky top-0">
              <tr>
                <th className="px-4 py-3 border-b border-slate-700">Column Name</th>
                <th className="px-4 py-3 border-b border-slate-700">Type</th>
                <th className="px-4 py-3 border-b border-slate-700">Missing</th>
                <th className="px-4 py-3 border-b border-slate-700">Unique</th>
                <th className="px-4 py-3 border-b border-slate-700">Sample Values</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50 even:bg-slate-900/30">
                  <td className="px-4 py-3 font-medium text-slate-200">{col.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs border ${col.type === 'numeric' ? 'bg-blue-900/50 border-blue-700 text-blue-300' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
                      {col.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className={col.missing_percent > 20 ? 'text-rose-400 font-bold' : ''}>
                        {col.missing_count} ({col.missing_percent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{col.unique_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {col.samples.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs truncate max-w-[100px]" title={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duplicate Modal */}
      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-surface border border-slate-700 rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Duplicate Rows Preview</h3>
              <button onClick={() => setShowDupModal(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    {Object.keys(duplicateData.rows[0] || {}).map(k => <th key={k} className="px-3 py-2">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {duplicateData.rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                      {Object.values(r).map((v, j) => <td key={j} className="px-3 py-2 truncate max-w-[150px]">{String(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {duplicateData.count > 50 && <p className="mt-2 text-center text-slate-400 italic">Showing first 50 duplicate rows.</p>}
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end space-x-3">
              <button onClick={() => setShowDupModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded font-medium">Close</button>
              <button onClick={handleRemoveDuplicates} disabled={removingDups} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium">Remove All Duplicates</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
