import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API_URL } from '../../config';
import { cn } from '../../utils';
import { ShieldAlert, AlertCircle, Smile, ChevronDown, ChevronUp } from 'lucide-react';

const BatchAnalysis = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [modelType, setModelType] = useState('smart');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [activeTab, setActiveTab] = useState('Model Result');

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setResults(null);
    setExpandedRow(null);

    // Parse headers to let user select the text column
    if (uploadedFile.name.endsWith('.csv')) {
      Papa.parse(uploadedFile, {
        header: true,
        preview: 1, // just need headers
        complete: (results) => {
          if (results.meta && results.meta.fields) {
            setColumns(results.meta.fields);
            setSelectedColumn(results.meta.fields[0]);
          }
        },
        error: (err) => {
          setError('Failed to parse CSV headers: ' + err.message);
        }
      });
    } else if (uploadedFile.name.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const header = XLSX.utils.sheet_to_json(worksheet, {header: 1})[0];
            if (header) {
                setColumns(header);
                setSelectedColumn(header[0]);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    } else {
        setError("Unsupported file format. Please upload a CSV or Excel file.");
    }
  };

  const runAnalysis = async () => {
    if (!file || !selectedColumn) {
      setError('Please upload a file and select a column to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(10); // Start progress

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_type', modelType);
    formData.append('column', selectedColumn);

    try {
      const response = await fetch(`${API_URL}/nlp/batch_file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Analysis failed');
      }

      setProgress(90);
      const data = await response.json();

      // We expect the backend to return { results: [...], data: [...] }
      // where 'data' is the original CSV augmented with the new columns
      setResults(data.data || []);
      setProgress(100);

    } catch (err) {
      setError(err.message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = (format) => {
    if (!results || results.length === 0) return;

    if (format === 'csv') {
      const csv = Papa.unparse(results.map(row => {
          const { full_analysis, ...rest } = row;
          return rest;
      }));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nlp_analysis_results.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(results.map(row => {
          const { full_analysis, ...rest } = row;
          return rest;
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `nlp_analysis_results.xlsx`);
    }
  };

  const tabs = ['Model Result', 'Scripts & Languages', 'Slang Detected', 'Phoneme Hints', 'Text Stats'];

  const renderConfidenceBar = (score, colorClass) => (
    <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden border border-slate-200">
      <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${score}%` }}></div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
        <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        Batch File Analysis
      </h2>

      {/* Upload Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">1. Upload Dataset (CSV or Excel)</label>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex justify-center items-center bg-slate-50 hover:bg-slate-100 transition-colors">
          <input
            type="file"
            accept=".csv, .xlsx"
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        {file && <p className="mt-2 text-sm text-slate-600">Selected file: <span className="font-semibold text-slate-800">{file.name}</span></p>}
      </div>

      {/* Configuration Section */}
      {columns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">2. Select Text Column</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white p-2 border"
            >
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">3. Select Model</label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white p-2 border"
            >
              <option value="smart">Smart Router (Auto-detect)</option>
              <option value="all">All Models</option>
              <option value="misinfo">Misinformation Detection</option>
              <option value="fakenews">Fake News Classification</option>
              <option value="emosen">Sentiment Analysis</option>
              <option value="text">Text Analysis Only</option>
            </select>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={runAnalysis}
          disabled={!file || !selectedColumn || loading}
          className={`flex items-center px-6 py-3 rounded-lg text-white font-medium transition-colors ${
            !file || !selectedColumn || loading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing... {progress}%
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Batch Analysis
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md flex items-start">
          <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="mt-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Analysis Complete
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => exportResults('csv')}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportResults('excel')}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="bg-green-50 text-green-800 p-4 rounded-lg border border-green-200 mb-6">
            <p className="font-medium">Successfully processed {results.length} rows.</p>
            <p className="text-sm mt-1 text-green-700">Click the export buttons above to download the detailed results appended to your data.</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex">
             <div className="w-full">
               <table className="min-w-full divide-y divide-slate-200">
                 <thead className="bg-slate-50">
                   <tr>
                     <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10"></th>
                     {Object.keys(results[0]).filter(k => k !== 'full_analysis').slice(0, 4).map(key => (
                       <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                         {key}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-slate-200">
                   {results.slice(0, 10).map((row, i) => (
                     <React.Fragment key={i}>
                         <tr className={cn("hover:bg-slate-50 cursor-pointer transition-colors", expandedRow === i ? "bg-indigo-50" : i % 2 === 0 ? 'bg-white' : 'bg-slate-50')} onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                           <td className="px-4 py-3 text-slate-400">
                              {expandedRow === i ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                           </td>
                           {Object.keys(results[0]).filter(k => k !== 'full_analysis').slice(0, 4).map(key => (
                             <td key={key} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap max-w-[200px] truncate">
                               {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                             </td>
                           ))}
                         </tr>

                         {expandedRow === i && row.full_analysis && (
                             <tr>
                                 <td colSpan={5} className="p-0 border-b border-slate-200">
                                     <div className="p-6 bg-slate-50 shadow-inner">
                                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                                            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
                                              {tabs.map((tab) => {
                                                 if (modelType === 'text' && tab === 'Model Result') return null;
                                                 return (
                                                    <button
                                                      key={tab}
                                                      onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                                                      className={cn(
                                                        "px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm",
                                                        activeTab === tab
                                                          ? "bg-indigo-600 text-white border border-indigo-700"
                                                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                                      )}
                                                    >
                                                      {tab}
                                                    </button>
                                                 );
                                              })}
                                            </div>

                                            {/* MODEL RESULT TAB (BATCH) */}
                                            {activeTab === 'Model Result' && modelType !== 'text' && (
                                                <div className="space-y-6">
                                                    {(modelType === 'all' || modelType === 'smart' || modelType === 'misinfo') && row.full_analysis.misinfo && !row.full_analysis.misinfo.error && (
                                                    <div className="relative overflow-hidden p-4 rounded-lg border border-slate-100 bg-slate-50">
                                                        <div className={cn("absolute top-0 left-0 w-1.5 h-full", row.full_analysis.misinfo.label === 'misinfo' ? 'bg-rose-500' : 'bg-emerald-500')}></div>
                                                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                                                        <ShieldAlert className="w-4 h-4 mr-2" /> Misinformation Detector
                                                        </h4>
                                                        <div className="flex justify-between items-end mb-1">
                                                        <span className={cn("text-2xl font-black uppercase tracking-wide", row.full_analysis.misinfo.label === 'misinfo' ? 'text-rose-600' : 'text-emerald-600')}>
                                                            {row.full_analysis.misinfo.label === 'misinfo' ? 'Misinfo' : 'Safe'}
                                                        </span>
                                                        <span className="text-slate-500 font-mono text-sm font-bold">{row.full_analysis.misinfo.confidence}%</span>
                                                        </div>
                                                        {renderConfidenceBar(row.full_analysis.misinfo.confidence, row.full_analysis.misinfo.label === 'misinfo' ? 'bg-rose-500' : 'bg-emerald-500')}
                                                    </div>
                                                    )}

                                                    {(modelType === 'all' || modelType === 'smart' || modelType === 'fakenews') && row.full_analysis.fakenews && !row.full_analysis.fakenews.error && (
                                                    <div className="relative overflow-hidden p-4 rounded-lg border border-slate-100 bg-slate-50">
                                                        <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                                                        ['fake', 'mostly fake', 'False'].includes(row.full_analysis.fakenews.label) ? 'bg-rose-500' :
                                                        ['true', 'mostly true'].includes(row.full_analysis.fakenews.label) ? 'bg-emerald-500' : 'bg-amber-500'
                                                        )}></div>
                                                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                                                        <AlertCircle className="w-4 h-4 mr-2" /> Fake News Classifier
                                                        </h4>
                                                        <div className="flex justify-between items-end mb-4">
                                                        <span className="text-2xl font-black uppercase tracking-wide flex items-center text-slate-800">
                                                            {row.full_analysis.fakenews.emoji} <span className="ml-2">{row.full_analysis.fakenews.label}</span>
                                                        </span>
                                                        <span className="text-slate-500 font-mono text-sm font-bold">{row.full_analysis.fakenews.confidence}%</span>
                                                        </div>
                                                    </div>
                                                    )}

                                                    {(modelType === 'all' || modelType === 'smart' || modelType === 'emosen') && row.full_analysis.emosen && !row.full_analysis.emosen.error && (
                                                    <div className="relative overflow-hidden p-4 rounded-lg border border-slate-100 bg-slate-50">
                                                        <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                                                        row.full_analysis.emosen.label.toLowerCase() === 'positive' ? 'bg-emerald-500' :
                                                        row.full_analysis.emosen.label.toLowerCase() === 'negative' ? 'bg-rose-500' : 'bg-slate-400'
                                                        )}></div>
                                                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                                                        <Smile className="w-4 h-4 mr-2" /> EmoSen (Code-Mix Sentiment)
                                                        </h4>
                                                        <div className="flex justify-between items-end mb-4">
                                                        <span className="text-2xl font-black uppercase tracking-wide flex items-center text-slate-800">
                                                            {row.full_analysis.emosen.emoji} <span className="ml-2">{row.full_analysis.emosen.label}</span>
                                                        </span>
                                                        <span className="text-slate-500 font-mono text-sm font-bold">{row.full_analysis.emosen.confidence}%</span>
                                                        </div>
                                                    </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* SCRIPTS & LANGUAGES TAB (BATCH) */}
                                            {activeTab === 'Scripts & Languages' && row.full_analysis.text_analysis && (
                                                <div className="space-y-6">
                                                    <div>
                                                        <h4 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider">Detected Scripts</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {row.full_analysis.text_analysis.scripts_detected.map(s => (
                                                                <span key={s} className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs shadow-sm">{s}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider">Detected Languages</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {row.full_analysis.text_analysis.languages_detected.map(l => (
                                                                <span key={l} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs shadow-sm">{l}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* SLANG DETECTED TAB (BATCH) */}
                                            {activeTab === 'Slang Detected' && row.full_analysis.text_analysis && (
                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                                                        <h4 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Slang & Entities Analysis</h4>
                                                        <span className="bg-indigo-100 px-3 py-1 rounded-full text-indigo-700 border border-indigo-200 shadow-sm text-xs font-bold">
                                                            Total Found: {row.full_analysis.text_analysis.slang_analysis.slang_count}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {/* Internet Slang */}
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-500 mb-2">Internet Slang</h5>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {Array.isArray(row.full_analysis.text_analysis.slang_analysis.internet_slang) ?
                                                                    row.full_analysis.text_analysis.slang_analysis.internet_slang.map((s, idx) => (
                                                                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex justify-between items-center shadow-sm">
                                                                            <span className="font-bold text-blue-800 text-sm">{s}</span>
                                                                        </div>
                                                                    )) :
                                                                    Object.entries(row.full_analysis.text_analysis.slang_analysis.internet_slang || {}).map(([s, meaning], idx) => (
                                                                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex flex-col shadow-sm">
                                                                            <span className="font-bold text-blue-800 text-sm">{s}</span>
                                                                            <span className="text-xs text-blue-600 mt-1 flex items-center">
                                                                                <span className="text-blue-300 mr-1">↳</span> {meaning}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                }
                                                                {(!row.full_analysis.text_analysis.slang_analysis.internet_slang ||
                                                                  (Array.isArray(row.full_analysis.text_analysis.slang_analysis.internet_slang) && row.full_analysis.text_analysis.slang_analysis.internet_slang.length === 0) ||
                                                                  (!Array.isArray(row.full_analysis.text_analysis.slang_analysis.internet_slang) && Object.keys(row.full_analysis.text_analysis.slang_analysis.internet_slang).length === 0)) &&
                                                                    <span className="text-sm text-slate-400 italic">None detected</span>}
                                                            </div>
                                                        </div>

                                                        {/* Hinglish Slang */}
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-500 mb-2">Hinglish Slang</h5>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {Array.isArray(row.full_analysis.text_analysis.slang_analysis.hinglish_slang) ?
                                                                    row.full_analysis.text_analysis.slang_analysis.hinglish_slang.map((s, idx) => (
                                                                        <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-2 flex justify-between items-center shadow-sm">
                                                                            <span className="font-bold text-orange-800 text-sm">{s}</span>
                                                                        </div>
                                                                    )) :
                                                                    Object.entries(row.full_analysis.text_analysis.slang_analysis.hinglish_slang || {}).map(([s, meaning], idx) => (
                                                                        <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-2 flex flex-col shadow-sm">
                                                                            <span className="font-bold text-orange-800 text-sm">{s}</span>
                                                                            <span className="text-xs text-orange-600 mt-1 flex items-center">
                                                                                <span className="text-orange-300 mr-1">↳</span> {meaning}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                }
                                                                {(!row.full_analysis.text_analysis.slang_analysis.hinglish_slang ||
                                                                  (Array.isArray(row.full_analysis.text_analysis.slang_analysis.hinglish_slang) && row.full_analysis.text_analysis.slang_analysis.hinglish_slang.length === 0) ||
                                                                  (!Array.isArray(row.full_analysis.text_analysis.slang_analysis.hinglish_slang) && Object.keys(row.full_analysis.text_analysis.slang_analysis.hinglish_slang).length === 0)) &&
                                                                    <span className="text-sm text-slate-400 italic">None detected</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Abbreviations & Stretched */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-500 mb-2">Abbreviations</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {row.full_analysis.text_analysis.slang_analysis.abbreviations?.map(s => (
                                                                    <span key={s} className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold text-xs shadow-sm">{s}</span>
                                                                ))}
                                                                {(!row.full_analysis.text_analysis.slang_analysis.abbreviations || row.full_analysis.text_analysis.slang_analysis.abbreviations.length === 0) && <span className="text-sm text-slate-400 italic">None detected</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-500 mb-2">Stretched Words</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {row.full_analysis.text_analysis.slang_analysis.stretched_words?.map(s => (
                                                                    <span key={s} className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-xs shadow-sm">{s}</span>
                                                                ))}
                                                                {(!row.full_analysis.text_analysis.slang_analysis.stretched_words || row.full_analysis.text_analysis.slang_analysis.stretched_words.length === 0) && <span className="text-sm text-slate-400 italic">None detected</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Emojis */}
                                                    <div>
                                                        <h5 className="text-xs font-bold text-slate-500 mb-2">Emojis Detected</h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {row.full_analysis.text_analysis.slang_analysis.emojis_present?.map(e => (
                                                                <span key={e} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xl shadow-sm leading-none">{e}</span>
                                                            ))}
                                                            {(!row.full_analysis.text_analysis.slang_analysis.emojis_present || row.full_analysis.text_analysis.slang_analysis.emojis_present.length === 0) && <span className="text-sm text-slate-400 italic">None detected</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PHONEME HINTS TAB (BATCH) */}
                                            {activeTab === 'Phoneme Hints' && row.full_analysis.text_analysis && (
                                                <div className="space-y-4">
                                                    {row.full_analysis.text_analysis.phoneme_hints.length > 0 ? (
                                                        row.full_analysis.text_analysis.phoneme_hints.map((hint, idx) => (
                                                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 text-sm shadow-sm inline-block w-max">
                                                                        Pattern: {hint.pattern.split(' ')[0]}
                                                                    </span>
                                                                    <span className="text-xs font-medium text-slate-500 mt-2 sm:mt-0">
                                                                        {hint.pattern.substring(hint.pattern.indexOf(' ') + 1)}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Examples in text:</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {hint.examples.map(ex => (
                                                                            <span key={ex} className="bg-white border border-slate-200 px-3 py-1 rounded text-sm text-slate-700 shadow-sm font-medium">"{ex}"</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                                                            <span className="text-slate-500 font-medium">No specific phoneme patterns detected.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* TEXT STATS TAB (BATCH) */}
                                            {activeTab === 'Text Stats' && row.full_analysis.text_analysis && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{row.full_analysis.text_analysis.text_stats.word_count}</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Word Count</div>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{row.full_analysis.text_analysis.text_stats.char_count}</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Char Count</div>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{row.full_analysis.text_analysis.text_stats.sentence_count}</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Sentences</div>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{row.full_analysis.text_analysis.text_stats.avg_word_length}</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Avg Word Length</div>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{(row.full_analysis.text_analysis.text_stats.uppercase_ratio * 100).toFixed(1)}%</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Uppercase Ratio</div>
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-sm flex flex-col justify-center">
                                                        <div className="text-3xl font-black text-indigo-600">{row.full_analysis.text_analysis.text_stats.has_numbers ? 'Yes' : 'No'}</div>
                                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Contains Numbers</div>
                                                    </div>

                                                    {(row.full_analysis.text_analysis.text_stats.hashtags?.length > 0 || row.full_analysis.text_analysis.text_stats.mentions?.length > 0) && (
                                                        <div className="col-span-2 sm:col-span-3 mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            {row.full_analysis.text_analysis.text_stats.hashtags?.length > 0 && (
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hashtags</h5>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {row.full_analysis.text_analysis.text_stats.hashtags.map(h => (
                                                                            <span key={h} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-sm font-medium">{h}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {row.full_analysis.text_analysis.text_stats.mentions?.length > 0 && (
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mentions</h5>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {row.full_analysis.text_analysis.text_stats.mentions.map(m => (
                                                                            <span key={m} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-sm font-medium">{m}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                     </div>
                                 </td>
                             </tr>
                         )}
                     </React.Fragment>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchAnalysis;
