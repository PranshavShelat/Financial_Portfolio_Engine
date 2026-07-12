"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("fse_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/watchlist", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setWatchlist(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8">Full Watchlist</h1>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-emerald-500" size={48} />
          </div>
        ) : watchlist.length === 0 ? (
          <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-12 text-center text-gray-400">
            You don't have any stocks in your watchlist yet.
          </div>
        ) : (
          <div className="bg-[#16181d] border border-[#22262d] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#1e2229] border-b border-[#22262d]">
                  <tr>
                    <th className="p-4 font-semibold text-gray-300">Ticker</th>
                    <th className="p-4 font-semibold text-gray-300">Company Name</th>
                    <th className="p-4 font-semibold text-gray-300">Current Price</th>
                    <th className="p-4 font-semibold text-gray-300 text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22262d]">
                  {watchlist.map((item, idx) => {
                    const isUp = item.change_percent > 0;
                    const isDown = item.change_percent < 0;
                    const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-gray-400";
                    const sign = isUp ? "+" : "";

                    return (
                      <motion.tr 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className="hover:bg-[#1e2229] transition-colors"
                      >
                        <td className="p-4 font-bold text-gray-200">{item.ticker}</td>
                        <td className="p-4 font-medium text-gray-400">{item.name}</td>
                        <td className="p-4 font-bold text-white">
                          {item.price !== null ? `$${item.price.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className={`p-4 font-bold text-right flex items-center justify-end gap-2 ${color}`}>
                          {item.change_percent !== null ? (
                            <>
                              {isUp ? <TrendingUp size={16} /> : isDown ? <TrendingDown size={16} /> : <Minus size={16} />}
                              {sign}{item.change_percent.toFixed(2)}%
                            </>
                          ) : 'N/A'}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
