"use client";

import { useEffect, useState } from "react";
import { SentimentCard } from "@/components/SentimentCard";
import { StockDetailCard } from "@/components/StockDetailCard";
import { SearchBar } from "@/components/SearchBar";
import { AuthModal } from "@/components/AuthModal";
import { motion } from "framer-motion";
import { Star, UserCircle, LogOut } from "lucide-react";

export default function Home() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Phase 5: Search state
  const [searchResult, setSearchResult] = useState<any>(null);
  
  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<any[]>([]);

  useEffect(() => {
    // Check local storage for token on mount
    const savedToken = localStorage.getItem("fse_token");
    const savedUser = localStorage.getItem("fse_username");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUsername(savedUser);
      fetchWatchlist(savedToken);
    }
  }, []);

  const fetchWatchlist = async (authToken: string) => {
    try {
      const res = await fetch("http://localhost:8000/api/watchlist", {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (e) {
      console.error("Failed to fetch watchlist", e);
    }
  };

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem("fse_token", newToken);
    localStorage.setItem("fse_username", newUsername);
    setToken(newToken);
    setUsername(newUsername);
    fetchWatchlist(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("fse_token");
    localStorage.removeItem("fse_username");
    setToken(null);
    setUsername(null);
    setWatchlist([]);
  };

  const handleCardClick = async (ticker: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/search/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResult(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      console.error("Failed to fetch ticker details", e);
    } finally {
      setLoading(false);
    }
  };

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
    <main className="min-h-screen bg-[#0a0c10] text-white p-4 md:p-8 font-sans">
      
      {/* Navbar */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-12 bg-[#16181d] border border-[#22262d] p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-black">F</div>
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">Financial Sentiment Engine</h1>
        </div>
        <div>
          {token ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400 font-medium flex items-center gap-1"><UserCircle size={16}/> {username}</span>
              <button onClick={handleLogout} className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              Sign In
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col items-center">
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

        <div className="w-full mt-12">
          {searchResult ? (
            <div className="w-full max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 border-b border-[#22262d] pb-2">
                <h2 className="text-2xl font-semibold text-emerald-400">Deep Dive Analysis</h2>
                <button onClick={() => setSearchResult(null)} className="text-sm text-gray-400 hover:text-white transition-colors">
                  Close &times;
                </button>
              </div>
              <StockDetailCard 
                data={searchResult} 
                token={token} 
                isWatchlisted={watchlist.some(w => w.ticker === searchResult.symbol)}
                onWatchlistChange={() => token && fetchWatchlist(token)} 
              />
            </div>
          ) : (
            <div className="space-y-12">
              {token && watchlist.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Star className="text-yellow-500" fill="currentColor"/> My Watchlist</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {watchlist.map((item, idx) => {
                      const isUp = item.change_percent > 0;
                      const isDown = item.change_percent < 0;
                      const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-gray-400";
                      const sign = isUp ? "+" : "";
                      return (
                        <div key={idx} onClick={() => handleCardClick(item.ticker)} className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 relative overflow-hidden shadow-lg hover:border-gray-500 transition-colors cursor-pointer flex flex-col h-full">
                          <div className="text-sm font-bold text-gray-400 mb-1">{item.ticker}</div>
                          <h3 className="text-xl font-extrabold text-white">{item.name}</h3>
                          
                          <div className="mt-auto pt-4 border-t border-[#22262d]">
                            {item.price !== null && item.price !== undefined && (
                              <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-2xl font-bold text-white">
                                  {item.price.toFixed(2)}
                                </span>
                                {item.change_percent !== null && item.change_percent !== undefined && (
                                  <span className={`text-sm font-semibold ${color}`}>
                                    {sign}{item.change_percent.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Live Market Pulse</h2>
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
                    {data.filter((item: any) => {
                      return ["^NSEI", "NQ=F", "BANKBEES.NS", "GLD"].includes(item.asset_symbol);
                    }).map((item: any, idx: number) => (
                      <SentimentCard key={item.asset_symbol} data={item} index={idx} onClick={() => handleCardClick(item.asset_symbol)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess} 
      />
    </main>
  );
}
