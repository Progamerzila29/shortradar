const fs = require('fs');

const about = JSON.parse(fs.readFileSync('dump_about.json'));

let foundName = null;
let foundAvatar = null;
let foundDesc = null;

function findInfo(obj) {
    if (Array.isArray(obj)) {
        for (const i of obj) findInfo(i);
    } else if (typeof obj === 'object' && obj !== null) {
        if (obj.channelName) foundName = obj.channelName;
        if (obj.title && !foundName) foundName = obj.title;
        if (obj.description && typeof obj.description === 'string') foundDesc = obj.description;
        if (obj.avatar && obj.avatar.thumbnails) foundAvatar = obj.avatar.thumbnails;
        
        for (const v of Object.values(obj)) findInfo(v);
    }
}
findInfo(about);

console.log("Name:", foundName);
console.log("Avatar:", JSON.stringify(foundAvatar, null, 2));
console.log("Desc length:", foundDesc ? foundDesc.length : 0);

const shorts = JSON.parse(fs.readFileSync('dump_shorts.json'));
let recentShorts = [];

function findShorts(obj) {
    if (Array.isArray(obj)) {
        for (const i of obj) findShorts(i);
    } else if (typeof obj === 'object' && obj !== null) {
        if (obj.shortsLockupViewModel) {
            recentShorts.push({
                id: obj.shortsLockupViewModel.entityId,
                title: obj.shortsLockupViewModel.overlayMetadata?.primaryText?.content,
                views: obj.shortsLockupViewModel.overlayMetadata?.secondaryText?.content,
                thumb: obj.shortsLockupViewModel.thumbnail?.sources?.[0]?.url
            });
        }
        for (const v of Object.values(obj)) findShorts(v);
    }
}
findShorts(shorts);

console.log("Recent Shorts Found:", recentShorts.length);
if (recentShorts.length > 0) {
    console.log(recentShorts.slice(0, 5));
}
