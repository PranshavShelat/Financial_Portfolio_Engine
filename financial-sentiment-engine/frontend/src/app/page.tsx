"use client";

import { useEffect, useState } from "react";
import { SentimentCard } from "@/components/SentimentCard";
import { StockDetailCard } from "@/components/StockDetailCard";
import { SearchBar } from "@/components/SearchBar";
import { motion } from "framer-motion";

export default function Home() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Phase 5: Search state
  const [searchResult, setSearchResult] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/sentiments");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-8 md:p-24 selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 flex flex-col items-center text-center"
        >
          <div className="inline-block px-3 py-1 mb-6 rounded-full border border-[#22262d] bg-[#16181d] text-sm text-gray-400 font-medium tracking-wide">
            Powered by Native Llama 3
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-6">
            Financial Sentiment Engine
          </h1>
          
          <SearchBar 
            onSearchResult={(result) => setSearchResult(result)} 
            onClear={() => setSearchResult(null)} 
          />
        </motion.div>

        {searchResult ? (
          <div className="flex justify-center">
             <div className="w-full max-w-4xl">
               <div className="flex items-center justify-between mb-6 border-b border-[#22262d] pb-2">
                 <h2 className="text-2xl font-semibold text-emerald-400">Deep Dive Analysis</h2>
                 <button onClick={() => setSearchResult(null)} className="text-sm text-gray-400 hover:text-white transition-colors">
                   Close &times;
                 </button>
               </div>
               <StockDetailCard data={searchResult} />
             </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-6 border-b border-[#22262d] pb-2 text-gray-300">Live Market Pulse</h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 h-64 animate-pulse">
                    <div className="h-6 bg-[#22262d] rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-[#22262d] rounded w-full mb-2"></div>
                    <div className="h-4 bg-[#22262d] rounded w-3/4 mb-10"></div>
                    <div className="flex justify-between border-t border-[#22262d] pt-4">
                      <div className="h-8 bg-[#22262d] rounded w-16"></div>
                      <div className="h-8 bg-[#22262d] rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {data.map((item: any, idx: number) => (
                  <SentimentCard key={item.asset_symbol} data={item} index={idx} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
