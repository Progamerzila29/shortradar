import json
import innertube

def test_innertube_lib():
    # Initialize the WEB client
    client = innertube.InnerTube("WEB")
    
    print("Fetching FEshorts...")
    try:
        data = client.browse("FEshorts")
        # Save to file to inspect the structure
        with open("innertube_dump.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print("Success! Dumped to innertube_dump.json.")
        
        # Try to find exactly where the video IDs are
        def find_shorts(d):
            vids = []
            if isinstance(d, dict):
                for k, v in d.items():
                    if k == "videoId":
                        vids.append(v)
                    else:
                        vids.extend(find_shorts(v))
            elif isinstance(d, list):
                for item in d:
                    vids.extend(find_shorts(item))
            return vids
            
        vids = find_shorts(data)
        print(f"Found {len(set(vids))} unique video IDs in the payload.")
        if vids:
            print("Samples:", list(set(vids))[:5])
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_innertube_lib()
