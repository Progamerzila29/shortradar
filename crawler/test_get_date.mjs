import { Innertube } from 'youtubei.js';

async function testDatePing() {
    const yt = await Innertube.create({ generate_session_locally: true });
    
    console.log(`\nPinging InnerTube getInfo for eWlcszvljcE...`);
    const start = Date.now();
    try {
        const info = await yt.getInfo("eWlcszvljcE");
        console.log(`Time taken: ${Date.now() - start}ms`);
        console.log(`Title: ${info.basic_info.title}`);
        console.log(`Date via basic_info: ${info.basic_info.date}`);
        console.log(`Date via microformat: ${info.primary_info?.published?.text}`);
        
        // Let's dump the microformat
        console.log(info.player_response?.microformat?.playerMicroformatRenderer?.publishDate);
        
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testDatePing();
