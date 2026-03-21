const fs = require('fs');
const data = JSON.parse(fs.readFileSync('yt.json', 'utf-8'));
fs.writeFileSync('header.json', JSON.stringify(data.header, null, 2), 'utf-8');
