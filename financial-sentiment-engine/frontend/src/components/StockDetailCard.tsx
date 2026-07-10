"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

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
    }[];
    chart_data: { Date: string; Close: number }[];
  };
}

const formatCurrency = (value: number, currencyCode: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export function StockDetailCard({ data }: StockDetailCardProps) {
  const [timeframe, setTimeframe] = useState("1d");
  const [chartData, setChartData] = useState(data.chart_data);
  const [chartLoading, setChartLoading] = useState(false);

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

  // Determine overall sentiment trend based on average score of the 5 items
  const avgScore = data.sentiments.reduce((acc, curr) => acc + curr.sentiment_score, 0) / data.sentiments.length;
  const overallTrend = avgScore >= 60 ? "bullish" : avgScore <= 40 ? "bearish" : "neutral";
  const mainColor = overallTrend === "bullish" ? "#10b981" : overallTrend === "bearish" ? "#ef4444" : "#6b7280";

  const firstPrice = chartData.length > 0 ? chartData[0].Close : 0;
  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].Close : data.current_price;
  const percentChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  
  // Format the X-Axis ticks depending on timeframe
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return "";
    if (timeframe === "1d" || timeframe === "5d") {
      // Return time (HH:MM)
      const parts = tickItem.split(" ");
      return parts.length > 1 ? parts[1] : tickItem;
    }
    // Return date for larger timeframes
    return tickItem.split(" ")[0];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#16181d] border border-[#22262d] rounded-3xl overflow-hidden shadow-2xl w-full"
    >
      <div className="p-8 pb-4 border-b border-[#22262d]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">{data.name}</h2>
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
        
        {/* Timeframe selector */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.sentiments.map((item, idx) => {
            const isItemBullish = item.sentiment_label.toLowerCase() === "bullish";
            const isItemBearish = item.sentiment_label.toLowerCase() === "bearish";
            return (
              <div key={idx} className="bg-[#16181d] border border-[#22262d] p-4 rounded-2xl flex flex-col justify-between hover:border-gray-500 transition-colors">
                <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-3">"{item.headline}"</p>
                <div className="flex items-center justify-between mt-auto">
                  <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isItemBullish ? 'text-emerald-400' : isItemBearish ? 'text-red-400' : 'text-gray-400'}`}>
                    {isItemBullish ? <TrendingUp size={16} /> : isItemBearish ? <TrendingDown size={16} /> : <Minus size={16} />}
                    {item.sentiment_label}
                  </div>
                  <div className={`text-xl font-extrabold ${isItemBullish ? 'text-emerald-400' : isItemBearish ? 'text-red-400' : 'text-gray-400'}`}>
                    {item.sentiment_score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
