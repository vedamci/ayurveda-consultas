import fs from 'node:fs';
import path from 'node:path';
import { uuid } from './config.mjs';
import { readJsonFile, containedFile, Unavailable, AccessDenied, requirePatient } from './policy.mjs';

const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const text = (value, limit = 8000) => typeof value === 'string' ? value.slice(0, limit) : '';
const propertyText = (page, prefix, kind) => {
  const entries = Object.entries(page.properties || {}).filter(([key]) => key.trim() === prefix);
  if (entries.length !== 1) throw new Unavailable();
  const values = entries[0][1]?.[kind];
  if (!Array.isArray(values)) throw new Unavailable();
  return values.map(t => t.plain_text || t.text?.content || '').join('');
};

export function createClinicalAdapter({ notionApiKey, databaseId, localDataDir, fetchImpl = fetch }) {
  const database = uuid.parse(databaseId).replaceAll('-', '');
  if (!notionApiKey || !path.isAbsolute(localDataDir)) throw new Error('Private Notion and local data configuration required.');
  async function pageFor(principal, id) {
    requirePatient(principal, id); // Must precede every remote/local read.
    try {
      const response = await fetchImpl(`https://api.notion.com/v1/pages/${id}`, {
        headers: { Authorization: `Bearer ${notionApiKey}`, 'Notion-Version': '2022-06-28' },
        redirect: 'error', signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Unavailable();
      // Bound even upstream failures/data; do not log response bodies or credentials.
      const reader = response.body.getReader();
      let size = 0; const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1048576) throw new Unavailable();
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const page = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (uuid.parse(page.id) !== id || page.archived || page.in_trash ||
          String(page.parent?.database_id || '').replaceAll('-', '') !== database) throw new AccessDenied();
      return page;
    } catch (error) { if (error instanceof AccessDenied) throw error; throw new Unavailable(); }
  }
  const summary = page => ({ patientId: uuid.parse(page.id), name: text(propertyText(page, 'Nombre Completo', 'title'), 200),
    lastEdited: text(page.last_edited_time, 40) });
  function localRecord(principal, id) {
    requirePatient(principal, id);
    // The app maintains patient_folders.json. Never call its read helper: it may
    // create directories, migrate files or rename patient folders during reads.
    const map = readJsonFile(containedFile(localDataDir, 'patient_folders.json'));
    const folder = Object.hasOwn(map, id) ? map[id] : undefined;
    if (typeof folder !== 'string' || !folder || folder === '.' || folder === '..' || /[\\/]/.test(folder)) throw new Unavailable();
    const file = containedFile(localDataDir, path.join('patients', folder, 'records.json'));
    return readJsonFile(file, 2 * 1024 * 1024);
  }
  return {
    async search(principal, query, limit) {
      // Pilot bound: at most 20 explicitly assigned pages, four in flight; no
      // databases/query, directory listing, broad professional filter or cache.
      const matches = [];
      for (let i = 0; i < principal.patientIds.length; i += 4) {
        const pages = await Promise.all(principal.patientIds.slice(i, i + 4).map(id => pageFor(principal, id)));
        for (const page of pages) {
          const item = summary(page);
          if (normalize(item.name).includes(normalize(query))) matches.push(item);
        }
      }
      return { patients: matches.slice(0, limit), hasMore: matches.length > limit };
    },
    async patient(principal, id, section) {
      const page = await pageFor(principal, id);
      if (section === 'summary') return summary(page);
      const notes = propertyText(page, 'Notas', 'rich_text');
      return { patientId: id, notes: text(notes), truncated: notes.length > 8000 };
    },
    async entries(principal, id, kind, offset, limit) {
      await pageFor(principal, id); // Confirm database membership and active page.
      const records = localRecord(principal, id)[kind];
      if (!Array.isArray(records)) throw new Unavailable();
      return { patientId: id, kind, entries: records.slice(offset, offset + limit).map(item => ({
        entryId: uuid.parse(item.id), date: text(item.date, 40), title: text(item.title, 200)
      })), nextOffset: offset + limit < records.length ? offset + limit : null };
    },
    async entry(principal, id, kind, entryId) {
      await pageFor(principal, id);
      const records = localRecord(principal, id)[kind];
      if (!Array.isArray(records)) throw new Unavailable();
      const item = records.find(r => r.id === entryId);
      if (!item) throw new AccessDenied();
      const fields = ['date', 'title', 'note', 'diagnosis', 'treatment', 'lifestyle', 'patientDiagnosis', 'patientTreatment', 'patientLifestyle', 'dosha'];
      const entry = {}; let truncated = false;
      for (const key of fields) if (typeof item[key] === 'string') {
        entry[key] = text(item[key], 4000); truncated ||= item[key].length > 4000;
      }
      // Deliberately excludes files, URLs, contact data, unrelated arrays and AI history.
      return { patientId: id, entryId, kind, entry, truncated };
    }
  };
}
