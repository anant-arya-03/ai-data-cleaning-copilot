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
  const [modelType, setModelType] = useState('smart');

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

        const detectedText = cols.filter(c => {
          const val = results.data[0][c];
          return typeof val === 'string' && isNaN(Number(val));
        });
        setTextCols(detectedText);
        setSelectedCols(detectedText.slice(0, 1));
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
           continue;
        }

        try {
          const res = await axios.post(`${apiUrl}/predict/${modelType}`, { text });

          if (modelType === 'smart') {
             row[`${col}_routed`] = res.data.routed_to || null;
             if (res.data.routed_to === 'emosen') {
                row[`${col}_sentiment`] = res.data.label || null;
                row[`${col}_sentiment_conf`] = res.data.confidence || null;
             } else {
                row[`${col}_misinfo`] = res.data.misinfo?.label || null;
                row[`${col}_misinfo_conf`] = res.data.misinfo?.confidence || null;
                row[`${col}_fakenews`] = res.data.fakenews?.label || null;
                row[`${col}_fakenews_conf`] = res.data.fakenews?.confidence || null;
             }
          } else if (modelType === 'all') {
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
    <div className="flex flex-col md:flex-row gap-6 h-full">

      {/* Left Pane - Input & Config */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center text-slate-800">
            <Database className="w-5 h-5 mr-2 text-indigo-500" />
            Batch CSV Analysis
          </h2>
          {file && (
             <button onClick={() => { setFile(null); setData([]); setProcessedData(null); }} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
               Change File
             </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!file ? (
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100 rounded-xl p-12 text-center cursor-pointer transition-colors shadow-sm flex flex-col items-center justify-center min-h-[300px]"
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-12 h-12 text-indigo-400 mb-4" />
              <p className="text-lg text-slate-700 font-bold">Drag & drop your CSV file here</p>
              <p className="text-slate-500 mt-2 text-sm font-medium">To begin batch processing</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center">
                <FileSpreadsheet className="w-8 h-8 text-indigo-500 mr-4" />
                <div>
                  <p className="font-bold text-slate-800 text-lg">{file.name}</p>
                  <p className="text-sm text-slate-500 font-medium">{data.length.toLocaleString()} rows loaded successfully</p>
                </div>
              </div>

              {error && <div className="text-rose-700 bg-rose-50 border border-rose-200 p-4 rounded-lg font-bold text-sm shadow-sm">{error}</div>}

              {!processedData && !processing && (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                  <h4 className="font-bold text-slate-700 mb-3 flex items-center"><span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-indigo-600 shadow-sm border border-slate-200 mr-2 text-xs">1</span> Select Text Columns</h4>
                  <div className="flex flex-wrap gap-2 mb-8 ml-8">
                    {headers.map(col => (
                      <label key={col} className={`flex items-center px-4 py-2 border rounded-lg cursor-pointer transition shadow-sm ${selectedCols.includes(col) ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedCols.includes(col)}
                          onChange={() => toggleCol(col)}
                        />
                        <span className="text-sm font-bold">{col}</span>
                      </label>
                    ))}
                  </div>

                  <h4 className="font-bold text-slate-700 mb-3 flex items-center"><span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-indigo-600 shadow-sm border border-slate-200 mr-2 text-xs">2</span> Select Analysis Model</h4>
                  <div className="ml-8 mb-8">
                    <select
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-bold"
                    >
                      <option value="smart">Auto-Route (Smart Predict)</option>
                      <option value="all">Run All Models</option>
                      <option value="misinfo">Misinformation Detector only</option>
                      <option value="fakenews">Fake News Classifier only</option>
                      <option value="emosen">EmoSen Sentiment only</option>
                    </select>
                  </div>

                  <button
                    onClick={runBatch}
                    className="w-full ml-8 max-w-[calc(100%-2rem)] bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold flex items-center justify-center transition shadow-md hover:shadow-lg"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" /> Start Batch Analysis
                  </button>
                </div>
              )}

              {processing && (
                <div className="bg-white p-10 rounded-xl border border-slate-200 text-center shadow-sm">
                   <div className="mb-6 flex justify-center">
                      <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                   </div>
                   <h4 className="text-xl font-bold text-slate-800 mb-2">Processing {data.length.toLocaleString()} rows...</h4>
                   <p className="text-slate-500 mb-6 font-medium">Please do not close this window.</p>
                   <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 shadow-inner">
                     <div className="bg-indigo-500 h-full transition-all duration-300 relative" style={{ width: `${progress}%` }}>
                        <div className="absolute inset-0 bg-white/20 w-full h-full" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)'}}></div>
                     </div>
                   </div>
                   <p className="mt-3 text-indigo-600 font-black text-2xl">{progress}%</p>
                </div>
              )}

              {processedData && !processing && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex items-center mb-6 shadow-sm">
                    <CheckCircle className="w-8 h-8 mr-4 text-emerald-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-800 text-lg">Batch Analysis Complete!</h4>
                      <p className="text-sm font-medium text-emerald-600">Processed {processedData.length.toLocaleString()} rows. Results are shown in the right panel.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <button onClick={() => downloadResults('csv')} className="flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-xl font-bold transition shadow-sm hover:shadow-md">
                       <Download className="w-5 h-5 mr-2 text-indigo-500" /> Download CSV
                     </button>
                     <button onClick={() => downloadResults('excel')} className="flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-xl font-bold transition shadow-sm hover:shadow-md">
                       <Download className="w-5 h-5 mr-2 text-emerald-500" /> Download Excel
                     </button>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Results Summary */}
      <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col bg-slate-50 rounded-xl shadow-inner border border-slate-200 overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
           <h2 className="text-lg font-bold text-slate-800">Results Summary</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
           {!processedData ? (
             <div className="h-full flex items-center justify-center text-slate-400 font-medium text-center px-6">
               Configure and run batch analysis on the left to see distribution charts here.
             </div>
           ) : (
             <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">

               <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                 <h4 className="font-bold text-slate-800 mb-4 flex items-center border-b border-slate-100 pb-2">
                    <BarChart2 className="w-4 h-4 mr-2 text-indigo-500" /> Primary Label Distribution
                 </h4>

                 {(() => {
                    const stats = { labels: {}, langs: {}, total: 0 };
                    processedData.forEach(row => {
                      selectedCols.forEach(col => {
                        stats.total++;
                        let label = null;
                        if (modelType === 'smart') label = row[`${col}_routed`] === 'emosen' ? row[`${col}_sentiment`] : (row[`${col}_misinfo`] || row[`${col}_fakenews`]);
                        else if (modelType === 'all' || modelType === 'misinfo') label = row[`${col}_misinfo`];
                        else if (modelType === 'fakenews') label = row[`${col}_fakenews`];
                        else if (modelType === 'emosen') label = row[`${col}_sentiment`];

                        if (!label && row[`${col}_fakenews`]) label = row[`${col}_fakenews`];
                        if (!label && row[`${col}_sentiment`]) label = row[`${col}_sentiment`];

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
                      <div className="space-y-6">
                        {pieData.length > 0 ? (
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                  {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">No labels generated for this run.</p>
                        )}

                        {langData.length > 0 && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-bold text-xs text-slate-600 uppercase tracking-wider">
                               Language Presence
                            </div>
                            <table className="w-full text-sm text-left bg-white">
                              <tbody className="divide-y divide-slate-100">
                                {langData.map(l => (
                                  <tr key={l.name} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2.5 px-3 font-bold text-slate-700">{l.name}</td>
                                    <td className="py-2.5 px-3 text-right text-indigo-600 font-mono font-bold text-xs">{l.value} <span className="text-slate-400 font-sans">rows</span></td>
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

             </div>
           )}
        </div>
      </div>
    </div>
  );
}
