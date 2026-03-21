import requests

def dump_shorts_html():
    session = requests.Session()
    session.cookies.set("SOCS", "CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg", domain=".youtube.com")
    session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    
    # We load a known popular short
    res = session.get("https://www.youtube.com/shorts/_OBlgSz8sSM")
    
    with open("shorts_dump.html", "w", encoding="utf-8") as f:
        f.write(res.text)
    print("Dumped shorts_dump.html")

if __name__ == "__main__":
    dump_shorts_html()
