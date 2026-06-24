export const DOSHA_OPTIONS = [
    'Vata-Pitta',
    'Vata',
    'Pitta',
    'Kapha',
    'Pitta-Kapha',
    'Vata-Kapha',
    'Tridoshica',
] as const;

export type DoshaType = typeof DOSHA_OPTIONS[number];

const DOSHA_ALIASES: Array<{ dosha: DoshaType; patterns: string[] }> = [
    { dosha: 'Vata-Pitta', patterns: ['vata-pitta', 'vata pitta', 'vata y pitta', 'vata/pitta'] },
    { dosha: 'Pitta-Kapha', patterns: ['pitta-kapha', 'pitta kapha', 'pitta y kapha', 'pitta/kapha'] },
    { dosha: 'Vata-Kapha', patterns: ['vata-kapha', 'vata kapha', 'vata y kapha', 'vata/kapha'] },
    { dosha: 'Tridoshica', patterns: ['tridoshica', 'tridoshico', 'tridosha', 'vata pitta kapha'] },
    { dosha: 'Vata', patterns: ['vata'] },
    { dosha: 'Pitta', patterns: ['pitta'] },
    { dosha: 'Kapha', patterns: ['kapha'] },
];

const normalize = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

export const inferDoshaFromText = (...texts: Array<string | null | undefined>): DoshaType => {
    for (const text of texts) {
        if (!text) continue;
        const normalized = normalize(text);
        for (const alias of DOSHA_ALIASES) {
            if (alias.patterns.some((pattern) => normalized.includes(pattern))) {
                return alias.dosha;
            }
        }
    }

    return 'Vata-Pitta';
};
