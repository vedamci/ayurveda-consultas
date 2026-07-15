import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, '../.env') });

const LOCAL_DATA_DIR = join(__dirname, '../local-data');
const LOCAL_PATIENTS_DIR = join(LOCAL_DATA_DIR, 'patients');
const MAP_FILE = join(LOCAL_DATA_DIR, 'patient_folders.json');

const notion = new Client({ auth: process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY });

function getFolderMap() {
    try {
        if (fs.existsSync(MAP_FILE)) {
            return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading folder map:', e);
    }
    return {};
}

function saveFolderMap(map) {
    try {
        fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing folder map:', e);
    }
}

function getCleanPatientName(patientName) {
    if (!patientName) return '';
    return String(patientName)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_') || 'Paciente';
}

function isUUID(str) {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str);
}

async function renameFolders() {
    if (!fs.existsSync(LOCAL_PATIENTS_DIR)) {
        console.log('No patients directory found.');
        return;
    }

    const map = getFolderMap();
    const items = fs.readdirSync(LOCAL_PATIENTS_DIR);
    
    for (const item of items) {
        const itemPath = join(LOCAL_PATIENTS_DIR, item);
        if (!fs.statSync(itemPath).isDirectory()) continue;
        if (item === '.' || item === '..') continue;

        let patientId = null;
        let prefixName = '';

        if (isUUID(item)) {
            patientId = item;
        } else {
            // Check if it ends with _UUID
            const parts = item.split('_');
            const lastPart = parts[parts.length - 1];
            if (isUUID(lastPart)) {
                patientId = lastPart;
                prefixName = parts.slice(0, -1).join('_');
            }
        }

        if (!patientId) {
            console.log(`Folder "${item}" does not match UUID pattern. Skipping.`);
            continue;
        }

        console.log(`Processing folder "${item}" for patient ID: ${patientId}`);
        let finalName = '';

        try {
            const page = await notion.pages.retrieve({ page_id: patientId });
            const props = page.properties;
            const notionName = props["Nombre Completo "]?.title?.map(t => t.plain_text).join('') || "";
            if (notionName) {
                finalName = getCleanPatientName(notionName);
                console.log(`Found name in Notion: "${notionName}" -> "${finalName}"`);
            }
        } catch (e) {
            console.warn(`Could not retrieve patient details from Notion for ${patientId}: ${e.message}`);
            if (prefixName) {
                finalName = prefixName;
                console.log(`Using prefix name from folder as fallback: "${finalName}"`);
            }
        }

        if (!finalName) {
            finalName = 'Paciente_' + patientId.substring(0, 8);
            console.log(`No name found, using fallback: "${finalName}"`);
        }

        // Avoid naming collisions
        let targetFolderName = finalName;
        let counter = 1;
        while (fs.existsSync(join(LOCAL_PATIENTS_DIR, targetFolderName)) && join(LOCAL_PATIENTS_DIR, targetFolderName) !== itemPath) {
            targetFolderName = `${finalName}_${counter}`;
            counter++;
        }

        const newPath = join(LOCAL_PATIENTS_DIR, targetFolderName);
        if (itemPath !== newPath) {
            try {
                fs.renameSync(itemPath, newPath);
                console.log(`Renamed: "${item}" -> "${targetFolderName}"`);
                map[patientId] = targetFolderName;
            } catch (err) {
                console.error(`Failed to rename "${item}" to "${targetFolderName}":`, err);
            }
        } else {
            console.log(`Folder "${item}" is already correctly named.`);
            map[patientId] = item;
        }
    }

    saveFolderMap(map);
    console.log('Folder renaming completed successfully.');
}

renameFolders();
