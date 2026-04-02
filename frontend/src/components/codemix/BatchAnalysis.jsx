import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, Play, CheckCircle, Download, Database, BarChart2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#64748b'];

export default function BatchAnalysis({ apiUrl, backendUrl }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [textCols, setTextCols] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [modelType, setModelType] = useState('all');

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedData, setProcessedData] = useState(null);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');
    setProcessedData(null);
    setProgress(0);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setError("CSV file is empty.");
          return;
        }
        setData(results.data);
        const cols = Object.keys(results.data[0]);
        setHeaders(cols);

        // Simple auto-detect: assume string columns are text
        const detectedText = cols.filter(c => {
          const val = results.data[0][c];
          return typeof val === 'string' && isNaN(Number(val));
        });
        setTextCols(detectedText);
        setSelectedCols(detectedText.slice(0, 1)); // Select first by default
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const toggleCol = (col) => {
    setSelectedCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const runBatch = async () => {
    if (selectedCols.length === 0) {
      setError("Please select at least one column to analyze.");
      return;
    }
    setProcessing(true);
    setError('');

    const resultData = [...data];
    let currentCount = 0;
    const totalCount = data.length * selectedCols.length;

    for (let i = 0; i < data.length; i++) {
      const row = { ...data[i] };

      for (const col of selectedCols) {
        const text = row[col];
        if (!text || text.trim().length < 3) {
           currentCount++;
           continue; // skip empty or very short
        }

        try {
          const res = await axios.post(`${apiUrl}/predict/${modelType}`, { text });

          if (modelType === 'all') {
             row[`${col}_misinfo`] = res.data.misinfo?.label || null;
             row[`${col}_misinfo_conf`] = res.data.misinfo?.confidence || null;
             row[`${col}_fakenews`] = res.data.fakenews?.label || null;
             row[`${col}_fakenews_conf`] = res.data.fakenews?.confidence || null;
             row[`${col}_sentiment`] = res.data.emosen?.label || null;
             row[`${col}_sentiment_conf`] = res.data.emosen?.confidence || null;
          } else if (modelType === 'misinfo') {
             row[`${col}_misinfo`] = res.data.label || null;
             row[`${col}_misinfo_conf`] = res.data.confidence || null;
          } else if (modelType === 'fakenews') {
             row[`${col}_fakenews`] = res.data.label || null;
             row[`${col}_fakenews_conf`] = res.data.confidence || null;
          } else if (modelType === 'emosen') {
             row[`${col}_sentiment`] = res.data.label || null;
             row[`${col}_sentiment_conf`] = res.data.confidence || null;
          }

          if (res.data.text_analysis) {
             row[`${col}_langs`] = res.data.text_analysis.languages_detected.join(', ');
             row[`${col}_slang_count`] = res.data.text_analysis.slang_analysis.slang_count;
             row[`${col}_code_mix_ratio`] = res.data.text_analysis.code_mix_ratio;
          }
        } catch (err) {
           console.error(`Row ${i} Col ${col} failed`, err);
           row[`${col}_error`] = 'API Failed';
        }
        currentCount++;
        setProgress(Math.round((currentCount / totalCount) * 100));
      }
      resultData[i] = row;
    }

    setProcessedData(resultData);
    setProcessing(false);
  };

  const downloadResults = (format) => {
    if (!processedData) return;

    if (format === 'csv') {
      const csv = Papa.unparse(processedData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `batch_results.csv`);
      link.click();
    } else {
      const worksheet = XLSX.utils.json_to_sheet(processedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, `batch_results.xlsx`);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <h3 className="text-xl font-bold mb-6 flex items-center">
        <Database className="w-5 h-5 mr-3 text-indigo-400" />
        Batch CSV Analysis
      </h3>

      {!file ? (
        <div
          {...getRootProps()}
          className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-12 text-center cursor-pointer transition-colors bg-slate-900/50"
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-lg text-slate-200 font-medium">Drag & drop your CSV file here to begin</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center">
              <FileSpreadsheet className="w-6 h-6 text-indigo-400 mr-3" />
              <div>
                <p className="font-medium text-slate-200">{file.name}</p>
                <p className="text-sm text-slate-500">{data.length} rows loaded</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setData([]); setProcessedData(null); }} className="text-sm text-slate-400 hover:text-white">
              Change File
            </button>
          </div>

          {error && <div className="text-danger bg-danger/10 p-3 rounded">{error}</div>}

          {!processedData && !processing && (
            <div className="bg-slate-800/50 p-5 rounded-lg border border-slate-700">
              <h4 className="font-bold text-slate-300 mb-3">1. Select Text Columns to Analyse</h4>
              <div className="flex flex-wrap gap-3 mb-6">
                {headers.map(col => (
                  <label key={col} className={`flex items-center px-3 py-2 border rounded-lg cursor-pointer transition ${selectedCols.includes(col) ? 'bg-indigo-900/50 border-indigo-500 text-indigo-200' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedCols.includes(col)}
                      onChange={() => toggleCol(col)}
                    />
                    <span className="text-sm font-medium">{col}</span>
                  </label>
                ))}
              </div>

              <h4 className="font-bold text-slate-300 mb-3">2. Select Analysis Model</h4>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none mb-6"
              >
                <option value="all">Run All Models (Misinfo, Fake News, Sentiment)</option>
                <option value="misinfo">Misinformation Detector only</option>
                <option value="fakenews">Fake News Classifier only</option>
                <option value="emosen">EmoSen Sentiment only</option>
              </select>

              <button
                onClick={runBatch}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold flex items-center justify-center transition"
              >
                <Play className="w-4 h-4 mr-2 fill-current" /> Start Batch Analysis
              </button>
            </div>
          )}

          {processing && (
            <div className="bg-slate-800/50 p-8 rounded-lg border border-slate-700 text-center">
               <div className="mb-4 flex justify-center">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
               <h4 className="text-lg font-bold text-white mb-2">Processing {data.length} rows...</h4>
               <p className="text-slate-400 mb-4">Please do not close this window.</p>
               <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden border border-slate-700">
                 <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
               </div>
               <p className="mt-2 text-indigo-400 font-bold">{progress}%</p>
            </div>
          )}

          {processedData && !processing && (
            <div className="animate-in fade-in duration-500">
               <div className="bg-success/10 border border-success/30 p-5 rounded-lg flex items-center justify-between mb-6">
                 <div className="flex items-center text-success">
                   <CheckCircle className="w-6 h-6 mr-3" />
                   <div>
                     <h4 className="font-bold">Batch Analysis Complete!</h4>
                     <p className="text-sm opacity-90">Processed {processedData.length} rows. Results appended as new columns.</p>
                   </div>
                 </div>
               </div>

               {/* Summary Charts */}
               <div className="mb-6 bg-slate-800/30 border border-slate-700 p-5 rounded-lg">
                 <h4 className="font-bold text-slate-300 mb-4 flex items-center">
                    <BarChart2 className="w-4 h-4 mr-2" /> Batch Results Summary
                 </h4>

                 {(() => {
                    const stats = { labels: {}, langs: {}, conf: [], total: 0 };
                    processedData.forEach(row => {
                      selectedCols.forEach(col => {
                        stats.total++;
                        // Accumulate labels based on model type
                        let label = null;
                        if (modelType === 'all' || modelType === 'misinfo') label = row[`${col}_misinfo`];
                        if (!label && (modelType === 'all' || modelType === 'fakenews')) label = row[`${col}_fakenews`];
                        if (!label && (modelType === 'all' || modelType === 'emosen')) label = row[`${col}_sentiment`];

                        if (label) {
                          stats.labels[label] = (stats.labels[label] || 0) + 1;
                        }

                        if (row[`${col}_langs`]) {
                           row[`${col}_langs`].split(', ').forEach(l => {
                             stats.langs[l] = (stats.langs[l] || 0) + 1;
                           });
                        }
                      });
                    });

                    const pieData = Object.entries(stats.labels).map(([name, value]) => ({name, value}));
                    const langData = Object.entries(stats.langs).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pieData.length > 0 && (
                          <div className="h-48 border border-slate-700/50 rounded bg-slate-900/50 flex flex-col items-center justify-center">
                            <span className="text-xs text-slate-400 mb-2 mt-2 font-medium">Primary Label Distribution</span>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                  {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {langData.length > 0 && (
                          <div className="h-48 border border-slate-700/50 rounded bg-slate-900/50 p-3 overflow-y-auto">
                            <span className="text-xs text-slate-400 mb-2 font-medium block">Language Presence</span>
                            <table className="w-full text-xs text-left">
                              <tbody>
                                {langData.map(l => (
                                  <tr key={l.name} className="border-b border-slate-800/50">
                                    <td className="py-1.5 font-medium">{l.name}</td>
                                    <td className="py-1.5 text-right text-indigo-400">{l.value} rows</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                 })()}
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => downloadResults('csv')} className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white py-4 rounded-lg font-bold transition">
                   <Download className="w-5 h-5 mr-2" /> Download CSV
                 </button>
                 <button onClick={() => downloadResults('excel')} className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white py-4 rounded-lg font-bold transition">
                   <Download className="w-5 h-5 mr-2 text-emerald-400" /> Download Excel
                 </button>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
