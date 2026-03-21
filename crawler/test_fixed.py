import json
import requests
import re

def scrape_from_fixed_short():
    session = requests.Session()
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")
    session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

    # Fetch a known short (any random short ID to kickstart the sequence)
    print("Fetching a specific short to get continuation...")
    res = session.get("https://www.youtube.com/shorts/_OBlgSz8sSM")
    
    # Extract API Key
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    
    # Extract ytInitialData
    data_match = re.search(r'var ytInitialData = (\{.*?\});</script>', res.text)
    if not data_match:
        print("Failed to find ytInitialData")
        return
        
    data = json.loads(data_match.group(1))

    def find_sequence(obj):
        results = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == "sequenceParams":
                    results.append(v)
                else:
                    results.extend(find_sequence(v))
        elif isinstance(obj, list):
            for item in obj:
                results.extend(find_sequence(item))
        return results

    tokens = find_sequence(data)
    tokens = list(set(tokens))
    print("Tokens found:", len(tokens))
    for t in tokens:
        print(f" - {t[:40]}...")

    if not tokens:
        return

    # Let's test the token!
    print("Testing token...")
    url = f"https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240320.00.00"
            }
        },
        "continuation": tokens[0]
    }
    
    res2 = session.post(url, json=payload)
    print("Status:", res2.status_code)
    try:
        data2 = res2.json()
        print("Keys returned:", data2.keys())
        if "entries" in data2:
            print(f"Got {len(data2['entries'])} entries.")
        else:
            print("Response Dump:")
            print(json.dumps(data2)[:500])
    except:
        print("Failed JSON decode")

if __name__ == "__main__":
    scrape_from_fixed_short()
