import crypto from 'crypto';

const plainText = (property) => {
    const items = property?.title || property?.rich_text || [];
    return items.map(item => item?.plain_text || item?.text?.content || '').join('').trim();
};

const parseFrequencyIntensity = (value = '') => {
    const numbers = String(value).match(/\d+/g)?.map(Number) || [];
    const frequency = numbers[0] ?? 0;
    const intensity = numbers[1] ?? 0;
    return {
        frequency: frequency === 0 ? 'Superado' : String(frequency),
        intensity: Math.max(0, Math.min(10, intensity))
    };
};

const symptomPoint = (row, symptomName, fallbackNote = '') => {
    const properties = row.properties || {};
    return {
        sourceId: row.id,
        dateTime: row.created_time,
        visitLabel: plainText(properties.VS),
        symptomName,
        note: plainText(properties.Anotaciones) || fallbackNote,
        ...parseFrequencyIntensity(plainText(properties['F/I']))
    };
};

export async function importNotionSymptomHistory({
    notionApiKey,
    sourceDatabaseId,
    targetPatientId,
    readPatientRecord,
    writePatientRecord,
    writeVisitMarkdown,
    fetchImpl = fetch
}) {
    if (!notionApiKey) return { importedVisits: 0, importedPoints: 0 };

    const notionApi = async (path, options = {}) => {
        const response = await fetchImpl(`https://api.notion.com/v1${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Notion respondió ${response.status}`);
        }
        return response.json();
    };

    const listRows = async (databaseId) => {
        const rows = [];
        let startCursor;
        do {
            const data = await notionApi(`/databases/${databaseId}/query`, {
                method: 'POST',
                body: JSON.stringify({ page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) })
            });
            rows.push(...(data.results || []));
            startCursor = data.has_more ? data.next_cursor : undefined;
        } while (startCursor);
        return rows;
    };

    const listBlocks = async (blockId) => {
        const blocks = [];
        let startCursor;
        do {
            const query = new URLSearchParams({ page_size: '100' });
            if (startCursor) query.set('start_cursor', startCursor);
            const data = await notionApi(`/blocks/${blockId}/children?${query}`);
            blocks.push(...(data.results || []));
            startCursor = data.has_more ? data.next_cursor : undefined;
        } while (startCursor);
        return blocks;
    };

    const symptomPages = await listRows(sourceDatabaseId);
    const points = [];

    for (const symptomPage of symptomPages) {
        const properties = symptomPage.properties || {};
        const symptomName = plainText(properties['Síntoma']);
        if (!symptomName || symptomName.toLowerCase().includes('seguimiento de síntomas')) continue;

        const fallbackNote = plainText(properties.Anotaciones);
        const blocks = await listBlocks(symptomPage.id);
        const childPoints = [];

        for (const childDatabase of blocks.filter(block => block.type === 'child_database')) {
            const rows = await listRows(childDatabase.id);
            childPoints.push(...rows.map(row => symptomPoint(row, symptomName, fallbackNote)));
        }
        points.push(...childPoints);

        // Los síntomas agregados entre seguimientos guardan el primer valor en la
        // fila principal. Si ese mismo día ya existe una fila hija, gana la hija.
        const parentPoint = symptomPoint(symptomPage, symptomName, fallbackNote);
        const parentDay = String(parentPoint.dateTime || '').slice(0, 10);
        const duplicatedDay = childPoints.some(point => String(point.dateTime || '').slice(0, 10) === parentDay);
        if (!duplicatedDay) points.push(parentPoint);
    }

    const byDate = new Map();
    for (const point of points.filter(point => point.dateTime)) {
        const date = point.dateTime.slice(0, 10);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(point);
    }

    const record = readPatientRecord(targetPatientId);
    const importedIds = new Set((record.visits || []).flatMap(visit => visit.notionSourceIds || []));
    let importedVisits = 0;
    let importedPoints = 0;

    for (const [date, dayPoints] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const pending = dayPoints.filter(point => !importedIds.has(point.sourceId));
        if (pending.length === 0) continue;

        const symptoms = Object.fromEntries(pending.map(point => [
            point.symptomName,
            {
                frequency: point.frequency,
                intensity: point.intensity,
                ...(point.note ? { note: point.note } : {})
            }
        ]));
        const labels = [...new Set(pending.map(point => point.visitLabel).filter(Boolean))];
        const createdAt = pending.map(point => point.dateTime).sort()[0];
        const visit = {
            id: crypto.randomUUID(),
            title: labels.length ? labels.join(' / ') : `Seguimiento ${date}`,
            date,
            note: '',
            diagnosis: '',
            treatment: '',
            lifestyle: '',
            symptoms,
            herbs: [],
            categories: [],
            recipes: [],
            adherence: {},
            notionSourceIds: pending.map(point => point.sourceId),
            createdAt,
            updatedAt: createdAt
        };
        visit.mdFile = writeVisitMarkdown(targetPatientId, visit);
        record.visits.push(visit);
        importedVisits += 1;
        importedPoints += pending.length;
    }

    if (importedVisits > 0) {
        record.intensityScale = 10;
        writePatientRecord(targetPatientId, record);
    }
    return { importedVisits, importedPoints };
}
