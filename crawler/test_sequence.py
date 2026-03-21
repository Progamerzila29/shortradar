import json
import requests
import re

def test_sequence_params():
    session = requests.Session()
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")
    session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})

    print("Fetching base short...")
    res = session.get("https://www.youtube.com/shorts/_OBlgSz8sSM")
    
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    
    data_match = re.search(r'var ytInitialData = (\{.*?\});</script>', res.text)
    if not data_match:
        print("Failed to find ytInitialData")
        return
        
    data_str = data_match.group(1)
    
    # regex for sequenceParams
    seq_match = re.search(r'"sequenceParams":"([^"]+)"', data_str)
    if seq_match:
        seq = seq_match.group(1)
        print("Found sequenceParams:", seq[:40], "...")
        
        # Now hit reel_item_watch with THIS sequenceParam
        url = f"https://www.youtube.com/youtubei/v1/reel/reel_item_watch?key={api_key}"
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20240320.00.00"
                }
            },
            "params": seq
        }
        print("Requesting reel_item_watch with params payload...")
        res2 = session.post(url, json=payload)
        print("Status:", res2.status_code)
        try:
            data2 = res2.json()
            if "entries" in data2:
                print(f"BINGO! Got {len(data2['entries'])} entries.")
            else:
                print("Keys:", data2.keys())
        except Exception as e:
            print("Err:", e)
    else:
        print("No sequenceParams found.")

if __name__ == "__main__":
    test_sequence_params()
