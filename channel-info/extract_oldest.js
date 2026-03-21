const fs = require('fs');
const data = JSON.parse(fs.readFileSync('shorts.json', 'utf-8'));

const chips = data.contents.twoColumnBrowseResultsRenderer.tabs[2].tabRenderer.content.richGridRenderer.header.chipBarViewModel.chips;

const oldestChip = chips.find(c => c.chipViewModel.text === 'Oldest');
if (oldestChip) {
    fs.writeFileSync('oldest_chip.json', JSON.stringify(oldestChip, null, 2), 'utf-8');
    console.log("Saved oldest_chip.json");
} else {
    console.log("Oldest chip not found");
}

// Check videos tab for oldest sort just in case
if (fs.existsSync('videos.json')) {
    const vdata = JSON.parse(fs.readFileSync('videos.json', 'utf-8'));
    try {
        const vchips = vdata.contents.twoColumnBrowseResultsRenderer.tabs[1].tabRenderer.content.richGridRenderer.header.chipBarViewModel.chips;
        const vOldest = vchips.find(c => c.chipViewModel.text === 'Oldest');
        if (vOldest) {
            fs.writeFileSync('videos_oldest_chip.json', JSON.stringify(vOldest, null, 2), 'utf-8');
            console.log("Saved videos_oldest_chip.json");
        }
    } catch(e) {}
}
