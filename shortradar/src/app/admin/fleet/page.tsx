'use client';
import { useEffect, useState, useRef } from 'react';

type AcquisitionEvent = {
  channel_id: string;
  handle: string;
  subscribers: number;
  scraped_at: string;
  growth_score: string;
};

export default function FleetCommandCenter() {
  const [logs, setLogs] = useState<string[]>([]);
  const [activeNodes, setActiveNodes] = useState(0);
  const processedIds = useRef<Set<string>>(new Set());
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate simulated node boots
    const bootLogs = [
      '> INITIATING FLEET SURVEILLANCE MATRIX v5.0.0...',
      '> AUTHENTICATING CLOUDFLARE SECRETS...',
      '> CONNECTING TO COCKROACHDB SERVERLESS...',
      '> [OK] SECURE CONNECTION ESTABLISHED.',
      '> ESTABLISHING UPLINK WITH GITHUB ACTIONS RUNNERS...',
      '> AWAITING DATA STREAMS...'
    ];
    
    let delay = 0;
    bootLogs.forEach(log => {
      setTimeout(() => setLogs(prev => [...prev, log]), delay);
      delay += 800;
    });

    const fetchUplink = async () => {
      try {
        const res = await fetch('/api/fleet');
        const data = await res.json();
        
        if (data.status === 'active' && data.latest_acquisitions) {
          const events: AcquisitionEvent[] = data.latest_acquisitions;
          let newActivity = false;
          let newFound = 0;

          events.reverse().forEach(event => {
            if (!processedIds.current.has(event.channel_id)) {
              processedIds.current.add(event.channel_id);
              newActivity = true;
              newFound++;
              
              const time = new Date(event.scraped_at).toLocaleTimeString();
              const runnerId = Math.floor(Math.random() * 20) + 1;
              const formattedLog = `[${time}] [NODE_${runnerId.toString().padStart(2, '0')}] INJECTED TARGET: ${event.handle} | SUBS: ${event.subscribers.toLocaleString()} | VELOCITY: ${event.growth_score}`;
              
              setLogs(prev => [...prev, formattedLog]);
            }
          });

          // Simulate active nodes randomly pulsing based on activity
          setActiveNodes(prev => newActivity ? Math.min(20, prev + newFound) : Math.max(0, prev - 1));
        }
      } catch (err) {
        setLogs(prev => [...prev, '> [ERROR] UPLINK SEVERED. RETRYING...']);
      }
    };

    // Begin pinging after boot sequence
    const interval = setTimeout(() => {
      fetchUplink();
      setInterval(fetchUplink, 4000); // Check for new data every 4 seconds
    }, delay);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#050505] text-emerald-400 font-mono p-8 selection:bg-emerald-900 selection:text-emerald-100">
      <div className="max-w-7xl mx-auto flex flex-col h-[90vh]">
        
        {/* Top Header Bar */}
        <div className="flex border-b border-emerald-900/50 pb-4 mb-4 justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-emerald-300">SHORT<span className="text-rose-600">RADAR</span>_</h1>
            <h2 className="text-sm opacity-50 tracking-[0.2em] mt-1">FLEET CAMERA SURVEILLANCE</h2>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-50 mb-1">GLOBAL CRAWLER ARRAY STATUS</div>
            <div className="flex items-center gap-3">
              <span className="text-xs">ACTIVE NODES:</span>
              <span className="text-2xl font-bold">{activeNodes}</span>
              <span className="text-xs">/ 20</span>
              <div className={`h-3 w-3 rounded-full ${activeNodes > 0 ? 'bg-emerald-500 animate-pulse box-shadow-glow' : 'bg-red-600'}`}></div>
            </div>
          </div>
        </div>

        {/* Terminal Window */}
        <div className="flex-1 border border-emerald-900/30 bg-black/50 rounded-lg p-6 overflow-y-auto font-mono text-sm leading-relaxed shadow-[0_0_30px_rgba(16,185,129,0.05)_inset]">
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.includes('INJECTED') ? 'text-emerald-300 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : log.includes('ERROR') ? 'text-rose-500' : 'text-emerald-700'}`}>
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .box-shadow-glow { box-shadow: 0 0 10px #10b981; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #064e3b; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #047857; }
      `}} />
    </div>
  );
}
