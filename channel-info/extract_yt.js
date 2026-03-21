const fs = require('fs');
const data = JSON.parse(fs.readFileSync('yt.json', 'utf-8'));

let out = '';
function findPaths(obj, targetStr, currentPath = '') {
    if (typeof obj === 'string') {
        if (obj.includes(targetStr)) out += `${currentPath}: ${obj.substring(0, 100)}\n`;
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => findPaths(item, targetStr, `${currentPath}[${index}]`));
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            findPaths(value, targetStr, `${currentPath}.${key}`);
        }
    }
}

out += "Looking for 'Joined'...\n";
findPaths(data, 'Joined');

out += "\nLooking for Exact Count (e.g., 1850)...\n";
// Sometimes it's a number instead of a string, let's catch numbers too
function findNumberPaths(obj, targetStr, currentPath = '') {
    if (typeof obj === 'number' || typeof obj === 'string') {
        if (String(obj).includes(targetStr)) {
            if (String(obj).length < 20) out += `${currentPath}: ${obj}\n`;
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => findNumberPaths(item, targetStr, `${currentPath}[${index}]`));
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            findNumberPaths(value, targetStr, `${currentPath}.${key}`);
        }
    }
}

// We need to look for things like exact counts. Unfortunately we don't know MKBHD's exact count right now.
// However we do know that the channel's about popup is requested dynamically!
// Since October 2023, the 'about' page is empty, it makes a POST to /youtubei/v1/browse
// Wait! Let's just output the whole "about" module or see if we find "Joined".

fs.writeFileSync('output_utf8.txt', out, 'utf-8');
