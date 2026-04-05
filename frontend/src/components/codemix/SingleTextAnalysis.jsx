import React, { useState } from 'react';
import axios from 'axios';
import { Send, Zap, MessageSquareQuote, ShieldAlert, AlertCircle, Smile } from 'lucide-react';
import { cn } from '../../utils';

const ENDPOINTS = {
  all: '/predict/all',
  misinfo: '/predict/misinfo',
  fakenews: '/predict/fakenews',
  emosen: '/predict/emosen',
  smart: '/predict/smart',
  text: '/predict/text'
};

export default function SingleTextAnalysis({ apiUrl }) {
  const [text, setText] = useState('');
  const [modelType, setModelType] = useState('smart');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyse = async () => {
    if (text.trim().length < 3) {
      setError("Please enter at least a few words.");
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(`${apiUrl}${ENDPOINTS[modelType]}`, { text });

      if (modelType === 'all' || modelType === 'smart') {
        setResult(res.data);
      } else if (modelType === 'text') {
         setResult({ text_analysis: res.data.text_analysis });
      } else {
         const { text_analysis, ...modelData } = res.data;
         setResult({ text_analysis, [modelType]: modelData });
      }
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const renderConfidenceBar = (score, colorClass) => (
    <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden border border-slate-200">
      <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${score}%` }}></div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Left Pane - Input */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
          <MessageSquareQuote className="w-5 h-5 text-indigo-500 mr-2" />
          <h2 className="text-xl font-bold text-slate-800">Text Input</h2>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text, tweet, or news headline here (supports Hinglish/Code-Mix)..."
            className="w-full flex-1 bg-white border border-slate-300 rounded-xl p-5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none font-medium shadow-inner"
          />

          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold shadow-sm"
            >
              <option value="smart">Auto-Route (Smart Predict)</option>
              <option value="all">Run All Models</option>
              <option value="misinfo">Misinformation Detector only</option>
              <option value="fakenews">Fake News Classifier only</option>
              <option value="emosen">EmoSen Sentiment only</option>
              <option value="text">Text Analysis only (No ML)</option>
            </select>

            <button
              onClick={handleAnalyse}
              disabled={loading || !text.trim()}
              className="sm:w-48 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center"
            >
              {loading ? (
                <><Zap className="w-5 h-5 mr-2 fill-current animate-pulse" /> Analysing...</>
              ) : (
                <><Send className="w-5 h-5 mr-2" /> Analyse</>
              )}
            </button>
          </div>

          {error && <div className="text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg font-bold flex items-center shadow-sm"><AlertCircle className="w-5 h-5 mr-2"/>{error}</div>}
        </div>
      </div>

      {/* Right Pane - Results */}
      <div className="w-full md:w-[450px] lg:w-[500px] flex flex-col bg-slate-50 rounded-xl shadow-inner border border-slate-200 overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
           <h2 className="text-lg font-bold text-slate-800">Analysis Results</h2>
           {result && result.routed_to && (
             <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100">
               Routed: {result.routed_to}
             </span>
           )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
           {!result ? (
             <div className="h-full flex items-center justify-center text-slate-400 font-medium">
               Run an analysis to see results here.
             </div>
           ) : (
             <div className="animate-in slide-in-from-right-4 fade-in duration-500 space-y-6">

               {/* Models */}
               {modelType !== 'text' && (
                 <div className="space-y-4">
                    {(modelType === 'all' || modelType === 'smart' || modelType === 'misinfo') && result.misinfo && !result.misinfo.error && (
                      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
                        <div className={cn("absolute top-0 left-0 w-1.5 h-full", result.misinfo.label === 'misinfo' ? 'bg-rose-500' : 'bg-emerald-500')}></div>
                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                          <ShieldAlert className="w-4 h-4 mr-2" /> Misinformation Detector
                        </h4>
                        <div className="flex justify-between items-end mb-1">
                          <span className={cn("text-2xl font-black uppercase tracking-wide", result.misinfo.label === 'misinfo' ? 'text-rose-600' : 'text-emerald-600')}>
                            {result.misinfo.label === 'misinfo' ? 'Misinfo' : 'Safe'}
                          </span>
                          <span className="text-slate-500 font-mono text-sm font-bold">{result.misinfo.confidence}%</span>
                        </div>
                        {renderConfidenceBar(result.misinfo.confidence, result.misinfo.label === 'misinfo' ? 'bg-rose-500' : 'bg-emerald-500')}
                      </div>
                    )}

                    {(modelType === 'all' || modelType === 'smart' || modelType === 'fakenews') && result.fakenews && !result.fakenews.error && (
                      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
                        <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                           ['fake', 'mostly fake'].includes(result.fakenews.label) ? 'bg-rose-500' :
                           ['true', 'mostly true'].includes(result.fakenews.label) ? 'bg-emerald-500' : 'bg-amber-500'
                        )}></div>
                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                          <AlertCircle className="w-4 h-4 mr-2" /> Fake News Classifier
                        </h4>
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-2xl font-black uppercase tracking-wide flex items-center text-slate-800">
                            {result.fakenews.emoji} <span className="ml-2">{result.fakenews.label}</span>
                          </span>
                          <span className="text-slate-500 font-mono text-sm font-bold">{result.fakenews.confidence}%</span>
                        </div>

                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                          {Object.entries(result.fakenews.all_scores).map(([label, score]) => (
                             <div key={label} className="flex items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                               <span className="w-24 truncate">{label}</span>
                               <div className="flex-1 mx-2 bg-slate-100 rounded-full h-1.5">
                                 <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${score}%` }}></div>
                               </div>
                               <span className="w-8 text-right font-mono">{score.toFixed(0)}</span>
                             </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(modelType === 'all' || modelType === 'smart' || modelType === 'emosen') && result.emosen && !result.emosen.error && (
                      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
                        <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                           result.emosen.label.toLowerCase() === 'positive' ? 'bg-emerald-500' :
                           result.emosen.label.toLowerCase() === 'negative' ? 'bg-rose-500' : 'bg-slate-400'
                        )}></div>
                        <h4 className="font-bold text-slate-700 flex items-center mb-3">
                          <Smile className="w-4 h-4 mr-2" /> EmoSen (Code-Mix Sentiment)
                        </h4>
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-2xl font-black uppercase tracking-wide flex items-center text-slate-800">
                            {result.emosen.emoji} <span className="ml-2">{result.emosen.label}</span>
                          </span>
                          <span className="text-slate-500 font-mono text-sm font-bold">{result.emosen.confidence}%</span>
                        </div>

                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                          {Object.entries(result.emosen.all_scores).map(([label, score]) => (
                             <div key={label} className="flex-1 bg-slate-50 rounded p-2 text-center border border-slate-200 shadow-sm">
                               <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</div>
                               <div className="font-mono text-sm font-black text-slate-700 mt-1">{score}%</div>
                             </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
               )}

               {/* Text Analysis */}
               {result.text_analysis && (
                 <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                   <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Linguistics & Text Stats</h4>

                   <div className="space-y-5">
                      {/* Languages */}
                      <div>
                        <div className="flex flex-wrap gap-2 mb-3">
                           {result.text_analysis.languages_detected.map(l => (
                             <span key={l} className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px] uppercase shadow-sm">{l}</span>
                           ))}
                           {result.text_analysis.scripts_detected.map(s => (
                             <span key={s} className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded font-bold text-[10px] uppercase shadow-sm">{s} Script</span>
                           ))}
                        </div>

                        {result.text_analysis.code_mix_ratio > 0 && (
                          <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                              <span>Pure English</span>
                              <span className="text-indigo-600">Code-Mix Ratio: {(result.text_analysis.code_mix_ratio * 100).toFixed(0)}%</span>
                              <span>Hindi Roman</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex shadow-inner">
                               <div className="bg-slate-400 h-full" style={{ width: `${(1 - result.text_analysis.code_mix_ratio)*100}%`}}></div>
                               <div className="bg-indigo-500 h-full" style={{ width: `${result.text_analysis.code_mix_ratio*100}%`}}></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Slangs */}
                      <div>
                        <h5 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold flex items-center justify-between">
                          Detected Slangs & Entities
                          {result.text_analysis.slang_analysis.slang_count > 0 &&
                            <span className="bg-indigo-100 px-2 py-0.5 rounded-full text-indigo-700 border border-indigo-200 shadow-sm">
                              {result.text_analysis.slang_analysis.slang_count} found
                            </span>
                          }
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                           {result.text_analysis.slang_analysis.internet_slang.map(s => (
                             <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold text-[10px] uppercase shadow-sm">{s}</span>
                           ))}
                           {result.text_analysis.slang_analysis.hinglish_slang.map(s => (
                             <span key={s} className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-bold text-[10px] uppercase shadow-sm">{s}</span>
                           ))}
                           {result.text_analysis.slang_analysis.abbreviations.map(s => (
                             <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded font-bold text-[10px] uppercase shadow-sm">{s} (abbr)</span>
                           ))}
                           {result.text_analysis.slang_analysis.emojis_present.map(e => (
                             <span key={e} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-sm shadow-sm">{e}</span>
                           ))}
                           {result.text_analysis.slang_analysis.slang_count === 0 && result.text_analysis.slang_analysis.emojis_present.length === 0 && (
                              <span className="text-xs text-slate-400 italic font-medium">None detected.</span>
                           )}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div>
                         <div className="grid grid-cols-4 gap-2">
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-200 shadow-sm">
                               <div className="text-lg font-black text-indigo-600">{result.text_analysis.text_stats.word_count}</div>
                               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Words</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-200 shadow-sm">
                               <div className="text-lg font-black text-indigo-600">{result.text_analysis.text_stats.char_count}</div>
                               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Chars</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-200 shadow-sm">
                               <div className="text-lg font-black text-indigo-600">{result.text_analysis.text_stats.sentence_count}</div>
                               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Sents</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-200 shadow-sm">
                               <div className="text-lg font-black text-indigo-600">{result.text_analysis.text_stats.avg_word_length}</div>
                               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Avg Len</div>
                            </div>
                         </div>
                      </div>
                   </div>
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
