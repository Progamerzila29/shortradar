const fs = require('fs');

async function main() {
    ['videos', 'shorts', 'streams'].forEach(name => {
        if (!fs.existsSync(`${name}.json`)) return;
        const data = JSON.parse(fs.readFileSync(`${name}.json`, 'utf-8'));
        let out = '';
        function search(obj, path = '') {
            if (typeof obj === 'string') {
                if (obj.toLowerCase().includes('video') || obj.toLowerCase().includes('count')) {
                    if (obj.length < 50) out += `${path}: ${obj}\n`;
                }
            } else if (Array.isArray(obj)) {
                obj.forEach((item, index) => search(item, `${path}[${index}]`));
            } else if (typeof obj === 'object' && obj !== null) {
                // If the key is videoCount or similar, log it even if it's a number
                for (const [key, value] of Object.entries(obj)) {
                    if (key.toLowerCase().includes('count')) {
                        out += `KEY MATCH ${path}.${key} => ${value}\n`;
                    }
                    search(value, `${path}.${key}`);
                }
            }
        }
        search(data);
        fs.writeFileSync(`${name}_search.txt`, out, 'utf-8');
        console.log(`Saved ${name}_search.txt`);
    });
}
main();
