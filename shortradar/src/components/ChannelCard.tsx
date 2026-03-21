"use client";

import { CheckCircle2, TrendingUp, PlaySquare, Calendar, ExternalLink } from "lucide-react";
import Image from "next/image";

export interface ShortData {
  video_id: string;
  thumbnail: string;
  title: string;
  views: number;
}

export interface Channel {
  channel_id: string;
  handle: string;
  channel_name: string;
  avatar_url: string;
  subscribers: number;
  average_views_last5: number;
  channel_age_days: number;
  growth_score: number;
  is_monetized: boolean;
  first_short_date: string;
  recent_shorts: ShortData[];
}

export default function ChannelCard({ channel }: { channel: Channel }) {
  const numberFormat = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="glass-panel p-6 rounded-2xl w-full flex flex-col group relative overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgba(255,0,80,0.1)] hover:border-[var(--color-brand-600)]/30">
      
      {/* Decorative gradient blob for aesthetics */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:bg-[var(--color-brand-600)]/10"></div>

      {/* Top Section: Profile Header */}
      <div className="flex items-start justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-brand-500)] to-[#00ffcc] rounded-full blur opacity-20 group-hover:opacity-60 transition-opacity"></div>
            {channel.avatar_url && (
              <Image 
                src={channel.avatar_url} 
                alt={channel.channel_name} 
                width={64} height={64} 
                className="rounded-full ring-2 ring-zinc-800 relative z-10 group-hover:ring-[var(--color-brand-500)]/50 transition-all shadow-xl"
              />
            )}
          </div>
          <div>
            <a 
              href={`https://youtube.com/${channel.handle}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group-hover:text-[var(--color-brand-500)] transition-colors flex items-center gap-2"
            >
              <h3 className="text-xl font-black tracking-tight text-white m-0">
                {channel.channel_name}
              </h3>
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
            </a>
            <p className="text-sm font-mono text-zinc-500">{channel.handle}</p>
          </div>
        </div>

        {/* Monetization Badge */}
        {channel.is_monetized ? (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 text-xs font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <CheckCircle2 size={14} /> Partnered <span className="opacity-60 font-mono tracking-tighter">YPP++</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-zinc-800/50 text-zinc-400 px-3 py-1.5 rounded-full border border-zinc-700/50 text-xs font-bold tracking-wider uppercase">
            Incubating
          </div>
        )}
      </div>

      {/* Middle Section: Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mt-6 mb-6">
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
            <TrendingUp size={11} className="text-[#00ffcc]" /> Score
          </div>
          <div className="text-xl font-black text-white">{numberFormat(channel.growth_score)}</div>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
             Subscribers
          </div>
          <div className="text-xl font-black text-white">{numberFormat(channel.subscribers)}</div>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
            <PlaySquare size={11} className="text-[var(--color-brand-500)]"/> Avg Views <span className="text-[8px] opacity-60">(L5)</span>
          </div>
          <div className="text-xl font-black text-white">{numberFormat(channel.average_views_last5)}</div>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
            <Calendar size={11}/> Age (Days)
          </div>
          <div className="text-xl font-black text-white">{channel.channel_age_days || 1}</div>
        </div>
      </div>

      {/* Bottom Section: Shorts Thumbnail Grid */}
      <div className="mt-auto">
        <h4 className="text-xs uppercase font-bold tracking-widest text-zinc-500 mb-3 ml-1 flex items-center gap-2">
           Latest AI Uploads
           <div className="flex-1 h-px bg-zinc-800"></div>
        </h4>
        <div className="grid grid-cols-5 gap-2">
          {channel.recent_shorts && channel.recent_shorts.slice(0, 5).map((short, idx) => (
            <a 
              key={idx} 
              href={`https://youtube.com/shorts/${short.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-[9/16] rounded overflow-hidden group/short bg-zinc-900 border border-zinc-800 transition-all hover:border-zinc-500"
            >
              <img 
                src={short.thumbnail} 
                alt="Short Thumbnail"
                className="w-full h-full object-cover opacity-80 group-hover/short:opacity-100 transition-opacity group-hover/short:scale-105 duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none opacity-90"></div>
              
              <div className="absolute bottom-0 left-0 right-0 p-1.5 flex flex-col pointer-events-none">
                <span className="text-[8px] font-black tracking-widest text-[#00ffcc] uppercase truncate mb-0.5 shadow-sm">
                  {numberFormat(short.views || 0)} V
                </span>
                <span className="text-[9px] text-zinc-300 line-clamp-2 leading-tight drop-shadow-md">
                  {short.title || "No Title"}
                </span>
              </div>
            </a>
          ))}
          
          {/* Fill empty spots if less than 5 shorts */}
          {!channel.recent_shorts || channel.recent_shorts.length < 5 && Array(Math.max(0, 5 - (channel.recent_shorts?.length || 0))).fill(0).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-[9/16] rounded border border-dashed border-zinc-800 bg-zinc-900/20 flex items-center justify-center">
              <span className="text-zinc-700 text-xs">...</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
