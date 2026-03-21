const fs = require('fs');

for (let i = 0; i < 4; i++) {
    const data = JSON.parse(fs.readFileSync(`token_${i}.json`, 'utf-8'));
    let out = '';
    function searchKeys(obj, currentPath = '') {
        if (typeof obj === 'string') {
            const lower = obj.toLowerCase();
            if (lower.includes('joined') || lower.includes('video') || lower.includes('view') || lower.includes('sub')) {
                if (obj.length < 200) {
                    out += `${currentPath}: ${obj}\n`;
                }
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((item, index) => searchKeys(item, `${currentPath}[${index}]`));
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                searchKeys(value, `${currentPath}.${key}`);
            }
        }
    }
    searchKeys(data);
    fs.writeFileSync(`token_${i}_out.txt`, out, 'utf-8');
}
