"use client";

import { Dispatch, SetStateAction } from "react";
import { Filter, Users, TrendingUp, Sparkles, Clock, CheckCircle2 } from "lucide-react";

interface FilterParams {
  minSubs: number;
  maxSubs: number;
  minScore: number;
  maxAgeDays: number;
  monetized: boolean;
}

interface FilterProps {
  filters: FilterParams;
  setFilters: Dispatch<SetStateAction<FilterParams>>;
  onApply: () => void;
  isLoading: boolean;
}

export default function FilterSidebar({ filters, setFilters, onApply, isLoading }: FilterProps) {
  
  const handleChange = (key: keyof FilterParams, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-panel w-full lg:w-80 rounded-xl p-5h-fit sticky top-6 shadow-2xl shrink-0 p-6 flex flex-col gap-8 h-max">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
        <Filter className="text-[var(--color-brand-500)]" size={20} />
        <h2 className="text-lg font-bold">Extraction Parameters</h2>
      </div>

      <div className="space-y-6 flex-1">
        {/* Subscribers Limit */}
        <div className="space-y-3">
          <label className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
            <Users size={14} /> Max Subscriber Cap
          </label>
          <input 
            type="range" 
            min="0" max="1000000" step="5000"
            value={filters.maxSubs}
            onChange={(e) => handleChange('maxSubs', parseInt(e.target.value))}
            className="w-full accent-[var(--color-brand-500)]"
          />
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>0</span>
            <span className="text-zinc-300 font-bold">
              {filters.maxSubs === 1000000 ? "NO CAP" : `${(filters.maxSubs / 1000).toFixed(0)}K Subs`}
            </span>
          </div>
        </div>

        {/* Growth Score Filter */}
        <div className="space-y-3">
          <label className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
            <TrendingUp size={14} /> Min. Velocity Score
          </label>
          <input 
            type="range" 
            min="0" max="100000" step="1000"
            value={filters.minScore}
            onChange={(e) => handleChange('minScore', parseInt(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>0</span>
            <span className="text-emerald-400 font-bold">{filters.minScore.toLocaleString()}</span>
          </div>
        </div>

        {/* Channel Age Filter */}
        <div className="space-y-3">
          <label className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
            <Clock size={14} /> Max Channel Age (post-2025)
          </label>
          <input 
            type="range" 
            min="1" max="1000" step="1"
            value={filters.maxAgeDays}
            onChange={(e) => handleChange('maxAgeDays', parseInt(e.target.value))}
            className="w-full accent-[#00ffcc]"
          />
          <div className="flex justify-between text-xs text-zinc-500 font-mono">
            <span>1d</span>
            <span className="text-[#00ffcc] font-bold">
               {filters.maxAgeDays === 1000 ? "Unlimited" : `${filters.maxAgeDays} Days`}
            </span>
          </div>
        </div>

        {/* Monetization Toggle */}
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer group hover:bg-zinc-800/50 p-2 -mx-2 rounded-lg transition-colors">
            <div className={`relative w-12 h-6 rounded-full transition-colors ${filters.monetized ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${filters.monetized ? 'left-7' : 'left-1'}`}></div>
            </div>
            <input 
              type="checkbox" 
              checked={filters.monetized}
              onChange={(e) => handleChange('monetized', e.target.checked)}
              className="hidden" 
            />
            <span className="text-sm font-semibold tracking-wide text-zinc-300 group-hover:text-white flex items-center gap-2">
               Monetized Only <CheckCircle2 size={16} className={filters.monetized ? "text-emerald-500" : "text-zinc-600"}/>
            </span>
          </label>
        </div>
      </div>

      <button 
        onClick={onApply}
        disabled={isLoading}
        className="mt-4 w-full bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-500)] text-white font-bold h-12 rounded-lg shadow-[0_0_20px_rgba(230,0,69,0.3)] hover:shadow-[0_0_30px_rgba(255,0,80,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          <><Sparkles size={16} /> Scan Matrix</>
        )}
      </button>

    </div>
  );
}
