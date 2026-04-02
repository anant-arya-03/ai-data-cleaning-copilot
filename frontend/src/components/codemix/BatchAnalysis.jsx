import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, Play, Loader2, Download, Table, Code, Type, LayoutList, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { API_URL } from '../../config';

export default function BatchAnalysis() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedCol, setSelectedCol] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedData, setProcessedData] = useState(null);
  const [activeRowIdx, setActiveRowIdx] = useState(null);
  const [activeTab, setActiveTab] = useState('model');
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setProcessedData(null);
    setActiveRowIdx(null);

    // Fast preview using PapaParse for CSV, fallback to basic preview
    if (uploadedFile.name.endsWith('.csv')) {
      Papa.parse(uploadedFile, {
        header: true,
        preview: 10,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            setData(results.data);
            const cols = Object.keys(results.data[0]);
            setColumns(cols);

            // Auto-detect text column
            const textCol = cols.find(key => {
               const val = results.data[0][key];
               return typeof val === 'string' && val.length > 10;
            });
            if (textCol) setSelectedCol(textCol);
            else setSelectedCol(cols[0]);
          } else {
             setError("CSV file is empty");
          }
        },
        error: (err) => setError(err.message)
      });
    } else {
        // Just show filename for excel, we will parse fully on backend
        setData([{preview: "Excel file selected. Preview not available.", rows: "?"}]);
        setColumns(["Upload ready"]);
        setSelectedCol("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInputRef.current.files = e.dataTransfer.files;
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const runBatch = async () => {
    if (!file || !selectedCol) return;
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // If it's excel, we need the user to type the column name if we couldn't parse headers
        if (!selectedCol) {
            setError("Please type the name of the column to analyze");
            return;
        }
    }

    setProcessing(true);
    setProgress(10);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("text_column", selectedCol);

    try {
        const response = await fetch(`${API_URL}/nlp/batch_file`, {
            method: 'POST',
            body: formData,
        });

        setProgress(80);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Analysis failed");
        }

        const result = await response.json();

        // Convert full_analysis string back to object for UI
        const parsedData = result.data.map(row => {
            if (typeof row.full_analysis === 'string') {
                try {
                    row.full_analysis = JSON.parse(row.full_analysis);
                } catch(e) {
                    row.full_analysis = {};
                }
            }
            return row;
        });

        setProcessedData(parsedData);
        setProgress(100);

        // Auto-select first row
        if (parsedData.length > 0) {
            setActiveRowIdx(0);
        }

    } catch (err) {
        setError(err.message);
    } finally {
        setProcessing(false);
    }
  };

  const downloadResults = (format) => {
    if (!processedData) return;

    // Omit the giant JSON column for CSV/Excel export
    const exportData = processedData.map(({ full_analysis, ...rest }) => rest);

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `batch_results_${Date.now()}.csv`;
      link.click();
    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `batch_results_${Date.now()}.xlsx`);
    }
  };

  const getActiveRowJson = () => {
    if (activeRowIdx === null || !processedData || !processedData[activeRowIdx]) return null;
    return processedData[activeRowIdx].full_analysis || {};
  };

  const renderTabContent = (json) => {
    if (!json || Object.keys(json).length === 0) return <div className="text-slate-400 p-4">No data available for this row.</div>;

    switch (activeTab) {
        case 'model':
            const allScores = json.all_scores || {};
            return (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-4 mb-6">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex-1 shadow-sm">
                            <div className="text-slate-500 text-sm mb-1 font-semibold uppercase tracking-wider">Label</div>
                            <div className="text-2xl font-black text-slate-800 flex items-center capitalize">
                                {json.label || "N/A"} {json.emoji && <span className="ml-2 text-3xl">{json.emoji}</span>}
                            </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex-1 shadow-sm">
                            <div className="text-slate-500 text-sm mb-1 font-semibold uppercase tracking-wider">Confidence</div>
                            <div className="text-2xl font-black text-slate-800">
                                {json.confidence ? `${json.confidence.toFixed(2)}%` : "N/A"}
                            </div>
                        </div>
                    </div>
                    {Object.keys(allScores).length > 0 && (
                        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                            <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">All Scores</div>
                            {Object.entries(allScores).map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between mb-3 last:mb-0 bg-slate-50 p-2 rounded">
                                    <span className="text-slate-700 font-medium capitalize">{key}</span>
                                    <span className="text-indigo-600 font-mono font-bold">{val}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        case 'scripts':
            const analysis = json.text_analysis || {};
            return (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                        <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">Scripts Detected</div>
                        <div className="flex flex-wrap gap-2">
                            {analysis.scripts_detected?.map((s, i) => (
                                <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm">{s}</span>
                            )) || <span className="text-slate-400 italic">None</span>}
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                        <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">Languages Detected</div>
                        <div className="flex flex-wrap gap-2">
                            {analysis.languages_detected?.map((l, i) => (
                                <span key={i} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm">{l}</span>
                            )) || <span className="text-slate-400 italic">None</span>}
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Code-Mix Ratio</div>
                        <div className="text-2xl font-black text-indigo-600 bg-indigo-50 px-4 py-1 rounded-lg border border-indigo-100">{analysis.code_mix_ratio || 0}</div>
                    </div>
                </div>
            );
        case 'slang':
            const slang = json.slang_analysis || {};
            return (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                        <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">Internet Slang</div>
                        <div className="flex flex-wrap gap-2">
                            {slang.internet_slang?.length > 0 ? slang.internet_slang.map((s, i) => (
                                <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-mono font-bold shadow-sm">{s}</span>
                            )) : <span className="text-slate-400 text-sm italic">None</span>}
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                        <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">Hinglish Slang</div>
                        <div className="flex flex-wrap gap-2">
                            {slang.hinglish_slang?.length > 0 ? slang.hinglish_slang.map((s, i) => (
                                <span key={i} className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg text-sm font-mono font-bold shadow-sm">{s}</span>
                            )) : <span className="text-slate-400 text-sm italic">None</span>}
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                        <div className="text-slate-500 text-sm mb-3 font-semibold uppercase tracking-wider">Abbreviations</div>
                        <div className="flex flex-wrap gap-2">
                            {slang.abbreviations?.length > 0 ? slang.abbreviations.map((s, i) => (
                                <span key={i} className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-sm font-mono font-bold shadow-sm">{s}</span>
                            )) : <span className="text-slate-400 text-sm italic">None</span>}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex-1 shadow-sm">
                            <div className="text-slate-500 text-sm mb-1 font-semibold uppercase tracking-wider">Total Slangs</div>
                            <div className="text-2xl font-black text-slate-800">{slang.slang_count || 0}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex-1 shadow-sm">
                            <div className="text-slate-500 text-sm mb-1 font-semibold uppercase tracking-wider">Emojis Present</div>
                            <div className="text-2xl font-black text-slate-800 tracking-widest">
                                {slang.emojis_present?.join(' ') || "None"}
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 'phonemes':
            const phones = json.phoneme_hints || [];
            return (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {phones.length > 0 ? phones.map((p, i) => (
                        <div key={i} className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
                            <div className="text-indigo-600 font-black mb-3 text-lg border-b border-slate-100 pb-2">{p.pattern}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Examples</div>
                            <div className="flex gap-2">
                               {p.examples?.map((ex, idx) => (
                                  <span key={idx} className="bg-slate-50 border border-slate-200 px-3 py-1 rounded text-slate-700 font-mono font-medium">{ex}</span>
                               ))}
                            </div>
                        </div>
                    )) : <div className="text-slate-400 bg-white p-6 text-center border border-slate-200 rounded-lg">No specific phoneme patterns detected.</div>}
                </div>
            );
        case 'stats':
            const stats = json.text_stats || {};
            return (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">Word Count</div>
                        <div className="text-3xl font-black text-indigo-600">{stats.word_count || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">Char Count</div>
                        <div className="text-3xl font-black text-emerald-600">{stats.char_count || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">Avg Word Length</div>
                        <div className="text-3xl font-black text-blue-600">{stats.avg_word_length || 0}</div>
                    </div>
                    <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">Hashtags</div>
                        <div className="text-3xl font-black text-orange-500">{stats.hashtags?.length || 0}</div>
                    </div>
                </div>
            );
        default:
            return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-160px)]">
      {/* Left Pane - Table & Controls (Light Theme) */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
         <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10">
            <h2 className="font-bold text-slate-800 text-lg flex items-center">
                <Table className="w-5 h-5 mr-2 text-indigo-500" />
                Batch Data
            </h2>
            {processedData && (
                <div className="flex gap-2">
                    <button onClick={() => downloadResults('csv')} className="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-bold transition flex items-center shadow-sm">
                        <Download className="w-3 h-3 mr-1" /> CSV
                    </button>
                    <button onClick={() => downloadResults('excel')} className="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-bold transition flex items-center shadow-sm">
                        <Download className="w-3 h-3 mr-1" /> Excel
                    </button>
                </div>
            )}
         </div>

         {/* File Upload Area */}
         {!data && (
            <div className="flex-1 p-6 flex flex-col items-center justify-center">
                <div
                    className="w-full h-64 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 transition flex flex-col items-center justify-center cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-indigo-500" />
                    </div>
                    <p className="text-slate-700 font-bold text-lg mb-1">Click or drag file to this area to upload</p>
                    <p className="text-slate-500 text-sm">Supports .csv, .xlsx, .xls</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" />

                {error && (
                    <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm font-medium w-full text-center">
                        {error}
                    </div>
                )}
            </div>
         )}

         {/* Data Preview & Analysis Controls */}
         {data && !processedData && !processing && (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
                <div className="p-4 bg-white border-b border-slate-200">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Text Column to Analyze</label>
                            {columns.length > 1 ? (
                                <select
                                    value={selectedCol}
                                    onChange={(e) => setSelectedCol(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                >
                                    <option value="" disabled>Select a column</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={selectedCol}
                                    onChange={(e) => setSelectedCol(e.target.value)}
                                    placeholder="Type column name (e.g. text)"
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                />
                            )}
                        </div>
                        <button
                            onClick={runBatch}
                            disabled={!selectedCol}
                            className={`px-6 py-2.5 rounded-lg font-bold flex items-center transition shadow-sm
                                ${!selectedCol ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                        >
                            <Play className="w-4 h-4 mr-2" /> Run Analysis
                        </button>
                    </div>
                    {error && <div className="mt-3 text-red-500 text-sm font-medium">{error}</div>}
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 p-4">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Data Preview (First 10 rows)
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        {columns.map((col, idx) => (
                                            <th key={idx} className={`px-4 py-3 whitespace-nowrap ${col === selectedCol ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            {columns.map((col, cIdx) => (
                                                <td key={cIdx} className={`px-4 py-2 max-w-[200px] truncate ${col === selectedCol ? 'bg-indigo-50/30 font-medium' : 'text-slate-600'}`}>
                                                    {row[col]?.toString() || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
         )}

         {/* Processing State */}
         {processing && (
             <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 backdrop-blur-sm absolute inset-0 z-20">
                 <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center max-w-sm w-full">
                     <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                     <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Data...</h3>
                     <p className="text-sm text-slate-500 mb-6 text-center">Processing rows through NLP models. This might take a moment.</p>
                     <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                         <div className="bg-indigo-600 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
                     </div>
                 </div>
             </div>
         )}

         {/* Processed Data Table */}
         {processedData && !processing && (
             <div className="flex-1 overflow-auto animate-in fade-in duration-300">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">#</th>
                            <th className="px-4 py-3 min-w-[200px] max-w-[300px]">Text</th>
                            <th className="px-4 py-3">Label</th>
                            <th className="px-4 py-3">Mix Ratio</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {processedData.map((row, idx) => (
                            <tr
                                key={idx}
                                onClick={() => setActiveRowIdx(idx)}
                                className={`cursor-pointer transition-colors ${activeRowIdx === idx ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                            >
                                <td className="px-4 py-3 text-slate-400 font-mono text-xs text-center">{idx + 1}</td>
                                <td className="px-4 py-3 truncate max-w-[300px] text-slate-700 font-medium">
                                    {row[selectedCol]?.toString() || row.text}
                                </td>
                                <td className="px-4 py-3">
                                    {row.label ? (
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex inline-flex items-center gap-1
                                            ${row.label === 'positive' || row.label === 'true' ? 'bg-emerald-100 text-emerald-700' :
                                              row.label === 'negative' || row.label === 'fake' ? 'bg-red-100 text-red-700' :
                                              'bg-slate-100 text-slate-700'}`}>
                                            {row.label} {row.emoji}
                                        </span>
                                    ) : <span className="text-slate-400 text-xs italic">N/A</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono text-xs font-bold">
                                    {row.code_mix_ratio || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
         )}
      </div>

      {/* Right Pane - Detail View (Matches Screenshot style but light theme) */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
         <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between z-10">
            <h2 className="font-bold text-slate-800 text-lg flex items-center">
                <Code className="w-5 h-5 mr-2 text-indigo-500" />
                Row Analysis Output
            </h2>
            {activeRowIdx !== null && (
                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    Row {activeRowIdx + 1} Selected
                </div>
            )}
         </div>

         {!processedData ? (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                     <Layers className="w-8 h-8 text-slate-300" />
                 </div>
                 <p className="font-medium text-slate-500">Run batch analysis and click a row to view its detailed JSON output here.</p>
             </div>
         ) : activeRowIdx === null ? (
             <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">
                 Click on a row in the left table to view details.
             </div>
         ) : (
             <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">

                 {/* Original Text Block */}
                 <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Input Text</div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 font-medium shadow-sm break-words">
                        {processedData[activeRowIdx]?.[selectedCol]?.toString() || processedData[activeRowIdx]?.text || "No text available"}
                    </div>
                 </div>

                 {/* Tabs */}
                 <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 hide-scrollbar px-2">
                    {[
                        { id: 'model', label: 'Model Result' },
                        { id: 'scripts', label: 'Scripts & Languages' },
                        { id: 'slang', label: 'Slang Detected' },
                        { id: 'phonemes', label: 'Phoneme Hints' },
                        { id: 'stats', label: 'Text Stats' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap px-4 py-3 text-sm font-bold transition-colors border-b-2
                                ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                 </div>

                 {/* Tab Content */}
                 <div className="flex-1 overflow-auto p-5 bg-slate-50/50">
                    {renderTabContent(getActiveRowJson())}
                 </div>

                 {/* Raw JSON View at Bottom */}
                 <div className="h-64 border-t border-slate-200 flex flex-col">
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span>Raw JSON Output</span>
                        <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-[10px]">models1.py format</span>
                    </div>
                    <div className="flex-1 bg-slate-900 overflow-auto p-4">
                        <pre className="text-emerald-400 font-mono text-sm">
                            {JSON.stringify(getActiveRowJson(), null, 2)}
                        </pre>
                    </div>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
}