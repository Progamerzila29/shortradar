"use client";

import { useEffect, useState } from "react";
import HeaderStatusBar, { Stats } from "@/components/HeaderStatusBar";
import FilterSidebar from "@/components/FilterSidebar";
import ChannelCard, { Channel } from "@/components/ChannelCard";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, monetized: 0, new_this_week: 0 });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    minSubs: 0, maxSubs: 1000000, minScore: 0, maxAgeDays: 1000, monetized: false
  });

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error("Stats Error:", e); }
  };

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams({
        minSubs: filters.minSubs.toString(), maxSubs: filters.maxSubs.toString(),
        minScore: filters.minScore.toString(), maxAgeDays: filters.maxAgeDays.toString(),
        monetized: filters.monetized.toString()
      });
      const res = await fetch(`/api/feed?${p}`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (e) { console.error("Feed Error:", e); }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStats();
    fetchFeed();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[var(--color-dark-bg)] text-zinc-100 p-4 md:p-8 selection:bg-[var(--color-brand-500)] selection:text-white pb-32">
      <HeaderStatusBar stats={stats} />
      
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start relative">
        <FilterSidebar filters={filters} setFilters={setFilters} onApply={fetchFeed} isLoading={isLoading} />
        
        <div className="flex-1 w-full space-y-6">
          <div className="flex items-center justify-between pb-3 mb-6 border-b border-zinc-800">
            <h2 className="text-xl font-black md:text-2xl uppercase tracking-widest text-zinc-300">Live Acquisition Matrix</h2>
            <div className="text-[10px] md:text-sm text-zinc-500 font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#00ffcc] animate-pulse"></span> {channels.length} Extracted
            </div>
          </div>
          
          {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-30">
                {[1, 2, 3, 4].map(i => <div key={i} className="glass-panel h-96 rounded-2xl animate-pulse-slow"></div>)}
             </div>
          ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-max w-full">
               {channels.length > 0 ? channels.map(c => <ChannelCard key={c.channel_id} channel={c} />) : (
                 <div className="col-span-full py-32 flex flex-col items-center justify-center text-zinc-600 glass-panel border border-dashed border-zinc-800 rounded-2xl text-center">
                   <div className="text-5xl mb-4 opacity-50">🦇</div>
                   <p className="font-mono text-sm tracking-widest uppercase">No parameters matched the global datalake.</p>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
    </main>
  );
}
