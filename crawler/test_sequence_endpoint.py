import json
import requests
import re

def test_sequence_endpoint():
    session = requests.Session()
    # 1. Get API Key
    res = session.get("https://www.youtube.com/")
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    
    # 2. Hit reel_watch_sequence to generate a new feed session!
    print("Requesting reel_watch_sequence to bootstrap sequence...")
    url = f"https://www.youtube.com/youtubei/v1/reel/reel_watch_sequence?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240321.01.00"
            }
        }
    }
    
    res2 = session.post(url, json=payload)
    print("Status:", res2.status_code)
    try:
        data = res2.json()
        print("Keys:", data.keys())
        # Let's see if sequenceParams or continuation is returned
        json_str = json.dumps(data)
        
        matches = re.findall(r'"sequenceParams":"([^"]+)"', json_str)
        print("Sequence params found:", len(set(matches)))
        if matches:
             print("Sample:", matches[0][:40])
             
        matches_cont = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
        if matches_cont:
             print("Continuation found:", matches_cont[0][:40])
             
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_sequence_endpoint()
