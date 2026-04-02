import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, FileSpreadsheet, FileText, CheckCircle, Wand2, FileCode2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function Step6Export({ apiUrl, datasetInfo }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [renamesApplied, setRenamesApplied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/rename/suggest`);
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (idx) => {
    const newSug = [...suggestions];
    newSug[idx].accepted = !newSug[idx].accepted;
    setSuggestions(newSug);
  };

  const handleApplyRenames = async () => {
    setApplying(true);
    const renamesToApply = {};
    suggestions.forEach(s => {
      if (s.accepted && s.original !== s.suggested) {
        renamesToApply[s.original] = s.suggested;
      }
    });

    if (Object.keys(renamesToApply).length === 0) {
      setRenamesApplied(true);
      setApplying(false);
      return;
    }

    try {
      await axios.post(`${apiUrl}/rename/apply`, { renames: renamesToApply });
      setRenamesApplied(true);
    } catch (err) {
      alert("Failed to apply renames.");
    } finally {
      setApplying(false);
    }
  };

  const downloadFile = async (type) => {
    setExporting(true);
    try {
      const res = await axios.get(`${apiUrl}/export/data`);
      const { filename, data, columns } = res.data;

      const cleanFilename = filename.replace('.csv', '');

      if (type === 'csv') {
        const csv = Papa.unparse(data, { columns });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${cleanFilename}_cleaned.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      else if (type === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cleaned Data");

        const summaryData = [
          ["AI Data Cleaning Copilot - Summary"],
          ["Original Rows", datasetInfo?.rows],
          ["Cleaned Rows", data.length],
          ["Columns", columns.length]
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

        XLSX.writeFile(workbook, `${cleanFilename}_cleaned.xlsx`);
      } else if (type === 'html') {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Cleaning Report - ${cleanFilename}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
              .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
              h1 { color: #4f46e5; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 30px; font-weight: 800; font-size: 28px; }
              h2 { color: #334155; margin-top: 40px; font-size: 20px; font-weight: 700; border-left: 4px solid #4f46e5; padding-left: 12px; }
              table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
              th, td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
              th { background: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; }
              .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
              .stat-box { background: #ffffff; padding: 25px 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
              .stat-value { font-size: 32px; font-weight: 800; color: #4f46e5; }
              .stat-label { font-size: 13px; color: #64748b; text-transform: uppercase; margin-top: 8px; font-weight: 600; letter-spacing: 0.05em; }
              tr:last-child td { border-bottom: none; }
              .rename-new { color: #10b981; font-weight: 600; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Data Cleaning Report</h1>
              <p style="color: #64748b; font-size: 15px; margin-bottom: 30px;">Dataset: <strong>${cleanFilename}</strong></p>

              <div class="stats">
                 <div class="stat-box">
                    <div class="stat-value">${datasetInfo?.rows || 0}</div>
                    <div class="stat-label">Original Rows</div>
                 </div>
                 <div class="stat-box">
                    <div class="stat-value">${data.length}</div>
                    <div class="stat-label">Cleaned Rows</div>
                 </div>
                 <div class="stat-box">
                    <div class="stat-value">${columns.length}</div>
                    <div class="stat-label">Total Columns</div>
                 </div>
              </div>

              <h2>Column Renames Applied</h2>
              ${suggestions.filter(s => s.accepted && s.original !== s.suggested).length > 0 ? `
              <table>
                <thead><tr><th>Original Name</th><th>New Name</th></tr></thead>
                <tbody>
                  ${suggestions.filter(s => s.accepted && s.original !== s.suggested).map(s => `<tr><td style="color: #64748b; font-family: monospace;">${s.original}</td><td><span class="rename-new">${s.suggested}</span></td></tr>`).join('')}
                </tbody>
              </table>
              ` : '<p style="color: #94a3b8; font-style: italic; margin-top: 15px;">No columns were renamed during this session.</p>'}

              <h2>Cleaned Data Preview (First 5 Rows)</h2>
              <div style="overflow-x: auto;">
                <table>
                  <thead>
                    <tr>${columns.slice(0, 8).map(c => `<th>${c}</th>`).join('')}${columns.length > 8 ? '<th>...</th>' : ''}</tr>
                  </thead>
                  <tbody>
                    ${data.slice(0, 5).map(row => `<tr>${columns.slice(0, 8).map(c => `<td>${row[c] !== null ? row[c] : '<span style="color:#cbd5e1; font-style:italic">null</span>'}</td>`).join('')}${columns.length > 8 ? '<td style="color:#cbd5e1;">...</td>' : ''}</tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <p style="text-align: center; color: #94a3b8; margin-top: 40px; font-size: 13px; border-top: 1px solid #f1f5f9; padding-top: 20px;">Generated by AI Data Cleaning Copilot Dashboard</p>
            </div>
          </body>
          </html>
        `;
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${cleanFilename}_report.html`);
        link.click();
      }
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-panel">
        <h3 className="card-title text-slate-800">
          <Wand2 className="w-5 h-5 mr-2 text-indigo-500" />
          AI Column Renames
        </h3>

        {loading ? (
          <div className="animate-pulse h-32 bg-slate-100 rounded-lg"></div>
        ) : renamesApplied ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center shadow-sm font-bold text-sm">
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>Column renames applied successfully. Ready for export!</span>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col max-h-[300px]">
             <div className="overflow-y-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-2.5 w-12 text-center text-xs font-bold uppercase tracking-wider">Apply</th>
                      <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Original Name</th>
                      <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Suggested Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suggestions.map((s, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30">
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={s.accepted}
                            onChange={() => handleToggle(idx)}
                            disabled={s.original === s.suggested}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{s.original}</td>
                        <td className="px-4 py-2.5">
                           {s.original === s.suggested ? (
                              <span className="text-slate-400 italic text-xs font-medium">Looks good!</span>
                           ) : (
                              <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 text-[11px]">{s.suggested}</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  onClick={handleApplyRenames}
                  disabled={applying}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold text-sm transition shadow-sm w-full"
                >
                  {applying ? 'Applying...' : 'Apply Selected Renames'}
                </button>
             </div>
          </div>
        )}
      </div>

      <div className="card-panel">
        <h3 className="card-title text-slate-800">
          <Download className="w-5 h-5 mr-2 text-indigo-500" />
          Export Dataset
        </h3>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => downloadFile('csv')}
            disabled={exporting || !renamesApplied}
            className="flex items-center p-4 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm text-left w-full"
          >
            <div className="bg-indigo-100 p-2.5 rounded-lg mr-4 group-hover:scale-110 transition-transform shadow-inner">
               <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
               <span className="font-bold text-slate-800 block">Download CSV</span>
               <span className="text-xs font-medium text-slate-500">Standard comma-separated values</span>
            </div>
          </button>

          <button
            onClick={() => downloadFile('excel')}
            disabled={exporting || !renamesApplied}
            className="flex items-center p-4 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm text-left w-full"
          >
            <div className="bg-emerald-100 p-2.5 rounded-lg mr-4 group-hover:scale-110 transition-transform shadow-inner">
               <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
               <span className="font-bold text-slate-800 block">Download Excel</span>
               <span className="text-xs font-medium text-slate-500">Includes summary report sheet</span>
            </div>
          </button>

          <button
            onClick={() => downloadFile('html')}
            disabled={exporting || !renamesApplied}
            className="flex items-center p-4 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm text-left w-full"
          >
            <div className="bg-amber-100 p-2.5 rounded-lg mr-4 group-hover:scale-110 transition-transform shadow-inner">
               <FileCode2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
               <span className="font-bold text-slate-800 block">HTML Cleaning Report</span>
               <span className="text-xs font-medium text-slate-500">Standalone interactive document</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
