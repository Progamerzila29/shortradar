const fs = require('fs');
const yt = JSON.parse(fs.readFileSync('yt.json', 'utf-8'));
let out = '';
function deepSearch(obj, path = '') {
    if (typeof obj === 'string') {
        const l = obj.toLowerCase();
        if (l.includes('shorts') && l.includes('count')) {
            out += `${path}: ${obj}\n`;
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => deepSearch(item, `${path}[${index}]`));
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes('short') && typeof value === 'number') {
                out += `KEY MATCH ${path}.${key} => ${value}\n`;
            }
            deepSearch(value, `${path}.${key}`);
        }
    }
}
deepSearch(yt);
fs.writeFileSync('shorts_deep_search.txt', out, 'utf-8');
