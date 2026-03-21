import json
import requests
import re

def test_pure_android_reel():
    session = requests.Session()
    
    # We need a mobile user agent
    session.headers.update({
        "User-Agent": "com.google.android.youtube/18.43.45 (Linux; U; Android 13; en_US)",
        "Content-Type": "application/json"
    })
    
    # 1. Get an API Key from the web just to authorize InnerTube
    print("Getting API key...")
    res = requests.get("https://www.youtube.com/")
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    print("Key:", api_key)
    
    # 2. Hit reel_item_watch as an ANDROID device!
    print("Requesting reel_item_watch as ANDROID...")
    url = f"https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": "18.43.45",
                "androidSdkVersion": 33,
                "userAgent": "com.google.android.youtube/18.43.45 (Linux; U; Android 13; en_US) gzip",
                "hl": "en",
                "gl": "US"
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
        
        # Let's see what is inside
        json_str = json.dumps(data)
        
        # Look for videoId sequences
        matches = re.findall(r'"videoId":"([^"]{11})"', json_str)
        seen = set()
        unique = [x for x in matches if not (x in seen or seen.add(x))]
        print("Unique videos found in payload:", len(unique))
        print(unique[:10])
        
        # Look for reelWatchEndpoint
        tokens = re.findall(r'"sequenceParams":"([^"]+)"', json_str)
        print("Sequence params:", len(set(tokens)))
        
        continuations = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
        print("Continuations:", len(set(continuations)))
        
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_pure_android_reel()
