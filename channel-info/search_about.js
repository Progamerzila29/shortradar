const fs = require('fs');

const data = JSON.parse(fs.readFileSync('about_test.json', 'utf-8'));
let out = '';
function search(o, path='') {
    if (typeof o === 'string' && o.includes('Joined')) {
        out += `${path}: ${o}\n`;
    }
    if (typeof o === 'string' && o.includes('videos')) {
        if (o.length < 50) out += `${path}: ${o}\n`;
    }
    if (Array.isArray(o)) {
        o.forEach((i, idx) => search(i, `${path}[${idx}]`));
    } else if (typeof o === 'object' && o !== null) {
        for (const [k, v] of Object.entries(o)) {
            search(v, `${path}.${k}`);
        }
    }
}
search(data);
console.log(out || "Not found");
