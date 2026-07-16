"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, UploadCloud, Search, CheckCircle, Database, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RagSectionProps {
  ticker: string;
}

export function RagSection({ ticker }: RagSectionProps) {
  const [ingestManualLoading, setIngestManualLoading] = useState(false);
  const [ingestManualSuccess, setIngestManualSuccess] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [autoIngesting, setAutoIngesting] = useState(false);
  const [autoIngestSuccess, setAutoIngestSuccess] = useState(false);
  const [autoIngestStatus, setAutoIngestStatus] = useState("");
  const [autoIngestProgress, setAutoIngestProgress] = useState(0);
  
  const [query, setQuery] = useState("");
  const [chatResponse, setChatResponse] = useState<{ text: string, sources: any[] } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Cleanup EventSource if component unmounts
  const eventSourceRef = useRef<EventSource | null>(null);
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startAutoIngest = () => {
    setAutoIngesting(true);
    setAutoIngestSuccess(false);
    setAutoIngestStatus("Initializing connection...");
    setAutoIngestProgress(5);
    
    // Determine if it's an Indian stock (.NS, .BO, etc)
    const isIndian = ticker.endsWith(".NS") || ticker.endsWith(".BO");
    const endpoint = isIndian ? `http://127.0.0.1:8000/api/rag/ingest/auto/india/${ticker}` : `http://127.0.0.1:8000/api/rag/ingest/auto/us/${ticker}`;
    
    const eventSource = new EventSource(endpoint);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.step === -1) {
          setAutoIngestStatus(`Error: ${data.message}`);
          setAutoIngesting(false);
          eventSource.close();
        } else {
          setAutoIngestStatus(data.message);
          setAutoIngestProgress(data.step * 20);
          
          if (data.step === 5) {
            setTimeout(() => {
              setAutoIngesting(false);
              setAutoIngestSuccess(true);
            }, 1000);
            eventSource.close();
          }
        }
      } catch (e) {
        console.error("Error parsing SSE:", e);
      }
    };
    
    eventSource.onerror = (e) => {
      console.error("SSE Error", e);
      setAutoIngestStatus("Connection lost or server error. Please check logs.");
      setAutoIngesting(false);
      eventSource.close();
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    setIngestManualLoading(true);
    setIngestManualSuccess(false);
    setIngestError(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/rag/ingest/manual?ticker=${ticker}`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        setIngestManualSuccess(true);
      } else {
        const errData = await res.json().catch(() => null);
        setIngestError(errData?.detail || "Failed to vectorize the document. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setIngestError("Network error while uploading the document.");
    } finally {
      setIngestManualLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setQueryLoading(true);
    setChatResponse(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, ticker })
      });
      if (res.ok) {
        const data = await res.json();
        setChatResponse({ text: data.answer, sources: data.citations });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div className="p-8 border-t border-[#22262d] bg-black/40">
      <div className="flex items-center gap-3 mb-6">
        <Database className="text-blue-500" size={24} />
        <h3 className="text-xl font-bold text-white">Deep Document Insights (RAG)</h3>
      </div>
      
      <p className="text-sm text-gray-400 mb-8">
        Upload custom reports or transcripts to extract hyper-specific insights using Gemini Vector Search.
      </p>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Auto Ingest Column */}
        <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <Bot className="text-blue-400 mb-3" size={32} />
          <h4 className="text-white font-semibold mb-2">Auto-Ingest Latest Filings</h4>
          <p className="text-xs text-gray-500 mb-6 px-4">Automatically fetch, parse, and embed the latest financial documents for {ticker}.</p>
          
          <button 
            onClick={startAutoIngest}
            disabled={autoIngesting || autoIngestSuccess}
            className={`w-full max-w-sm mx-auto py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all block text-center ${autoIngestSuccess ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : autoIngesting ? 'bg-[#22262d] text-gray-400 border border-gray-600' : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500'}`}>
            {autoIngesting ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18}/> INGESTING...</span> : autoIngestSuccess ? <span className="flex items-center justify-center gap-2"><CheckCircle size={18}/> VECTORIZED SUCCESSFULLY</span> : "AUTO-INGEST NOW"}
          </button>

          {autoIngesting && (
             <div className="w-full max-w-sm mt-5 text-left">
                 <div className="text-xs text-blue-400 mb-2 truncate" title={autoIngestStatus}>{autoIngestStatus}</div>
                 <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${autoIngestProgress}%`}}></div>
                 </div>
             </div>
          )}
          {!autoIngesting && autoIngestStatus && autoIngestStatus.startsWith("Error:") && (
             <div className="w-full max-w-sm mt-3 text-xs text-red-400 text-left">
                 {autoIngestStatus}
             </div>
          )}
        </div>

        {/* Manual PDF Upload Column */}
        <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 flex flex-col items-center justify-center text-center border-dashed">
          <UploadCloud className="text-gray-400 mb-3" size={32} />
          <h4 className="text-white font-semibold mb-2">Custom PDF Upload</h4>
          <p className="text-xs text-gray-500 mb-6 px-4">Upload a custom earnings report, research paper, or transcript to the vector store.</p>
          
          <label 
            onClick={() => { if (ingestError) { setIngestError(null); setIngestManualSuccess(false); } }}
            className={`w-full max-w-sm mx-auto py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all cursor-pointer block text-center ${ingestManualSuccess ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : ingestError ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-[#22262d] hover:bg-gray-700 text-white border border-gray-600'}`}>
            {ingestManualLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : ingestManualSuccess ? <span className="flex items-center justify-center gap-2"><CheckCircle size={18}/> VECTORIZED SUCCESSFULLY</span> : ingestError ? <span>{ingestError} <span className="underline ml-1">Try Again</span></span> : "SELECT PDF"}
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={ingestManualLoading} />
          </label>
        </div>
      </div>

      <div className="bg-[#16181d] border border-[#22262d] rounded-2xl overflow-hidden">
        <form onSubmit={handleQuery} className="flex border-b border-[#22262d]">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask a specific question about ${ticker}'s documents...`}
            className="flex-1 bg-transparent text-white px-6 py-4 focus:outline-none placeholder-gray-600"
          />
          <button type="submit" disabled={queryLoading || !query.trim()} className="px-6 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
            {queryLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </form>

        <AnimatePresence>
          {chatResponse && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-6 bg-black/20"
            >
              <h5 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Gemini RAG Response</h5>
              <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">{chatResponse.text}</p>
              
              {chatResponse.sources && chatResponse.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-[#22262d]">
                  <h6 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Retrieved Context Sources</h6>
                  <div className="flex flex-col gap-2">
                    {chatResponse.sources.map((src, i) => (
                      <div key={i} className="text-xs text-gray-500 bg-[#16181d] border border-[#22262d] p-3 rounded-lg flex items-center justify-between">
                        <span className="truncate max-w-[80%]">{src.text.substring(0, 100)}...</span>
                        <span className="text-blue-500 font-medium ml-4 shrink-0">Score: {src.score.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
