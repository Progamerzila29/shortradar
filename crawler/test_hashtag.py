import json
import requests
import re

def test_android_shorts():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "com.google.android.youtube/18.21.34 (Linux; U; Android 13; en_US) gzip",
        "Content-Type": "application/json"
    })

    print("Requesting Android FEshorts...")
    url = "https://www.youtube.com/youtubei/v1/browse"
    
    # We must include the API key, Android has a specific one but WEB works sometimes, let's use the Android API Key
    # Actually, Android API keys: AIzaSyAcXxxxxxxxxx (We can use a known Android client API key, or just WEB client with Android user-agent? No, keys are client-specific).
    # Easier: Just use the WEB client with WEB API key, but ask for the `FEshorts` page.
    pass

def test_web_shorts_homepage():
    # To get a Shorts continuation, we can load a specific short.
    # What if we just go to youtube.com/hashtag/shorts ?
    session = requests.Session()
    res = session.get("https://www.youtube.com/hashtag/shorts")
    
    data_match = re.search(r'var ytInitialData = (\{.*?\});</script>', res.text)
    if data_match:
        data = json.loads(data_match.group(1))
        json_str = json.dumps(data)
        matches = re.findall(r'"continuationCommand":\{"token":"([^"]+)"', json_str)
        if matches:
            print("Found Hashtag Continuation:", matches[0][:30])
        else:
            print("No continuation on hashtag page.")
    
if __name__ == "__main__":
    test_web_shorts_homepage()
