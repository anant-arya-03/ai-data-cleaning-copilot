import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../utils';

export default function Step1Upload({ apiUrl, onSuccess, colTypes, setColTypes, previewData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  return (
    <div className="w-full max-w-xl mx-auto">
      {!success && (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors duration-200 bg-slate-50",
              isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-100"
            )}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            {loading ? (
              <div className="animate-pulse text-indigo-600 font-medium">Uploading and analysing dataset...</div>
            ) : (
              <>
                <p className="text-lg text-slate-700 font-medium">Drag & drop your CSV file here</p>
                <p className="text-slate-500 mt-2 text-sm">or click to browse files (max 200MB)</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center shadow-sm">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 text-rose-500" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
