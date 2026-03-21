const { Client } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const certUrl = 'https://cockroachlabs.cloud/clusters/075de267-69cf-45a3-861b-ca3f13185a6f/cert';
const pgDir = path.join(process.env.APPDATA || process.env.HOME || '.', 'postgresql');
const certPath = path.join(pgDir, 'root.crt');

async function downloadCert() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(certPath)) return resolve();
    if (!fs.existsSync(pgDir)) fs.mkdirSync(pgDir, { recursive: true });
    
    console.log('Downloading CA certificate...');
    const file = fs.createWriteStream(certPath);
    https.get(certUrl, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Certificate downloaded to ' + certPath);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(certPath);
      reject(err);
    });
  });
}

async function setup() {
  try {
    await downloadCert();
    
    // Create the client with the downloaded cert
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
          ca: fs.readFileSync(certPath).toString()
      }
    });

    await client.connect();
    console.log('✅ Connected to CockroachDB');
    
    await client.query(`
        CREATE TABLE IF NOT EXISTS channels (
            channel_id STRING PRIMARY KEY,
            handle STRING UNIQUE,
            channel_name STRING,
            description STRING,
            avatar_url STRING,
            channel_url STRING,
            subscribers INT8,
            total_videos INT4,
            is_monetized BOOLEAN,
            first_short_date DATE,
            channel_age_days INT4,
            average_views_last5 INT8,
            views_to_sub_ratio FLOAT8,
            shorts_per_week FLOAT8,
            growth_score FLOAT8,
            scraped_at TIMESTAMP DEFAULT current_timestamp()
        );
    `);
    console.log('✅ Table "channels" created.');

    await client.query(`
        CREATE TABLE IF NOT EXISTS shorts (
            video_id STRING PRIMARY KEY,
            channel_id STRING REFERENCES channels(channel_id) ON DELETE CASCADE,
            title STRING,
            thumbnail STRING,
            views INT8,
            likes INT8,
            publish_date DATE,
            video_url STRING,
            duration INT4
        );
    `);
    console.log('✅ Table "shorts" created.');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_subscribers ON channels (subscribers DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_average_views_last5 ON channels (average_views_last5 DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_channels_channel_age_days ON channels (channel_age_days ASC);`);
    console.log('✅ SQL Indexes created.');

    await client.query(`
        UPSERT INTO channels (channel_id, handle, channel_name, subscribers, is_monetized, first_short_date, average_views_last5)
        VALUES ('UC_DUMMY_123', '@dummychannel', 'Dummy Channel', 1000, true, '2025-01-05', 50000);
    `);
    console.log('✅ Dummy channel inserted successfully.');
    await client.end();
  } catch (err) {
    console.error('❌ Error executing setup', err.stack);
  }
}

setup();
