"use client";

import { Activity, PlaySquare, CheckCircle, Database } from "lucide-react";

export interface Stats {
  total: number;
  monetized: number;
  new_this_week: number;
}

export default function HeaderStatusBar({ stats }: { stats: Stats }) {
  const numberFormat = (num: number) => new Intl.NumberFormat('en-US').format(num);

  return (
    <div className="w-full glass-panel rounded-xl p-6 mb-8 mt-4 mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--color-brand-600)] rounded-full blur-3xl opacity-20 pointer-events-none"></div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <Activity size={28} className="text-[#00ffcc]" />
          <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#00ffcc] animate-pulse"></div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            SHORT<span className="text-[var(--color-brand-500)]">RADAR</span>
          </h1>
          <p className="text-sm text-zinc-400 font-medium tracking-wider">LIVE GLOBAL TELEMETRY</p>
        </div>
      </div>

      <div className="flex items-center gap-8 px-4">
        <div className="flex flex-col items-center">
          <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
            <Database size={12} /> Total Shards
          </div>
          <div className="text-xl font-black text-zinc-100">{numberFormat(stats?.total || 0)}</div>
        </div>
        
        <div className="w-px h-8 bg-zinc-800"></div>

        <div className="flex flex-col items-center">
          <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
            <CheckCircle size={12} className="text-emerald-500" /> Monetized Found
          </div>
          <div className="text-xl font-black text-emerald-400">{numberFormat(stats?.monetized || 0)}</div>
        </div>

        <div className="w-px h-8 bg-zinc-800"></div>

        <div className="flex flex-col items-center">
          <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
            <PlaySquare size={12} className="text-[#00ffcc]" /> Fresh Channels (<span className="opacity-70">7d</span>)
          </div>
          <div className="text-xl font-black text-white drop-shadow-[0_0_10px_rgba(0,255,204,0.3)]">
            +{numberFormat(stats?.new_this_week || 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
