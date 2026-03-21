"""
  🚀 SHORT RADAR — V5 API FLEET (UNDEFEATABLE CLOUD ARMY)
  
  Pure Python API scraper using direct InnerTube Search API.
  Zero Browsers. Zero Monkey Pages. Absolutely free CI/CD execution.
  
  Retrieves the absolute freshest #shorts globally sorted by upload date.
"""

import os
import sys
import time
import json
import requests
import datetime
import traceback

WORKER_API = "https://shortradar-scraper-api.shortradar.workers.dev"

# The public, unauthenticated Web Client API Key (same across all anonymous youtube sessions)
YT_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

class C:
    RESET  = '\033[0m'
    BOLD   = '\033[1m'
    DIM    = '\033[2m'
    GREEN  = '\033[32m'
    RED    = '\033[31m'
    YELLOW = '\033[33m'
    CYAN   = '\033[36m'
    MAG    = '\033[35m'
    BG_GRN = '\033[42m'

def log(icon, msg):
    t = time.strftime("%I:%M:%S %p")
    print(f"{C.DIM}[{t}]{C.RESET} {icon}  {msg}")

class YouTubeSearchScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json"
        })
        self.url = f"https://www.youtube.com/youtubei/v1/search?key={YT_API_KEY}"

    def get_search_page(self, continuation=None):
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20240320.00.00"
                }
            },
            "query": "#shorts",
            "params": "CAISBAgCEAE="  # Magic bytes for "Sort by Upload Date"
        }
        
        if continuation:
            # If paging, query and params are dropped, only continuation is sent.
            payload.pop("query")
            payload.pop("params")
            payload["continuation"] = continuation

        res = self.session.post(self.url, json=payload)
        if res.status_code != 200:
            log("⚠️", f"API Rejected: {res.status_code}")
            return [], None
            
        data = res.json()
        
        # 1. Extract video IDs and Channel IDs
        results = []
        def extract_shorts(d):
            if isinstance(d, dict):
                # Look for reelItemRenderer which represents a Short in search
                if "reelItemRenderer" in d:
                    renderer = d["reelItemRenderer"]
                    vid = renderer.get("videoId")
                    # The channelId might be under navigationEndpoint if available,
                    # or for shorts we can just send the videoId to the scraper, 
                    # but wait! The scraper API expects a `handle` or `channelId`.
                    # Actually, our scraper `WORKER_API` accepts `?handle=xx` or `/api?id=xx`.
                    # Let's extract whatever channel data we can:
                    try:
                        channel_id = renderer["navigationEndpoint"]["browseEndpoint"]["browseId"]
                    except:
                        channel_id = None
                        
                    if vid:
                        results.append({"videoId": vid, "channelId": channel_id})
                else:
                    for k, v in d.items():
                        extract_shorts(v)
            elif isinstance(d, list):
                for item in d:
                    extract_shorts(item)
        extract_shorts(data)
        
        # 2. Extract Continuation Token
        next_token = None
        def find_token(d):
            nonlocal next_token
            if isinstance(d, dict):
                for k, v in d.items():
                    if k == "continuationCommand" and getattr(v, "get", lambda x: None)("token"):
                        next_token = v["token"]
                    else:
                        find_token(v)
            elif isinstance(d, list):
                for item in d:
                    find_token(item)
        find_token(data)

        return results, next_token

def run_fleet_instance(target_extractions=1000):
    print(f"\n  {C.BOLD}🚀 SHORT RADAR — V5 CLOUD ARMY INITIATED{C.RESET}\n")
    log("🧠", "Booting InnerTube Search API (Global #Shorts / Fresh Sort)...")
    
    scraper = YouTubeSearchScraper()
    token = None
    processed_count = 0
    pages = 0
    
    # Statistics
    stats = {"discovered": 0, "api_hits": 0, "errors": 0, "cf_valid": 0, "cf_ignored": 0}
    processed_vids = set()
    
    while processed_count < target_extractions:
        pages += 1
        t0 = time.time()
        shorts_data, token = scraper.get_search_page(continuation=token)
        ms = int((time.time() - t0) * 1000)
        
        if not shorts_data:
            log("🛑", "No videos returned. YouTube might have rate-limited this run.")
            break
            
        print(f"{C.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{C.RESET}")
        log("📺", f"Page {pages} retrieved in {ms}ms. Found {C.GREEN}{len(shorts_data)} fresh Shorts{C.RESET}.")
        
        for short in shorts_data:
            vid = short["videoId"]
            cid = short.get("channelId")
            
            if vid in processed_vids: continue
            processed_vids.add(vid)
            processed_count += 1
            stats["discovered"] += 1
            
            # Send to CF Worker
            if cid:
                try:
                    # Depending on how the CF worker handles channel IDs vs handles
                    # We send ?channel_id= or ?id= 
                    # If your worker accepts `?handle=UCX...` it will resolve it anyway.
                    res = requests.get(f"{WORKER_API}?handle={cid}", timeout=10)
                    cf_data = res.json()
                    
                    status = cf_data.get("status", "")
                    if status == "success":
                        stats["cf_valid"] += 1
                        ch = cf_data["data"]["channel"]
                        log("✅", f"{C.BG_GRN}{C.BOLD} VALID CHANNEL! {C.RESET} {cid} "
                                 f"Subs: {ch.get('subscribers_text','?')} | Age: {ch.get('channel_age_days','?')}d")
                    elif status == "ignored":
                        stats["cf_ignored"] += 1
                        reason = cf_data.get("reason", "Filtered")
                        print(f"{C.DIM}   ❌ {cid} — {reason}{C.RESET}")
                    else:
                        print(f"{C.DIM}   ⚠️ API Error: {cf_data.get('error')}{C.RESET}")
                except Exception as e:
                    stats["errors"] += 1
            else:
                print(f"{C.DIM}   ⚠️ No channel ID extracted for {vid}{C.RESET}")

        log("🔎", f"Total Extracted in this Run: {processed_count}/{target_extractions}")
        
        if not token:
            log("🛑", "No continuation token found. End of line.")
            break
            
        # Wait 0.5s to play nice with the API
        time.sleep(0.5)

    log("✅", f"{C.BG_GRN}{C.BOLD} INSTANCE COMPLETE {C.RESET} Extracted {processed_count} brand new global Shorts.")

if __name__ == "__main__":
    try:
        # Run 20 pages max for the test (should yield around 400-500 shorts instantly)
        run_fleet_instance(target_extractions=500)
    except Exception as e:
        print(f"\n{C.RED}FATAL: {e}{C.RESET}")
        traceback.print_exc()
        sys.exit(1)
