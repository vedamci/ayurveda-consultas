import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from 'googleapis';
import fs from 'fs';
import crypto from 'crypto';
import convertHEIC from 'heic-convert';
import { exec } from 'child_process';
import os from 'os';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if we are running in Electron packaged mode or regular dev mode
const isPackaged = process.env.NODE_ENV === 'production' || !!process.versions.electron || process.env.IS_PACKAGED === 'true';

// Determine the user-writable folder for app data.
// Priority: DATA_DIR env (used for hosting, e.g. a Render persistent disk) >
//   macOS Application Support (Electron packaged) > project root (local dev).
const USER_DATA_DIR = process.env.DATA_DIR
    ? process.env.DATA_DIR
    : isPackaged
    ? join(os.homedir(), 'Library/Application Support/AyurvedaApp')
    : join(__dirname, '..');

// Ensure USER_DATA_DIR exists
if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

function normalizeDoshaValue(value = '') {
    const normalized = String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    const aliases = [
        { dosha: 'Vata-Pitta', patterns: ['vata-pitta', 'vata pitta', 'vata y pitta', 'vata/pitta'] },
        { dosha: 'Pitta-Kapha', patterns: ['pitta-kapha', 'pitta kapha', 'pitta y kapha', 'pitta/kapha'] },
        { dosha: 'Vata-Kapha', patterns: ['vata-kapha', 'vata kapha', 'vata y kapha', 'vata/kapha'] },
        { dosha: 'Tridoshica', patterns: ['tridoshica', 'tridoshico', 'tridoshic', 'tridosha', 'vata pitta kapha'] },
        { dosha: 'Vata', patterns: ['vata'] },
        { dosha: 'Pitta', patterns: ['pitta'] },
        { dosha: 'Kapha', patterns: ['kapha'] },
    ];

    return aliases.find(alias => alias.patterns.some(pattern => normalized.includes(pattern)))?.dosha || '';
}

function buildClinicalContext(patient, fallbackText = '') {
    if (!patient) return fallbackText || '';

    let context = `Nombre: ${patient.name || 'Desconocido'}\n`;
    context += `Edad: ${patient.age || 'Desconocida'}\n`;
    context += `Dosha actual/previo: ${patient.dosha || 'No determinado'}\n`;

    if (patient.email) context += `Correo: ${patient.email}\n`;
    if (patient.phone) context += `Teléfono: ${patient.phone}\n`;

    if (patient.clinicalData && Object.keys(patient.clinicalData).length > 0) {
        context += `\n**Datos Clínicos e Historial (Notion):**\n`;
        for (const [key, value] of Object.entries(patient.clinicalData)) {
            if (value && String(value).trim()) {
                context += `- ${key}: ${value}\n`;
            }
        }
    }

    if (patient.plainSymptoms && patient.plainSymptoms.length > 0) {
        context += `\n**Síntomas principales:** ${patient.plainSymptoms.join(', ')}\n`;
    }

    if (patient.symptomCalibrations && patient.symptomCalibrations.length > 0) {
        context += `\n**Calibración de Síntomas:**\n`;
        patient.symptomCalibrations.forEach(sc => {
            const label = sc.intensityLabel || (sc.intensity === 1 ? 'Suave' : sc.intensity === 2 ? 'Moderado' : sc.intensity === 3 ? 'Fuerte' : sc.intensity);
            context += `- ${sc.symptom}: Frecuencia: ${sc.frequency}, Intensidad: ${sc.intensity} (${label})\n`;
        });
    }

    if (patient.fullNotes && patient.fullNotes.trim()) {
        context += `\n**Notas y Resumen de Ficha:**\n${patient.fullNotes}\n`;
    }

    if (patient.visits && patient.visits.length > 0) {
        context += `\n**Historial de Visitas Previas:**\n`;
        const sortedVisits = [...patient.visits].sort((a, b) => new Date(b.date) - new Date(a.date));
        sortedVisits.slice(0, 3).forEach((visit, idx) => {
            const vNum = sortedVisits.length - idx;
            context += `- Visita ${vNum} (${visit.date}):\n`;
            if (visit.note && visit.note.trim()) context += `  * Notas del profesional: ${visit.note}\n`;
            if (visit.diagnosis && visit.diagnosis.trim()) context += `  * Diagnóstico anterior: ${visit.diagnosis}\n`;
            if (visit.treatment && visit.treatment.trim()) context += `  * Tratamiento anterior: ${visit.treatment}\n`;
            if (visit.lifestyle && visit.lifestyle.trim()) context += `  * Estilo de vida sugerido: ${visit.lifestyle}\n`;
        });
    }

    return context;
}

const RAW_SOURCE_DIR_CANDIDATES = [
    join(__dirname, '..', '..', 'Recursos', 'Fuentes RAW'),
    join(process.cwd(), '..', 'Recursos', 'Fuentes RAW'),
    join(process.cwd(), 'Recursos', 'Fuentes RAW'),
];
const RAW_SOURCE_EXTENSIONS = new Set(['.txt', '.md']);
const MAX_RAW_SOURCE_EXCERPTS = 8;
const MAX_RAW_SOURCE_CHARS = 12000;
let rawSourceCache = null;

function normalizeForSearch(value = '') {
    return String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9áéíóúüñ\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getRawSourceDir() {
    return RAW_SOURCE_DIR_CANDIDATES.find(candidate => fs.existsSync(candidate)) || null;
}

function splitRawSourceText(text) {
    return String(text)
        .split(/\n\s*\n+/)
        .map(part => part.replace(/\s+/g, ' ').trim())
        .filter(part => part.length >= 120)
        .flatMap(part => {
            if (part.length <= 1400) return [part];
            const chunks = [];
            for (let index = 0; index < part.length; index += 1200) {
                chunks.push(part.slice(index, index + 1400).trim());
            }
            return chunks;
        });
}

function loadRawSources() {
    if (rawSourceCache) return rawSourceCache;

    const sourceDir = getRawSourceDir();
    if (!sourceDir) {
        rawSourceCache = [];
        return rawSourceCache;
    }

    rawSourceCache = fs.readdirSync(sourceDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .filter(entry => RAW_SOURCE_EXTENSIONS.has(entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'))))
        .flatMap(entry => {
            const filePath = join(sourceDir, entry.name);
            const chunks = splitRawSourceText(fs.readFileSync(filePath, 'utf8'));
            return chunks.map((text, index) => ({
                source: entry.name,
                index: index + 1,
                text,
                normalized: normalizeForSearch(text),
            }));
        });

    console.log(`Loaded ${rawSourceCache.length} Ayurveda raw source excerpts from ${sourceDir}`);
    return rawSourceCache;
}

function buildRawBibliographyContext(clinicalContext) {
    const sources = loadRawSources();
    if (!sources.length) return '';

    const keywords = [...new Set(normalizeForSearch(clinicalContext)
        .split(' ')
        .filter(word => word.length >= 4 && !/^\d+$/.test(word))
        .slice(0, 180))];

    if (!keywords.length) return '';

    const scored = sources.map(chunk => {
        let score = 0;
        for (const keyword of keywords) {
            if (chunk.normalized.includes(keyword)) score += keyword.length > 7 ? 3 : 1;
        }
        return { ...chunk, score };
    })
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RAW_SOURCE_EXCERPTS);

    if (!scored.length) return '';

    let totalChars = 0;
    const excerpts = [];
    for (const chunk of scored) {
        const remaining = MAX_RAW_SOURCE_CHARS - totalChars;
        if (remaining <= 0) break;
        const text = chunk.text.slice(0, remaining);
        totalChars += text.length;
        excerpts.push(`[${chunk.source} | fragmento ${chunk.index}]\n${text}`);
    }

    return excerpts.join('\n\n---\n\n');
}

// Load env vars
const ENV_PATH = join(USER_DATA_DIR, '.env');

// If in production/packaged mode, and the .env does not exist in USER_DATA_DIR, copy from bundle if it exists, or create a blank one
if (isPackaged && !fs.existsSync(ENV_PATH)) {
    const bundleEnvPath = join(__dirname, '../.env');
    if (fs.existsSync(bundleEnvPath)) {
        fs.copyFileSync(bundleEnvPath, ENV_PATH);
    } else {
        fs.writeFileSync(ENV_PATH, '', 'utf8');
    }
}

dotenv.config({ path: ENV_PATH });

// Helper to update/save values in .env file and update process.env in memory
function updateEnvFile(updates) {
    const envPath = join(USER_DATA_DIR, '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
    }
    
    let lines = content.split('\n');
    
    for (const [key, value] of Object.entries(updates)) {
        let found = false;
        lines = lines.map(line => {
            const match = line.match(new RegExp(`^\\s*${key}\\s*=`));
            if (match) {
                found = true;
                return `${key}=${value}`;
            }
            return line;
        });
        if (!found) {
            if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
                lines.push('');
            }
            lines.push(`${key}=${value}`);
        }
        process.env[key] = value;
    }
    
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// Generate JWT_SECRET if not exists
if (!process.env.JWT_SECRET) {
    const randomSecret = crypto.randomBytes(32).toString('hex');
    updateEnvFile({ JWT_SECRET: randomSecret });
    console.log('JWT_SECRET has been initialized and saved to .env');
}

const USERS_FILE_PATH = isPackaged ? join(USER_DATA_DIR, 'users.json') : join(__dirname, 'users.json');

if (isPackaged && !fs.existsSync(USERS_FILE_PATH)) {
    const bundledUsersPath = join(__dirname, 'users.json');
    if (fs.existsSync(bundledUsersPath)) {
        fs.copyFileSync(bundledUsersPath, USERS_FILE_PATH);
    }
}

// Helper to read users
function readUsers() {
    try {
        if (!fs.existsSync(USERS_FILE_PATH)) {
            fs.writeFileSync(USERS_FILE_PATH, '[]', 'utf8');
            return [];
        }
        const content = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        return JSON.parse(content || '[]');
    } catch (e) {
        console.error('Error reading users file:', e);
        return [];
    }
}

// Helper to write users
function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing users file:', e);
        return false;
    }
}

// Helper to hash password
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Token helper methods (manual signed stateless tokens)
function generateToken(user) {
    const payload = JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    const base64Payload = Buffer.from(payload).toString('base64');
    const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(base64Payload).digest('hex');
    return `${base64Payload}.${signature}`;
}

function verifyToken(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        const [base64Payload, signature] = parts;
        const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(base64Payload).digest('hex');
        if (signature !== expectedSignature) return null;
        
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
        if (payload.exp < Date.now()) {
            return null; // Expired
        }
        return payload;
    } catch (e) {
        return null;
    }
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token.' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    
    req.user = decoded;
    next();
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
}

const app = express();
const configuredPort = Number.parseInt(process.env.PORT || '3000', 10);
const port = Number.isFinite(configuredPort) ? configuredPort : 3000;
const getDefaultCalendarRedirectUri = () => `http://localhost:${port}/api/calendar/auth/callback`;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ─── Authentication Endpoints ──────────────────────────────────────────────

// Register a new user
app.post('/api/auth/register', (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos (nombre, correo y contraseña).' });
        }
        
        const sanitizedEmail = email.trim().toLowerCase();
        
        // Load existing users
        const users = readUsers();
        
        // Check if email already registered
        if (users.find(u => u.email === sanitizedEmail)) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }
        
        // Determine role: krishnadas@vedamci.com.mx is ALWAYS admin. All others are 'user' initially.
        const role = sanitizedEmail === 'krishnadas@vedamci.com.mx' ? 'admin' : 'user';
        
        const newUser = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: sanitizedEmail,
            password: hashPassword(password),
            role: role,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        writeUsers(users);
        
        // Generate session token
        const token = generateToken(newUser);
        
        // Respond with user info (without password) and token
        res.status(201).json({
            success: true,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            },
            token
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Error interno en el registro.' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
        }
        
        const sanitizedEmail = email.trim().toLowerCase();
        const users = readUsers();
        
        const user = users.find(u => u.email === sanitizedEmail);
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }
        
        const hashedInput = hashPassword(password);
        if (user.password !== hashedInput) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }
        
        // Double check: if user email is krishnadas@vedamci.com.mx, ensure their role is admin
        // (Just in case it was changed manually or through some bug)
        if (sanitizedEmail === 'krishnadas@vedamci.com.mx' && user.role !== 'admin') {
            user.role = 'admin';
            writeUsers(users);
        }
        
        // Generate session token
        const token = generateToken(user);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Error interno en el inicio de sesión.' });
    }
});

// Get current logged-in user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
    // req.user has decoded payload: { id, email, role }
    // Fetch latest user details from file to ensure roles/names are up-to-date
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

// ─── Admin Users Endpoints ──────────────────────────────────────────────────

// Get all users (Admin only)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    try {
        const users = readUsers();
        // Return without password hashes
        const usersList = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt
        }));
        res.json({ success: true, users: usersList });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener los usuarios.' });
    }
});

// Update a user's role (Admin only)
app.put('/api/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        if (!role || (role !== 'admin' && role !== 'user')) {
            return res.status(400).json({ error: 'Rol inválido. Debe ser "admin" o "user".' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.id === id);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        
        // Prevent changing the role of the primary admin krishnadas@vedamci.com.mx
        if (user.email === 'krishnadas@vedamci.com.mx') {
            return res.status(400).json({ error: 'No está permitido cambiar el rol del administrador principal.' });
        }
        
        // Prevent admin from demoting themselves (if they are the one being edited, but since they can't edit krishnadas email, let's also block self-demotion just in case)
        if (user.id === req.user.id && role !== 'admin') {
            return res.status(400).json({ error: 'No puedes degradar tu propio rol.' });
        }
        
        user.role = role;
        writeUsers(users);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Error al actualizar el rol de usuario.' });
    }
});

const notion = new Client({ auth: process.env.VITE_NOTION_API_KEY });
const databaseId = process.env.VITE_NOTION_DATABASE_ID;
const PROFESSIONAL_PROPERTY = "36. Nombre del profesional de Ayurveda que te atiende.";
const KRISHNA_PROFESSIONAL_NAME = "Krishna Das";
const LOCAL_DATA_DIR = join(USER_DATA_DIR, 'local-data');

// Migration: If in packaged mode, and Library/local-data doesn't exist, copy from bundle's local-data if it exists
if (isPackaged && !fs.existsSync(LOCAL_DATA_DIR)) {
    const bundleLocalData = join(__dirname, '../local-data');
    if (fs.existsSync(bundleLocalData)) {
        try {
            const copyDirRecursive = (src, dest) => {
                fs.mkdirSync(dest, { recursive: true });
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = join(src, entry.name);
                    const destPath = join(dest, entry.name);
                    if (entry.isDirectory()) {
                        copyDirRecursive(srcPath, destPath);
                    } else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };
            copyDirRecursive(bundleLocalData, LOCAL_DATA_DIR);
            console.log('Successfully migrated local-data from bundle to user directory.');
        } catch (err) {
            console.error('Error migrating local-data:', err);
        }
    }
}

const LOCAL_PATIENTS_DIR = join(LOCAL_DATA_DIR, 'patients');

const MAP_FILE = join(LOCAL_DATA_DIR, 'patient_folders.json');

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
        if (!fs.existsSync(LOCAL_DATA_DIR)) {
            fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
        }
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

function safePatientId(patientId) {
    return String(patientId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function findPatientDir(patientId) {
    const map = getFolderMap();
    if (map[patientId]) {
        const path = join(LOCAL_PATIENTS_DIR, map[patientId]);
        if (fs.existsSync(path)) {
            return path;
        }
    }
    // Fallback: look for legacy ending with _id or exactly id
    const safeId = safePatientId(patientId);
    if (!fs.existsSync(LOCAL_PATIENTS_DIR)) {
        fs.mkdirSync(LOCAL_PATIENTS_DIR, { recursive: true });
    }
    const dirs = fs.readdirSync(LOCAL_PATIENTS_DIR);
    for (const dir of dirs) {
        if (dir.endsWith(`_${safeId}`)) {
            return join(LOCAL_PATIENTS_DIR, dir);
        }
    }
    const exactDir = join(LOCAL_PATIENTS_DIR, safeId);
    if (fs.existsSync(exactDir)) {
        return exactDir;
    }
    return null;
}

function getPatientRecordPath(patientId, patientName = '') {
    const safeId = safePatientId(patientId);
    const map = getFolderMap();
    let folderName = map[patientId];
    
    let patientDir = null;
    if (folderName) {
        patientDir = join(LOCAL_PATIENTS_DIR, folderName);
    }

    // If folder not found in map, or directory does not exist on disk
    if (!patientDir || !fs.existsSync(patientDir)) {
        // Try to find a legacy/existing directory
        let legacyDirName = null;
        if (fs.existsSync(LOCAL_PATIENTS_DIR)) {
            const dirs = fs.readdirSync(LOCAL_PATIENTS_DIR);
            for (const d of dirs) {
                if (d.endsWith(`_${safeId}`) || d === safeId) {
                    legacyDirName = d;
                    break;
                }
            }
        }

        const cleanName = getCleanPatientName(patientName);

        if (legacyDirName) {
            // Found a legacy directory!
            const legacyPath = join(LOCAL_PATIENTS_DIR, legacyDirName);
            if (cleanName && cleanName !== 'Paciente') {
                // We have a name! Rename to just the clean patient name.
                let targetFolderName = cleanName;
                let counter = 1;
                while (fs.existsSync(join(LOCAL_PATIENTS_DIR, targetFolderName)) && join(LOCAL_PATIENTS_DIR, targetFolderName) !== legacyPath) {
                    targetFolderName = `${cleanName}_${counter}`;
                    counter++;
                }
                
                const newPath = join(LOCAL_PATIENTS_DIR, targetFolderName);
                try {
                    fs.renameSync(legacyPath, newPath);
                    console.log(`Renamed legacy folder ${legacyDirName} to ${targetFolderName}`);
                    map[patientId] = targetFolderName;
                    saveFolderMap(map);
                    patientDir = newPath;
                } catch (e) {
                    console.error('Error renaming legacy folder:', e);
                    patientDir = legacyPath;
                }
            } else {
                // No name available yet, keep the legacy folder name
                map[patientId] = legacyDirName;
                saveFolderMap(map);
                patientDir = legacyPath;
            }
        } else {
            // No legacy directory exists. Create a brand new folder.
            if (cleanName && cleanName !== 'Paciente') {
                let targetFolderName = cleanName;
                let counter = 1;
                while (fs.existsSync(join(LOCAL_PATIENTS_DIR, targetFolderName))) {
                    targetFolderName = `${cleanName}_${counter}`;
                    counter++;
                }
                map[patientId] = targetFolderName;
                saveFolderMap(map);
                patientDir = join(LOCAL_PATIENTS_DIR, targetFolderName);
            } else {
                // If we don't even have a name, default to the safe ID for now
                map[patientId] = safeId;
                saveFolderMap(map);
                patientDir = join(LOCAL_PATIENTS_DIR, safeId);
            }
        }
    } else {
        // Folder exists in map and on disk.
        // If we now have a patientName, and the current folder name is just the ID (safeId) or is a legacy format (contains the UUID suffix), let's upgrade/rename it!
        const cleanName = getCleanPatientName(patientName);
        if (cleanName && cleanName !== 'Paciente' && (folderName === safeId || folderName.includes(safeId))) {
            let targetFolderName = cleanName;
            let counter = 1;
            while (fs.existsSync(join(LOCAL_PATIENTS_DIR, targetFolderName)) && join(LOCAL_PATIENTS_DIR, targetFolderName) !== patientDir) {
                targetFolderName = `${cleanName}_${counter}`;
                counter++;
            }
            const newPath = join(LOCAL_PATIENTS_DIR, targetFolderName);
            try {
                fs.renameSync(patientDir, newPath);
                console.log(`Upgraded folder name from ${folderName} to ${targetFolderName}`);
                map[patientId] = targetFolderName;
                saveFolderMap(map);
                patientDir = newPath;
            } catch (e) {
                console.error('Error upgrading folder name:', e);
            }
        }
    }

    if (patientDir && !fs.existsSync(patientDir)) {
        fs.mkdirSync(patientDir, { recursive: true });
    }

    return {
        patientDir,
        recordsFile: join(patientDir, 'records.json')
    };
}

function normalizePatientRecord(record = {}) {
    return {
        visits: Array.isArray(record.visits) ? record.visits : [],
        treatmentPlans: Array.isArray(record.treatmentPlans) ? record.treatmentPlans : [],
        tonguePhotos: Array.isArray(record.tonguePhotos) ? record.tonguePhotos : [],
        pulseReadings: Array.isArray(record.pulseReadings) ? record.pulseReadings : [],
        contextDocuments: Array.isArray(record.contextDocuments) ? record.contextDocuments : []
    };
}

function readPatientRecords() {
    try {
        const legacyFile = join(LOCAL_DATA_DIR, 'patient-records.json');
        if (!fs.existsSync(legacyFile)) return {};
        return JSON.parse(fs.readFileSync(legacyFile, 'utf8') || '{}');
    } catch (error) {
        console.error('Error reading local patient records:', error);
        return {};
    }
}

function readPatientRecord(patientId, patientName = '') {
    try {
        const { recordsFile } = getPatientRecordPath(patientId, patientName);
        if (!fs.existsSync(recordsFile)) {
            const legacyRecord = readPatientRecords()[patientId];
            return normalizePatientRecord(legacyRecord);
        }
        return normalizePatientRecord(JSON.parse(fs.readFileSync(recordsFile, 'utf8') || '{}'));
    } catch (error) {
        console.error('Error reading local patient record:', error);
        return normalizePatientRecord();
    }
}

function writePatientRecord(patientId, record) {
    const { patientDir, recordsFile } = getPatientRecordPath(patientId);
    if (!fs.existsSync(patientDir)) {
        fs.mkdirSync(patientDir, { recursive: true });
    }
    fs.writeFileSync(recordsFile, JSON.stringify(normalizePatientRecord(record), null, 2), 'utf8');
}

function buildVisitMarkdown(visit = {}, patientName = '') {
    const L = [];
    const safe = (v) => (v === undefined || v === null) ? '' : String(v);
    const fmtDate = (d) => {
        if (!d) return '';
        try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
        catch { return String(d); }
    };

    L.push(`# ${safe(visit.title) || 'Visita'}`);
    L.push('');
    if (patientName) L.push(`**Paciente:** ${patientName}  `);
    L.push(`**Fecha de la visita:** ${fmtDate(visit.date)}  `);
    if (visit.dosha) L.push(`**Dosha:** ${safe(visit.dosha)}  `);
    L.push(`**Actualizado:** ${fmtDate(visit.updatedAt || visit.createdAt || new Date().toISOString())}`);
    L.push('');

    if (safe(visit.note).trim()) {
        L.push('## Nota general');
        L.push('');
        L.push(safe(visit.note).trim());
        L.push('');
    }

    // Síntomas
    const symptoms = visit.symptoms && typeof visit.symptoms === 'object' ? visit.symptoms : {};
    const symptomKeys = Object.keys(symptoms);
    if (symptomKeys.length > 0) {
        L.push('## Síntomas');
        L.push('');
        L.push('| Síntoma | Frecuencia | Intensidad | Nota |');
        L.push('| --- | --- | --- | --- |');
        symptomKeys.forEach((name) => {
            const s = symptoms[name] || {};
            const note = safe(s.note).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
            L.push(`| ${safe(name).replace(/\|/g, '\\|')} | ${safe(s.frequency) || '-'} | ${s.intensity ? safe(s.intensity) + '/3' : '-'} | ${note || '-'} |`);
        });
        L.push('');
    }

    // Notas de la consulta
    if (safe(visit.diagnosis).trim()) {
        L.push('## Diagnóstico de la visita');
        L.push('');
        L.push(safe(visit.diagnosis).trim());
        L.push('');
    }
    if (safe(visit.lifestyle).trim()) {
        L.push('## Estilo de vida');
        L.push('');
        L.push(safe(visit.lifestyle).trim());
        L.push('');
    }

    // Tratamiento
    if (safe(visit.treatment).trim()) {
        L.push('## Tratamiento indicado');
        L.push('');
        L.push(safe(visit.treatment).trim());
        L.push('');
    }
    const categories = Array.isArray(visit.categories) ? visit.categories : [];
    if (categories.length > 0) {
        L.push('### Categorías de alimentación');
        L.push('');
        categories.forEach((c) => L.push(`- ${safe(c)}`));
        L.push('');
    }
    const herbs = Array.isArray(visit.herbs) ? visit.herbs : [];
    if (herbs.length > 0) {
        L.push('### Fórmulas herbales');
        L.push('');
        herbs.forEach((h) => {
            const formula = safe(h && h.formula).trim();
            const dosage = safe(h && h.dosage).trim();
            if (!formula) return;
            L.push(`- ${formula}${dosage ? ` — ${dosage}` : ''}`);
        });
        L.push('');
    }

    // Adherencia
    const adh = visit.adherence && typeof visit.adherence === 'object' ? visit.adherence : {};
    const adhCats = Array.isArray(adh.categories) ? adh.categories : [];
    const adhHerbs = Array.isArray(adh.herbs) ? adh.herbs : [];
    const adhLife = Array.isArray(adh.lifestyle) ? adh.lifestyle : [];
    const statusLabel = (st) => ({ done: 'Hecho', partial: 'Parcial', not_done: 'No hecho', unknown: 'Sin revisar' }[st] || 'Sin revisar');
    const renderAdhItems = (items, heading) => {
        const valid = items.filter((it) => it && it.name);
        if (valid.length === 0) return;
        L.push(`### ${heading}`);
        L.push('');
        valid.forEach((it) => {
            const note = safe(it.note).replace(/\r?\n/g, ' ').trim();
            L.push(`- **${safe(it.name)}** — ${statusLabel(it.status)}${note ? `: ${note}` : ''}`);
        });
        L.push('');
    };
    if (adhCats.length || adhHerbs.length || adhLife.length || safe(adh.generalNote).trim()) {
        L.push('## Adherencia (qué hizo el paciente)');
        L.push('');
        renderAdhItems(adhCats, 'Categorías');
        renderAdhItems(adhHerbs, 'Fórmulas herbales');
        renderAdhItems(adhLife, 'Estilo de vida');
        if (safe(adh.generalNote).trim()) {
            L.push('**Nota general de adherencia:** ' + safe(adh.generalNote).trim());
            L.push('');
        }
    }

    L.push('---');
    L.push(`_Generado automáticamente por la app de consultas VEDAMCI._`);
    L.push('');
    return L.join('\n');
}

function writeVisitMarkdown(patientId, visit, patientName = '') {
    try {
        const { patientDir } = getPatientRecordPath(patientId);
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }
        const baseName = sanitizeFileName(visit.title || `Visita ${visit.date || ''}`) || `Visita_${String(visit.id || '').slice(0, 8)}`;
        const fileName = `${baseName}.md`;
        // If the visit already had a different md file (e.g. title changed), remove the stale one.
        if (visit.mdFile && visit.mdFile !== fileName) {
            const stale = join(patientDir, visit.mdFile);
            if (fs.existsSync(stale)) {
                try { fs.unlinkSync(stale); } catch { /* ignore */ }
            }
        }
        fs.writeFileSync(join(patientDir, fileName), buildVisitMarkdown(visit, patientName), 'utf8');
        return fileName;
    } catch (error) {
        console.error('Error writing visit markdown:', error.message);
        return visit.mdFile || null;
    }
}

function getLocalPatientRecord(patientId, patientName = '') {
    return readPatientRecord(patientId, patientName);
}

function appendLocalPatientRecord(patientId, key, value) {
    const patientRecord = readPatientRecord(patientId);
    patientRecord[key] = Array.isArray(patientRecord[key]) ? patientRecord[key] : [];
    patientRecord[key].push(value);
    writePatientRecord(patientId, patientRecord);
    return value;
}

function buildLocalRecordTitle(patientRecord, patientName, date = new Date().toISOString()) {
    const totalRecords = (patientRecord.visits?.length || 0) + (patientRecord.treatmentPlans?.length || 0);
    const cleanName = String(patientName || 'Paciente').trim() || 'Paciente';
    if (totalRecords === 0) {
        return `Consulta inicial - ${cleanName}`;
    }
    return `Consulta seguimiento - ${cleanName} - ${new Date(date).toLocaleDateString('es-MX')}`;
}

function getTonguePhotoDir(patientId) {
    return join(getPatientRecordPath(patientId).patientDir, 'tongue-photos');
}

function getContextDocsDir(patientId) {
    return join(getPatientRecordPath(patientId).patientDir, 'context-docs');
}

// Tipos de texto que la IA puede leer directamente.
const CONTEXT_DOC_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'tsv', 'text'];
const MAX_CONTEXT_DOC_BYTES = 2 * 1024 * 1024; // 2 MB por archivo

function getContextDocExtension(name = '') {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
}

// Lee y concatena el texto de todos los documentos de contexto de un paciente.
function readPatientContextDocuments(patientId, { maxTotalChars = 60000 } = {}) {
    try {
        const record = readPatientRecord(patientId);
        const docs = Array.isArray(record.contextDocuments) ? record.contextDocuments : [];
        if (docs.length === 0) return '';

        const dir = getContextDocsDir(patientId);
        const parts = [];
        let used = 0;

        for (const doc of docs) {
            const filePath = join(dir, doc.filename || '');
            if (!doc.filename || !fs.existsSync(filePath)) continue;
            let content = '';
            try {
                content = fs.readFileSync(filePath, 'utf8');
            } catch {
                continue;
            }
            if (!content.trim()) continue;

            const remaining = maxTotalChars - used;
            if (remaining <= 0) break;
            if (content.length > remaining) {
                content = content.slice(0, remaining) + '\n[...documento truncado...]';
            }
            used += content.length;

            const label = doc.originalName || doc.filename;
            const note = doc.note && doc.note.trim() ? ` — Nota: ${doc.note.trim()}` : '';
            parts.push(`### Documento: ${label}${note}\n${content.trim()}`);
        }

        return parts.join('\n\n');
    } catch (error) {
        console.error('Error reading context documents:', error.message);
        return '';
    }
}

function buildTonguePhotoUrl(patientId, photo) {
    return `/api/patients/${encodeURIComponent(patientId)}/tongue-photos/${encodeURIComponent(photo.id)}/file?v=${encodeURIComponent(photo.updatedAt || photo.createdAt || '')}`;
}

function sanitizeFileName(name = 'foto-lengua') {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'foto-lengua';
}

// Setup DeepSeek
const deepSeekBaseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const deepSeekDefaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

async function callDeepSeek(messages, options = {}) {
    if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API Key missing');
    }

    const response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: options.model || deepSeekDefaultModel,
            messages,
            stream: false,
            ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
        throw new Error(`DeepSeek Error: ${detail}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('DeepSeek no devolvió contenido');
    }

    return text;
}

// Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Setup Google Calendar
let oauth2Client;
let calendar;

function initGoogleCalendar() {
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || getDefaultCalendarRedirectUri()
    );

    if (process.env.GOOGLE_REFRESH_TOKEN) {
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });
    }

    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
}

initGoogleCalendar();



console.log('Notion Server Starting...');
console.log('Database ID:', databaseId);

// Store Bot User ID
let botUserId = null;

// Fetch Bot User ID
async function fetchBotUserId() {
    try {
        const response = await fetch('https://api.notion.com/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${process.env.VITE_NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
            },
        });
        if (response.ok) {
            const data = await response.json();
            botUserId = data.id;
            console.log('Bot User ID:', botUserId);
        } else {
            console.error('Failed to fetch Bot User ID');
        }
    } catch (error) {
        console.error('Error fetching Bot User ID:', error);
    }
}

fetchBotUserId();

// Get recent patients for Dashboard
app.get('/api/patients/recent-dashboard', authenticateToken, async (req, res) => {
    try {
        if (!databaseId) {
            throw new Error('Database ID is not configured');
        }

        const notionApiKey = process.env.VITE_NOTION_API_KEY;

        const krishnaFilter = {
            or: [
                {
                    property: PROFESSIONAL_PROPERTY,
                    multi_select: {
                        contains: KRISHNA_PROFESSIONAL_NAME
                    }
                },
                {
                    property: "Notas",
                    rich_text: {
                        contains: `Profesional Solicitado: ${KRISHNA_PROFESSIONAL_NAME}`
                    }
                }
            ]
        };

        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sorts: [
                    {
                        timestamp: "created_time",
                        direction: "descending"
                    }
                ],
                filter: krishnaFilter,
                page_size: 4
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to query Notion API');
        }

        const data = await response.json();
        const results = data.results || [];

        // Fetch Google Calendar events to match future appointments
        let calendarEvents = [];
        if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            try {
                const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
                const calResponse = await calendar.events.list({
                    calendarId: calendarId,
                    timeMin: new Date().toISOString(),
                    maxResults: 50,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                calendarEvents = calResponse.data.items || [];
            } catch (e) {
                console.error('Error fetching calendar events for dashboard:', e.message);
            }
        }

        const patientDetails = await Promise.all(results.map(async (page) => {
            const props = page.properties;
            const name = props["Nombre Completo "]?.title?.map(t => t.plain_text).join('') || "Sin Nombre";
            const email = props["11. Correo"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const phone = props["2. Número de celular"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const notes = props["Notas"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const professionalFromNotes = notes.match(/Profesional Solicitado:\s*([^\n]+)/)?.[1]?.trim() || "";
            const professional = props[PROFESSIONAL_PROPERTY]?.multi_select?.map(option => option.name).join(', ') || professionalFromNotes;
            
            const dosha = notes.match(/- Dosha: (.*)/)?.[1] || "No det.";

            let lastVisit = null;
            let treatmentSent = false;

            try {
                const blocks = await notion.blocks.children.list({ block_id: page.id, page_size: 100 });
                const visits = [];

                for (const block of blocks.results) {
                    if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
                        const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
                        if (text.startsWith('[VISITA]')) {
                            try {
                                const jsonStr = text.replace('[VISITA] ', '');
                                const visitData = JSON.parse(jsonStr);
                                visits.push(new Date(visitData.date));
                            } catch (e) {
                                console.error('Error parsing visit block in dashboard:', e);
                            }
                        } else if (text.startsWith(DOCTOR_NOTE_PREFIX)) {
                            treatmentSent = true;
                        }
                    }
                }

                if (visits.length > 0) {
                    visits.sort((a, b) => b - a);
                    lastVisit = visits[0].toISOString().split('T')[0];
                }
            } catch (err) {
                console.error(`Error fetching blocks for patient ${page.id}:`, err.message);
            }

            // Find matching next appointment
            const nameLower = name.toLowerCase().trim();
            const match = calendarEvents.find(event => {
                const summaryLower = (event.summary || '').toLowerCase();
                if (summaryLower.includes(nameLower)) return true;
                const nameParts = nameLower.split(/\s+/).filter(part => part.length > 2);
                if (nameParts.length > 0 && nameParts.every(part => summaryLower.includes(part))) {
                    return true;
                }
                return false;
            });

            let nextAppt = null;
            if (match) {
                const startStr = match.start?.dateTime || match.start?.date;
                if (startStr) {
                    nextAppt = startStr;
                }
            }

            return {
                id: page.id,
                name,
                email,
                phone,
                professional,
                condition: dosha,
                lastVisit: lastVisit || page.created_time,
                isNew: !lastVisit,
                treatmentSent,
                nextAppt
            };
        }));

        res.json({ success: true, results: patientDetails });
    } catch (error) {
        console.error('Error fetching dashboard patients:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Search for patients
app.get('/api/patients/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        // console.log('Searching for:', query);

        if (!databaseId) {
            throw new Error('Database ID is not configured');
        }

        const notionApiKey = process.env.VITE_NOTION_API_KEY;

        const payload = {
            sorts: [
                {
                    timestamp: "created_time",
                    direction: "descending"
                }
            ],
            page_size: 100
        };

        // Filter to ONLY show patients attended by Krishna Das.
        const krishnaFilter = {
            or: [
                {
                    property: PROFESSIONAL_PROPERTY,
                    multi_select: {
                        contains: KRISHNA_PROFESSIONAL_NAME
                    }
                },
                {
                    property: "Notas",
                    rich_text: {
                        contains: `Profesional Solicitado: ${KRISHNA_PROFESSIONAL_NAME}`
                    }
                }
            ]
        };

        if (query) {
            payload.filter = {
                and: [
                    krishnaFilter,
                    {
                        property: "Nombre Completo ",
                        title: {
                            contains: query
                        }
                    }
                ]
            };
        } else {
            payload.filter = krishnaFilter;
        }

        const results = [];
        let nextCursor = undefined;

        do {
            const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${notionApiKey}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...payload,
                    ...(nextCursor ? { start_cursor: nextCursor } : {})
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to query Notion API');
            }

            const data = await response.json();
            results.push(...data.results);
            nextCursor = data.has_more ? data.next_cursor : undefined;
        } while (nextCursor);

        const filteredResults = results;

        const patients = filteredResults.map(page => {
            const props = page.properties;
            // Safely extract name
            const name = props["Nombre Completo "]?.title?.map(t => t.plain_text).join('') || "Sin Nombre";
            const email = props["11. Correo"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const phone = props["2. Número de celular"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const notes = props["Notas"]?.rich_text?.map(t => t.plain_text).join('') || "";
            const professionalFromNotes = notes.match(/Profesional Solicitado:\s*([^\n]+)/)?.[1]?.trim() || "";
            const professional = props[PROFESSIONAL_PROPERTY]?.multi_select?.map(option => option.name).join(', ') || professionalFromNotes;

            return {
                id: page.id,
                name,
                email,
                phone,
                professional,
                createdAt: page.created_time,
                lastEdited: page.last_edited_time
            };
        });

        res.json({ success: true, results: patients });
    } catch (error) {
        console.error('Error searching Notion:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get full patient details by ID
app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const page = await notion.pages.retrieve({ page_id: id });
        const props = page.properties;

        // Parse relevant fields to map back to frontend state
        const name = props["Nombre Completo "]?.title?.map(t => t.plain_text).join('') || "";
        const fullNotes = props["Notas"]?.rich_text?.map(t => t.plain_text).join('') || "";
        const email = props["11. Correo"]?.rich_text?.map(t => t.plain_text).join('').trim() || "";

        // Extract Dosha from notes summary
        const dosha = fullNotes.match(/- Dosha: (.*)/)?.[1] || "";

        // Parse symptom calibrations from notes
        const symptomCalibrations = [];
        const calMatch = fullNotes.match(/\*\*Calibración de Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
        if (calMatch) {
            const lines = calMatch[1].trim().split('\n');
            for (const line of lines) {
                const m = line.match(/^- (.+?) → Frecuencia: (Diaria|Semanal|Mensual), Intensidad: (\d) \((.+?)\)/);
                if (m) {
                    symptomCalibrations.push({
                        symptom: m[1],
                        frequency: m[2],
                        intensity: parseInt(m[3]),
                        intensityLabel: m[4]
                    });
                }
            }
        }

        // Extract plain symptoms from notes
        const symptomsMatch = fullNotes.match(/\*\*Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
        let plainSymptoms = [];
        if (symptomsMatch) {
            plainSymptoms = symptomsMatch[1].trim().split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean);
        }

        // ── Helpers for property extraction ─────────────────────────────────────
        const extractText = (key) => props[key]?.rich_text?.map(t => t.plain_text).join('').trim() || "";
        const extractMultiSelect = (key) => props[key]?.multi_select?.map(o => o.name).join(', ') || "";
        const extractNumber = (key) => props[key]?.number != null ? String(props[key].number) : "";

        // ── Phone: try multiple possible field names ──────────────────────────────
        const phone =
            extractText("2. Número de celular") ||
            props["2. Número de celula"]?.phone_number ||
            props["teléfono "]?.phone_number ||
            props["Phone"]?.phone_number ||
            extractText("Celular (whastapp)") ||
            "";

        // ── Email fallback from typed email property ───────────────────────────
        const emailFull =
            email ||
            props["Email 1"]?.email ||
            extractText("Correo Electronico") ||
            extractText("11. Correo electrónico") ||
            "";

        // ── Age: from notes first, then Notion properties ──────────────────────
        const age = fullNotes.match(/Edad: (\d+)/)?.[1] || extractText("10. Edad (1)") || extractNumber("Edad") || "";

        // ── Build clinicalData from direct Notion properties ──────────────────
        // This ensures patients created manually in Notion also show their data.
        const clinicalData = {};

        const addField = (label, value) => { if (value && value.trim()) clinicalData[label] = value.trim(); };

        // ── Propósito / Motivo de Consulta ────────────────────────────────────
        addField("Propósito de Consulta",
            extractText("12. Por favor describe brevemente el propósito de tu consulta") ||
            fullNotes.match(/- Motivo Consulta: (.+)/)?.[1]?.trim() ||
            extractText("Motivo de consulta") ||
            extractText("15. Motivo de consulta")
        );

        // ── Síntomas (agregar a clinicalData además de plainSymptoms) ─────────
        const symptomsFromProps = extractMultiSelect("18. Síntomas  (Selecciona los síntomas que tengas en este momento)");
        if (symptomsFromProps && plainSymptoms.length === 0) {
            plainSymptoms = symptomsFromProps.split(', ').filter(Boolean);
        }
        // Also show symptoms as readable text in clinical data
        const allSymptomsList = plainSymptoms.length > 0
            ? plainSymptoms.join(', ')
            : symptomCalibrations.map(s => s.symptom).join(', ');
        addField("Síntomas", allSymptomsList);

        // Other symptoms not in the list
        addField("Otros Síntomas",
            extractText("19. Enlista cualquier otro síntoma no mencionado anteriormente.") ||
            fullNotes.match(/- Otros Síntomas: (.+)/)?.[1]?.trim()
        );

        // ── Contact & location ───────────────────────────────────────────────
        addField("Dirección", extractText("3. Dirección"));
        addField("Ciudad", extractText("Ciudad") || extractText("País"));

        // ── Age fallback from Notion property ────────────────────────────────
        // (age variable is already set above, but some patients use "10. Edad (1)")
        if (!age) {
            const ageFromProp = extractText("10. Edad (1)");
            if (ageFromProp) addField("Edad", ageFromProp);
        }

        // ── Physical stats ──────────────────────────────────────────────────
        addField("Peso",
            fullNotes.match(/- Peso: (.+)/)?.[1]?.trim() ||
            extractText("8. Peso (1)")
        );
        addField("Altura",
            fullNotes.match(/- Altura: (.+)/)?.[1]?.trim() ||
            extractText("9. Altura (1)")
        );
        addField("Estado Civil",
            fullNotes.match(/- Estado Civil: (.+)/)?.[1]?.trim() ||
            extractText("5. Estado civil (1)")
        );
        addField("Hijos",
            fullNotes.match(/- Hijos: (.+)/)?.[1]?.trim() ||
            extractText("6. Numero de hijos") ||
            extractText("6. Hijos")
        );
        addField("Contacto Emergencia",
            fullNotes.match(/- Contacto Emergencia: (.+)/)?.[1]?.trim() ||
            extractText("7. Contacto de emergencia (1)")
        );

        // ── Energía ─────────────────────────────────────────────────────────
        addField("Energía (1-10)",
            fullNotes.match(/- Nivel Energía \(1-10\): (.+)/)?.[1]?.trim() ||
            extractText("20. Cuál es tu nivel de energía en un rango del 1 al 10 (1 baja, 10 alta)")
        );

        // ── Occupation / profession ─────────────────────────────────────────
        addField("Profesión",
            fullNotes.match(/- Ocupación: (.+)/)?.[1]?.trim() ||
            extractText("4. Ocupación (1)") ||
            extractText("Profesión Actual")
        );

        // ── Diet ────────────────────────────────────────────────────────────
        addField("Desayuno",
            fullNotes.match(/- Desayuno: (.+)/)?.[1]?.trim() ||
            extractText("22. Describe que es lo que consumes normalmente en el desayuno (Menciona la frecuencia con la que consumes cierto alimento: diario, semanal o mensual, también menciona la cantidad: poca, moderado, mucho)")
        );
        addField("Comida",
            extractText("23. Describe que es lo que consumes normalmente en la comida. (Menciona la frecuencia con la que consumes cierto alimento: diario, semanal o mensual, también menciona la cantidad: poca, moderado, mucho)") ||
            extractText("23. Describe que es lo que consumes normalmente la comida. (Menciona la frecuencia con la que consumes cierto alimento: diario, semanal o mensual, también menciona la cantidad: poca, moderado, mucho)")
        );
        addField("Cena",
            fullNotes.match(/- Cena: (.+)/)?.[1]?.trim() ||
            extractText("24. Describe que es lo que consumes normalmente en la cena (Menciona la frecuencia con la que consumes cierto alimento: diario, semanal o mensual, también menciona la cantidad: poca, moderado, mucho)")
        );
        addField("Alergias",
            fullNotes.match(/- Alergias: (.+)/)?.[1]?.trim() ||
            extractText("25. ¿Tienes algún tipo de alergia?")
        );
        addField("Horarios Regulares",
            fullNotes.match(/- Horarios Regulares: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("26. ¿Los horarios cuando consumes los alimentos son regulares?")
        );
        addField("Comidas al Día",
            fullNotes.match(/- Comidas al día: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("27. ¿Cuántas veces comes al día?")
        );
        addField("Hábitos Alimenticios",
            fullNotes.match(/- Hábitos al comer: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("28. Respecto a cómo comes selecciona las afirmaciones que apliquen para ti.")
        );
        addField("Suplementos",
            fullNotes.match(/- Suplementos: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("29. Selecciona los tipos de suplementos que consumes.")
        );

        // ── Ayurvedic profile ───────────────────────────────────────────────
        addField("Apetito",
            extractText("30. Apetito") ||
            extractMultiSelect("30. Describe el estado de tu apetito") ||
            fullNotes.match(/- Apetito: (.+)/)?.[1]?.trim()
        );
        addField("Tendencia de Peso",
            fullNotes.match(/- Tendencia Peso: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("31. Con respecto al peso elige alguna de las siguientes opciones")
        );
        addField("Menstruación",
            extractText("32. Menstruación") ||
            extractMultiSelect("32. Con respecto a la menstruación elige alguna de las siguientes opciones.") ||
            fullNotes.match(/- Menstruación: (.+)/)?.[1]?.trim()
        );
        addField("Sudor",
            fullNotes.match(/- Sudor: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("33. Con respecto al sudor elige alguna de las siguientes opciones.")
        );
        addField("Sueño",
            fullNotes.match(/- Sueño: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("34. Con respecto al sueño elige alguna de las siguientes opciones")
        );
        addField("Temperatura Corporal",
            extractMultiSelect("35. ¿Cómo es tu temperatura corporal?") ||
            fullNotes.match(/- Temperatura: (.+)/)?.[1]?.trim()
        );

        // ── Health history ──────────────────────────────────────────────────
        addField("Enfermedades Previas",
            fullNotes.match(/- Enfermedades Previas: (.+)/)?.[1]?.trim() ||
            extractText("13. Enfermedades diagnosticadas") ||
            extractText("13. Enfermedades diagnosticadas previamente (escribe los detalles)")
        );
        addField("Hospitalizaciones",
            fullNotes.match(/- Hospitalizaciones: (.+)/)?.[1]?.trim() ||
            extractText("14. Hospitalizaciones") ||
            extractText("14. Hospitalizaciones (escribe los detalles)")
        );
        addField("Cirugías",
            fullNotes.match(/- Cirugías: (.+)/)?.[1]?.trim() ||
            extractText("15. Cirugías estéticas (escribe los detalles)")
        );
        addField("Embarazo",
            fullNotes.match(/- Embarazo: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("16. Embarazo (1)")
        );
        addField("Sustancias",
            fullNotes.match(/- Sustancias: (.+)/)?.[1]?.trim() ||
            extractText("17. Uso de alcohol y substancias") ||
            extractMultiSelect("17. Usas frecuentemente algunas de las siguientes substancias.")
        );
        addField("Ejercicio",
            fullNotes.match(/- Ejercicio: (.+)/)?.[1]?.trim() ||
            extractMultiSelect("21. ¿Practicas algún tipo de ejercicio?")
        );

        // ── Administrative ──────────────────────────────────────────────────
        addField("Profesional",
            extractMultiSelect(PROFESSIONAL_PROPERTY) ||
            fullNotes.match(/- Profesional Solicitado: (.+)/)?.[1]?.trim()
        );
        addField("Grabación Educativa",
            extractText("38. Grabación") ||
            extractMultiSelect("37. Con fines educativos las sesiones pueden ser grabadas y observadas por alumnos de nuestra escuela.") ||
            extractMultiSelect("38. Permito que durante la consulta online, alumnos que están aprendiendo puedan estar de oyentes. Si nos apoyas recibirás un bono de $200 pesos que podrás utilizar en futuras consultas o productos Ayurvédicos.") ||
            fullNotes.match(/- Grabación Educativa: (.+)/)?.[1]?.trim()
        );
        addField("Consentimiento",
            extractText("38. Consentimiento informado") ||
            extractText("39. Consentimiento informado") ||
            extractMultiSelect("Multi-select")
        );
        addField("Observaciones",
            extractText("37. Observación") ||
            extractText("Anotaciones") ||
            fullNotes.match(/\*\*Observaciones Adicionales\*\*: (.+)/)?.[1]?.trim()
        );
        addField("Notas del Profesional",
            extractText("Notas del Profesional") ||
            fullNotes.match(/\*\*Notas del Profesional\*\*\n([\s\S]*?)(?=\n\*\*|$)/)?.[1]?.trim()
        );

        // ─────────────────────────────────────────────────────────────────────────

        const localRecord = getLocalPatientRecord(id, name);
        const visits = [...(localRecord.visits || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const treatmentPlans = [...(localRecord.treatmentPlans || [])].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        const tonguePhotos = [...(localRecord.tonguePhotos || [])]
            .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
            .map(photo => ({
                ...photo,
                url: buildTonguePhotoUrl(id, photo)
            }));
        const pulseReadings = [...(localRecord.pulseReadings || [])]
            .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
        const contextDocuments = [...(localRecord.contextDocuments || [])]
            .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));

        res.json({
            success: true,
            patient: {
                id,
                name,
                age,
                email: emailFull,
                phone,
                dosha,
                fullNotes,
                symptomCalibrations,
                plainSymptoms,
                clinicalData,
                visits,
                treatmentPlans,
                tonguePhotos,
                pulseReadings,
                contextDocuments,
                createdAt: page.created_time
            }
        });
    } catch (error) {
        console.error('Error retrieving page:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update patient details (case calibrations, symptoms, and basic info)
app.patch('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, age, email, phone, dosha, symptomCalibrations, plainSymptoms } = req.body;

        // Retrieve existing Notion page to merge or get raw notes
        const page = await notion.pages.retrieve({ page_id: id });
        const props = page.properties;
        const currentNotes = props["Notas"]?.rich_text?.map(t => t.plain_text).join('') || "";

        let newNotes = currentNotes;

        // 1. Update Dosha in newNotes
        if (dosha !== undefined) {
            if (newNotes.match(/- Dosha: (.*)/)) {
                newNotes = newNotes.replace(/- Dosha: (.*)/, `- Dosha: ${dosha}`);
            } else {
                const matchDatos = newNotes.match(/\*\*Datos Personales\*\*/);
                if (matchDatos) {
                    newNotes = newNotes.replace(/\*\*Datos Personales\*\*/, `**Datos Personales**\n- Dosha: ${dosha}`);
                } else {
                    newNotes = `- Dosha: ${dosha}\n\n` + newNotes;
                }
            }
        }

        // 2. Update Age in newNotes
        if (age !== undefined) {
            if (newNotes.match(/Edad: (\d+)/)) {
                newNotes = newNotes.replace(/Edad: (\d+)/, `Edad: ${age}`);
            } else if (newNotes.match(/- Edad: (.*)/)) {
                newNotes = newNotes.replace(/- Edad: (.*)/, `- Edad: ${age}`);
            } else {
                const matchDatos = newNotes.match(/\*\*Datos Personales\*\*/);
                if (matchDatos) {
                    newNotes = newNotes.replace(/\*\*Datos Personales\*\*/, `**Datos Personales**\n- Edad: ${age}`);
                }
            }
        }

        // 3. Update Calibración de Síntomas in newNotes
        if (symptomCalibrations !== undefined && Array.isArray(symptomCalibrations)) {
            const intensityLabels = { 1: 'Suave', 2: 'Moderado', 3: 'Fuerte' };
            let calibrationsText = `**Calibración de Síntomas**\n`;
            symptomCalibrations.forEach(sc => {
                const label = sc.intensityLabel || intensityLabels[sc.intensity] || 'Moderado';
                calibrationsText += `- ${sc.symptom} → Frecuencia: ${sc.frequency}, Intensidad: ${sc.intensity} (${label})\n`;
            });

            const calMatch = newNotes.match(/\*\*Calibración de Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
            if (calMatch) {
                newNotes = newNotes.replace(/\*\*Calibración de Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/, calibrationsText);
            } else {
                newNotes = newNotes.trim() + `\n\n` + calibrationsText;
            }
        }

        // 4. Update plain symptoms in newNotes
        if (plainSymptoms !== undefined && Array.isArray(plainSymptoms)) {
            let plainSymptomsText = `**Síntomas**\n`;
            plainSymptoms.forEach(s => {
                plainSymptomsText += `- ${s}\n`;
            });

            const symptomsMatch = newNotes.match(/\*\*Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/);
            if (symptomsMatch) {
                newNotes = newNotes.replace(/\*\*Síntomas\*\*\n([\s\S]*?)(?=\n\*\*|$)/, plainSymptomsText);
            } else {
                newNotes = newNotes.trim() + `\n\n` + plainSymptomsText;
            }
        }

        // 5. Update Notion page properties dynamically
        const propertiesToUpdate = {};

        if (name !== undefined && props["Nombre Completo "]) {
            propertiesToUpdate["Nombre Completo "] = {
                title: [{ text: { content: name } }]
            };
        }
        if (email !== undefined && props["11. Correo"]) {
            propertiesToUpdate["11. Correo"] = {
                rich_text: [{ text: { content: email } }]
            };
        }
        if (phone !== undefined && props["2. Número de celular"]) {
            propertiesToUpdate["2. Número de celular"] = {
                rich_text: [{ text: { content: phone } }]
            };
        }
        if (plainSymptoms !== undefined && props["18. Síntomas  (Selecciona los síntomas que tengas en este momento)"]) {
            propertiesToUpdate["18. Síntomas  (Selecciona los síntomas que tengas en este momento)"] = {
                multi_select: plainSymptoms.map(s => ({ name: s }))
            };
        }
        if (age !== undefined) {
            if (props["10. Edad (1)"]) {
                propertiesToUpdate["10. Edad (1)"] = {
                    rich_text: [{ text: { content: String(age) } }]
                };
            } else if (props["Edad"]) {
                if (props["Edad"].type === 'number') {
                    propertiesToUpdate["Edad"] = {
                        number: Number(age) || null
                    };
                } else {
                    propertiesToUpdate["Edad"] = {
                        rich_text: [{ text: { content: String(age) } }]
                    };
                }
            }
        }
        if (props["Notas"]) {
            propertiesToUpdate["Notas"] = {
                rich_text: (newNotes.match(/[\s\S]{1,2000}/g) || [""]).map(chunk => ({ text: { content: chunk } }))
            };
        }

        await notion.pages.update({
            page_id: id,
            properties: propertiesToUpdate
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating patient properties:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/patients/:id/tongue-photos/:photoId/file', async (req, res) => {
    try {
        const { id, photoId } = req.params;
        const patientRecord = readPatientRecord(id);
        const photo = (patientRecord.tonguePhotos || []).find(item => item.id === photoId);

        if (!photo) {
            return res.status(404).send('Foto no encontrada.');
        }

        const filePath = join(getTonguePhotoDir(id), photo.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Archivo no encontrado.');
        }

        // Los navegadores no pueden mostrar HEIC/HEIF: convertir a JPEG al vuelo (con caché en disco).
        const isHeic = /\.(heic|heif)$/i.test(photo.filename) ||
            ['image/heic', 'image/heif'].includes(String(photo.mimeType || '').toLowerCase());
        if (isHeic) {
            const cachedJpgPath = filePath.replace(/\.(heic|heif)$/i, '.jpg');
            try {
                if (!fs.existsSync(cachedJpgPath)) {
                    const convertedBuffer = await convertHEIC({
                        buffer: fs.readFileSync(filePath),
                        format: 'JPEG',
                        quality: 0.85
                    });
                    fs.writeFileSync(cachedJpgPath, Buffer.from(convertedBuffer));
                }
                res.type('image/jpeg');
                return res.sendFile(cachedJpgPath);
            } catch (convertErr) {
                console.error('[Tongue Photo] No se pudo convertir HEIC al servir:', convertErr.message);
                // Como último recurso enviamos el archivo original.
            }
        }

        res.type(photo.mimeType || 'image/jpeg');
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving tongue photo:', error.message);
        res.status(500).send(error.message);
    }
});

app.post('/api/patients/:id/tongue-photos', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { dataUrl, name = '', type = '', note = '' } = req.body;
        const match = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);

        if (!match) {
            return res.status(400).json({ error: 'La foto debe ser PNG, JPG, WEBP, HEIC o HEIF.' });
        }

        const originalName = sanitizeFileName(name);
        const lowerName = originalName.toLowerCase();
        const dataMimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
        const requestedMimeType = String(type || '').toLowerCase();
        const mimeType = dataMimeType === 'application/octet-stream' && lowerName.endsWith('.heic')
            ? 'image/heic'
            : dataMimeType === 'application/octet-stream' && lowerName.endsWith('.heif')
                ? 'image/heif'
                : dataMimeType === 'application/octet-stream' && ['image/heic', 'image/heif'].includes(requestedMimeType)
                    ? requestedMimeType
                    : dataMimeType || requestedMimeType;
        const extensionByMime = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/heic': 'heic',
            'image/heif': 'heif'
        };
        const originalExtension = extensionByMime[mimeType];
        const originalBuffer = Buffer.from(match[2], 'base64');

        if (!originalExtension || originalBuffer.length === 0) {
            return res.status(400).json({ error: 'Formato de imagen no válido. Usa PNG, JPG, WEBP, HEIC o HEIF.' });
        }

        if (originalBuffer.length > 12 * 1024 * 1024) {
            return res.status(400).json({ error: 'La foto supera el límite de 12 MB.' });
        }

        let buffer = originalBuffer;
        let extension = originalExtension;
        let finalMimeType = mimeType;

        if (mimeType === 'image/heic' || mimeType === 'image/heif') {
            try {
                console.log(`[Tongue Photo] Converting ${mimeType} image to image/jpeg...`);
                const convertedBuffer = await convertHEIC({
                    buffer: originalBuffer,
                    format: 'JPEG',
                    quality: 0.8
                });
                buffer = Buffer.from(convertedBuffer);
                extension = 'jpg';
                finalMimeType = 'image/jpeg';
                console.log(`[Tongue Photo] Conversion successful. New size: ${buffer.length} bytes`);
            } catch (convertErr) {
                console.error('[Tongue Photo] Failed to convert HEIC, saving raw:', convertErr);
            }
        }

        const photoDir = getTonguePhotoDir(id);
        if (!fs.existsSync(photoDir)) {
            fs.mkdirSync(photoDir, { recursive: true });
        }

        const photoId = crypto.randomUUID();
        const filename = `${photoId}.${extension}`;
        fs.writeFileSync(join(photoDir, filename), buffer);

        const patientRecord = readPatientRecord(id);
        const savedOriginalName = extension !== originalExtension
            ? originalName.replace(/\.(heic|heif)$/i, '.jpg')
            : originalName;

        const photo = {
            id: photoId,
            originalName: savedOriginalName,
            filename,
            mimeType: finalMimeType,
            size: buffer.length,
            note,
            createdAt: req.body.date || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        patientRecord.tonguePhotos.push(photo);
        writePatientRecord(id, patientRecord);

        res.json({
            success: true,
            photo: {
                ...photo,
                url: buildTonguePhotoUrl(id, photo)
            }
        });
    } catch (error) {
        console.error('Error saving tongue photo:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/patients/:id/tongue-photos/:photoId', authenticateToken, async (req, res) => {
    try {
        const { id, photoId } = req.params;
        const { note } = req.body;
        const patientRecord = readPatientRecord(id);
        const photos = Array.isArray(patientRecord.tonguePhotos) ? patientRecord.tonguePhotos : [];
        const photo = photos.find(item => item.id === photoId);

        if (!photo) {
            return res.status(404).json({ error: 'Foto de lengua no encontrada.' });
        }

        if (typeof note === 'string') {
            photo.note = note;
        }
        photo.updatedAt = new Date().toISOString();
        writePatientRecord(id, patientRecord);

        res.json({
            success: true,
            photo: {
                ...photo,
                url: buildTonguePhotoUrl(id, photo)
            }
        });
    } catch (error) {
        console.error('Error updating tongue photo:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/patients/:id/tongue-photos/:photoId', authenticateToken, async (req, res) => {
    try {
        const { id, photoId } = req.params;
        const patientRecord = readPatientRecord(id);
        const photos = Array.isArray(patientRecord.tonguePhotos) ? patientRecord.tonguePhotos : [];
        const photo = photos.find(item => item.id === photoId);

        if (!photo) {
            return res.status(404).json({ error: 'Foto de lengua no encontrada.' });
        }

        const filePath = join(getTonguePhotoDir(id), photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        // Borrar también el JPG cacheado de una conversión HEIC, si existe.
        const cachedJpgPath = filePath.replace(/\.(heic|heif)$/i, '.jpg');
        if (cachedJpgPath !== filePath && fs.existsSync(cachedJpgPath)) {
            fs.unlinkSync(cachedJpgPath);
        }

        patientRecord.tonguePhotos = photos.filter(item => item.id !== photoId);
        writePatientRecord(id, patientRecord);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting tongue photo:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ── Documentos de contexto (archivos de texto para la IA) ──────────────────

// Listar documentos de contexto del paciente.
app.get('/api/patients/:id/context-docs', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const record = readPatientRecord(id);
        res.json({ success: true, documents: record.contextDocuments || [] });
    } catch (error) {
        console.error('Error listing context documents:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Descargar/ver el contenido de un documento de contexto.
app.get('/api/patients/:id/context-docs/:docId/file', authenticateToken, async (req, res) => {
    try {
        const { id, docId } = req.params;
        const record = readPatientRecord(id);
        const doc = (record.contextDocuments || []).find(item => item.id === docId);
        if (!doc) return res.status(404).send('Documento no encontrado.');

        const filePath = join(getContextDocsDir(id), doc.filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado.');

        res.type(doc.mimeType || 'text/plain; charset=utf-8');
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving context document:', error.message);
        res.status(500).send(error.message);
    }
});

// Subir un documento de texto. Acepta texto plano en `content` o un dataUrl base64 en `dataUrl`.
app.post('/api/patients/:id/context-docs', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name = 'documento.txt', note = '', content, dataUrl } = req.body;

        const extension = getContextDocExtension(name);
        if (!CONTEXT_DOC_EXTENSIONS.includes(extension)) {
            return res.status(400).json({ error: 'Solo se permiten archivos de texto: .txt, .md, .csv o .tsv.' });
        }

        let buffer;
        if (typeof content === 'string' && content.length > 0) {
            buffer = Buffer.from(content, 'utf8');
        } else {
            const match = String(dataUrl || '').match(/^data:([^;]*);base64,([A-Za-z0-9+/=]+)$/);
            if (!match) {
                return res.status(400).json({ error: 'No se recibió contenido de texto válido.' });
            }
            buffer = Buffer.from(match[2], 'base64');
        }

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío.' });
        }
        if (buffer.length > MAX_CONTEXT_DOC_BYTES) {
            return res.status(400).json({ error: 'El archivo supera el límite de 2 MB.' });
        }

        const dir = getContextDocsDir(id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const docId = crypto.randomUUID();
        const filename = `${docId}.${extension}`;
        fs.writeFileSync(join(dir, filename), buffer);

        const record = readPatientRecord(id);
        const doc = {
            id: docId,
            originalName: sanitizeFileName(name),
            filename,
            mimeType: extension === 'csv' ? 'text/csv; charset=utf-8'
                : extension === 'md' || extension === 'markdown' ? 'text/markdown; charset=utf-8'
                    : 'text/plain; charset=utf-8',
            size: buffer.length,
            note,
            createdAt: req.body.date || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        record.contextDocuments = [doc, ...(record.contextDocuments || [])];
        writePatientRecord(id, record);

        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Error saving context document:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar la nota de un documento de contexto.
app.patch('/api/patients/:id/context-docs/:docId', authenticateToken, async (req, res) => {
    try {
        const { id, docId } = req.params;
        const { note } = req.body;
        const record = readPatientRecord(id);
        const doc = (record.contextDocuments || []).find(item => item.id === docId);
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

        if (typeof note === 'string') doc.note = note;
        doc.updatedAt = new Date().toISOString();
        writePatientRecord(id, record);

        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Error updating context document:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Borrar un documento de contexto.
app.delete('/api/patients/:id/context-docs/:docId', authenticateToken, async (req, res) => {
    try {
        const { id, docId } = req.params;
        const record = readPatientRecord(id);
        const docs = Array.isArray(record.contextDocuments) ? record.contextDocuments : [];
        const doc = docs.find(item => item.id === docId);
        if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

        const filePath = join(getContextDocsDir(id), doc.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        record.contextDocuments = docs.filter(item => item.id !== docId);
        writePatientRecord(id, record);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting context document:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients/:id/pulse-readings', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date = new Date().toISOString().split('T')[0], positions = [], notes = '' } = req.body;

        if (!Array.isArray(positions) || positions.length === 0) {
            return res.status(400).json({ error: 'Agrega al menos una posición de pulso.' });
        }

        const patientRecord = readPatientRecord(id);
        const reading = {
            id: crypto.randomUUID(),
            date,
            positions: positions.map(position => ({
                side: position.side || '',
                sideLabel: position.sideLabel || '',
                point: position.point || '',
                number: position.number || '',
                superficialOrgan: position.superficialOrgan || '',
                deepOrgan: position.deepOrgan || '',
                superficialStatus: position.superficialStatus || '',
                deepStatus: position.deepStatus || ''
            })),
            notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        patientRecord.pulseReadings.push(reading);
        writePatientRecord(id, patientRecord);

        res.json({ success: true, reading });
    } catch (error) {
        console.error('Error saving pulse reading:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/patients/:id/pulse-readings/:readingId', authenticateToken, async (req, res) => {
    try {
        const { id, readingId } = req.params;
        const patientRecord = readPatientRecord(id);
        const pulseReadings = Array.isArray(patientRecord.pulseReadings) ? patientRecord.pulseReadings : [];
        const reading = pulseReadings.find(item => item.id === readingId);

        if (!reading) {
            return res.status(404).json({ error: 'Lectura de pulso no encontrada.' });
        }

        patientRecord.pulseReadings = pulseReadings.filter(item => item.id !== readingId);
        writePatientRecord(id, patientRecord);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting pulse reading:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Add a visit
app.post('/api/patients/:id/visits', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            title = '',
            patientName = '',
            note,
            symptoms = {},
            diagnosis = '',
            treatment = '',
            lifestyle = '',
            patientDiagnosis = '',
            patientTreatment = '',
            patientLifestyle = '',
            cerealGuidance = '',
            cerealRecipe = '',
            dosha = '',
            herbs = [],
            categories = [],
            recipes = [],
            adherence = {},
            subtitle = '',
            pdfFontSize = '',
            isFollowUp = false,
            visitNumber = '',
            showLifestylePage = true,
            showDigestiveRecoveryPage = false,
            showDiagnosis = true,
            showHealthyEatingGuide = true,
            healthyEatingGuide = '',
            healthyEatingHabits = [],
            tongue = ''
        } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const patientRecord = readPatientRecord(id);
        const visitData = {
            id: crypto.randomUUID(),
            title: title || buildLocalRecordTitle(patientRecord, patientName, date),
            date,
            note,
            diagnosis,
            treatment,
            lifestyle,
            patientDiagnosis,
            patientTreatment,
            patientLifestyle,
            cerealGuidance,
            cerealRecipe,
            dosha,
            symptoms,
            herbs,
            categories,
            recipes,
            adherence,
            subtitle,
            pdfFontSize,
            isFollowUp,
            visitNumber,
            showLifestylePage,
            showDigestiveRecoveryPage,
            showDiagnosis,
            showHealthyEatingGuide,
            healthyEatingGuide,
            healthyEatingHabits,
            tongue,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Write a markdown summary of the visit into the patient's folder.
        visitData.mdFile = writeVisitMarkdown(id, visitData, patientName);

        patientRecord.visits.push(visitData);
        writePatientRecord(id, patientRecord);
        res.json({ success: true, visit: visitData });
    } catch (error) {
        console.error('Error adding visit:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Edit a locally saved visit
app.patch('/api/patients/:id/visits/:visitId', authenticateToken, async (req, res) => {
    try {
        const { id, visitId } = req.params;
        const patientRecord = readPatientRecord(id);
        const visits = Array.isArray(patientRecord.visits) ? patientRecord.visits : [];
        const visitIndex = visits.findIndex(visit => visit.id === visitId);

        if (visitIndex === -1) {
            return res.status(404).json({ error: 'Visita local no encontrada.' });
        }

        const allowedFields = [
            'title', 'date', 'note', 'diagnosis', 'treatment', 'lifestyle',
            'patientDiagnosis', 'patientTreatment', 'patientLifestyle', 'dosha', 'symptoms',
            'cerealGuidance', 'cerealRecipe', 'herbs', 'categories', 'recipes',
            'adherence', 'subtitle', 'pdfFontSize', 'isFollowUp', 'visitNumber', 'showLifestylePage',
            'showDigestiveRecoveryPage', 'showDiagnosis', 'showHealthyEatingGuide', 'healthyEatingGuide', 'healthyEatingHabits', 'tongue'
        ];
        const updates = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        visits[visitIndex] = {
            ...visits[visitIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        // Regenerate the markdown summary in the patient's folder.
        const patientNameForMd = (req.body && req.body.patientName) || '';
        visits[visitIndex].mdFile = writeVisitMarkdown(id, visits[visitIndex], patientNameForMd);
        patientRecord.visits = visits;
        writePatientRecord(id, patientRecord);

        res.json({ success: true, visit: visits[visitIndex] });
    } catch (error) {
        console.error('Error updating local visit:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Delete a locally saved visit (and its generated files)
app.delete('/api/patients/:id/visits/:visitId', authenticateToken, async (req, res) => {
    try {
        const { id, visitId } = req.params;
        const patientRecord = readPatientRecord(id);
        const visits = Array.isArray(patientRecord.visits) ? patientRecord.visits : [];
        const visitIndex = visits.findIndex(visit => visit.id === visitId);

        if (visitIndex === -1) {
            return res.status(404).json({ error: 'Visita local no encontrada.' });
        }

        const [removed] = visits.splice(visitIndex, 1);
        patientRecord.visits = visits;
        writePatientRecord(id, patientRecord);

        // Best-effort cleanup of the visit's generated files (markdown + PDF).
        try {
            const { patientDir } = getPatientRecordPath(id);
            [removed.mdFile, removed.pdfFile].forEach((fileName) => {
                if (!fileName) return;
                const filePath = join(patientDir, fileName);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
                }
            });
        } catch (cleanupError) {
            console.error('Error cleaning visit files:', cleanupError.message);
        }

        res.json({ success: true, deletedId: visitId });
    } catch (error) {
        console.error('Error deleting local visit:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Save a generated treatment PDF plan for future reference
app.post('/api/patients/:id/treatment-plans', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date = new Date().toISOString(),
            title = '',
            patientName = '',
            visitDate = '',
            diagnosis = '',
            treatment = '',
            lifestyle = '',
            patientDiagnosis = '',
            patientTreatment = '',
            patientLifestyle = '',
            cerealGuidance = '',
            cerealRecipe = '',
            dosha = '',
            herbs = [],
            categories = [],
            recipes = [],
            adherence = {},
            subtitle = '',
            pdfFontSize = '',
            isFollowUp = false,
            visitNumber = '',
            showLifestylePage = true,
            showDigestiveRecoveryPage = false,
            showDiagnosis = true,
            showHealthyEatingGuide = true,
            healthyEatingGuide = '',
            healthyEatingHabits = [],
            tongue = ''
        } = req.body;

        if (!diagnosis && !treatment && !lifestyle) {
            return res.status(400).json({ error: 'Diagnosis, treatment, or lifestyle is required' });
        }

        const patientRecord = readPatientRecord(id);
        const planData = {
            id: crypto.randomUUID(),
            title: title || buildLocalRecordTitle(patientRecord, patientName, visitDate || date),
            date,
            visitDate,
            diagnosis,
            treatment,
            lifestyle,
            patientDiagnosis,
            patientTreatment,
            patientLifestyle,
            cerealGuidance,
            cerealRecipe,
            dosha,
            herbs,
            categories,
            recipes,
            adherence,
            subtitle,
            pdfFontSize,
            isFollowUp,
            visitNumber,
            showLifestylePage,
            showDigestiveRecoveryPage,
            showDiagnosis,
            showHealthyEatingGuide,
            healthyEatingGuide,
            healthyEatingHabits,
            tongue,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        patientRecord.treatmentPlans.push(planData);
        writePatientRecord(id, patientRecord);
        res.json({ success: true, plan: planData });
    } catch (error) {
        console.error('Error saving treatment plan:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Edit a locally saved treatment plan
app.patch('/api/patients/:id/treatment-plans/:planId', authenticateToken, async (req, res) => {
    try {
        const { id, planId } = req.params;
        const patientRecord = readPatientRecord(id);
        const treatmentPlans = Array.isArray(patientRecord.treatmentPlans) ? patientRecord.treatmentPlans : [];
        const planIndex = treatmentPlans.findIndex(plan => plan.id === planId);

        if (planIndex === -1) {
            return res.status(404).json({ error: 'Tratamiento local no encontrado.' });
        }

        const allowedFields = [
            'title', 'date', 'visitDate', 'diagnosis', 'treatment', 'lifestyle',
            'patientDiagnosis', 'patientTreatment', 'patientLifestyle', 'cerealGuidance',
            'cerealRecipe', 'dosha', 'herbs', 'categories', 'recipes', 'adherence', 'subtitle',
            'pdfFontSize', 'isFollowUp', 'visitNumber', 'showLifestylePage',
            'showDigestiveRecoveryPage', 'showDiagnosis', 'showHealthyEatingGuide', 'healthyEatingGuide', 'healthyEatingHabits', 'tongue'
        ];
        const updates = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        treatmentPlans[planIndex] = {
            ...treatmentPlans[planIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        patientRecord.treatmentPlans = treatmentPlans;
        writePatientRecord(id, patientRecord);

        res.json({ success: true, plan: treatmentPlans[planIndex] });
    } catch (error) {
        console.error('Error updating local treatment plan:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Improve / polish a free-text note while keeping it human and in Krishna's style
app.post('/api/ai/improve-text', authenticateToken, async (req, res) => {
    try {
        const { text = '', field = '', provider = 'deepseek', model } = req.body;
        const aiProvider = provider === 'gemini' ? 'gemini' : 'deepseek';

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'No hay texto para mejorar.' });
        }

        const fieldHint = field ? `\nEste texto corresponde al campo: "${field}".` : '';

        const systemPrompt = `Eres el asistente de redacción de Krishna, un terapeuta de medicina ayurvédica. Tu tarea es MEJORAR notas clínicas que él escribe rápido, dejándolas claras y bien redactadas, SIN que pierdan su voz.

Reglas estrictas:
- Corrige ortografía, acentos, puntuación y gramática.
- Conserva EXACTAMENTE el significado. No inventes síntomas, causas, datos ni conclusiones que no estén en el texto.
- Conserva tal cual los números, mediciones y rangos (por ejemplo "5 a 3", "2/3").
- Mantén un tono humano, directo, cálido y natural, como lo diría una persona. Nada de lenguaje corporativo, inflado, genérico ni "tono de IA". Evita frases de relleno.
- No agregues introducciones, títulos, viñetas ni comentarios. No uses comillas alrededor de la respuesta.
- Escribe en español de México, respetando la persona del original (si habla del paciente en tercera persona, mantenla).
- Puedes reordenar y unir ideas para que se lea fluido y profesional, pero breve.${fieldHint}

Devuelve ÚNICAMENTE el texto mejorado, listo para guardar en la ficha.`;

        let improved = '';

        if (aiProvider === 'deepseek') {
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ];
            try {
                improved = await callDeepSeek(messages, {
                    model: model || deepSeekDefaultModel,
                    temperature: 0.4,
                });
            } catch (deepSeekError) {
                console.error('DeepSeek Improve Error:', deepSeekError);
                return res.status(500).json({ error: deepSeekError.message });
            }
        } else {
            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({ error: 'Gemini API Key missing' });
            }
            const geminiPrompt = `${systemPrompt}\n\nTexto a mejorar:\n${text}`;
            const result = await aiModel.generateContent(geminiPrompt);
            const response = await result.response;
            improved = response.text();
        }

        improved = (improved || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();

        if (!improved) {
            return res.status(500).json({ error: 'La IA no devolvió texto.' });
        }

        res.json({ success: true, improvedText: improved });
    } catch (error) {
        console.error('Error improving text:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// AI Diagnose & Treatment
app.post('/api/ai/diagnose', authenticateToken, async (req, res) => {
    try {
        console.log('Received /api/ai/diagnose request');
        const { patientData, patient, provider = 'deepseek', model } = req.body;
        const aiProvider = provider === 'gemini' ? 'gemini' : 'deepseek';
        const manualDoshaRaw = String(patient?.dosha || '').trim();
        const manualDosha = normalizeDoshaValue(manualDoshaRaw);

        let diagnosisContext = buildClinicalContext(patient, patientData);

        if (!diagnosisContext || diagnosisContext.trim().length === 0) {
            console.error('No patient data provided for diagnosis');
            return res.json({ success: false, error: 'No hay suficientes datos del paciente para generar un diagnóstico.' });
        }

        // Adjuntar los documentos de contexto subidos por el profesional para este paciente.
        if (patient && patient.id) {
            const contextDocs = readPatientContextDocuments(patient.id);
            if (contextDocs && contextDocs.trim()) {
                diagnosisContext += `\n\n**Documentos de contexto aportados por el profesional:**\n${contextDocs}\n`;
                console.log(`[Diagnose] Incluidos documentos de contexto (${contextDocs.length} chars) para paciente ${patient.id}`);
            }
        }

        console.log(`Generating diagnosis with ${aiProvider} for context length:`, diagnosisContext.length);
        const bibliographyContext = buildRawBibliographyContext(diagnosisContext);

        const prompt = `
            Actúa como un Consultor Senior de Ayurveda.
            Basado en la siguiente información de la ficha de ingreso y en la bibliografía RAW proporcionada por VEDAMCI, determina su Dosha predominante y proporciona un diagnóstico ayurvédico detallado, claro, bien estructurado y útil para orientar el tratamiento.
            Usa la bibliografía RAW como marco doctrinal principal. Si la ficha y la bibliografía no sostienen una afirmación, dilo como hipótesis clínica o como dato por confirmar.

            REGLA CRÍTICA DE NO TECNICISMO (PROHIBIDO SÁNSCRITO COMPLEJO):
            Está estrictamente PROHIBIDO utilizar palabras en sánscrito o tecnicismos médicos que puedan confundir o abrumar al paciente (por ejemplo, NO uses: "rakta", "lasikā", "vidradhi", "bīja-doṣa", "yakṛt-rogā", "medo-dhātu", "agnimāndya", "āmā", "Vikriti", etc.).
            En su lugar, usa siempre sus equivalentes sencillos en español: "sangre", "linfa", "abscesos o inflamación", "predisposición hereditaria", "hígado graso", "digestión lenta o débil", "toxinas", "desequilibrio o acumulación". Explica todo de forma cercana, empática, y en segunda persona (tú).

            OBLIGATORIO: Comienza tu respuesta EXACTAMENTE con la siguiente línea de formato:
            DOSHA: [Tipo de Dosha]
            Donde [Tipo de Dosha] debe ser uno de los siguientes valores exactos: Vata, Pitta, Kapha, Vata-Pitta, Pitta-Kapha, Vata-Kapha, Tridoshica.
            Ejemplo de primera línea: DOSHA: Vata-Pitta
            ${manualDoshaRaw ? `\n            PRIORIDAD CLÍNICA: El profesional ya definió el dosha como ${manualDosha || manualDoshaRaw}. Debes respetar ese criterio por encima de tu inferencia automática.${manualDosha ? ` La primera línea debe ser exactamente: DOSHA: ${manualDosha}.` : ''} Puedes mencionar matices o desequilibrios secundarios, pero no cambies la clasificación principal.` : ''}

            Después de esa línea, entrega un informe en Markdown con buena maquetación. Usa encabezados H2 (##), tablas Markdown, listas con viñetas y negritas para facilitar lectura clínica.

            ESTRUCTURA OBLIGATORIA DEL INFORME:

            ## Resumen del caso
            Escribe 2 a 4 frases cálidas y precisas. Resume el patrón principal que observas y la prioridad clínica inicial.

            ## Dosha predominante y desequilibrio actual
            - **Constitución o tendencia principal:** explica el dosha detectado.
            - **Desequilibrio activo:** explica qué dosha o combinación está más alterada ahora.
            - **Lectura práctica:** explica qué significa para el paciente en lenguaje cotidiano.

            ## Señales principales observadas
            Incluye una tabla Markdown con 4 a 8 filas:
            | Síntoma o señal | Lectura ayurvédica simple | Dosha implicado | Prioridad |
            | :--- | :--- | :--- | :--- |
            La prioridad debe ser "Alta", "Media" o "Baja".

            ## Interpretación ayurvédica
            Explica de forma ordenada:
            - Digestión y metabolismo.
            - Sueño, energía y sistema nervioso.
            - Eliminación, inflamación, pesadez o sequedad si aplica.
            - Emociones, estrés y hábitos relevantes si aparecen en la ficha.
            Mantén el lenguaje comprensible y evita afirmaciones absolutas.

            ## Diagnóstico integrativo
            Redacta 2 a 4 párrafos. Conecta síntomas, hábitos y dosha sin sonar alarmista. Distingue claramente entre lo observado, lo probable y lo que habría que confirmar en consulta.

            ## Factores que sostienen el desequilibrio
            Lista 4 a 7 factores concretos tomados de la ficha. Si un dato no aparece, no lo inventes.

            ## Recomendaciones iniciales
            Elige y prioriza únicamente las pautas más críticas y útiles para el paciente en esta etapa inicial. Limita estrictamente la cantidad de recomendaciones a las siguientes cifras exactas:
            - **Alimentación:** Exactamente 3 pautas claras y específicas (por ejemplo, reducir o evitar ciertos alimentos perjudiciales para su estado actual, o reemplazarlos por alternativas más adecuadas).
            - **Rutina diaria:** Exactamente 1 pauta de hábito diario clave (por ejemplo, hora de levantarse, caminar después de comer, o respiración consciente).
            - **Descanso y mente:** Exactamente 1 pauta concreta para calmar la mente o mejorar el descanso (por ejemplo, rutina de sueño, masaje de pies con aceite o escritura antes de dormir).
            - **Qué observar durante 7 días:** Exactamente 3 preguntas o señales claras de seguimiento y evolución que el paciente deba observar.

            ## Precauciones
            Incluye una nota breve indicando que esto no sustituye evaluación médica, especialmente ante síntomas intensos, persistentes o diagnósticos previos.

            Información del Paciente:
            ${diagnosisContext}

            Bibliografía RAW relevante para este caso:
            ${bibliographyContext || 'No se encontraron fragmentos específicos; usa únicamente principios ayurvédicos generales sin inventar citas.'}

            REGLAS DE CALIDAD:
            - Responde en español.
            - Sé detallado, pero no rellenes con generalidades.
            - Personaliza cada sección con datos de la ficha.
            - Fundamenta el razonamiento en los fragmentos de Bibliografía RAW cuando existan y menciona entre paréntesis el archivo fuente de forma breve cuando sea útil.
            - Si falta información, dilo como "no se reporta" o "conviene confirmar en consulta".
            - No recomiendes hierbas, dosis ni tratamientos invasivos en este diagnóstico; eso pertenece al plan de tratamiento.
        `;

        let text = '';

        if (aiProvider === 'deepseek') {
            try {
                const messages = [
                    { role: "system", content: "Eres un experto Consultor Senior de Ayurveda (Vaidya) con profundo conocimiento de los textos clásicos. Tus respuestas son precisas, técnicas pero comprensibles, y totalmente personalizadas. Evita generalidades." },
                    { role: "user", content: prompt }
                ];

                text = await callDeepSeek(messages, {
                    model: model || deepSeekDefaultModel,
                    temperature: 0.7,
                });
            } catch (deepSeekError) {
                console.error('DeepSeek Error:', deepSeekError);
                return res.status(500).json({ error: deepSeekError.message });
            }
        } else {
            // Default to Gemini
            if (!process.env.GEMINI_API_KEY) {
                console.error('Gemini API Key missing');
                return res.json({ success: false, error: 'Gemini API Key missing' });
            }
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            text = response.text();
        }

        let doshaExtracted = '';
        let cleanText = text;

        const doshaMatch = text.match(/DOSHA:\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ-]+)/i);
        if (doshaMatch) {
            doshaExtracted = doshaMatch[1].trim();
            cleanText = text.replace(/DOSHA:\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ-]+\s*\n*/i, '').trim();
        }

        let matchedDosha = manualDosha || manualDoshaRaw || normalizeDoshaValue(doshaExtracted);

        if (matchedDosha && !manualDoshaRaw && patient && patient.id) {
            try {
                const patientId = patient.id;
                const page = await notion.pages.retrieve({ page_id: patientId });
                const currentNotes = page.properties["Notas"]?.rich_text?.map(t => t.plain_text).join('') || "";

                let newNotes = currentNotes;
                if (newNotes.match(/- Dosha: (.*)/)) {
                    newNotes = newNotes.replace(/- Dosha: (.*)/, `- Dosha: ${matchedDosha}`);
                } else {
                    const matchDatos = newNotes.match(/\*\*Datos Personales\*\*/);
                    if (matchDatos) {
                        newNotes = newNotes.replace(/\*\*Datos Personales\*\*/, `**Datos Personales**\n- Dosha: ${matchedDosha}`);
                    } else {
                        newNotes = `- Dosha: ${matchedDosha}\n\n` + newNotes;
                    }
                }

                await notion.pages.update({
                    page_id: patientId,
                    properties: {
                        "Notas": {
                            rich_text: newNotes.match(/[\s\S]{1,2000}/g).map(chunk => ({ text: { content: chunk } }))
                        }
                    }
                });
                console.log(`[Dosha Auto] Updated patient ${patientId} dosha to ${matchedDosha} in Notion.`);
            } catch (notionError) {
                console.error('[Dosha Auto] Error updating dosha in Notion:', notionError.message);
            }
        }

        res.json({ success: true, diagnosis: cleanText, dosha: matchedDosha });
    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// AI Chat / Questions
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message, context, patient, provider = 'deepseek', history = [], model, chatType = 'diagnosis', currentDiagnosis, currentTreatment } = req.body;
        const aiProvider = provider === 'gemini' ? 'gemini' : 'deepseek';

        const patientContext = buildClinicalContext(patient, context);

        let systemPrompt = '';
        if (chatType === 'treatment') {
            const currentTreatmentJson = JSON.stringify(currentTreatment, null, 2);
            systemPrompt = `
                Eres un experto Médico Ayurvédico (Vaidya) con profundo conocimiento de los textos clásicos y de la psicología del paciente.
                Estás ayudando al profesional a refinar el plan de tratamiento y las indicaciones en PDF del paciente.
                
                CONTEXTO CLÍNICO DEL PACIENTE:
                ${patientContext}
                
                PLAN DE TRATAMIENTO ACTUAL:
                ${currentTreatmentJson}
                
                INSTRUCCIÓN CRÍTICA DE INTERACCIÓN:
                Si el profesional te pide realizar cambios, adiciones, eliminaciones o ajustes en el plan de tratamiento (por ejemplo: agregar una hierba, cambiar la dosis, cambiar las categorías de alimentos, ajustar la indicación del PDF, etc.), debes recalcular y generar los campos del tratamiento modificados.
                
                FORMATO OBLIGATORIO DE RESPUESTA:
                Debes estructurar tu respuesta EXACTAMENTE usando las siguientes marcas:
                
                ---RESPUESTA---
                [Escribe aquí tu respuesta conversacional habitual para el médico, de forma cálida, profesional y breve, explicando qué cambiaste si te lo solicitó]
                
                ---TRATAMIENTO_ACTUALIZADO---
                [Si el usuario solicitó cambios en el tratamiento, escribe aquí un objeto JSON válido con los campos que cambiaron o con todos los campos actualizados. Si NO se solicitaron cambios, deja esta sección completamente vacía.
                El JSON debe tener la siguiente estructura exacta:
                {
                  "patientDiagnosis": "breve diagnóstico para el paciente en el PDF, en segunda persona (tú) y lenguaje comprensible",
                  "treatment": "indicaciones de tratamiento y alimentación en markdown para el PDF. Debe centrarse únicamente en: dos categorías de comida elegidas, raspa lengua por la mañana y la fórmula herbal. Máximo 5 viñetas, estilo cálido e inspirador.",
                  "lifestyle": "indicación breve del raspa lengua para el PDF del paciente (máximo 2 frases)",
                  "clinicalTreatment": "tratamiento clínico completo para el archivo interno en markdown",
                  "categories": ["Categoría1", "Categoría2"], // exactamente 2 categorías del tratamiento
                  "herbs": [{"formula": "Nombre de la fórmula", "dosage": "Dosis e indicación de uso"}]
                }
                ]
            `;
        } else {
            systemPrompt = `
                Eres un experto Consultor Senior de Ayurveda (Vaidya).
                Estás chateando con el médico/terapeuta sobre el caso clínico de este paciente.
                
                CONTEXTO CLÍNICO DEL PACIENTE:
                ${patientContext}
                
                DIAGNÓSTICO ACTUAL:
                ${currentDiagnosis || 'Aún no se ha generado un diagnóstico.'}
                
                INSTRUCCIÓN CRÍTICA DE INTERACCIÓN:
                Si el profesional te pide realizar cualquier cambio, ajuste, reducción, adición o refinamiento en el diagnóstico o en las recomendaciones (por ejemplo, reducir el número de recomendaciones de alimentación a 3, quitar ciertos alimentos, cambiar el dosha, etc.), debes redactar el diagnóstico actualizado completo en formato markdown y devolverlo.
                
                REGLA DE RECOMENDACIONES (Si las actualizas):
                - Alimentación: Exactamente 3 pautas claras.
                - Rutina diaria: Exactamente 1 pauta de hábito diario clave.
                - Descanso y mente: Exactamente 1 pauta de relajación o sueño.
                - Qué observar durante 7 días: Exactamente 3 preguntas claras de seguimiento.
                
                FORMATO OBLIGATORIO DE RESPUESTA:
                Debes estructurar tu respuesta EXACTAMENTE usando las siguientes marcas:
                
                ---RESPUESTA---
                [Escribe aquí tu respuesta conversacional habitual para el médico, de forma cálida, profesional y breve, explicando qué cambiaste si te lo solicitó]
                
                ---DIAGNOSTICO_ACTUALIZADO---
                [Si el usuario solicitó cambios en el diagnóstico o recomendaciones, escribe aquí la versión COMPLETA, revisada y corregida del diagnóstico en markdown, respetando los encabezados ## y la estructura. Si NO se solicitaron cambios o no hay diagnóstico generado aún, deja esta sección completamente vacía]
            `;
        }

        let text = '';

        if (aiProvider === 'deepseek') {
            const messages = [
                { role: "system", content: systemPrompt },
                ...history.map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.text
                })),
                { role: "user", content: message }
            ];

            try {
                text = await callDeepSeek(messages, {
                    model: model || deepSeekDefaultModel,
                    temperature: 0.7,
                });
            } catch (deepSeekError) {
                console.error('DeepSeek Chat Error:', deepSeekError);
                return res.status(500).json({ error: deepSeekError.message });
            }
        } else {
            // Default to Gemini
            if (!process.env.GEMINI_API_KEY) {
                return res.json({ success: false, error: 'Gemini API Key missing' });
            }

            const geminiPrompt = `
                ${systemPrompt}
                
                Historial del chat:
                ${history.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}`).join('\n')}
                
                Pregunta/Petición actual del usuario:
                ${message}
            `;

            const result = await aiModel.generateContent(geminiPrompt);
            const response = await result.response;
            text = response.text();
        }

        let reply = text;
        let updatedDiagnosis = null;
        let updatedTreatment = null;

        if (text.includes('---RESPUESTA---')) {
            const parts = text.split(/---DIAGNOSTICO_ACTUALIZADO---|---TRATAMIENTO_ACTUALIZADO---/);
            let responsePart = parts[0] || '';
            let updatedPart = parts[1] || '';

            responsePart = responsePart.replace('---RESPUESTA---', '').trim();
            updatedPart = updatedPart.trim();

            reply = responsePart;
            reply = reply.replace(/---DIAGNOSTICO_ACTUALIZADO---|---TRATAMIENTO_ACTUALIZADO---/g, '').trim();

            if (text.includes('---DIAGNOSTICO_ACTUALIZADO---')) {
                if (updatedPart && updatedPart.length > 50) {
                    updatedDiagnosis = updatedPart;
                }
            } else if (text.includes('---TRATAMIENTO_ACTUALIZADO---')) {
                if (updatedPart && updatedPart.length > 10) {
                    try {
                        const jsonStr = updatedPart.replace(/^```json\s*/i, '').replace(/```\s*$/g, '').trim();
                        updatedTreatment = JSON.parse(jsonStr);
                    } catch (jsonErr) {
                        console.error('Error parsing updated treatment JSON from AI response:', jsonErr, updatedPart);
                    }
                }
            }
        }

        res.json({ success: true, reply, updatedDiagnosis, updatedTreatment });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update an herb/formula definition
app.post('/api/herbs/update', authenticateToken, (req, res) => {
    try {
        const { name, preview, usage, instruction, ingredients, isCustom } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El nombre de la fórmula/hierba es requerido.' });
        }
        
        const herbsPath = join(__dirname, '../src/data/herb.json');
        if (!fs.existsSync(herbsPath)) {
            return res.status(404).json({ error: 'Archivo de base de datos de hierbas no encontrado.' });
        }
        
        const herbsList = JSON.parse(fs.readFileSync(herbsPath, 'utf8'));
        const herb = herbsList.find(h => h.name.toLowerCase() === name.toLowerCase());
        
        const updatedHerb = herb || {
            name: name,
            preview: preview || '',
            usage: usage || '',
            link: '',
            pacify: [],
            aggravate: [],
            tridosha: false
        };

        if (preview !== undefined) updatedHerb.preview = preview;
        if (usage !== undefined) updatedHerb.usage = usage;
        if (instruction !== undefined) updatedHerb.instruction = instruction;
        if (ingredients !== undefined) updatedHerb.ingredients = ingredients;
        if (isCustom !== undefined) updatedHerb.isCustom = isCustom;

        if (!herb) {
            herbsList.push(updatedHerb);
        }

        fs.writeFileSync(herbsPath, JSON.stringify(herbsList, null, 2), 'utf8');

        if (isCustom) {
            const customPath = join(__dirname, '../src/data/custom_formulas.json');
            let customList = [];
            if (fs.existsSync(customPath)) {
                try {
                    customList = JSON.parse(fs.readFileSync(customPath, 'utf8') || '[]');
                } catch (e) {
                    console.error('Error parsing custom_formulas.json:', e);
                }
            }
            
            const existingCustomIdx = customList.findIndex(h => h.name.toLowerCase() === name.toLowerCase());
            const customItem = {
                name: updatedHerb.name,
                preview: updatedHerb.preview,
                usage: updatedHerb.usage,
                instruction: updatedHerb.instruction || '',
                ingredients: updatedHerb.ingredients || '',
                createdAt: new Date().toISOString()
            };

            if (existingCustomIdx >= 0) {
                customList[existingCustomIdx] = { ...customList[existingCustomIdx], ...customItem };
            } else {
                customList.push(customItem);
            }
            
            fs.writeFileSync(customPath, JSON.stringify(customList, null, 2), 'utf8');
        }

        res.json({ success: true, message: 'Fórmula guardada exitosamente.', herb: updatedHerb });
    } catch (error) {
        console.error('Error updating herb definition:', error);
        res.status(500).json({ error: 'Error al actualizar la base de datos de hierbas.' });
    }
});

// Get lifestyle guidelines list
app.get('/api/lifestyles', authenticateToken, (req, res) => {
    try {
        const lifestylesPath = join(__dirname, '../src/data/lifestyle.json');
        let lifestylesList = [];
        if (fs.existsSync(lifestylesPath)) {
            lifestylesList = JSON.parse(fs.readFileSync(lifestylesPath, 'utf8') || '[]');
        }
        res.json({ success: true, lifestyles: lifestylesList });
    } catch (error) {
        console.error('Error getting lifestyles:', error);
        res.status(500).json({ error: 'Error al obtener la base de datos de estilos de vida.' });
    }
});

// Update a lifestyle/habit definition
app.post('/api/lifestyles/update', authenticateToken, (req, res) => {
    try {
        const { name, text } = req.body;
        if (!name || !text) {
            return res.status(400).json({ error: 'El nombre y texto del hábito son requeridos.' });
        }
        
        const lifestylesPath = join(__dirname, '../src/data/lifestyle.json');
        let lifestylesList = [];
        if (fs.existsSync(lifestylesPath)) {
            lifestylesList = JSON.parse(fs.readFileSync(lifestylesPath, 'utf8') || '[]');
        }
        
        const existingIdx = lifestylesList.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
        const updatedLifestyle = { name, text };

        if (existingIdx >= 0) {
            lifestylesList[existingIdx] = updatedLifestyle;
        } else {
            lifestylesList.push(updatedLifestyle);
        }

        fs.writeFileSync(lifestylesPath, JSON.stringify(lifestylesList, null, 2), 'utf8');

        res.json({ success: true, message: 'Estilo de vida guardado exitosamente.', lifestyle: updatedLifestyle });
    } catch (error) {
        console.error('Error updating lifestyle definition:', error);
        res.status(500).json({ error: 'Error al actualizar la base de datos de estilos de vida.' });
    }
});

// Update a recipe definition
app.post('/api/recipes/update', authenticateToken, (req, res) => {
    try {
        const { id, title, text } = req.body;
        if (!id || !title || !text) {
            return res.status(400).json({ error: 'El ID, título y texto de la receta son requeridos.' });
        }
        
        const recipesPath = join(__dirname, '../src/data/recipes.json');
        let recipesList = [];
        if (fs.existsSync(recipesPath)) {
            recipesList = JSON.parse(fs.readFileSync(recipesPath, 'utf8') || '[]');
        }
        
        const existingIdx = recipesList.findIndex(r => r.id === id);
        if (existingIdx >= 0) {
            recipesList[existingIdx].title = title;
            recipesList[existingIdx].text = text;
            delete recipesList[existingIdx].structured;
            fs.writeFileSync(recipesPath, JSON.stringify(recipesList, null, 2), 'utf8');
            res.json({ success: true, message: 'Receta guardada exitosamente.', recipe: recipesList[existingIdx] });
        } else {
            res.status(404).json({ error: 'Receta no encontrada.' });
        }
    } catch (error) {
        console.error('Error updating recipe definition:', error);
        res.status(500).json({ error: 'Error al actualizar la base de datos de recetas.' });
    }
});



// AI Draft Treatment Indication
app.post('/api/ai/draft-treatment', authenticateToken, async (req, res) => {
    try {
        console.log('Received /api/ai/draft-treatment request');
        const { patientName, patientAge, dosha, diagnosis = '', symptoms, prescribedHerbs, lifestyle = '', provider = 'deepseek', model, isInitial = false, doshaLocked = false } = req.body;
        const aiProvider = provider === 'gemini' ? 'gemini' : 'deepseek';
        const lockedDosha = doshaLocked ? (normalizeDoshaValue(dosha) || dosha || '') : '';

        let symptomsText = '';
        if (Array.isArray(symptoms)) {
            symptomsText = symptoms.join(', ');
        } else if (symptoms && typeof symptoms === 'object') {
            symptomsText = Object.keys(symptoms).join(', ');
        } else {
            symptomsText = symptoms || 'No especificados';
        }

        // Load herbs list to provide the available herb names to the AI
        let localHerbsList = [];
        try {
            const herbsPath = join(__dirname, '../src/data/herb.json');
            if (fs.existsSync(herbsPath)) {
                localHerbsList = JSON.parse(fs.readFileSync(herbsPath, 'utf8'));
            }
        } catch (err) {
            console.error('Error loading herbs list in draft-treatment endpoint:', err);
        }
        const availableHerbNames = localHerbsList.map(h => h.name).filter(Boolean);

        const prompt = `
            Actúa como un experimentado Médico Ayurvédico (Vaidya) con profundo conocimiento de los textos clásicos.
            Tu tarea es generar dos capas de redacción: una capa clínica interna, detallada, para el archivo del paciente; y una capa sencilla, cálida y comprensible para el PDF que leerá el paciente.

            INFORMACIÓN DEL PACIENTE:
            - Nombre: ${patientName || 'Paciente'}
            - Edad: ${patientAge || 'N/A'} años
            - Constitución/Desequilibrio (Dosha): ${dosha || 'no especificado'}
            - Síntomas / Motivo de consulta: ${symptomsText}

            DIAGNÓSTICO CLÍNICO/AYURVÉDICO BASE:
            ${diagnosis || 'No especificado'}

            INSTRUCCIONES CLAVE DE LA IA (SELECCIONES OBLIGATORIAS):
            1. **Dosha del Tratamiento**: Confirma el Dosha principal a tratar (debe ser uno de estos exactamente: Vata-Pitta, Vata, Pitta, Kapha, Pitta-Kapha, Vata-Kapha, Tridoshica).
               ${lockedDosha ? `El profesional ya fijó el Dosha del tratamiento como "${lockedDosha}". Debes conservar exactamente ese valor en el JSON y no sustituirlo por otra combinación inferida por IA.` : ''}
            2. **Categorías de Alimentos**: Elige exactamente dos (2) categorías de la siguiente lista de 12 que el paciente más necesite priorizar o regular en esta etapa. Estas dos categorías son el eje alimentario del PDF; no hagas un plan general de desayuno/comida/cena.
               Lista de 12: Cereales, Lácteos, Endulzantes, Aceites, Frutas, Hortalizas, Nueces, Carnes, Legumbres, Especias, Condimentos, Bebidas.
            3. **Categoría de Estilo de Vida**: Usa "Raspa lengua / higiene oral ayurvédica" como categoría principal de estilo de vida.
            4. **Terapia Corporal**: Si el JSON requiere este campo, devuelve "No indicada en esta etapa"; no metas masaje, aceites, vapor ni otras terapias corporales en el PDF del paciente.
            5. **Fórmula Herbal**: Selecciona exactamente una (1) hierba o fórmula de la siguiente lista de base de datos que sea la que más necesite el paciente:
               Hierbas disponibles: ${availableHerbNames.slice(0, 200).join(', ')}
               Si necesitas una fórmula no listada, elige la más cercana de esta lista.
            6. **Uso de Raspa Lengua**:
               - ¿Es Consulta Inicial? ${isInitial ? 'SÍ' : 'NO'}.
               - Incluye OBLIGATORIAMENTE el uso de raspa lengua (limpieza de lengua) por las mañanas dentro del treatmentDraft y del lifestyleDraft, de forma breve y destacada.

            ENFOQUE OBLIGATORIO DEL PDF PARA EL PACIENTE:
            El treatmentDraft debe centrarse solo en tres elementos:
            1. Las dos categorías de comida elegidas.
            2. El raspa lengua por la mañana.
            3. La fórmula herbal seleccionada y su dosis.
            No agregues listas generales de horarios de comida, masaje, agua tibia, ejercicio, sueño, meditación ni terapias corporales. Si algo no pertenece a esos tres elementos, déjalo fuera del treatmentDraft.

            INSTRUCCIONES CRÍTICAS DE ESTILO (LA VOZ DE KRISHNA Y HUMANIZADOR):
            Debes imitar a la perfección la voz auténtica de Krishna. No utilices tonos clínicos, fríos, ni frases artificiales de IA.
            Tampoco uses tonos excesivamente poéticos, literarios o metafóricos floridos (como "abscesos son la voz de tu Pitta elevado", "fuego interno que pide ser apaciguado", "susurran desequilibrio", etc.). Escribe de forma DIRECTA, FILOSÓFICA y ACCESIBLE.

            REGLAS CLAVE DE ESCRITURA:
            1. **Repetición acumulativa/rítmica**: Construye usando estructuras de repetición rítmica que den énfasis (ej. "El cuerpo siempre está hablando. ... Son la forma en que el cuerpo nos dice..."). No saltes de idea en idea secamente. Repite estructuras gramaticales para crear cadencia.
            2. **Frases cortas como remates**: Intercala frases muy cortas e impactantes, idealmente aisladas en sus propias líneas o párrafos al final para dar fuerza (ej. "Porque algo que no se cultiva no crece.").
            3. **Capa espiritual y de conciencia**: No te limites al plano físico (dieta, síntomas). Conecta la salud con la conciencia, la felicidad, los hábitos diarios y las decisiones que tomamos a favor de nosotros mismos.
            4. **Cierre que abre**: El final del texto no debe ser seco. Debe abrir una nueva dimensión de acompañamiento o reflexión espiritual (ej. "Eso es lo que vamos a buscar juntos.").
            5. **Evita lenguaje clínico frío**: En lugar de decir "pacificar ambos con dieta suave y rutina constante", escribe de manera humana y cálida: "Hacer eso con una dieta suave. Hacerlo con una rutina constante. Hacerlo día a día, sin prisa, sin violencia."

            EJEMPLO DE REFERENCIA DE VOZ (CÓMO DEBES REDACTAR EXACTAMENTE):
            """
            El cuerpo es inteligente. El cuerpo siempre está hablando. Los abscesos, el estreñimiento, la inflamación — no son el problema, son la señal. Son la forma en que el cuerpo nos dice que algo está fuera de equilibrio.

            Hay una definición en Ayurveda que dice que la salud es equilibrio. Equilibrio entre Pitta y Vata, equilibrio entre el fuego y el movimiento, equilibrio entre lo que comemos y lo que somos capaces de digerir. Y cuando ese equilibrio se pierde, el cuerpo lo muestra. Siempre lo muestra.

            Por eso el tratamiento no es atacar el síntoma. El tratamiento es volver al equilibrio. Cultivar la digestión, fortalecer el agni, reducir las toxinas que se han acumulado. Hacer eso con una dieta suave. Hacerlo con una rutina constante. Hacerlo día a día, sin prisa, sin violencia.

            Porque algo que no se cultiva no crece.

            Y la salud no se da sola. La salud se construye. Se construye en cada comida, en cada hábito, en cada decisión pequeña que tomamos a favor de nosotros mismos.

            Eso es lo que vamos a buscar juntos.
            """

            FORMATO DE SALIDA (RETORNA ÚNICAMENTE UN OBJETO JSON VÁLIDO):
            Debes responder ÚNICAMENTE con un JSON con la siguiente estructura exacta. No agregues textos introductorios ni explicativos, solo el JSON:
            {
              "dosha": "Vata-Pitta", // Debe ser exactamente uno de los 7 permitidos
              "foodCategories": ["Categoría1", "Categoría2"], // Exactamente 2 de la lista de 12
              "lifestyleCategory": "Nombre de la categoría de estilo de vida",
              "bodyTherapy": "Nombre de la terapia corporal",
              "herbalFormula": {
                "formula": "Nombre exacto de la hierba de la lista",
                "dosage": "Indicación de dosis corta y cálida"
              },
              "clinicalTreatmentDraft": "Plan interno detallado para el archivo clínico. Debe usar Markdown con secciones: Objetivo terapéutico, Prioridades, Alimentación, Rutina, Fórmula herbal seleccionada, Terapia corporal, Seguimiento. Debe ser específico, técnico pero comprensible, y no menor de 5 párrafos.",
              "patientDiagnosisDraft": "Diagnóstico sencillo para el PDF del paciente. Máximo 2 párrafos cortos, sin tabla, sin tecnicismos pesados, en segunda persona, explicando qué se observó y qué vamos a cuidar.",
              "treatmentDraft": "Tratamiento sencillo para el PDF del paciente. Debe usar Markdown y centrarse únicamente en: dos categorías de comida elegidas, raspa lengua por la mañana y fórmula herbal seleccionada con dosis. Debe ser claro, práctico, cálido y breve: máximo 5 viñetas. No incluyas explicación clínica extensa ni otros hábitos.",
              "lifestyleDraft": "Indicación breve del raspa lengua para el PDF del paciente. Máximo 2 frases prácticas."
            }
        `;

        let text = '';

        if (aiProvider === 'deepseek') {
            try {
                const messages = [
                    { role: "system", content: "Eres un experto Médico Ayurvédico (Vaidya) que prescribe tratamientos personalizados de forma automatizada y estructurada como JSON." },
                    { role: "user", content: prompt }
                ];

                text = await callDeepSeek(messages, {
                    model: model || deepSeekDefaultModel,
                    temperature: 0.7,
                });
            } catch (deepSeekError) {
                console.error('DeepSeek Error in draft-treatment:', deepSeekError);
                return res.status(500).json({ error: deepSeekError.message });
            }
        } else {
            // Default to Gemini
            if (!process.env.GEMINI_API_KEY) {
                return res.json({ success: false, error: 'Gemini API Key missing' });
            }
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            text = response.text();
        }

        let responseJson = null;
        try {
            let cleanText = text.trim();
            // Remove markdown codeblock wrapper if present
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7);
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            cleanText = cleanText.trim();
            responseJson = JSON.parse(cleanText);
        } catch (parseError) {
            console.error('Error parsing JSON from AI response:', parseError);
            console.log('Raw text was:', text);
            // Attempt to extract JSON using regex if parse failed
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    responseJson = JSON.parse(jsonMatch[0].trim());
                } catch (innerError) {
                    console.error('Failed to parse extracted JSON block:', innerError);
                }
            }
        }

        if (responseJson) {
            res.json({
                success: true,
                dosha: lockedDosha || responseJson.dosha || dosha || 'Vata-Pitta',
                foodCategories: responseJson.foodCategories || [],
                lifestyleCategory: responseJson.lifestyleCategory || '',
                bodyTherapy: responseJson.bodyTherapy || '',
                herbalFormula: responseJson.herbalFormula || { formula: '', dosage: '' },
                clinicalTreatmentDraft: responseJson.clinicalTreatmentDraft || '',
                patientDiagnosisDraft: responseJson.patientDiagnosisDraft || '',
                treatmentDraft: responseJson.treatmentDraft || '',
                lifestyleDraft: responseJson.lifestyleDraft || ''
            });
        } else {
            res.json({
                success: false,
                error: 'La respuesta de la IA no pudo ser estructurada en formato JSON correctamente.',
                rawText: text
            });
        }
    } catch (error) {
        console.error('AI Draft Treatment Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Doctor Notes (stored as blocks on the patient page) ─────────────────────

const DOCTOR_NOTE_PREFIX = '[Nota del Profesional]';

// ─── Google Calendar Endpoints ──────────────────────────────────────────────

// Get current Google Calendar configuration state
app.get('/api/calendar/config', authenticateToken, (req, res) => {
    res.json({
        success: true,
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || getDefaultCalendarRedirectUri(),
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        isConnected: !!process.env.GOOGLE_REFRESH_TOKEN,
        bookingLink: process.env.VITE_CALENDLY_LINK || '',
        allowedDays: process.env.ALLOWED_WORK_DAYS || '1,2,3,4,5',
        allowedHours: process.env.ALLOWED_WORK_HOURS || '9,10,11,12,13,14,15,16,17',
        blockedDates: process.env.BLOCKED_DATES || ''
    });
});

// Save Google Calendar configuration
app.post('/api/calendar/config', authenticateToken, (req, res) => {
    try {
        const { clientId, clientSecret, redirectUri, calendarId, bookingLink, allowedDays, allowedHours, blockedDates } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ error: 'El ID de Cliente (Client ID) es requerido.' });
        }
        
        const updates = {
            GOOGLE_CLIENT_ID: clientId,
            GOOGLE_REDIRECT_URI: redirectUri || getDefaultCalendarRedirectUri(),
            GOOGLE_CALENDAR_ID: calendarId || 'primary',
            VITE_CALENDLY_LINK: bookingLink || '',
            ALLOWED_WORK_DAYS: allowedDays || '1,2,3,4,5',
            ALLOWED_WORK_HOURS: allowedHours || '9,10,11,12,13,14,15,16,17',
            BLOCKED_DATES: blockedDates || ''
        };
        
        if (clientSecret) {
            updates.GOOGLE_CLIENT_SECRET = clientSecret;
        }
        
        updateEnvFile(updates);
        
        // Re-read from process.env after updates
        process.env.ALLOWED_WORK_DAYS = updates.ALLOWED_WORK_DAYS;
        process.env.ALLOWED_WORK_HOURS = updates.ALLOWED_WORK_HOURS;
        process.env.BLOCKED_DATES = updates.BLOCKED_DATES;
        
        initGoogleCalendar();
        
        res.json({ success: true, message: 'Configuración guardada correctamente.' });
    } catch (error) {
        console.error('Error saving calendar config:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect Google Calendar account
app.post('/api/calendar/disconnect', authenticateToken, (req, res) => {
    try {
        updateEnvFile({
            GOOGLE_REFRESH_TOKEN: ''
        });
        
        if (oauth2Client) {
            oauth2Client.setCredentials({});
        }
        
        initGoogleCalendar();
        
        res.json({ success: true, message: 'Google Calendar desconectado correctamente.' });
    } catch (error) {
        console.error('Error disconnecting calendar:', error);
        res.status(500).json({ error: error.message });
    }
});

// Auth URL
app.get('/api/calendar/auth', authenticateToken, (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).json({ error: 'Las credenciales de Google Calendar no están configuradas.' });
    }
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent'
    });
    res.json({ url });
});

// Auth Callback
app.get('/api/calendar/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        if (tokens.refresh_token) {
            updateEnvFile({
                GOOGLE_REFRESH_TOKEN: tokens.refresh_token
            });
            initGoogleCalendar();
            console.log('Google Auth Success. Refresh Token saved to .env.');
        } else {
            console.log('Google Auth Success, but no refresh token returned (already authorized).');
        }
        
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Conexión Exitosa</title>
                <style>
                    body {
                        background-color: #0f172a;
                        color: #f8fafc;
                        font-family: system-ui, -apple-system, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(16px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        padding: 2.5rem;
                        border-radius: 1.5rem;
                        text-align: center;
                        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
                        max-width: 400px;
                    }
                    h1 { color: #f5e6c8; margin-top: 0; font-size: 1.75rem; }
                    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
                    .check-icon {
                        font-size: 3rem;
                        color: #10b981;
                        margin-bottom: 1rem;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="check-icon">✓</div>
                    <h1>¡Conexión Exitosa!</h1>
                    <p>Tu cuenta de Google Calendar se ha conectado correctamente.</p>
                    <p>Puedes cerrar esta pestaña y regresar a la aplicación de Ayurveda.</p>
                    <script>
                        // Intenta cerrar la pestaña después de 2.5 segundos
                        setTimeout(() => {
                            window.close();
                        }, 2500);
                    </script>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error getting tokens:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Error de Autenticación</title>
                <style>
                    body {
                        background-color: #0f172a;
                        color: #f8fafc;
                        font-family: system-ui, -apple-system, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(16px);
                        border: 1px solid rgba(239, 68, 68, 0.2);
                        padding: 2.5rem;
                        border-radius: 1.5rem;
                        text-align: center;
                        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
                        max-width: 400px;
                    }
                    h1 { color: #f87171; margin-top: 0; font-size: 1.75rem; }
                    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Error de Conexión</h1>
                    <p>Hubo un problema al conectar con Google Calendar.</p>
                    <p>Detalle: ${error.message}</p>
                    <p>Por favor, cierra esta pestaña e inténtalo de nuevo.</p>
                </div>
            </body>
            </html>
        `);
    }
});

// Get Events
app.get('/api/calendar/events', authenticateToken, async (req, res) => {
    try {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return res.status(401).json({ success: false, error: 'Google Calendar no está conectado. Por favor conéctalo en la configuración.' });
        }
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(400).json({ success: false, error: 'Credenciales de Google API no configuradas.' });
        }
        
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: timeMin.toISOString(),
            maxResults: 150,
            singleEvents: true,
            orderBy: 'startTime',
        });
        const events = response.data.items || [];
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching calendar events:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Event
app.put('/api/calendar/events/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { summary, description, start, end } = req.body;
        
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return res.status(401).json({ success: false, error: 'Google Calendar no está conectado.' });
        }
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        const response = await calendar.events.patch({
            calendarId: calendarId,
            eventId: id,
            requestBody: {
                summary,
                description,
                start: {
                    dateTime: start,
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: end,
                    timeZone: 'America/Mexico_City'
                }
            }
        });
        
        res.json({ success: true, event: response.data });
    } catch (error) {
        console.error('Error updating calendar event:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete Event
app.delete('/api/calendar/events/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return res.status(401).json({ success: false, error: 'Google Calendar no está conectado.' });
        }
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: id
        });
        
        res.json({ success: true, message: 'Evento eliminado correctamente.' });
    } catch (error) {
        console.error('Error deleting calendar event:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper to check event overlaps for a slot
function isOverlapping(slotStart, slotEnd, events) {
    for (const event of events) {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        
        // If the event is all-day
        if (event.start.date) {
            eventStart.setHours(0, 0, 0, 0);
            eventEnd.setHours(23, 59, 59, 999);
        }
        
        if (eventStart < slotEnd && eventEnd > slotStart) {
            return true;
        }
    }
    return false;
}

// Get Available Slots for the next 3 weeks
app.get('/api/calendar/free-slots', async (req, res) => {
    try {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return res.status(401).json({ success: false, error: 'Google Calendar no está conectado.' });
        }

        const bookingWindowDays = 21;
        
        const startSearch = new Date();
        startSearch.setHours(0, 0, 0, 0);
        const endSearch = new Date();
        endSearch.setDate(endSearch.getDate() + bookingWindowDays);
        endSearch.setHours(23, 59, 59, 999);
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const response = await calendar.events.list({
            calendarId,
            timeMin: startSearch.toISOString(),
            timeMax: endSearch.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items || [];
        const slots = [];
        
        // Parse settings from environment variables
        const allowedDays = (process.env.ALLOWED_WORK_DAYS || '1,2,3,4,5').split(',').map(Number);
        const allowedHours = (process.env.ALLOWED_WORK_HOURS || '9,10,11,12,13,14,15,16,17').split(',').map(Number);
        const blockedDates = (process.env.BLOCKED_DATES || '').split(',').map(d => d.trim()).filter(Boolean);
        
        // Generate slots for the next 3 weeks, starting from tomorrow
        for (let i = 1; i <= bookingWindowDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            
            // Check if day of week is allowed
            const dayOfWeek = date.getDay();
            if (!allowedDays.includes(dayOfWeek)) continue;
            
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateString = `${yyyy}-${mm}-${dd}`;
            
            // Check if date is blocked
            if (blockedDates.includes(dateString)) continue;
            
            for (const hour of allowedHours) {
                // Construct slot dates in local server timezone (Mexico City)
                const slotStart = new Date(`${dateString}T${String(hour).padStart(2, '0')}:00:00`);
                const slotEnd = new Date(`${dateString}T${String(hour + 1).padStart(2, '0')}:00:00`);
                
                if (!isOverlapping(slotStart, slotEnd, events)) {
                    slots.push({
                        date: dateString,
                        start: slotStart.toISOString(),
                        end: slotEnd.toISOString(),
                        timeLabel: `${String(hour).padStart(2, '0')}:00`
                    });
                }
            }
        }
        
        res.json({ success: true, slots });
    } catch (error) {
        console.error('Error fetching free slots:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Book Event
app.post('/api/calendar/book', async (req, res) => {
    try {
        const { name, email, phone, start, end, notes, appointmentType, bookingMode } = req.body;
        
        if (!name || !email || !phone || !start || !end) {
            return res.status(400).json({ success: false, error: 'Todos los campos obligatorios (nombre, correo, celular, fecha y hora) deben ser proporcionados.' });
        }
        
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return res.status(401).json({ success: false, error: 'Google Calendar no está conectado.' });
        }
        
        const appointmentTypeLabel = appointmentType === 'followup' ? 'Visita de seguimiento' : 'Consulta inicial';
        const bookingModeLabel = bookingMode === 'admin' ? 'Modo administrador' : 'Portal de pacientes';
        
        const event = {
            summary: `${appointmentTypeLabel} Ayurveda: ${name}`,
            description: `Tipo de cita: ${appointmentTypeLabel}\nNombre del Paciente: ${name}\nCorreo: ${email}\nTeléfono: ${phone}\nMotivo/notas: ${notes || 'Sin especificar'}\nOrigen: ${bookingModeLabel}\nCreado automáticamente desde el portal de reservas de VEDAMCI.`,
            start: {
                dateTime: start,
                timeZone: 'America/Mexico_City',
            },
            end: {
                dateTime: end,
                timeZone: 'America/Mexico_City',
            },
            attendees: [
                { email: email }
            ],
            reminders: {
                useDefault: true
            }
        };
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const response = await calendar.events.insert({
            calendarId,
            resource: event,
        });
        
        res.json({ success: true, eventId: response.data.id });
    } catch (error) {
        console.error('Error booking calendar event:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get doctor notes for a patient
app.get('/api/patients/:id/notes', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch all children blocks of the patient page
        const response = await notion.blocks.children.list({ block_id: id, page_size: 100 });
        const notes = response.results
            .filter(block => {
                if (block.type !== 'paragraph') return false;
                const text = (block.paragraph.rich_text || []).map(rt => rt.plain_text).join('');
                return text.startsWith(DOCTOR_NOTE_PREFIX);
            })
            .map(block => {
                const fullText = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
                let noteText = fullText.replace(DOCTOR_NOTE_PREFIX, '').trim();
                
                // Parse custom date if present, e.g. [DATE:2026-05-29]
                let createdAt = block.created_time;
                const dateMatch = noteText.match(/^\[DATE:([^\]]+)\]/);
                if (dateMatch) {
                    createdAt = dateMatch[1];
                    noteText = noteText.replace(/^\[DATE:[^\]]+\]\s*/, '').trim();
                }

                // Strip optional inline timestamp like "(9/2/2026, 6:35:42 p.m.) "
                noteText = noteText.replace(/^\([^)]+\)\s*/, '').trim();
                return {
                    id: block.id,
                    text: noteText,
                    createdAt: createdAt,
                    createdBy: block.created_by?.id || 'unknown'
                };
            });
        res.json({ success: true, notes });
    } catch (error) {
        console.error('Error fetching doctor notes:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Add a doctor note to a patient
app.post('/api/patients/:id/notes', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { text, date } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Note text is required' });
        }
        const noteDate = date ? new Date(date) : new Date();
        const timestamp = noteDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
        const datePrefix = date ? `[DATE:${date}] ` : '';
        const noteContent = `${DOCTOR_NOTE_PREFIX} ${datePrefix}(${timestamp}) ${text}`;

        const result = await notion.blocks.children.append({
            block_id: id,
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [
                            {
                                type: 'text',
                                text: { content: noteContent }
                            }
                        ]
                    }
                }
            ]
        });

        const createdBlock = result.results[0];
        res.json({
            success: true,
            note: {
                id: createdBlock.id,
                text: text,
                createdAt: date || createdBlock.created_time
            }
        });
    } catch (error) {
        console.error('Error creating doctor note:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Save a generated treatment PDF flat file
app.post('/api/patients/:id/pdf/:recordId', authenticateToken, async (req, res) => {
    try {
        const { id, recordId } = req.params;
        const { pdfBase64 } = req.body;

        if (!pdfBase64) {
            return res.status(400).json({ error: 'Falta el contenido del PDF.' });
        }

        const { patientDir } = getPatientRecordPath(id);
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }

        // Save PDF file
        const buffer = Buffer.from(pdfBase64, 'base64');
        const pdfFilePath = join(patientDir, `Tratamiento_${recordId}.pdf`);
        fs.writeFileSync(pdfFilePath, buffer);

        // Update the record in patient's JSON
        const patientRecord = readPatientRecord(id);
        let updated = false;
        let recordData = null;

        if (patientRecord.treatmentPlans) {
            const plan = patientRecord.treatmentPlans.find(p => p.id === recordId);
            if (plan) {
                plan.pdfFile = `Tratamiento_${recordId}.pdf`;
                plan.updatedAt = new Date().toISOString();
                updated = true;
                recordData = plan;
            }
        }

        if (!updated && patientRecord.visits) {
            const visit = patientRecord.visits.find(v => v.id === recordId);
            if (visit) {
                visit.pdfFile = `Tratamiento_${recordId}.pdf`;
                visit.updatedAt = new Date().toISOString();
                updated = true;
                recordData = visit;
            }
        }

        if (updated) {
            writePatientRecord(id, patientRecord);
            
            // Also write human-readable copies in the patient's directory!
            if (recordData) {
                const titleStr = recordData.title || 'Tratamiento';
                const cleanTitle = titleStr.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'Tratamiento';
                
                // Write human-readable PDF copy
                const readablePdfPath = join(patientDir, `${cleanTitle}.pdf`);
                fs.writeFileSync(readablePdfPath, buffer);
                
                // Write human-readable editable JSON copy
                const readableJsonPath = join(patientDir, `${cleanTitle}.json`);
                fs.writeFileSync(readableJsonPath, JSON.stringify(recordData, null, 2));
                
                console.log(`Saved human-readable copies: ${cleanTitle}`);
            }
        }

        res.json({ success: true, pdfFile: `Tratamiento_${recordId}.pdf` });
    } catch (error) {
        console.error('Error saving PDF file:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Open patient's folder in macOS Finder
app.post('/api/patients/:id/open-folder', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { patientDir } = getPatientRecordPath(id);
        if (!fs.existsSync(patientDir)) {
            fs.mkdirSync(patientDir, { recursive: true });
        }
        
        exec(`open "${patientDir}"`, (err) => {
            if (err) {
                console.error('Error opening folder:', err);
                return res.status(500).json({ error: 'No se pudo abrir la carpeta en Finder.' });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error opening patient folder:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Serve/download a saved treatment PDF flat file
app.get('/api/patients/:id/pdf/:recordId', authenticateToken, async (req, res) => {
    try {
        const { id, recordId } = req.params;
        const { patientDir } = getPatientRecordPath(id);
        const pdfFilePath = join(patientDir, `Tratamiento_${recordId}.pdf`);

        if (!fs.existsSync(pdfFilePath)) {
            return res.status(404).send('Archivo PDF no encontrado.');
        }

        res.type('application/pdf');
        res.sendFile(pdfFilePath);
    } catch (error) {
        console.error('Error serving PDF:', error.message);
        res.status(500).send(error.message);
    }
});

app.post('/api/consultation', async (req, res) => {
    try {
        const body = req.body;

        if (!databaseId) {
            throw new Error('Database ID is not configured');
        }

        // Helper to formatting unmapped fields into a readable summary
        const formatSummary = (data) => {
            let summary = `**Resumen de Ficha de Ingreso**\nFecha: ${new Date().toLocaleDateString()}\n\n`;

            // Personal Data
            summary += `**Datos Personales**\n`;
            if (data.age) summary += `- Edad: ${data.age}\n`;
            if (data.address) summary += `- Dirección: ${data.address}\n`;
            if (data.occupation) summary += `- Ocupación: ${data.occupation}\n`;
            if (data.maritalStatus) summary += `- Estado Civil: ${data.maritalStatus}\n`;
            if (data.children) summary += `- Hijos: ${data.children}\n`;
            if (data.emergencyContact) summary += `- Contacto Emergencia: ${data.emergencyContact}\n`;
            if (data.weight) summary += `- Peso: ${data.weight}\n`;
            if (data.height) summary += `- Altura: ${data.height}\n`;

            // Health History
            summary += `\n**Salud y Antecedentes**\n`;
            if (data.consultationReason) summary += `- Motivo Consulta: ${data.consultationReason}\n`;
            if (data.preexistingConditions) summary += `- Enfermedades Previas: ${data.preexistingConditions}\n`;
            if (data.hospitalizations) summary += `- Hospitalizaciones: ${data.hospitalizations}\n`;
            if (data.surgeries) summary += `- Cirugías: ${data.surgeries}\n`;
            if (data.pregnancy) summary += `- Embarazo: ${data.pregnancy}\n`;
            if (data.substances) summary += `- Sustancias: ${Array.isArray(data.substances) ? data.substances.join(', ') : data.substances}\n`;
            if (data.otherSymptoms) summary += `- Otros Síntomas: ${data.otherSymptoms}\n`;
            if (data.energyLevel) summary += `- Nivel Energía (1-10): ${data.energyLevel}\n`;
            if (data.exercise) summary += `- Ejercicio: ${Array.isArray(data.exercise) ? data.exercise.join(', ') : data.exercise}\n`;

            // Diet Details
            summary += `\n**Detalles Dieta**\n`;
            if (data.breakfast) summary += `- Desayuno: ${data.breakfast}\n`;
            if (data.dinner) summary += `- Cena: ${data.dinner}\n`;
            if (data.allergies) summary += `- Alergias: ${data.allergies}\n`;
            if (data.mealSchedule) summary += `- Horarios Regulares: ${data.mealSchedule}\n`;
            if (data.mealsPerDay) summary += `- Comidas al día: ${data.mealsPerDay}\n`;
            if (data.eatingHabits) summary += `- Hábitos al comer: ${Array.isArray(data.eatingHabits) ? data.eatingHabits.join(', ') : data.eatingHabits}\n`;
            if (data.supplements) summary += `- Suplementos: ${Array.isArray(data.supplements) ? data.supplements.join(', ') : data.supplements}\n`;

            // Ayurveda Profile
            summary += `\n**Perfil Ayurvédico**\n`;
            if (data.appetite) summary += `- Apetito: ${data.appetite}\n`;
            if (data.weightTendency) summary += `- Tendencia Peso: ${data.weightTendency}\n`;
            if (data.menstruation) summary += `- Menstruación: ${Array.isArray(data.menstruation) ? data.menstruation.join(', ') : data.menstruation}\n`;
            if (data.sweat) summary += `- Sudor: ${data.sweat}\n`;
            if (data.sleep) summary += `- Sueño: ${data.sleep}\n`;
            if (data.temperature) summary += `- Temperatura: ${data.temperature}\n`;

            // Final
            summary += `\n**Administrativo**\n`;
            if (data.professional) summary += `- Profesional Solicitado: ${data.professional}\n`;
            if (data.recordingConsent) summary += `- Grabación Educativa: ${data.recordingConsent}\n`;
            if (data.studentListeners) summary += `- Oyentes Alumnos: ${data.studentListeners}\n`;
            if (data.professionalNotes) summary += `\n**Notas del Profesional**\n${data.professionalNotes.trim()}\n`;

            // Append extra loose fields
            if (data.observations) summary += `\n**Observaciones Adicionales**: ${data.observations}\n`;

            // Symptom Calibrations
            if (data.symptomCalibrations && Object.keys(data.symptomCalibrations).length > 0) {
                summary += `\n**Calibración de Síntomas**\n`;
                const intensityLabels = { 1: 'Suave', 2: 'Moderado', 3: 'Fuerte' };
                for (const [symptom, cal] of Object.entries(data.symptomCalibrations)) {
                    summary += `- ${symptom} → Frecuencia: ${cal.frequency}, Intensidad: ${cal.intensity} (${intensityLabels[cal.intensity] || cal.intensity})\n`;
                }
            }

            return summary;
        };

        const notesContent = formatSummary(body);

        const symptomOptions = Array.isArray(body.symptoms)
            ? body.symptoms.map(s => ({ name: s }))
            : [];

        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                "Nombre Completo ": {
                    title: [
                        { text: { content: body.patientName || 'Paciente Nuevo' } }
                    ]
                },
                "Origen": {
                    select: { name: 'AppForm' }
                },
                ...(body.professional && {
                    [PROFESSIONAL_PROPERTY]: {
                        multi_select: [{ name: body.professional }]
                    }
                }),
                "11. Correo": {
                    rich_text: [{ text: { content: body.email || '' } }]
                },
                "2. Número de celular": {
                    rich_text: [{ text: { content: body.phone || '' } }]
                },
                ...(symptomOptions.length > 0 && {
                    "18. Síntomas  (Selecciona los síntomas que tengas en este momento)": {
                        multi_select: symptomOptions
                    }
                }),
                "23. Describe que es lo que consumes normalmente en la comida. (Menciona la frecuencia con la que consumes cierto alimento: diario, semanal o mensual, también menciona la cantidad: poca, moderado, mucho)": {
                    rich_text: [{ text: { content: body.diet || '' } }]
                },
                "¿En una escala del 1 al 10 cuantas ganas tienes de participar en el diplomado con VEDAMCI para lograr el grado de Consultor en Ayurveda? ": {
                    number: Number(body.commitment) || null
                },
                "Notas": {
                    rich_text: notesContent.match(/[\s\S]{1,2000}/g).map(chunk => ({ text: { content: chunk } }))
                },
                "38. Consentimiento informado": {
                    rich_text: [{ text: { content: body.consent ? "Sí, aceptado." : "No." } }]
                },
                "Proteccion de datos": {
                    checkbox: !!body.dataProtection
                }
            },
        });

        console.log('Success! Entry created properly in Notion.');
        res.json({ success: true, id: response.id });
    } catch (error) {
        console.error('Error creating page in Notion:', error.body || error.message);
        res.status(500).json({ error: error.message });
    }
});

// Public health check — verifies the server is up and the Notion connection works.
// Returns booleans only; never exposes secrets.
app.get('/api/health', async (req, res) => {
    const result = {
        server: 'ok',
        notionConfigured: !!process.env.VITE_NOTION_API_KEY && !!databaseId,
        notionAuth: false,
        notionDatabase: false,
    };
    try {
        const meRes = await fetch('https://api.notion.com/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${process.env.VITE_NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
            },
        });
        result.notionAuth = meRes.ok;

        if (databaseId) {
            const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.VITE_NOTION_API_KEY}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ page_size: 1 }),
            });
            result.notionDatabase = dbRes.ok;
        }
    } catch (err) {
        result.error = err.message;
    }
    const healthy = result.notionAuth && result.notionDatabase;
    res.status(healthy ? 200 : 503).json(result);
});

// Serve static React files in production/packaged mode
if (isPackaged) {
    const distPath = join(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get(/.*/, (req, res) => {
            res.sendFile(join(distPath, 'index.html'));
        });
        console.log(`Serving static files from ${distPath}`);
    } else {
        console.warn(`Static files path not found: ${distPath}`);
    }
}

// Bind to 0.0.0.0 in hosted/production environments (Render, etc.) so the
// platform can route traffic; keep localhost for local dev / Electron.
const listenHost = process.env.HOST || (isPackaged ? '0.0.0.0' : 'localhost');
app.listen(port, listenHost, () => {
    console.log(`Server running on http://${listenHost}:${port}`);
});
