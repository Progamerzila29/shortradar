import re
import json
import time
import requests

def test_innertube_shorts():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    })

    print("Fetching initial page...")
    res = session.get("https://www.youtube.com/")
    html = res.text

    # 2. Extract the public INNERTUBE_API_KEY
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
    if not api_key_match:
        print("Failed to find API KEY")
        return
    api_key = api_key_match.group(1)
    print(f"API Key: {api_key}")

    # 3. Extract ytInitialData
    data_match = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    if not data_match:
        print("Failed to find ytInitialData")
        return
    yt_data = json.loads(data_match.group(1))

    # 4. Find the continuation token
    continuation = None
    try:
        # The structure is usually deeply nested. A quick regex on the stringified JSON is often faster and less brittle:
        cont_match = re.search(r'"continuationCommand":\{"token":"([^"]+)"', html)
        if cont_match:
            continuation = cont_match.group(1)
            print(f"Found Continuation Token: {continuation[:20]}...")
    except Exception as e:
        print("Error finding continuation:", e)
        
    if not continuation:
        print("No continuation found.")
        return

    # 5. POST to reel_item_watch to simulate a "swipe" and get the next batch of shorts
    print("Simulating a swipe... requesting next shorts")
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240101.01.00",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        },
        "continuation": continuation
    }
    
    api_url = f"https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key={api_key}"
    res2 = session.post(api_url, json=payload)
    
    if res2.status_code == 200:
        data2 = res2.json()
        entries = data2.get("entries", [])
        print(f"Success! Fetched {len(entries)} shorts in this swipe.")
        for e in entries:
            req = e.get("command", {}).get("reelWatchEndpoint", {})
            vid = req.get("videoId")
            # The JSON payload for reel sequences usually just gives video IDs and a new continuation token.
            print(f" - Found Short ID: {vid}")
    else:
        print(f"API Failed: {res2.status_code} - {res2.text[:200]}")

if __name__ == "__main__":
    test_innertube_shorts()
