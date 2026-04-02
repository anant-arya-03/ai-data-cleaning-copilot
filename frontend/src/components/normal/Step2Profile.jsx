import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChevronRight, Database, Columns, AlertCircle, Copy, Cpu, LayoutDashboard, Trash2, Eye } from 'lucide-react';

const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Step2Profile({ apiUrl, profileData, setProfileData, colTypes, datasetInfo, setDatasetInfo }) {
  const [loading, setLoading] = useState(true);
  const [duplicateData, setDuplicateData] = useState(null);
  const [removingDups, setRemovingDups] = useState(false);

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
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingDups(false);
    }
  };

  if (loading || !profileData) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/2 mb-6"></div>
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white border border-slate-200 rounded-lg shadow-sm"></div>)}
      </div>
    );
  }

  const { summary, columns, type_distribution } = profileData;
  const pieData = Object.entries(type_distribution).filter(([_, val]) => val > 0).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">

      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-center grid grid-cols-2 gap-4">
         <div className="p-2">
            <div className="text-xl font-bold text-slate-800">{summary.total_missing_percent.toFixed(1)}%</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Total Missing</div>
         </div>
         <div className="p-2 border-l border-slate-100">
            <div className="text-xl font-bold text-rose-500">{summary.duplicate_rows.toLocaleString()}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Duplicates</div>
         </div>
      </div>

      {duplicateData && duplicateData.count > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm">
          <div className="flex items-center text-rose-700 mb-3">
            <Copy className="w-5 h-5 mr-2" />
            <span className="font-bold">Found {duplicateData.count} exact duplicate rows</span>
          </div>
          <button onClick={handleRemoveDuplicates} disabled={removingDups} className="w-full py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg font-bold text-sm transition shadow-sm disabled:opacity-50">
             {removingDups ? "Removing..." : "Remove All Duplicates"}
          </button>
        </div>
      )}

      {/* Column Distributions styled like Cocoon */}
      <div className="space-y-4">
         <h3 className="font-bold text-slate-700 text-lg flex items-center border-b border-slate-200 pb-2">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Column Distributions
         </h3>

         {columns.map((col, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
               <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700 truncate w-3/4">{col.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${col.type === 'numeric' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                     {col.type}
                  </span>
               </div>

               <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs text-slate-500">
                        {col.missing_percent > 0 ? (
                           <span className="text-rose-500 font-medium bg-rose-50 px-1.5 rounded">{col.missing_percent.toFixed(1)}% NULL</span>
                        ) : (
                           <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 rounded">100% Filled</span>
                        )}
                     </span>
                     <span className="text-xs text-slate-400">{col.unique_count} Unique</span>
                  </div>

                  {/* Sparkline / Distribution chart placeholder */}
                  {col.distribution && col.distribution.length > 0 && (
                     <div className="h-20 w-full mt-3">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={col.distribution.map((val, i) => ({name: i, val}))}>
                           <Bar dataKey="val" fill={col.type === 'numeric' ? '#4f46e5' : '#94a3b8'} radius={[2, 2, 0, 0]} />
                           <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                  )}

                  <div className="mt-3 text-[10px] text-slate-400 bg-slate-50 p-2 rounded flex flex-wrap gap-1">
                     <span className="block w-full font-semibold text-slate-500 mb-1">Samples:</span>
                     {col.samples.map((s, i) => <span key={i} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm max-w-[80px] truncate">{s}</span>)}
                  </div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
}
