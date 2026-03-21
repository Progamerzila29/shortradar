const fs = require('fs');
const html = fs.readFileSync('yt.html', 'utf-8');

const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
const clientVersionMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"(.*?)"/);

console.log('API Key:', apiKeyMatch ? apiKeyMatch[1] : 'Not Found');
console.log('Client Version:', clientVersionMatch ? clientVersionMatch[1] : 'Not Found');

let token = '';
try {
    const data = JSON.parse(fs.readFileSync('yt.json', 'utf-8'));
    // Let's find the about continuation token
    function findToken(obj) {
        if (typeof obj === 'string') {
        } else if (Array.isArray(obj)) {
            obj.forEach(item => findToken(item));
        } else if (typeof obj === 'object' && obj !== null) {
            if (obj.targetId === 'engagement-panel-about-channel' || 
                (obj.engagementPanelSectionListRenderer && obj.engagementPanelSectionListRenderer.targetId.includes('about'))) {
                // Not standard anymore
            }
            if (obj.engagementPanelSectionListRenderer && obj.engagementPanelSectionListRenderer.targetId === 'engagement-panel-about-channel') {
                // Wait, targeting might be named somewhat differently let's just find anything with 'token' near 'browse'
            }
            // Search for "token" anywhere if the sibling has "request": "CONTINUATION_REQUEST_TYPE_BROWSE"
            if (obj.continuationCommand && obj.continuationCommand.request === 'CONTINUATION_REQUEST_TYPE_BROWSE') {
                // There are multiple. The "About" panel is usually in engagement panels.
                // Let's just output them
                console.log("Token Found:", obj.continuationCommand.token);
                token = obj.continuationCommand.token;
            }
            for (const value of Object.values(obj)) {
                findToken(value);
            }
        }
    }
    findToken(data);
} catch (e) {
    console.error(e);
}
