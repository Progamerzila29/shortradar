import json
import innertube

def test_innertube_search():
    client = innertube.InnerTube("WEB")
    
    print("Searching for #shorts sorted by date...")
    try:
        # CAISBAgCEAE= is the internal YouTube parameter for "Sort by Upload Date"
        data = client.search("#shorts", params="CAISBAgCEAE=")
        
        # Save to file to inspect the structure
        with open("innertube_search.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
        print("Success! Dumped to innertube_search.json.")
        
        # Find exactly where the video IDs are
        def find_videos(d):
            vids = []
            if isinstance(d, dict):
                for k, v in d.items():
                    if k == "videoId":
                        vids.append(v)
                    else:
                        vids.extend(find_videos(v))
            elif isinstance(d, list):
                for item in d:
                    vids.extend(find_videos(item))
            return vids
            
        vids = find_videos(data)
        print(f"Found {len(set(vids))} video IDs in the first page payload.")
        if vids:
            print("Samples:", list(set(vids))[:5])
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_innertube_search()
