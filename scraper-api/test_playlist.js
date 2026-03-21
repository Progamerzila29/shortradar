const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

fetch('https://www.youtube.com/youtubei/v1/browse?key=' + API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://www.youtube.com' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, browseId: 'UUSHj-l4qsg_yb4rnbLpjOFFFg' })
})
.then(r => r.json())
.then(j => {
    let found = false;
    function f(obj, p='') {
        if(!obj || typeof obj !== 'object') return;
        if(Array.isArray(obj)) return obj.forEach((v,i)=>f(v,p+'['+i+']'));
        for(const [k,v] of Object.entries(obj)) {
            if(k==='publishedTimeText' || k === 'publishDate' || k === 'dateText') { console.log('Found:', k, JSON.stringify(v)); found=true; }
            if(k==='accessibilityText') { console.log('A11y:', v); }
            f(v, p+'.'+k);
        }
    }
    f(j);
    if(!found) console.log('No dates found in UUSH. Keys:', Object.keys(j).slice(0,5));
})
.catch(e => console.log('Error:', e));
