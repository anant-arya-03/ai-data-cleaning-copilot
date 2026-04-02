import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { API_URL } from '../../config';

const BatchAnalysis = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [modelType, setModelType] = useState('smart');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setResults(null);

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
      const csv = Papa.unparse(results);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nlp_analysis_results.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(flattenedResults);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `nlp_analysis_results.xlsx`);
    }
  };

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

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-slate-200">
                 <thead className="bg-slate-50">
                   <tr>
                     {Object.keys(results[0]).slice(0, 8).map(key => (
                       <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                         {key}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-slate-200">
                   {results.slice(0, 10).map((row, i) => (
                     <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                       {Object.keys(results[0]).slice(0, 8).map(key => (
                         <td key={key} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap max-w-[200px] truncate">
                           {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             {results.length > 10 && (
                <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                  Showing first 10 rows. Export to see all {results.length} rows.
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchAnalysis;
