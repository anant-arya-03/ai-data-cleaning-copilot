import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertTriangle, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../utils';

const TYPE_COLORS = {
  numeric: 'bg-blue-900 text-blue-200 border-blue-700',
  categorical: 'bg-purple-900 text-purple-200 border-purple-700',
  text: 'bg-slate-700 text-slate-200 border-slate-600',
  datetime: 'bg-teal-900 text-teal-200 border-teal-700',
  boolean: 'bg-emerald-900 text-emerald-200 border-emerald-700',
  email: 'bg-indigo-900 text-indigo-200 border-indigo-700',
  phone: 'bg-orange-900 text-orange-200 border-orange-700',
  url: 'bg-cyan-900 text-cyan-200 border-cyan-700',
  id: 'bg-stone-800 text-stone-300 border-stone-600',
};

export default function Step1Upload({ apiUrl, onSuccess, onContinue, colTypes, setColTypes, previewData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fileDetails, setFileDetails] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setError("File exceeds 200MB limit.");
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${apiUrl}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFileDetails({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        rows: res.data.rows,
        columns: res.data.columns
      });
      setSuccess(true);
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const handleTypeChange = async (col, newType) => {
    try {
      await axios.post(`${apiUrl}/override_type`, { column: col, new_type: newType });
      setColTypes(prev => ({
        ...prev,
        [col]: { ...prev[col], type: newType }
      }));
    } catch (err) {
      console.error("Failed to override type");
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mr-3">1</span>
        Upload Dataset
      </h3>

      {!success ? (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors duration-200",
              isDragActive ? "border-primary bg-primary/10" : "border-slate-600 hover:border-primary hover:bg-slate-800/50"
            )}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            {loading ? (
              <div className="animate-pulse text-primary font-medium">Uploading and analysing dataset...</div>
            ) : (
              <>
                <p className="text-lg text-slate-200 font-medium">Drag & drop your CSV file here</p>
                <p className="text-slate-400 mt-2 text-sm">or click to browse files (max 200MB)</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-danger/20 border border-danger text-danger rounded-lg flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex items-center justify-between bg-success/10 border border-success/30 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-6 h-6 text-success mr-3" />
              <div>
                <p className="font-medium text-success">Dataset successfully loaded!</p>
                <p className="text-sm text-slate-400 flex items-center mt-1">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  {fileDetails.name} • {fileDetails.size} • {fileDetails.rows.toLocaleString()} rows • {fileDetails.columns} columns
                </p>
              </div>
            </div>
            <button
              onClick={onContinue}
              className="flex items-center bg-primary hover:bg-primaryHover text-white px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Continue to Profiling <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 text-sm font-medium">
              First 10 Rows Preview & Type Detection
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    {Object.keys(colTypes).map(col => (
                      <th key={col} className="px-4 py-3 border-b border-slate-700 whitespace-nowrap">
                        <div className="font-medium">{col}</div>
                        <div className="mt-2">
                          <select
                            value={colTypes[col].type}
                            onChange={(e) => handleTypeChange(col, e.target.value)}
                            className={cn(
                              "text-xs border rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary appearance-none w-full",
                              TYPE_COLORS[colTypes[col].type] || TYPE_COLORS.text
                            )}
                          >
                            {Object.keys(TYPE_COLORS).map(t => (
                              <option key={t} value={t} className="bg-slate-800 text-slate-200">{t}</option>
                            ))}
                          </select>
                        </div>
                        {colTypes[col].high_missing_warning && (
                          <div className="text-[10px] text-warning mt-1 flex items-center" title=">50% missing values">
                            <AlertTriangle className="w-3 h-3 mr-1" /> High missing %
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50 even:bg-slate-900/30">
                      {Object.keys(colTypes).map(col => (
                        <td key={col} className="px-4 py-2 truncate max-w-[200px]" title={row[col]}>
                          {row[col] === null || row[col] === "" ? <span className="text-slate-500 italic">null</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
