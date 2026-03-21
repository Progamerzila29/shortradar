const fs = require('fs');

if (fs.existsSync('shorts.json')) {
    const data = JSON.parse(fs.readFileSync('shorts.json', 'utf-8'));
    let out = '';
    let sortTokens = [];
    function findSorts(obj, path = '') {
        if (Array.isArray(obj)) {
            obj.forEach((i, idx) => findSorts(i, `${path}[${idx}]`));
        } else if (typeof obj === 'object' && obj !== null) {
            if (obj.text && typeof obj.text === 'string' && (obj.text.includes('Oldest') || obj.text.includes('Popular') || obj.text.includes('Latest'))) {
                out += `SORT OPTION: ${obj.text} at ${path}\n`;
            }
            if (obj.label && typeof obj.label === 'string' && (obj.label.includes('Oldest') || obj.label.includes('Popular') || obj.label.includes('Latest'))) {
                out += `SORT LABEL: ${obj.label} at ${path}\n`;
            }
            for (const [k, v] of Object.entries(obj)) {
                findSorts(v, `${path}.${k}`);
            }
        }
    }
    findSorts(data);
    console.log(out || "No sort options found in shorts.json");
} else {
    console.log("shorts.json not found");
}
