import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const apiKey = process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID || process.env.VITE_NOTION_DATABASE_ID;

console.log('Querying Database:', databaseId);

async function inspect() {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 5 }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Fetch Error:', response.status, error);
            return;
        }

        const data = await response.json();
        console.log(`Query Response (${data.results.length} items):`);

        data.results.forEach((item, index) => {
            console.log(`\nItem ${index + 1}:`);
            console.log('ID:', item.id);
            console.log('Created By:', JSON.stringify(item.created_by, null, 2));
            const origen = item.properties['Origen']?.select?.name;
            console.log('Origen:', origen);
            console.log('Name:', item.properties['Nombre Completo ']?.title?.[0]?.plain_text);
        });

        if (data.results.length === 0) {
            console.log('No items found (Empty Database or Filter match).');
        }
    } catch (error) {
        console.error('Network Error:', error);
    }
}

async function retrieve() {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Retrieve Error:', response.status, error);
            return;
        }

        const data = await response.json();
        console.log('Database Schema (Properties):');
        console.log(JSON.stringify(data.properties, null, 2));
    } catch (error) {
        console.error('Network Error:', error);
    }
}

inspect();
