import React, { useState } from 'react';
import axios from 'axios';
import { Send, Zap, MessageSquareQuote, ShieldAlert, AlertCircle, Smile } from 'lucide-react';
import { cn } from '../../utils';

const ENDPOINTS = {
  all: '/predict/all',
  misinfo: '/predict/misinfo',
  fakenews: '/predict/fakenews',
  emosen: '/predict/emosen',
  text: '/analyse/text'
};

export default function SingleTextAnalysis({ apiUrl }) {
  const [text, setText] = useState('');
  const [modelType, setModelType] = useState('all');
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

      // Normalize response structure so we always have text_analysis + model results
      if (modelType === 'all') {
        setResult(res.data);
      } else if (modelType === 'text') {
         setResult({ text_analysis: res.data });
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
    <div className="w-full bg-slate-800 rounded-full h-2.5 mt-2 overflow-hidden border border-slate-700">
      <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${score}%` }}></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <h3 className="text-lg font-bold mb-4 flex items-center">
          <MessageSquareQuote className="w-5 h-5 mr-2 text-indigo-400" />
          Text Input
        </h3>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text, tweet, or news headline here (supports Hinglish/Code-Mix)..."
          className="w-full h-32 bg-slate-900/80 border border-slate-600 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
        />

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
            className="w-full md:w-auto bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Run All Models</option>
            <option value="misinfo">Misinformation Detector only</option>
            <option value="fakenews">Fake News Classifier only</option>
            <option value="emosen">EmoSen Sentiment only</option>
            <option value="text">Text Analysis only (No ML)</option>
          </select>

          <button
            onClick={handleAnalyse}
            disabled={loading || !text.trim()}
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-lg font-bold transition flex items-center justify-center shadow-lg shadow-indigo-900/20"
          >
            {loading ? (
              <span className="flex items-center"><Zap className="w-4 h-4 mr-2 animate-pulse" /> Analysing...</span>
            ) : (
              <span className="flex items-center"><Send className="w-4 h-4 mr-2" /> Analyse</span>
            )}
          </button>
        </div>

        {error && <p className="text-danger mt-3 text-sm font-medium bg-danger/10 px-3 py-2 rounded inline-block">{error}</p>}
      </div>

      {/* Results Section */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">

          {/* Models Column */}
          {modelType !== 'text' && (
            <div className="space-y-6">
               {(modelType === 'all' || modelType === 'misinfo') && result.misinfo && (
                 <div className="bg-surface rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden">
                   <div className={cn("absolute top-0 left-0 w-1.5 h-full", result.misinfo.label === 'misinfo' ? 'bg-danger' : 'bg-success')}></div>
                   <h4 className="font-bold text-slate-300 flex items-center mb-3">
                     <ShieldAlert className="w-4 h-4 mr-2" /> Misinformation Detector
                   </h4>
                   <div className="flex justify-between items-end mb-1">
                     <span className={cn("text-2xl font-black uppercase tracking-wide", result.misinfo.label === 'misinfo' ? 'text-danger' : 'text-success')}>
                       {result.misinfo.label === 'misinfo' ? 'Misinformation' : 'Safe'}
                     </span>
                     <span className="text-slate-400 font-mono text-sm">{result.misinfo.confidence}% conf</span>
                   </div>
                   {renderConfidenceBar(result.misinfo.confidence, result.misinfo.label === 'misinfo' ? 'bg-danger' : 'bg-success')}
                 </div>
               )}

               {(modelType === 'all' || modelType === 'fakenews') && result.fakenews && (
                 <div className="bg-surface rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden">
                   <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                      ['fake', 'mostly fake'].includes(result.fakenews.label) ? 'bg-danger' :
                      ['true', 'mostly true'].includes(result.fakenews.label) ? 'bg-success' : 'bg-warning'
                   )}></div>
                   <h4 className="font-bold text-slate-300 flex items-center mb-3">
                     <AlertCircle className="w-4 h-4 mr-2" /> Fake News Classifier
                   </h4>
                   <div className="flex justify-between items-end mb-4">
                     <span className="text-2xl font-black uppercase tracking-wide flex items-center">
                       {result.fakenews.emoji} {result.fakenews.label}
                     </span>
                     <span className="text-slate-400 font-mono text-sm">{result.fakenews.confidence}% conf</span>
                   </div>

                   <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
                     <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Class Probabilities</p>
                     {Object.entries(result.fakenews.all_scores).map(([label, score]) => (
                        <div key={label} className="flex items-center text-xs">
                          <span className="w-24 text-slate-400 capitalize">{label}</span>
                          <div className="flex-1 mx-2 bg-slate-900 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${score}%` }}></div>
                          </div>
                          <span className="w-8 text-right text-slate-500 font-mono">{score.toFixed(0)}</span>
                        </div>
                     ))}
                   </div>
                 </div>
               )}

               {(modelType === 'all' || modelType === 'emosen') && result.emosen && (
                 <div className="bg-surface rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden">
                   <div className={cn("absolute top-0 left-0 w-1.5 h-full",
                      result.emosen.label.toLowerCase() === 'positive' ? 'bg-success' :
                      result.emosen.label.toLowerCase() === 'negative' ? 'bg-danger' : 'bg-slate-400'
                   )}></div>
                   <h4 className="font-bold text-slate-300 flex items-center mb-3">
                     <Smile className="w-4 h-4 mr-2" /> EmoSen (Code-Mix Sentiment)
                   </h4>
                   <div className="flex justify-between items-end mb-4">
                     <span className="text-2xl font-black uppercase tracking-wide flex items-center">
                       {result.emosen.emoji} {result.emosen.label}
                     </span>
                     <span className="text-slate-400 font-mono text-sm">{result.emosen.confidence}% conf</span>
                   </div>

                   <div className="flex gap-2 mt-4">
                     {Object.entries(result.emosen.all_scores).map(([label, score]) => (
                        <div key={label} className="flex-1 bg-slate-800 rounded p-2 text-center border border-slate-700">
                          <div className="text-[10px] text-slate-400 uppercase">{label}</div>
                          <div className="font-mono text-sm font-bold mt-1">{score}%</div>
                        </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* Text Analysis Column (Always shown) */}
          <div className={cn("space-y-6", modelType === 'text' && "lg:col-span-2")}>
             {result.text_analysis && (
               <div className="bg-surface rounded-xl border border-slate-700 p-6 shadow-lg h-full">
                 <h4 className="font-bold text-lg text-white mb-6 border-b border-slate-700 pb-3">Text Analysis Profile</h4>

                 <div className="space-y-6">
                    {/* Scripts & Languages */}
                    <div>
                      <h5 className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Linguistics</h5>
                      <div className="flex flex-wrap gap-2 mb-3">
                         {result.text_analysis.scripts_detected.map(s => (
                           <span key={s} className="px-2 py-1 bg-purple-900/30 text-purple-300 border border-purple-800/50 rounded text-xs">{s} Script</span>
                         ))}
                         {result.text_analysis.languages_detected.map(l => (
                           <span key={l} className="px-2 py-1 bg-teal-900/30 text-teal-300 border border-teal-800/50 rounded text-xs">{l}</span>
                         ))}
                      </div>

                      {result.text_analysis.code_mix_ratio > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Pure English</span>
                            <span className="text-indigo-400 font-medium">Code-Mix Ratio: {(result.text_analysis.code_mix_ratio * 100).toFixed(0)}%</span>
                            <span>Hindi Roman</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden flex">
                             <div className="bg-slate-600 h-full" style={{ width: `${(1 - result.text_analysis.code_mix_ratio)*100}%`}}></div>
                             <div className="bg-indigo-500 h-full" style={{ width: `${result.text_analysis.code_mix_ratio*100}%`}}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Slangs */}
                    <div>
                      <h5 className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center justify-between">
                        Slang & Entities
                        {result.text_analysis.slang_analysis.slang_count > 0 &&
                          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px] text-white">
                            {result.text_analysis.slang_analysis.slang_count} found
                          </span>
                        }
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                         {result.text_analysis.slang_analysis.internet_slang.map(s => (
                           <span key={s} className="px-2 py-0.5 bg-blue-900/50 text-blue-200 border border-blue-800 rounded text-xs">{s}</span>
                         ))}
                         {result.text_analysis.slang_analysis.hinglish_slang.map(s => (
                           <span key={s} className="px-2 py-0.5 bg-orange-900/50 text-orange-200 border border-orange-800 rounded text-xs">{s}</span>
                         ))}
                         {result.text_analysis.slang_analysis.abbreviations.map(s => (
                           <span key={s} className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs">{s} (abbr)</span>
                         ))}
                         {result.text_analysis.slang_analysis.emojis_present.map(e => (
                           <span key={e} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-sm leading-none flex items-center">{e}</span>
                         ))}
                         {result.text_analysis.slang_analysis.slang_count === 0 && result.text_analysis.slang_analysis.emojis_present.length === 0 && (
                            <span className="text-sm text-slate-500 italic">No slangs or emojis detected.</span>
                         )}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div>
                       <h5 className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Text Statistics</h5>
                       <div className="grid grid-cols-4 gap-2">
                          <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                             <div className="text-lg font-bold text-slate-200">{result.text_analysis.text_stats.word_count}</div>
                             <div className="text-[10px] text-slate-500">WORDS</div>
                          </div>
                          <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                             <div className="text-lg font-bold text-slate-200">{result.text_analysis.text_stats.char_count}</div>
                             <div className="text-[10px] text-slate-500">CHARS</div>
                          </div>
                          <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                             <div className="text-lg font-bold text-slate-200">{result.text_analysis.text_stats.sentence_count}</div>
                             <div className="text-[10px] text-slate-500">SENTENCES</div>
                          </div>
                          <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                             <div className="text-lg font-bold text-slate-200">{result.text_analysis.text_stats.avg_word_length}</div>
                             <div className="text-[10px] text-slate-500">AVG LEN</div>
                          </div>
                       </div>
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
