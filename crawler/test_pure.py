import json
import requests
import re

def test_pure_reel_item():
    session = requests.Session()
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")
    session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    
    # 1. Get API Key
    print("Getting API key...")
    res = session.get("https://www.youtube.com/")
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    
    # 2. Hit reel_item_watch with just the playerRequest videoId
    print("Requesting reel_item_watch to bootstrap sequence...")
    url = f"https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240321.01.00"
            }
        },
        "playerRequest": {
            "videoId": "_OBlgSz8sSM"
        }
    }
    
    res2 = session.post(url, json=payload)
    print("Status:", res2.status_code)
    try:
        data = res2.json()
        print("Keys:", data.keys())
        if "entries" in data:
            print(f"BINGO! Got {len(data['entries'])} shorts instantly.")
        else:
            print("No entries.")
            # Let's see if there is a continuation command natively returned
            json_str = json.dumps(data)
            matches = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
            print("Continuations found:", len(set(matches)))
            if matches:
                 print("Sample:", matches[0][:40])
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_pure_reel_item()
