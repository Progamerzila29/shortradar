import json
import requests
import re

def scrape_initial_short():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    })
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")

    print("Requesting /shorts...")
    res = session.get("https://www.youtube.com/shorts")
    print(f"Redirected to: {res.url}")
    
    # Extract API Key
    api_key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', res.text)
    api_key = api_key_match.group(1) if api_key_match else None
    print(f"API Key: {api_key}")
    
    # Extract ytInitialData
    data_match = re.search(r'var ytInitialData = (\{.*?\});</script>', res.text)
    if data_match:
        try:
            data = json.loads(data_match.group(1))
            print("Successfully parsed ytInitialData.")
            
            # Find the continuation token in the dump
            json_str = json.dumps(data)
            matches = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
            if matches:
                # Shorts sequence tokens usually start with a specific prefix
                print(f"Found {len(matches)} continuation tokens.")
                for m in set(matches):
                    print(f" - {m[:30]}...")
            else:
                print("No continuation tokens found in ytInitialData.")
        except Exception as e:
            print("Failed to parse JSON:", e)
    else:
        print("ytInitialData not found.")

if __name__ == "__main__":
    scrape_initial_short()
