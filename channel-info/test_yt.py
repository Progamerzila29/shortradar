import urllib.request
import re
import json
import sys

def test():
    channel = sys.argv[1] if len(sys.argv) > 1 else "mkbhd"
    url = f"https://www.youtube.com/@{channel}"
    print(f"Fetching {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0','Accept-Language': 'en-US,en;q=0.9'})
    html = urllib.request.urlopen(req).read().decode('utf-8')

    match = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    if match:
        data = json.loads(match.group(1))
        with open('yt.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Saved yt.json")
    else:
        print("No ytInitialData found")

if __name__ == "__main__":
    test()
