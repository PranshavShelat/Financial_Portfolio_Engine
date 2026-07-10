"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentData {
  asset_symbol: string;
  sentiment_score: number;
  sentiment_label: string;
  news_source: string;
  created_at: string;
}

export function SentimentCard({ data, index }: { data: SentimentData, index: number }) {
  const isBullish = data.sentiment_label.toLowerCase() === "bullish";
  const isBearish = data.sentiment_label.toLowerCase() === "bearish";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-white tracking-tight">{data.asset_symbol}</h3>
        <div className={`p-2 rounded-full ${isBullish ? 'bg-emerald-500/10 text-emerald-400' : isBearish ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
          {isBullish ? <TrendingUp size={24} /> : isBearish ? <TrendingDown size={24} /> : <Minus size={24} />}
        </div>
      </div>
      
      <div className="flex-grow">
        <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
          "{data.news_source}"
        </p>
      </div>
      
      <div className="mt-6 pt-4 border-t border-[#22262d] flex justify-between items-end">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">AI Sentiment</p>
          <p className={`text-lg font-medium capitalize ${isBullish ? 'text-emerald-400' : isBearish ? 'text-red-400' : 'text-gray-400'}`}>
            {data.sentiment_label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Score</p>
          <p className="text-3xl font-bold text-white">{data.sentiment_score}</p>
        </div>
      </div>
    </motion.div>
  );
}
