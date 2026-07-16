"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, Loader2, X, ExternalLink } from "lucide-react";
import { RagSection } from "./RagSection";

interface StockDetailCardProps {
  data: {
    symbol: string;
    name: string;
    current_price: number;
    currency: string;
    sentiments: {
      headline: string;
      sentiment_score: number;
      sentiment_label: string;
      url?: string;
    }[];
    chart_data: { Date: string; Close: number }[];
  };
  token?: string | null;
  isWatchlisted?: boolean;
  onWatchlistChange?: () => void;
}

const formatCurrency = (value: number, currencyCode: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export function StockDetailCard({ data, token, isWatchlisted, onWatchlistChange }: StockDetailCardProps) {
  const [timeframe, setTimeframe] = useState("1d");
  const [chartData, setChartData] = useState(data.chart_data);
  const [chartLoading, setChartLoading] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  
  // Modal State
  const [selectedArticle, setSelectedArticle] = useState<{headline: string, url: string} | null>(null);
  const [articleSummary, setArticleSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // Independent Sentiment State
  const [sentiments, setSentiments] = useState(data.sentiments || []);
  const [sentimentLoading, setSentimentLoading] = useState(!data.sentiments || data.sentiments.length === 0);

  useEffect(() => {
    let isMounted = true;
    const fetchSentiments = async () => {
      setSentiments([]); // Clear old sentiments
      setSentimentLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/search/${data.symbol}/sentiments`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) setSentiments(json.sentiments);
        }
      } catch (e) {
        console.error("Failed to fetch sentiment", e);
      } finally {
        if (isMounted) setSentimentLoading(false);
      }
    };
    fetchSentiments();
    
    return () => { isMounted = false; };
  }, [data.symbol]);

  useEffect(() => {
    // Initial fetch from data payload is for 1d, don't refetch if already 1d on mount
    if (timeframe === "1d" && chartData === data.chart_data) return;

    const fetchChart = async () => {
      setChartLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/chart/${data.symbol}?period=${timeframe}`);
        if (res.ok) {
          const json = await res.json();
          if (json.length > 0) {
             setChartData(json);
          }
        }
      } catch (e) {
        console.error("Failed to fetch chart", e);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChart();
  }, [timeframe, data.symbol]);

  const handleArticleClick = async (headline: string, url?: string) => {
    if (!url) return;
    setSelectedArticle({ headline, url });
    setArticleSummary(null);
    setSummaryLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        setArticleSummary(data.summary);
      } else {
        setArticleSummary("Failed to generate summary. The article might be behind a paywall.");
      }
    } catch (e) {
      setArticleSummary("An error occurred while analyzing this article.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleToggleWatchlist = async () => {
    if (!token || !onWatchlistChange) return;
    setWatchlistLoading(true);
    try {
      await fetch("http://localhost:8000/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ticker: data.symbol, name: data.name })
      });
      onWatchlistChange();
    } catch (e) {
      console.error("Failed to toggle watchlist", e);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const firstPrice = chartData.length > 0 ? chartData[0].Close : 0;
  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].Close : data.current_price;
  const percentChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  // Determine overall sentiment trend based on average score of the items
  const avgScore = sentiments.length > 0 
    ? sentiments.reduce((acc, curr) => acc + curr.sentiment_score, 0) / sentiments.length 
    : 50;
  const overallTrend = avgScore >= 60 ? "bullish" : avgScore <= 40 ? "bearish" : "neutral";
  
  // Graph color based on percentChange
  const mainColor = percentChange > 0 ? "#10b981" : percentChange < 0 ? "#ef4444" : "#6b7280";
  
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return "";
    if (timeframe === "1d" || timeframe === "5d") {
      const parts = tickItem.split(" ");
      return parts.length > 1 ? parts[1] : tickItem;
    }
    return tickItem.split(" ")[0];
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#16181d] border border-[#22262d] rounded-3xl overflow-hidden shadow-2xl w-full"
      >
        <div className="p-8 pb-4 border-b border-[#22262d]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-bold text-white">{data.name}</h2>
                {token && (
                  <button 
                    onClick={handleToggleWatchlist}
                    disabled={watchlistLoading}
                    className={`p-2 rounded-full transition-colors ${isWatchlisted ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-400 hover:text-white bg-[#22262d]'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isWatchlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tracking-wider text-gray-400 bg-[#22262d] px-3 py-1 rounded-full">
                  {data.symbol}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-extrabold text-white tracking-tighter">
                {formatCurrency(data.current_price, data.currency)}
              </div>
              <div className={`text-sm font-medium mt-1 flex items-center justify-end gap-1 ${percentChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {percentChange >= 0 ? "+" : ""}{percentChange.toFixed(2)}% ({timeframe.toUpperCase()})
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            {["1d", "5d", "1mo", "1y", "5y"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${timeframe === tf ? "bg-white text-black" : "bg-[#22262d] text-gray-400 hover:text-white"}`}
              >
                {tf}
              </button>
            ))}
            {chartLoading && <Loader2 className="animate-spin text-gray-500 ml-4" size={16} />}
          </div>
        </div>

        <div className="h-80 w-full relative p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={mainColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="Date" 
                tickFormatter={formatXAxis} 
                tick={{ fill: '#6b7280', fontSize: 12 }} 
                axisLine={false} 
                tickLine={false} 
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(value) => formatCurrency(value, data.currency)} 
                tick={{ fill: '#6b7280', fontSize: 12 }} 
                axisLine={false} 
                tickLine={false} 
                orientation="right"
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#16181d", borderColor: "#22262d", borderRadius: "12px", color: "#fff" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value: number) => [formatCurrency(value, data.currency), "Price"]}
                labelFormatter={(label) => <span className="text-gray-400">{label}</span>}
              />
              <Area 
                type="monotone" 
                dataKey="Close" 
                stroke={mainColor} 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorClose)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="p-8 border-t border-[#22262d] bg-black/20">
          <h3 className="text-xl font-bold text-white mb-6">AI Sentiment Breakdown</h3>
          {sentimentLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
              <p className="text-gray-400 font-medium tracking-wide animate-pulse">Analyzing latest market sentiment...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentiments.map((item, idx) => {
                const isItemBullish = item.sentiment_label.toLowerCase() === "bullish";
                const isItemBearish = item.sentiment_label.toLowerCase() === "bearish";
                const hasUrl = !!item.url;
                return (
                  <div 
                    key={idx} 
                    onClick={() => hasUrl && handleArticleClick(item.headline, item.url)}
                    className={`bg-[#16181d] border border-[#22262d] p-4 rounded-2xl flex flex-col justify-between transition-colors ${hasUrl ? 'cursor-pointer hover:border-gray-400' : ''}`}
                  >
                    <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-3">"{item.headline}"</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isItemBullish ? 'text-emerald-400' : isItemBearish ? 'text-red-400' : 'text-gray-400'}`}>
                        {isItemBullish ? <TrendingUp size={16} /> : isItemBearish ? <TrendingDown size={16} /> : <Minus size={16} />}
                        {item.sentiment_label}
                      </div>
                      <div className="flex items-center gap-4">
                        {hasUrl && <div className="text-xs text-gray-500 font-medium tracking-wide border border-gray-700 px-2 py-1 rounded-md bg-gray-800/50 flex items-center gap-1"><ExternalLink size={12}/> SUMMARY</div>}
                        <div className={`text-xl font-extrabold ${isItemBullish ? 'text-emerald-400' : isItemBearish ? 'text-red-400' : 'text-gray-400'}`}>
                          {item.sentiment_score}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- RAG SECTION (Deep Document Insights) --- */}
        <RagSection ticker={data.symbol} />
      </motion.div>

      {/* Article Summary Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#16181d] border border-[#22262d] rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#22262d] flex justify-between items-start bg-black/20">
                <div>
                  <div className="inline-block px-3 py-1 mb-3 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs text-blue-400 font-bold tracking-widest uppercase">
                    LangChain RAG Pipeline
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight">{selectedArticle.headline}</h3>
                </div>
                <button onClick={() => setSelectedArticle(null)} className="text-gray-400 hover:text-white bg-[#22262d] p-2 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto">
                {summaryLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                    <p className="text-gray-400 font-medium tracking-wide">AI is reading the full article...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-gray-300 text-lg leading-relaxed">
                      {articleSummary}
                    </p>
                    <div className="pt-4 mt-6 border-t border-[#22262d]">
                      <a href={selectedArticle.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2 text-sm transition-colors">
                        Read original article on Yahoo Finance <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
