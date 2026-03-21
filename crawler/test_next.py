import json
import requests
import re

def test_next_endpoint():
    session = requests.Session()
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")
    
    # 1. Get API Key from homepage
    print("Getting API key...")
    res = session.get("https://www.youtube.com/")
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    
    # 2. POST to next
    print("Requesting next for a short...")
    url = f"https://www.youtube.com/youtubei/v1/next?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240320.00.00"
            }
        },
        "videoId": "_OBlgSz8sSM"
    }
    
    res2 = session.post(url, json=payload)
    print("Status:", res2.status_code)
    try:
        data = res2.json()
        print("Keys:", data.keys())
        
        # Look for continuation
        json_str = json.dumps(data)
        matches = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
        print("Continuations found:", len(set(matches)))
        
        # Look for video IDs
        vids = re.findall(r'"videoId":"([^"]+)"', json_str)
        print("Video IDs found:", len(set(vids)))
        if vids:
            print("Sample ids:", list(set(vids))[:5])
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_next_endpoint()
