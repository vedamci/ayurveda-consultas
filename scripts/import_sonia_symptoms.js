import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { importNotionSymptomHistory } from '../server/import-notion-symptom-history.js';

const targetPatientId = '321edfc8-3c23-8164-8719-c98ef7191c51';
const sourceDatabaseId = '2a1edfc8-3c23-8125-b035-ea5a7915f147';
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const userDataDir = process.env.DATA_DIR || projectRoot;
const localDataDir = join(userDataDir, 'local-data');
const patientsDir = join(localDataDir, 'patients');
const mapFile = join(localDataDir, 'patient_folders.json');

const readJson = (path, fallback) => {
    try {
        return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8') || 'null') ?? fallback : fallback;
    } catch {
        return fallback;
    }
};

const resolvePatientDir = () => {
    const map = readJson(mapFile, {});
    if (map[targetPatientId]) return join(patientsDir, map[targetPatientId]);

    if (fs.existsSync(patientsDir)) {
        const safeId = targetPatientId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const existing = fs.readdirSync(patientsDir).find(name => name === safeId || name.endsWith(`_${safeId}`));
        if (existing) return join(patientsDir, existing);
    }
    return join(patientsDir, targetPatientId.replace(/[^a-zA-Z0-9_-]/g, '_'));
};

const patientDir = resolvePatientDir();
const recordsFile = join(patientDir, 'records.json');
let record = readJson(recordsFile, {
    visits: [], treatmentPlans: [], tonguePhotos: [], pulseReadings: [],
    contextDocuments: [], aiDiagnoses: [], intensityScale: 3
});

const result = await importNotionSymptomHistory({
    notionApiKey: process.env.NOTION_API_KEY || process.env.VITE_NOTION_API_KEY,
    sourceDatabaseId,
    targetPatientId,
    readPatientRecord: () => structuredClone(record),
    writePatientRecord: (_id, nextRecord) => {
        fs.mkdirSync(patientDir, { recursive: true });
        if (fs.existsSync(recordsFile)) {
            const backup = join(patientDir, 'records.backup-before-notion-symptoms.json');
            if (!fs.existsSync(backup)) fs.copyFileSync(recordsFile, backup);
        }
        const tempFile = `${recordsFile}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(nextRecord, null, 2), 'utf8');
        fs.renameSync(tempFile, recordsFile);
        record = structuredClone(nextRecord);
    },
    writeVisitMarkdown: () => undefined
});

if (result.importedVisits > 0) {
    console.log(`[Notion symptoms] Imported ${result.importedPoints} points in ${result.importedVisits} visits.`);
} else {
    console.log('[Notion symptoms] No pending history to import.');
}
