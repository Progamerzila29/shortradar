const fs = require('fs');

const data = JSON.parse(fs.readFileSync('dump_franko_about.json'));
let foundTexts = [];

function searchAbon(obj) {
    if (Array.isArray(obj)) { for (const i of obj) searchAbon(i); }
    else if (typeof obj === 'object' && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && (v.toLowerCase().includes('sub') || v.toLowerCase().includes('abon'))) {
                foundTexts.push(`Key: ${k} -> Value: ${v}`);
            }
        }
        for (const v of Object.values(obj)) searchAbon(v);
    }
}

searchAbon(data);
console.log(foundTexts.join('\n'));
