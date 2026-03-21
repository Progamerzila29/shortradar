const fs = require('fs');
const https = require('https');

const tokens = [
    '4qmFsgJoEhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEaTDhnWXhHaS15QVN3S0JBb0NDQU1hSkRabU16azBNVFZpTFRBd01EQXRNamN5TkMwNVpUQm1MVEUwTWpJelltRmxZamN5TWclM0QlM0Q', // fixed url encoding
    '4qmFsgJoEhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEaTDhnWXhHaS15QVN3S0JBb0NDQU1hSkRabU16azBNVFZrTFRBd01EQXRNamN5TkMwNVpUQm1MVEUwTWpJelltRmxZamN5TWclM0QlM0Q',
    '4qmFsgJgEhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEaRDhnWXJHaW1hQVNZS0pEWm1NemswTVRsaUxUQXdNREF0TWpjeU5DMDVaVEJtTFRFME1qSXpZbUZsWWpjeU1nJTNEJTNE',
    '4qmFsgJgEhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEaRDhnWXJHaW1hQVNZS0pEWm1NemswTVRsa0xUQXdNREF0TWpjeU5DMDVaVEJtTFRFME1qSXpZbUZsWWpjeU1nJTNEJTNE'
];

async function fetchToken(token, index) {
    const url = `https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false`;
    const payload = {
        context: {
            client: {
                clientName: 'WEB',
                clientVersion: '2.20260312.08.00',
                hl: 'en',
                gl: 'US'
            }
        },
        continuation: decodeURIComponent(token)
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Needs origin and referer otherwise it might block
                'Origin': 'https://www.youtube.com',
                'Referer': 'https://www.youtube.com/'
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        fs.writeFileSync(`token_${index}.json`, JSON.stringify(json, null, 2));
        console.log(`Saved token_${index}.json`);
    } catch (e) {
        console.error('Error fetching token', index, e);
    }
}

async function main() {
    for (let i = 0; i < tokens.length; i++) {
        await fetchToken(tokens[i], i);
    }
}
main();
