const fs = require('fs');
const data = JSON.parse(fs.readFileSync('yt.json', 'utf-8'));

let out = '';
function searchKeys(obj, currentPath = '') {
    if (typeof obj === 'string') {
        const lower = obj.toLowerCase();
        if (lower.includes('joined') || lower.includes('video') || lower.includes('viewcount') || lower.includes('subscribercount')) {
            if (obj.length < 100) {
                out += `${currentPath}: ${obj}\n`;
            }
        }
    } else if (typeof obj === 'number') {
        // we can check if it's a large number
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => searchKeys(item, `${currentPath}[${index}]`));
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes('count') || key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
                if (typeof value === 'string' || typeof value === 'number') {
                    out += `KEY MATCH => ${currentPath}.${key}: ${value}\n`;
                }
            }
            searchKeys(value, `${currentPath}.${key}`);
        }
    }
}

searchKeys(data);
fs.writeFileSync('search_results.txt', out, 'utf-8');
