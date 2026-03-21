async function testHTML() {
    const res = await fetch("https://www.youtube.com/shorts/18uTyd7oPcY", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    const text = await res.text();
    const match = text.match(/"datePublished":"(.*?)"/);
    if (match) {
        console.log("SUCCESS! Date is:", match[1]);
    } else {
        const itemMatch = text.match(/<meta itemprop="datePublished" content="(.*?)">/);
        if (itemMatch) console.log("SUCCESS! Date is:", itemMatch[1]);
        else console.log("FAILED to find date in HTML");
    }
}
testHTML();
