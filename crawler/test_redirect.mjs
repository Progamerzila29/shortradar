async function testShortsRedirect() {
    try {
        console.log("Fetching https://www.youtube.com/shorts ...");
        const res = await fetch("https://www.youtube.com/shorts", {
            redirect: "manual",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });
        
        console.log("Status:", res.status);
        console.log("Headers location:", res.headers.get("location"));
        
        // If it follows automatically, check res.url
        console.log("Final URL:", res.url);
        
    } catch(e) {
        console.log("Failed:", e.message);
    }
}

testShortsRedirect();
