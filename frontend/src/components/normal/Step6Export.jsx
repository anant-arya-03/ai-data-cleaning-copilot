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

        // Add a summary sheet
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
              body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
              .container { max-w-4xl mx-auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
              h1 { color: #0ea5e9; border-bottom: 2px solid #334155; padding-bottom: 10px; }
              h2 { color: #8b5cf6; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
              th { background: #0f172a; color: #cbd5e1; }
              .stats { display: flex; gap: 20px; margin-bottom: 30px; }
              .stat-box { background: #0f172a; padding: 20px; border-radius: 8px; flex: 1; text-align: center; border: 1px solid #334155; }
              .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
              .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>AI Data Cleaning Report</h1>
              <p>Dataset: <strong>${cleanFilename}</strong></p>

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
                    <div class="stat-label">Columns</div>
                 </div>
              </div>

              <h2>Column Renames Applied</h2>
              ${suggestions.filter(s => s.accepted && s.original !== s.suggested).length > 0 ? `
              <table>
                <thead><tr><th>Original Name</th><th>New Name</th></tr></thead>
                <tbody>
                  ${suggestions.filter(s => s.accepted && s.original !== s.suggested).map(s => `<tr><td>${s.original}</td><td style="color: #10b981;">${s.suggested}</td></tr>`).join('')}
                </tbody>
              </table>
              ` : '<p>No columns were renamed.</p>'}

              <h2>Cleaned Data Preview (First 5 Rows)</h2>
              <table>
                <thead>
                  <tr>${columns.slice(0, 10).map(c => `<th>${c}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${data.slice(0, 5).map(row => `<tr>${columns.slice(0, 10).map(c => `<td>${row[c] !== null ? row[c] : ''}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
              <p style="text-align: center; color: #64748b; margin-top: 20px; font-size: 12px;">Generated by AI Data Cleaning Copilot</p>
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
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <h3 className="text-xl font-bold mb-6 flex items-center">
        <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">6</span>
        Rename & Export
      </h3>

      {/* Rename Section */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-300 mb-4 flex items-center">
          <Wand2 className="w-5 h-5 mr-2 text-primary" /> AI Column Rename Suggestions
        </h4>

        {loading ? (
          <div className="animate-pulse h-32 bg-slate-800 rounded-lg"></div>
        ) : renamesApplied ? (
          <div className="bg-success/10 border border-success/30 p-4 rounded-lg flex items-center text-success">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Column renames applied successfully. Ready for export!</span>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
             <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900 text-slate-300 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-700 w-12 text-center">Accept</th>
                      <th className="px-4 py-3 border-b border-slate-700">Original Name</th>
                      <th className="px-4 py-3 border-b border-slate-700">Suggested Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s, idx) => (
                      <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800">
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={s.accepted}
                            onChange={() => handleToggle(idx)}
                            disabled={s.original === s.suggested}
                            className="w-4 h-4 accent-primary rounded cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-400">{s.original}</td>
                        <td className="px-4 py-2">
                           {s.original === s.suggested ? (
                              <span className="text-slate-500 italic text-xs">Looks good!</span>
                           ) : (
                              <span className="font-mono text-emerald-400 font-bold">{s.suggested}</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             <div className="p-4 border-t border-slate-700 flex justify-end">
                <button
                  onClick={handleApplyRenames}
                  disabled={applying}
                  className="bg-primary hover:bg-primaryHover text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  {applying ? 'Applying...' : 'Apply Selected Renames'}
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div>
        <h4 className="font-bold text-slate-300 mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2 text-emerald-400" /> Export Cleaned Dataset
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => downloadFile('csv')}
            disabled={exporting || !renamesApplied}
            className="flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <FileText className="w-10 h-10 text-primary mb-3 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg text-white">Download CSV</span>
            <span className="text-xs text-slate-400 mt-1">Standard comma-separated values</span>
          </button>

          <button
            onClick={() => downloadFile('excel')}
            disabled={exporting || !renamesApplied}
            className="flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <FileSpreadsheet className="w-10 h-10 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg text-white">Download Excel</span>
            <span className="text-xs text-slate-400 mt-1">Includes summary report sheet</span>
          </button>

          <button
            onClick={() => downloadFile('html')}
            disabled={exporting || !renamesApplied}
            className="flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <FileCode2 className="w-10 h-10 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg text-white">Cleaning Report</span>
            <span className="text-xs text-slate-400 mt-1">Standalone HTML Document</span>
          </button>
        </div>
      </div>
    </div>
  );
}
