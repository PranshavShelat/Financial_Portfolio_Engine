"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchBarProps {
  onSearchResult: (data: any) => void;
  onClear: () => void;
}

export function SearchBar({ onSearchResult, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    if (isSelecting) {
      setIsSelecting(false);
      return;
    }
    
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/suggestions?q=${query}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions");
      }
    }, 300); // debounce 300ms
    
    return () => clearTimeout(timeoutId);
  }, [query]);

  const executeSearch = async (ticker: string) => {
    setIsSelecting(true);
    setQuery(ticker);
    setShowDropdown(false);
    setSuggestions([]);
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`http://localhost:8000/api/search/${ticker}`);
      if (!res.ok) throw new Error("Ticker not found or failed to fetch.");
      const data = await res.json();
      onSearchResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      onClear();
      return;
    }
    executeSearch(query);
  };

  return (
    <div className="w-full max-w-xl mb-8 relative mx-auto" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="relative z-50">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value === "") onClear();
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder="Search any Stock or ETF (e.g. AAPL, RELIANCE.NS)..."
          className="w-full bg-[#16181d] border border-[#22262d] text-white rounded-full py-3 px-5 pl-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-xl transition-all relative z-50"
        />
        <div className="absolute left-4 top-3.5 text-gray-400 z-50">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
        </div>
        <button type="submit" className="hidden" />
      </form>
      
      {/* Dropdown Menu */}
      <AnimatePresence>
        {showDropdown && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#16181d] border border-[#22262d] rounded-2xl overflow-hidden shadow-2xl z-40"
          >
            {suggestions.map((s, i) => (
              <div
                key={i}
                onClick={() => executeSearch(s.symbol)}
                className="px-5 py-3 hover:bg-[#22262d] cursor-pointer border-b border-[#22262d] last:border-0 transition-colors flex justify-between items-center"
              >
                <div className="flex flex-col text-left">
                  <span className="font-bold text-white">{s.symbol}</span>
                  <span className="text-xs text-gray-400">{s.name}</span>
                </div>
                <span className="text-xs font-semibold text-emerald-500/50 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-widest text-right">
                  {s.exchange}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && (
        <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
      )}
    </div>
  );
}
