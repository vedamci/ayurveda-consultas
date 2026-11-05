import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

function readCatalogFile(path) {
    try {
        const items = JSON.parse(fs.readFileSync(path, 'utf8') || '[]');
        if (!Array.isArray(items)) throw new Error('Invalid therapy catalog');
        return items;
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

export function createTherapyCatalog({ seedPath, legacyPath, catalogPath }) {
    function read() {
        const persisted = readCatalogFile(catalogPath);
        if (persisted) return persisted;
        const legacy = readCatalogFile(legacyPath) ?? [];
        const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        // The live entry wins. This also keeps IDs already referenced by plans.
        return legacy.some(item => String(item?.id).toLowerCase() === seed.id)
            ? legacy
            : [...legacy, seed];
    }

    function change(transform) {
        const lockPath = catalogPath + '.lock';
        const lock = fs.openSync(lockPath, 'wx', 0o600);
        const temp = catalogPath + '.' + randomUUID() + '.tmp';
        try {
            const updated = transform(read());
            fs.writeFileSync(temp, JSON.stringify(updated, null, 2), { mode: 0o600 });
            fs.renameSync(temp, catalogPath);
            return updated;
        } finally {
            fs.rmSync(temp, { force: true });
            fs.closeSync(lock);
            fs.rmSync(lockPath, { force: true });
        }
    }

    return { read, change };
}
