"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add item form state
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Suggestion state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Delete modal state
  const [deleteModalItem, setDeleteModalItem] = useState<any | null>(null);
  const [sharesToDelete, setSharesToDelete] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");

  // Expandable grouped items state
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});

  const toggleExpand = (ticker: string) => {
    setExpandedTickers(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const fetchPortfolio = async () => {
    const token = localStorage.getItem("fse_token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/api/portfolio", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("fse_token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    fetchPortfolio();
  }, []);

  // Dropdown close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions
  useEffect(() => {
    if (isSelecting) {
      setIsSelecting(false);
      return;
    }
    
    if (!ticker.trim() || ticker.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/suggestions?q=${ticker}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {}
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [ticker]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    
    const token = localStorage.getItem("fse_token");
    try {
      const res = await fetch("http://localhost:8000/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          shares: parseFloat(shares),
          purchase_date: purchaseDate,
          purchase_price: parseFloat(purchasePrice)
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to add portfolio item");
      } else {
        setTicker("");
        setShares("");
        setPurchaseDate("");
        setPurchasePrice("");
        fetchPortfolio();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (item: any) => {
    setDeleteModalItem(item);
    setSharesToDelete(item.shares.toString());
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteModalItem) return;
    const token = localStorage.getItem("fse_token");
    if (!token) return;
    
    setDeleteError("");
    try {
      const parsedShares = parseFloat(sharesToDelete);
      if (isNaN(parsedShares) || parsedShares <= 0) {
        setDeleteError("Please enter a valid number of shares.");
        return;
      }
      if (parsedShares > deleteModalItem.shares) {
        setDeleteError(`You only have ${deleteModalItem.shares} shares to remove.`);
        return;
      }

      const res = await fetch(`http://localhost:8000/api/portfolio/${deleteModalItem.id}/sell`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ shares: parsedShares })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.detail || "Failed to remove shares");
      } else {
        setDeleteModalItem(null);
        fetchPortfolio();
      }
    } catch (e: any) {
      setDeleteError(e.message || "An error occurred");
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    } catch (e) {
      return `$${amount.toFixed(2)}`;
    }
  };

  const groupedPortfolio = portfolio.reduce((acc, item) => {
    const cur = item.currency || 'USD';
    if (!acc[cur]) acc[cur] = [];
    acc[cur].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8">My Portfolio</h1>

        {Object.keys(groupedPortfolio).length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
              <div className="text-gray-400 text-sm font-bold mb-2">Total Value</div>
              <div className="text-3xl font-extrabold text-white">$0.00</div>
            </div>
            <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
              <div className="text-gray-400 text-sm font-bold mb-2">Total Invested</div>
              <div className="text-3xl font-extrabold text-white">$0.00</div>
            </div>
            <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
              <div className="text-gray-400 text-sm font-bold mb-2">Total P&L</div>
              <div className={`text-3xl font-extrabold flex items-center gap-2 text-gray-400`}>
                $0.00
              </div>
            </div>
          </div>
        )}

        {Object.keys(groupedPortfolio).map(currency => {
          const items = groupedPortfolio[currency];
          const totalInvested = items.reduce((sum, item) => sum + (item.shares * item.purchase_price), 0);
          const totalValue = items.reduce((sum, item) => sum + (item.shares * (item.current_price || item.purchase_price)), 0);
          const totalPnL = totalValue - totalInvested;
          const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
          
          const isUp = totalPnL > 0;
          const isDown = totalPnL < 0;
          const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-gray-400";
          const sign = isUp ? "+" : "";

          return (
            <div key={currency} className="mb-12">
              {Object.keys(groupedPortfolio).length > 1 && (
                <h2 className="text-xl font-bold text-gray-400 mb-4">{currency} Holdings</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
                  <div className="text-gray-400 text-sm font-bold mb-2">Total Value</div>
                  <div className="text-3xl font-extrabold text-white">{formatCurrency(totalValue, currency)}</div>
                </div>
                <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
                  <div className="text-gray-400 text-sm font-bold mb-2">Total Invested</div>
                  <div className="text-3xl font-extrabold text-white">{formatCurrency(totalInvested, currency)}</div>
                </div>
                <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
                  <div className="text-gray-400 text-sm font-bold mb-2">Total P&L</div>
                  <div className={`text-3xl font-extrabold flex items-center gap-2 ${color}`}>
                    {sign}{formatCurrency(Math.abs(totalPnL), currency)}
                    <span className="text-sm px-2 py-1 bg-gray-800/50 rounded-full">
                      {sign}{totalPnLPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {loading ? (
              <>
                <h2 className="text-2xl font-bold mb-6">Holdings</h2>
                <div className="flex justify-center p-12 bg-[#16181d] border border-[#22262d] rounded-2xl">
                  <Loader2 className="animate-spin text-emerald-500" size={48} />
                </div>
              </>
            ) : portfolio.length === 0 ? (
              <>
                <h2 className="text-2xl font-bold mb-6">Holdings</h2>
                <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-12 text-center text-gray-400">
                  You haven't added any stocks to your portfolio yet.
                </div>
              </>
            ) : (
              <div className="space-y-12">
                {Object.keys(groupedPortfolio).map(currency => (
                  <div key={currency}>
                    <h2 className="text-2xl font-bold mb-6">
                      {Object.keys(groupedPortfolio).length > 1 ? `${currency} Holdings` : 'Holdings'}
                    </h2>
                    <div className="bg-[#16181d] border border-[#22262d] rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#1e2229] border-b border-[#22262d]">
                            <tr>
                              <th className="p-4 font-semibold text-gray-300">Ticker</th>
                              <th className="p-4 font-semibold text-gray-300 text-right">Shares</th>
                              <th className="p-4 font-semibold text-gray-300 text-right">Avg Cost</th>
                              <th className="p-4 font-semibold text-gray-300 text-right">Current</th>
                              <th className="p-4 font-semibold text-gray-300 text-right">P&L</th>
                              <th className="p-4 font-semibold text-gray-300 text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#22262d]">
                            {(() => {
                              const itemsForCurrency = groupedPortfolio[currency];
                              const groupedByTicker = itemsForCurrency.reduce((acc: any, item: any) => {
                                if (!acc[item.ticker]) acc[item.ticker] = [];
                                acc[item.ticker].push(item);
                                return acc;
                              }, {});

                              return Object.keys(groupedByTicker).map((ticker, idx) => {
                                const lots = groupedByTicker[ticker];
                                const name = lots[0].name;
                                const currencyCode = lots[0].currency;
                                
                                const totalShares = lots.reduce((sum: number, item: any) => sum + item.shares, 0);
                                const totalInvested = lots.reduce((sum: number, item: any) => sum + (item.shares * item.purchase_price), 0);
                                const avgCost = totalInvested / totalShares;
                                const currentPrice = lots[0].current_price || avgCost;
                                const totalPnl = (currentPrice * totalShares) - totalInvested;
                                const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
                                
                                const iUp = totalPnl > 0;
                                const iDown = totalPnl < 0;
                                const cColor = iUp ? "text-emerald-400" : iDown ? "text-red-400" : "text-gray-400";
                                const cSign = iUp ? "+" : "";
                                const isExpanded = expandedTickers[ticker] || false;

                                return (
                                  <Fragment key={ticker}>
                                    <motion.tr 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                                      className={`hover:bg-[#1e2229] transition-colors ${lots.length > 1 ? 'cursor-pointer' : ''}`}
                                      onClick={() => lots.length > 1 && toggleExpand(ticker)}
                                    >
                                      <td className="p-4">
                                        <div className="flex items-center gap-2">
                                          {lots.length > 1 && (
                                            <span className="text-gray-500">
                                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </span>
                                          )}
                                          <div>
                                            <div className="font-bold text-gray-200">{ticker} {lots.length > 1 ? <span className="text-gray-500 text-xs font-normal">({lots.length} lots)</span> : ''}</div>
                                            <div className="text-xs text-gray-500">{name}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-4 font-bold text-gray-400 text-right">{totalShares}</td>
                                      <td className="p-4 font-medium text-gray-400 text-right">{formatCurrency(avgCost, currencyCode)}</td>
                                      <td className="p-4 font-bold text-white text-right">{formatCurrency(currentPrice, currencyCode)}</td>
                                      <td className={`p-4 font-bold text-right ${cColor}`}>
                                        <div>{cSign}{formatCurrency(Math.abs(totalPnl), currencyCode)}</div>
                                        <div className="text-xs opacity-80">{cSign}{pnlPercent.toFixed(2)}%</div>
                                      </td>
                                      <td className="p-4 text-right">
                                        {lots.length === 1 && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(lots[0]); }}
                                            className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10"
                                            title="Delete Position"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        )}
                                      </td>
                                    </motion.tr>
                                    
                                    {isExpanded && lots.length > 1 && lots.map((item: any) => {
                                      const cost = item.purchase_price;
                                      const current = item.current_price || cost;
                                      const pnl = (current - cost) * item.shares;
                                      const lotPnlPercent = cost > 0 ? ((current - cost) / cost) * 100 : 0;
                                      const lotUp = pnl > 0;
                                      const lotDown = pnl < 0;
                                      const lotColor = lotUp ? "text-emerald-400" : lotDown ? "text-red-400" : "text-gray-400";
                                      const lotSign = lotUp ? "+" : "";

                                      return (
                                        <tr key={item.id} className="bg-[#101216] border-l-2 border-l-emerald-500/50">
                                          <td className="p-4 pl-12">
                                            <div className="text-sm font-medium text-gray-400">Purchased {item.purchase_date}</div>
                                          </td>
                                          <td className="p-4 font-bold text-gray-500 text-right">{item.shares}</td>
                                          <td className="p-4 font-medium text-gray-500 text-right">{formatCurrency(cost, currencyCode)}</td>
                                          <td className="p-4 font-bold text-gray-400 text-right">{formatCurrency(current, currencyCode)}</td>
                                          <td className={`p-4 font-bold text-right ${lotColor}`}>
                                            <div>{lotSign}{formatCurrency(Math.abs(pnl), currencyCode)}</div>
                                            <div className="text-xs opacity-80">{lotSign}{lotPnlPercent.toFixed(2)}%</div>
                                          </td>
                                          <td className="p-4 text-right">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}
                                              className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10"
                                              title="Delete Position"
                                            >
                                              <Trash2 size={18} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </Fragment>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">Add Position</h2>
            <div className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-xl">
              <form onSubmit={handleAddItem} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm font-medium">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Ticker Symbol</label>
                  <div className="relative" ref={dropdownRef}>
                    <input 
                      required 
                      type="text" 
                      value={ticker} 
                      onChange={(e) => setTicker(e.target.value)} 
                      onFocus={() => {
                        if (suggestions.length > 0) setShowDropdown(true);
                      }}
                      className="w-full bg-[#0a0c10] border border-[#22262d] rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none uppercase" 
                      placeholder="AAPL" 
                    />
                    
                    <AnimatePresence>
                      {showDropdown && suggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute w-full mt-2 bg-[#16181d] border border-[#22262d] rounded-xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto"
                        >
                          {suggestions.map((s: any, idx: number) => (
                            <div 
                              key={idx}
                              onClick={() => {
                                setIsSelecting(true);
                                setTicker(s.symbol);
                                setShowDropdown(false);
                              }}
                              className="px-4 py-3 hover:bg-[#22262d] cursor-pointer transition-colors border-b border-[#22262d] last:border-0"
                            >
                              <div className="font-bold text-white flex items-center justify-between">
                                {s.symbol} <span className="text-xs font-medium text-gray-400">{s.exchange}</span>
                              </div>
                              <div className="text-sm text-gray-400 truncate">{s.shortname || s.longname}</div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Shares</label>
                  <input required type="number" step="0.01" min="0" value={shares} onChange={(e) => setShares(e.target.value)} className="w-full bg-[#0a0c10] border border-[#22262d] rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="10.5" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Purchase Date</label>
                  <input required type="date" max={new Date().toISOString().split("T")[0]} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full bg-[#0a0c10] border border-[#22262d] rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Purchase Price</label>
                  <input required type="number" step="0.01" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full bg-[#0a0c10] border border-[#22262d] rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="150.00" />
                  <p className="text-xs text-gray-500 mt-1">Price must match the historical range for the chosen date.</p>
                </div>
                
                <button disabled={submitting} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors mt-6">
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />} Add to Portfolio
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {deleteModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16181d] border border-[#22262d] rounded-2xl p-6 shadow-2xl max-w-md w-full"
            >
              <h2 className="text-2xl font-bold text-white mb-2">Delete Position</h2>
              <p className="text-gray-400 mb-6">
                How many shares of <span className="font-bold text-white">{deleteModalItem.ticker}</span> do you want to remove?
              </p>
              
              {deleteError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm font-medium">
                  {deleteError}
                </div>
              )}
              
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-400 mb-1">Shares to Remove</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max={deleteModalItem.shares}
                  value={sharesToDelete} 
                  onChange={(e) => setSharesToDelete(e.target.value)} 
                  className="w-full bg-[#0a0c10] border border-[#22262d] rounded-lg p-3 text-white font-bold focus:ring-2 focus:ring-red-500 outline-none" 
                />
                <div className="text-xs text-gray-500 mt-2 flex justify-between">
                  <span>Max: {deleteModalItem.shares}</span>
                  <button 
                    onClick={() => setSharesToDelete(deleteModalItem.shares.toString())}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Select All
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteModalItem(null)}
                  className="flex-1 px-4 py-3 bg-transparent border border-[#22262d] text-white rounded-lg hover:bg-[#22262d] transition-colors font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
