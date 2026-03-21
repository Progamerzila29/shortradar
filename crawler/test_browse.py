import json
import requests
import re

def test_browse():
    session = requests.Session()
    
    # 1. Get API Key from homepage
    print("Getting API key...")
    res = session.get("https://www.youtube.com/")
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    print(f"API Key: {api_key}")
    
    # 2. POST to browse
    print("Requesting FEshorts...")
    url = f"https://www.youtube.com/youtubei/v1/browse?key={api_key}"
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240320.00.00"
            }
        },
        "browseId": "FEshorts"
    }
    
    res2 = session.post(url, json=payload)
    if res2.status_code == 200:
        data = res2.json()
        print("Success! Response size:", len(json.dumps(data)))
        # Search for continuation string
        cont_match = re.search(r'"continuationCommand":\{"token":"([^"]+)"', json.dumps(data))
        if cont_match:
            print("Found Token:", cont_match.group(1)[:30], "...")
    else:
        print("Failed:", res2.status_code)

if __name__ == "__main__":
    test_browse()
