import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, LayoutDashboard, Database, AlertCircle, Sparkles, Download } from 'lucide-react';
import { cn } from '../../utils';
import Step1Upload from './Step1Upload';
import Step2Profile from './Step2Profile';
import Step3MissingValues from './Step3MissingValues';
import Step4FlashFill from './Step4FlashFill';
import Step5Anomalies from './Step5Anomalies';
import Step6Export from './Step6Export';
import { API_URL } from '../../config';

export default function NormalModeApp() {
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [colTypes, setColTypes] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [profileData, setProfileData] = useState(null);

  const [activeTab, setActiveTab] = useState('insights'); // insights, missing, transformations, anomalies, export

  const handleUploadSuccess = (data) => {
    setDatasetInfo({
      filename: data.filename,
      rows: data.rows,
      columns: data.columns,
    });
    setPreviewData(data.preview);
    setColTypes(data.col_types);
    setActiveTab('insights'); // Switch to insights after successful load
  };

  const refreshProfile = async () => {
     try {
       const res = await axios.get(`${API_URL}/profile`);
       setProfileData(res.data);
     } catch (err) {
       console.error("Failed to refresh profile");
     }
  };

  if (!datasetInfo) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <div className="card-panel text-center p-16">
           <UploadCloud className="w-20 h-20 mx-auto text-indigo-200 mb-6" />
           <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload a Dataset</h2>
           <p className="text-slate-500 mb-8">Begin your data cleaning journey by uploading a CSV file.</p>
           <Step1Upload
              apiUrl={API_URL}
              onSuccess={handleUploadSuccess}
              colTypes={colTypes}
              setColTypes={setColTypes}
              previewData={previewData}
           />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-160px)]">

      {/* LEFT PANE - Data Table */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
           <div>
             <h2 className="text-xl font-bold flex items-center text-slate-800">
               <Database className="w-5 h-5 mr-2 text-indigo-500" />
               {datasetInfo.filename}
             </h2>
             <p className="text-sm text-slate-500 mt-1 font-medium">
               {datasetInfo.rows.toLocaleString()} rows • {datasetInfo.columns} columns
             </p>
           </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto bg-white p-4">
           {colTypes && previewData && (
             <table className="w-full text-sm text-left border-collapse min-w-max">
               <thead className="sticky top-0 bg-slate-50 shadow-sm border-b border-slate-300 z-10">
                 <tr>
                   {Object.keys(colTypes).map((col) => (
                     <th key={col} className="px-4 py-3 font-semibold text-slate-700 bg-slate-50">
                       <div className="flex flex-col">
                         <span>{col}</span>
                         <span className="text-[10px] uppercase text-indigo-600 tracking-wider font-bold mt-1">
                           {colTypes[col].type}
                         </span>
                       </div>
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {previewData.map((row, idx) => (
                   <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                     {Object.keys(colTypes).map(col => (
                       <td key={col} className="px-4 py-3 text-slate-600 truncate max-w-[200px]">
                         {row[col] === null || row[col] === "" ? (
                           <span className="text-rose-400 italic bg-rose-50 px-1 rounded text-xs border border-rose-100">null</span>
                         ) : (
                           String(row[col])
                         )}
                       </td>
                     ))}
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
           <p className="text-center text-xs text-slate-400 mt-4 italic pb-4">Showing first 10 rows preview.</p>
        </div>
      </div>

      {/* RIGHT PANE - Sidebar Actions */}
      <div className="w-full md:w-[450px] lg:w-[500px] flex flex-col bg-slate-50 rounded-xl shadow-inner border border-slate-200 overflow-hidden">

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto bg-white border-b border-slate-200 p-2 gap-2 hide-scrollbar">
           <button onClick={() => setActiveTab('insights')} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", activeTab === 'insights' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
             <LayoutDashboard className="w-4 h-4 inline mr-1.5"/> Insights
           </button>
           <button onClick={() => setActiveTab('missing')} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", activeTab === 'missing' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
             <AlertCircle className="w-4 h-4 inline mr-1.5"/> Missing Values
           </button>
           <button onClick={() => setActiveTab('transformations')} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", activeTab === 'transformations' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
             <Sparkles className="w-4 h-4 inline mr-1.5"/> FlashFill
           </button>
           <button onClick={() => setActiveTab('anomalies')} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", activeTab === 'anomalies' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
             <Database className="w-4 h-4 inline mr-1.5"/> Anomalies
           </button>
           <button onClick={() => setActiveTab('export')} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors", activeTab === 'export' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
             <Download className="w-4 h-4 inline mr-1.5"/> Export
           </button>
        </div>

        {/* Dynamic Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
           {activeTab === 'insights' && (
             <Step2Profile
                apiUrl={API_URL}
                profileData={profileData}
                setProfileData={setProfileData}
                colTypes={colTypes}
                datasetInfo={datasetInfo}
                setDatasetInfo={setDatasetInfo}
              />
           )}
           {activeTab === 'missing' && (
             <Step3MissingValues
                apiUrl={API_URL}
                colTypes={colTypes}
                profileData={profileData}
                setProfileData={setProfileData}
                onRefreshPreview={refreshProfile}
              />
           )}
           {activeTab === 'transformations' && (
             <Step4FlashFill
                apiUrl={API_URL}
                colTypes={colTypes}
                setColTypes={setColTypes}
              />
           )}
           {activeTab === 'anomalies' && (
             <Step5Anomalies
                apiUrl={API_URL}
                colTypes={colTypes}
                setDatasetInfo={setDatasetInfo}
              />
           )}
           {activeTab === 'export' && (
             <Step6Export
                apiUrl={API_URL}
                datasetInfo={datasetInfo}
              />
           )}
        </div>
      </div>

    </div>
  );
}
