import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Printer, Plus, Trash2, ChevronDown, Loader2, Sparkles, CheckCircle, AlertCircle, Send, FileText, Salad, Leaf, ClipboardList, Stethoscope, Settings2, Phone, Type, Utensils } from 'lucide-react';

type EditorTabId = 'documento' | 'ia' | 'alimentacion' | 'hierbas' | 'indicaciones';

const EDITOR_TABS: { id: EditorTabId; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
    { id: 'documento', label: 'Documento', icon: FileText },
    { id: 'ia', label: 'IA', icon: Sparkles },
    { id: 'alimentacion', label: 'Comida', icon: Salad },
    { id: 'hierbas', label: 'Hierbas', icon: Leaf },
    { id: 'indicaciones', label: 'Notas', icon: ClipboardList },
];

const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    icon?: React.ComponentType<{ size?: number | string }>;
}> = ({ checked, onChange, label, icon: Icon }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
        <span className={`flex items-center gap-2 text-sm font-medium transition-colors ${checked ? 'text-emerald-700' : 'text-slate-600'}`}>
            {Icon && <Icon size={17} />}
            {label}
        </span>
        <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
        </span>
    </button>
);
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import type { PatientDetail } from '../../types/patient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpeechTextarea } from '../ui/SpeechTextarea';
import { type DoshaType, inferDoshaFromText } from '../../utils/dosha';
import { buildWhatsAppUrl, professionalContact } from '../../utils/whatsapp';

// Import JSON Databases
import kaphaDiet from '../../data/diets/kapha.json';
import pittaKaphaDiet from '../../data/diets/pitta-kapha.json';
import pittaDiet from '../../data/diets/pitta.json';
import tridoshicaDiet from '../../data/diets/tridoshica.json';
import vataKaphaDiet from '../../data/diets/vata-kapha.json';
import vataPittaDiet from '../../data/diets/vata-pitta.json';
import vataDiet from '../../data/diets/vata.json';
import herbsList from '../../data/herb.json';
import recipesList from '../../data/recipes.json';
import lifestyleList from '../../data/lifestyle.json';

interface TreatmentPDFModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: PatientDetail & { id?: string };
    patientId?: string | null;
    initialDiagnosis: string | null;
    editingRecord?: { type: 'plan' | 'visit'; record: any } | null;
}

interface HerbalFormula {
    formula: string;
    dosage: string;
    purpose?: string;
}

const DIET_DATABASES: Record<string, any> = {
    'Vata-Pitta': vataPittaDiet,
    'Vata': vataDiet,
    'Pitta': pittaDiet,
    'Kapha': kaphaDiet,
    'Pitta-Kapha': pittaKaphaDiet,
    'Vata-Kapha': vataKaphaDiet,
    'Tridoshica': tridoshicaDiet
};

const CATEGORY_GUIDELINES: Record<string, string> = {
    'Cereales': `Los cereales se digieren mejor cuando están cocidos, calientes y suaves. Lava el grano antes de cocinarlo y, si es integral, remójalo unas horas para que quede más fácil de digerir. Evita comerlos fríos, secos o muy tostados.`,
    'Lácteos': `Los lácteos son nutritivos pero pesados. Es mejor consumirlos templados o calientes, nunca fríos de la nevera. Acompáñalos con especias como jengibre, cardamomo o canela para mejorar su digestibilidad.`,
    'Endulzantes': `El sabor dulce nutre y calma, pero debe consumirse con moderación. Prefiere endulzantes naturales y menos procesados, evitando el azúcar blanco refinado para no sobrecargar el sistema.`,
    'Aceites': `Los aceites de buena calidad (especialmente el ghee y el aceite de sésamo) lubrican el cuerpo y ayudan a la digestión. Consúmelos siempre cocinados o templados, evitando los aceites fritos o recalentados.`,
    'Frutas': `Las frutas deben comerse solas, preferiblemente maduras y a temperatura ambiente o cocidas (compotas). Evita mezclarlas con lácteos u otras comidas pesadas para prevenir la fermentación y la acumulación de toxinas (ama).`,
    'Hortalizas': `Las hortalizas y verduras son más fáciles de digerir cuando están bien cocidas, salteadas o al vapor con un poco de aceite y especias. Evita las ensaladas y verduras crudas, especialmente por la noche.`,
    'Nueces': `Las nueces y semillas son muy nutritivas pero pesadas. Es ideal remojarlas unas horas, pelarlas (como las almendras) o tostarlas ligeramente antes de consumirlas para facilitar su digestión.`,
    'Carnes': `Si consumes carne, prefiere preparaciones calientes, reconstituyentes y ligeras como caldos o sopas. Evita las carnes pesadas, embutidos o frituras, y consúmelas con moderación.`,
    'Legumbres': `Las legumbres son secas y pueden generar gases. Cocínalas siempre bien suaves, remojándolas previamente, y acompáñalas con especias digestivas como comino, jengibre y una pizca de asafétida.`,
    'Especias': `Las especias son fundamentales para encender el fuego digestivo (agni). Úsalas en la cocción para equilibrar las cualidades de los alimentos, adaptando la cantidad según tu dosha dominante.`,
    'Condimentos': `Los condimentos deben usarse en pequeñas cantidades para realzar el sabor y ayudar a la digestión. Prefiere opciones naturales y evita los condimentos muy procesados o excesivamente picantes y ácidos.`,
    'Bebidas': `Toma bebidas tibias o calientes a lo largo del día. Evita por completo el agua o las bebidas con hielo, especialmente durante las comidas, ya que apagan el fuego digestivo (agni).`
};

const getGuidanceForCategories = (categories: string[], dosha: string) => {
    const dietData = DIET_DATABASES[dosha];
    return categories.map(cat => {
        const baseGuidance = CATEGORY_GUIDELINES[cat] || '';
        const dietCat = dietData?.categorias?.find((c: any) => c.nombre === cat);
        const consejo = dietCat?.consejo;
        if (consejo && consejo.trim()) {
            return `**${cat}**:\n${baseGuidance}\n*Recomendación para ${dosha}:* ${consejo}`;
        }
        return `**${cat}**:\n${baseGuidance}`;
    }).join('\n\n');
};

// Texto introductorio (editable) de la sección "Guía de alimentación saludable" (fix #6).
const HEALTHY_EATING_GUIDE_TEXT = `Estos hábitos te ayudarán a mejorar la digestión y aprovechar mejor los alimentos. Aplícalos poco a poco, con constancia.`;

// Catálogo de hábitos seleccionables para la "Guía de alimentación saludable".
// El profesional elige cuáles incluir, igual que las categorías de alimentos.
const HEALTHY_EATING_HABITS: string[] = [
    'Antes de comer, hacer un agradecimiento o tomar de 3 a 5 respiraciones lentas.',
    'Comer en un ambiente tranquilo, sin pantallas, lectura ni distracciones.',
    'Evitar conversaciones excesivas o emocionalmente intensas durante la comida.',
    'Masticar bien los alimentos y comer con atención plena.',
    'Comer a un ritmo moderado, sin prisa.',
    'Comer hasta sentirse satisfecho, aproximadamente al 75% de la capacidad.',
    'Después de comer, reposar de 15 a 20 minutos antes de pasar a otra actividad.',
    'Beber poco líquido durante las comidas, de preferencia agua tibia o a temperatura ambiente, evitando bebidas frías durante el día y especialmente al comer.',
    'Hacer la comida principal alrededor del mediodía.',
    'Comer más ligero por la mañana y por la tarde/noche.',
    'Dejar pasar aproximadamente tres horas entre comidas.',
    'Comer alimentos preparados con amor, calma y buena intención.'
];

const DIGESTIVE_RECOVERY_TEXT = `# Recetas de Sopas y Arroces

## Agua de Arroz
El agua de arroz es el alimento más fácil de digerir. Cocina en agua arroz basmati con una pizca de sal y semillas de hinojo y comino. Cuela el arroz y bebe el agua.

## Sopa de Arroz
Este alimento es de los más fáciles de digerir. Para prepararlo, hierve arroz basmati en agua junto con una pizca de sal de roca o marina, más una cucharadita de semillas de hinojo y de comino.

Comienza con ½ taza de arroz y ponla a hervir en 7 tazas de agua. Luego cocina a fuego lento por aproximadamente 1 hora. Después, cuela el arroz y las semillas.

Lo que vas a beber es solo el agua. Tómala una taza a la vez, siguiendo la recomendación de tu profesional.

## Sopa de Arroz Espesa
Prepara la sopa de arroz como en la receta anterior, pero usa 1/2 taza de arroz y 2 tazas de agua. Añade sal y polvos de jengibre, cúrcuma, comino, cilantro e hinojo.

## Sopa de Mungo
Prepara la sopa mungo con frijol pelado partido en mitades y 6 tazas de agua por cada taza de mungo. Añade especias como en la sopa de arroz espesa.

## Arroz Cocinado
Prepara arroz de forma tradicional, cocinando 1 taza de arroz basmati con 2 tazas de agua y especias como en la sopa de arroz espesa.

## Kitchari
El kitchari es una mezcla de frijol mungo partido y arroz basmati. Prepáralo con cantidades variables de agua para variar su consistencia y facilitar la digestión.

## Sopa de Carne
La sopa de carne se prepara hirviendo carne y huesos, colándolos, y dejando solo el caldo. Añade especias como en las recetas anteriores. Aunque Ayurveda prefiere la comida vegetariana, para efectos de sanación, las sopas de carne son aceptables.

# Receta de Sopa de Carne

## Ingredientes
- Carne y huesos (la cantidad depende de cuánto caldo quieras hacer)
- Especias (como jengibre, cúrcuma, comino, cilantro e hinojo)
- Agua
- Sal al gusto

## Instrucciones
1. Coloca la carne y los huesos en una olla grande.
2. Añade agua hasta que la carne y los huesos estén completamente cubiertos.
3. Lleva el agua a ebullición y luego reduce el fuego a medio/bajo para que la mezcla hierva a fuego lento.
4. Deja que la carne y los huesos se cuezan durante varias horas. Cuanto más tiempo se cuezan, más sabor tendrá el caldo.
5. Una vez que la carne esté bien cocida y el caldo tenga un buen sabor, cuela la mezcla para eliminar la carne y los huesos. Deberías quedarte solo con el caldo.
6. Añade las especias y la sal al caldo. Puedes ajustar la cantidad según tu gusto.
7. Deja que el caldo hierva a fuego lento durante unos minutos más para que las especias se mezclen bien.
8. Sirve caliente y disfruta de una nutritiva sopa de carne.`;

const DEFAULT_FOOD_CATEGORIES = ['Cereales', 'Hortalizas'];
const MAX_FOOD_CATEGORIES = 12;
const PDF_TARGET_DPI = 300;
const MM_PER_INCH = 25.4;
const A4_WIDTH_MM = 210;
const PDF_PIXEL_RATIO = 2;
const PDF_RENDER_STAGE_ID = 'pdf-render-stage';

const waitForBrowserPaint = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
    });
});

const yieldToMainThread = (delay = 35) => new Promise<void>(resolve => {
    window.setTimeout(resolve, delay);
});

const createPdfRenderStage = () => {
    const existing = document.getElementById(PDF_RENDER_STAGE_ID);
    if (existing) {
        existing.remove();
    }

    const stage = document.createElement('div');
    stage.id = PDF_RENDER_STAGE_ID;
    stage.style.position = 'fixed';
    stage.style.left = '-10000px';
    stage.style.top = '0';
    stage.style.width = '210mm';
    stage.style.height = '297mm';
    stage.style.overflow = 'hidden';
    stage.style.background = '#ffffff';
    stage.style.pointerEvents = 'none';
    stage.style.zIndex = '-1';
    document.body.appendChild(stage);
    return stage;
};

const normalizeFoodCategories = (categories?: string[]) => {
    const cleanCategories = (categories || []).filter(Boolean);
    const uniqueCategories = Array.from(new Set(cleanCategories));
    return uniqueCategories.slice(0, MAX_FOOD_CATEGORIES);
};

const normalizeReuseName = (value = '') => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getTreatmentRecordDate = (record: any) => record.visitDate || record.date || record.updatedAt || record.createdAt || '';

const getPatientTreatmentHistory = (patient: PatientDetail, currentRecordId?: string) => {
    const categoryMap = new Map<string, { name: string; count: number; lastDate: string; lastStatus?: string }>();
    const herbMap = new Map<string, { name: string; count: number; lastDate: string; lastStatus?: string }>();
    const records = [
        ...(patient.treatmentPlans || []),
        ...(patient.visits || [])
    ].filter(record => record.id !== currentRecordId);

    const touch = (
        map: typeof categoryMap,
        name: string,
        date: string,
        status?: string
    ) => {
        const key = normalizeReuseName(name);
        if (!key) return;
        const existing = map.get(key) || { name, count: 0, lastDate: '', lastStatus: undefined };
        existing.count += 1;
        if (!existing.lastDate || new Date(date).getTime() >= new Date(existing.lastDate).getTime()) {
            existing.lastDate = date;
            existing.lastStatus = status;
        }
        map.set(key, existing);
    };

    records.forEach((record: any) => {
        const date = getTreatmentRecordDate(record);
        (record.categories || []).forEach((name: string) => {
            const status = (record.adherence?.categories || []).find((item: any) => normalizeReuseName(item.name) === normalizeReuseName(name))?.status;
            touch(categoryMap, name, date, status);
        });
        (record.herbs || []).forEach((herb: any) => {
            const status = (record.adherence?.herbs || []).find((item: any) => normalizeReuseName(item.name) === normalizeReuseName(herb.formula))?.status;
            touch(herbMap, herb.formula, date, status);
        });
    });

    return {
        categories: Array.from(categoryMap.values()),
        herbs: Array.from(herbMap.values())
    };
};

const getLatestTreatmentCategories = (patient: PatientDetail) => {
    const records = [
        ...(patient.treatmentPlans || []),
        ...(patient.visits || [])
    ]
        .filter((record: any) => Array.isArray(record.categories) && record.categories.length > 0)
        .sort((a: any, b: any) => new Date(getTreatmentRecordDate(b)).getTime() - new Date(getTreatmentRecordDate(a)).getTime());

    return normalizeFoodCategories(records[0]?.categories || []);
};

// Fix #3: devuelve las fórmulas herbales del último tratamiento/visita que tenga
// fórmulas, para reutilizarlas automáticamente en la visita de seguimiento y no
// tener que recapturarlas. Conserva fórmula + dosis (+ purpose/instruction si existen).
const getLatestTreatmentHerbs = (patient: PatientDetail): HerbalFormula[] => {
    const records = [
        ...(patient.treatmentPlans || []),
        ...(patient.visits || [])
    ]
        .filter((record: any) => Array.isArray(record.herbs) && record.herbs.length > 0)
        .sort((a: any, b: any) => new Date(getTreatmentRecordDate(b)).getTime() - new Date(getTreatmentRecordDate(a)).getTime());

    return ((records[0]?.herbs as any[]) || []).map((herb: any) => ({ ...herb }));
};

const formatReuseDate = (date?: string) => {
    if (!date) return 'fecha no registrada';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAdherenceStatus = (status?: string) => {
    if (status === 'done') return 'hecho';
    if (status === 'partial') return 'parcial';
    if (status === 'not_done') return 'no hecho';
    return 'sin revisar';
};

const getLatestLocalDiagnosis = (patient: PatientDetail) => {
    const records = [
        ...(patient.treatmentPlans || []),
        ...(patient.visits || [])
    ].filter(record => record.diagnosis?.trim());

    records.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || a.date || '').getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || b.date || '').getTime();
        return dateB - dateA;
    });

    return records[0]?.diagnosis || '';
};

const stripMarkdownForPatient = (text: string) => text
     .replace(/\|.*\|/g, ' ')
     .replace(/^#{1,6}\s+/gm, '')
     .replace(/[*_`>~-]/g, '')
     .replace(/\s+/g, ' ')
     .trim();

const getHerbParts = (h: HerbalFormula) => {
    let dosage = h.dosage || '';
    let purpose = h.purpose || '';
    
    if (!purpose && dosage.includes('Para qué sirve:')) {
        const parts = dosage.split(/Para qué sirve:\s*/);
        dosage = parts[0].trim();
        purpose = parts[1]?.trim() || '';
    }
    
    return { dosage, purpose };
};

const estimateHerbalFormulaRowLines = (h: HerbalFormula) => {
    const { dosage, purpose } = getHerbParts(h);
    const countWrappedLines = (text: string, charsPerLine: number) => {
        const explicitLines = (text || '').split('\n');
        return explicitLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / charsPerLine)), 0);
    };

    return Math.max(
        countWrappedLines(h.formula || '', 18),
        countWrappedLines(dosage, 28),
        countWrappedLines(purpose, 42)
    ) + 1;
};

const chunkHerbalFormulasForPrint = (items: HerbalFormula[], pdfFontSize: string) => {
    const maxLines = pdfFontSize === 'sm' ? 40 : pdfFontSize === 'base' ? 36 : pdfFontSize === 'lg' ? 31 : 26;
    const chunks: HerbalFormula[][] = [];
    let current: HerbalFormula[] = [];
    let currentLines = 0;

    items.forEach(item => {
        const rowLines = estimateHerbalFormulaRowLines(item);
        const needsExtraBreathingRoom = rowLines >= 16;
        if (current.length > 0 && currentLines + rowLines + (needsExtraBreathingRoom ? 1 : 0) > maxLines) {
            chunks.push(current);
            current = [];
            currentLines = 0;
        }

        current.push(item);
        currentLines += rowLines;
    });

    if (current.length > 0) chunks.push(current);
    return chunks;
};
 
 const buildPatientDiagnosisFallback = (diagnosis: string, dosha: string) => {
     const clean = stripMarkdownForPatient(diagnosis);
     if (!clean) {
         return `En tu evaluación observamos una tendencia principal de ${dosha}. El tratamiento buscará acompañar al cuerpo de forma gradual, sencilla y constante.`;
     }
 
     const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
     const summary = sentences.slice(0, 2).join(' ').trim();
     return `En tu evaluación observamos una tendencia principal de ${dosha}. ${summary}`;
 };
 
 const buildPatientTreatmentFallback = (treatment: string) => {
     const clean = stripMarkdownForPatient(treatment);
     if (!clean) return '';
 
     const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
     return sentences.slice(0, 4).join(' ').trim();
 };
 
 const removeHerbalFormulaItems = (text: string) => text
     .split('\n')
     .filter(line => {
         const normalized = line
             .toLowerCase()
             .normalize('NFD')
             .replace(/[\u0300-\u036f]/g, '');
 
         return !/^\s*[-*]\s*(\*\*)?\s*formulas?\s+herbales?/.test(normalized)
             && !/^\s*[-*]\s*(\*\*)?\s*formula\s+herbal/.test(normalized);
     })
     .join('\n')
     .replace(/\n{3,}/g, '\n\n')
     .trim();
 
 const updateCategoriesInText = (text: string, categories: string[]) => {
     const categoriesStr = categories.join(', ');
     const prefix = `**Categorías de comida seleccionadas:** ${categoriesStr}`;
     
     // Regular expression to find any line that starts with "**Categorías"
     const regex = /^\*\*Categorías(?: de comida)? seleccionadas:\*\*.*$/mi;
     
     if (regex.test(text)) {
         return text.replace(regex, prefix);
     } else {
         // If not found, prepend it
         if (!text.trim()) {
             return prefix;
         }
         return `${prefix}\n\n${text}`;
     }
 };
 
 const getLineCapacity = (fontSize: string): number => {
    switch (fontSize) {
        case 'sm': return 100;
        case 'base': return 85;
        case 'lg': return 73;
        case 'xl': return 65;
        default: return 85;
    }
};

const getWeight = (text: string, fontSize: string): number => {
    if (!text) return 0;
    const lineCapacity = getLineCapacity(fontSize);
    const lines = text.split('\n');
    let weight = 0;
    for (const line of lines) {
        const lineLen = line.length;
        const visualLines = Math.max(1, Math.ceil(lineLen / lineCapacity));
        weight += visualLines * lineCapacity;
    }
    return weight;
};

const splitOversizedParagraph = (paragraph: string, maxLength: number, fontSize: string): string[] => {
    if (getWeight(paragraph, fontSize) <= maxLength) return [paragraph];

    const chunks: string[] = [];
    let remaining = paragraph.trim();
    const lineCapacity = getLineCapacity(fontSize);
    const maxChars = Math.floor((maxLength / lineCapacity) * lineCapacity);

    while (getWeight(remaining, fontSize) > maxLength) {
        const slice = remaining.slice(0, maxChars);
        const breakIndex = Math.max(
            slice.lastIndexOf('. '),
            slice.lastIndexOf('? '),
            slice.lastIndexOf('! '),
            slice.lastIndexOf('; '),
            slice.lastIndexOf(', '),
            slice.lastIndexOf(' ')
        );
        const cutAt = breakIndex > Math.floor(maxChars * 0.45) ? breakIndex + 1 : maxChars;
        chunks.push(remaining.slice(0, cutAt).trim());
        remaining = remaining.slice(cutAt).trim();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
};

const isMarkdownSubheading = (paragraph: string) => {
    const clean = paragraph.trim();
    if (!clean) return false;
    return /^#{1,6}\s+\S/.test(clean) || /^\*\*[^*]{2,120}\*\*:?\s*$/.test(clean);
};

const RECIPE_SECTION_TITLES = new Set(['Datos de la receta', 'Ingredientes', 'Preparación', 'Comentarios']);
const isRecipeSectionTitle = (paragraph: string) => RECIPE_SECTION_TITLES.has(paragraph.trim());

const isMarkdownDivider = (paragraph: string) => /^-{3,}$/.test(paragraph.trim());

const findNextNonEmptyParagraphIndex = (paragraphs: string[], startIndex: number) => {
    for (let i = startIndex; i < paragraphs.length; i++) {
        if (paragraphs[i].trim()) return i;
    }
    return -1;
};

const buildPaginationBlocks = (text: string, maxLength: number, fontSize: string): string[] => {
    const rawParagraphs = text.split('\n');
    const blocks: string[] = [];

    for (let i = 0; i < rawParagraphs.length; i++) {
        const paragraph = rawParagraphs[i];
        const nextIndex = findNextNonEmptyParagraphIndex(rawParagraphs, i + 1);

        if (isMarkdownDivider(paragraph) && nextIndex !== -1 && isMarkdownSubheading(rawParagraphs[nextIndex])) {
            const afterHeadingIndex = findNextNonEmptyParagraphIndex(rawParagraphs, nextIndex + 1);
            if (afterHeadingIndex !== -1) {
                blocks.push(rawParagraphs.slice(i, afterHeadingIndex + 1).join('\n'));
                i = afterHeadingIndex;
                continue;
            }
        }

       if ((isMarkdownSubheading(paragraph) || isRecipeSectionTitle(paragraph)) && nextIndex !== -1) {
            blocks.push(rawParagraphs.slice(i, nextIndex + 1).join('\n'));
            i = nextIndex;
            continue;
        }

        blocks.push(paragraph);
    }

    return blocks.flatMap(block => splitOversizedParagraph(block, maxLength, fontSize));
};

// Helper function to split text into pages by paragraph to avoid A4 page overflow
const paginateParagraphs = (text: string, firstPageMax: number, nextPageMax: number, fontSize: string = 'base'): string[] => {
    const hardParagraphLimit = Math.min(firstPageMax, nextPageMax);
    const paragraphs = buildPaginationBlocks(text, hardParagraphLimit, fontSize);
    const pages: string[] = [];
    let currentPage = '';
    let isFirstPage = true;
    
    for (const paragraph of paragraphs) {
        const limit = isFirstPage ? firstPageMax : nextPageMax;
        if (currentPage && (getWeight(currentPage, fontSize) + getWeight(paragraph, fontSize) > limit)) {
            pages.push(currentPage.trim());
            currentPage = paragraph;
            isFirstPage = false;
        } else {
            currentPage = currentPage ? currentPage + '\n' + paragraph : paragraph;
        }
    }
    if (currentPage) {
        pages.push(currentPage.trim());
    }
    return pages;
};

// ============================================================================
// PAGINACIÓN POR MEDICIÓN REAL DE ALTURA (DOM)
// ----------------------------------------------------------------------------
// Reemplaza el reparto por conteo de caracteres (getWeight/paginateParagraphs),
// que provocaba páginas medio vacías o contenido cortado porque el conteo de
// caracteres no predice el alto real (tablas, listas, párrafos largos ocupan
// distinto). Aquí se mide el alto real de cada bloque renderizado dentro del
// contexto de estilos de #pdf-content y se empaquetan páginas por altura.
// La red de seguridad "escala-para-caber" de generatePdfDocument garantiza
// además que ninguna página se corte aunque la estimación quede algo corta.
// Si la medición no es posible (DOM no montado), se cae al método anterior.
// ============================================================================
const PDF_CONTENT_WIDTH_MM = 170;        // 210 − 2×20mm de padding lateral
const PDF_USABLE_HEIGHT_MM = 218;        // alto útil de secciones de texto
const PDF_DIET_USABLE_HEIGHT_MM = 208;   // alto útil de páginas de tablas dietéticas

// Clase representativa del cuerpo markdown en el PDF, para que la medición
// herede los tamaños de fuente reales (gobernados por CSS scoped a #pdf-content).
const MEASURE_WRAPPER_CLASS =
    'text-[11.5px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none ' +
    'prose-p:text-[#334155] prose-p:my-1.5 prose-strong:text-slate-900 prose-em:text-[#475569] ' +
    'prose-h1:text-[13px] prose-h1:font-bold prose-h2:text-[11.5px] prose-h2:font-bold ' +
    'prose-ul:my-1 prose-li:my-0.5 pdf-base-text';

// Divide markdown en bloques atómicos separados por líneas en blanco.
// Mantiene las tablas y encabezados con su contenido sin partirlos.
const buildAtomicBlocks = (text: string): string[] => {
    const lines = (text || '').split('\n');
    const blocks: string[] = [];
    let cur: string[] = [];
    const flush = () => {
        if (cur.join('\n').trim()) blocks.push(cur.join('\n'));
        cur = [];
    };
    for (const line of lines) {
        if (line.trim() === '') flush();
        else cur.push(line);
    }
    flush();
    return blocks;
};

// Píxeles reales por milímetro en este dispositivo/zoom.
const getPxPerMm = (): number => {
    if (typeof document === 'undefined') return 96 / 25.4;
    const probe = document.createElement('div');
    probe.style.cssText = 'width:100mm;position:absolute;visibility:hidden;left:-99999px;top:0;';
    document.body.appendChild(probe);
    const px = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return px > 0 ? px : 96 / 25.4;
};

// Mide el alto real (px) de cada bloque renderizado como markdown, dentro del
// contexto de estilos de #pdf-content para que coincida con el PDF final.
const measureMarkdownBlockHeights = (blocks: string[], wrapperClass: string): number[] | null => {
    if (typeof document === 'undefined') return null;
    const host = document.getElementById('pdf-content');
    if (!host || blocks.length === 0) return null;
    const measurer = document.createElement('div');
    measurer.style.cssText =
        `position:absolute;left:-99999px;top:0;width:${PDF_CONTENT_WIDTH_MM}mm;visibility:hidden;pointer-events:none;`;
    const cells: HTMLElement[] = [];
    for (const b of blocks) {
        const cell = document.createElement('div');
        cell.className = wrapperClass;
        cell.style.display = 'flow-root'; // contiene los márgenes internos al medir
        try {
            cell.innerHTML = renderToStaticMarkup(
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{b}</ReactMarkdown>
            );
        } catch {
            cell.textContent = b;
        }
        measurer.appendChild(cell);
        cells.push(cell);
    }
    host.appendChild(measurer);
    let heights: number[] | null;
    try {
        heights = cells.map(c => c.getBoundingClientRect().height);
    } catch {
        heights = null;
    }
    measurer.remove();
    return heights;
};

// Empaqueta bloques en páginas según su alto medido (no por caracteres).
const packBlocksByHeight = (
    blocks: string[], heights: number[], usablePx: number, gapPx: number
): string[] => {
    const pages: string[] = [];
    let cur: string[] = [];
    let curH = 0;
    for (let i = 0; i < blocks.length; i++) {
        const h = (heights[i] || 0) + gapPx;
        if (cur.length > 0 && curH + h > usablePx) {
            pages.push(cur.join('\n\n'));
            cur = [];
            curH = 0;
        }
        cur.push(blocks[i]);
        curH += h;
    }
    if (cur.length > 0) pages.push(cur.join('\n\n'));
    return pages.length > 0 ? pages : [''];
};

// Detecta la línea separadora de una tabla markdown, p. ej. | --- | :--: |.
const isTableSeparatorLine = (line: string): boolean => {
    const t = (line || '').trim();
    if (!t.includes('-')) return false;
    return /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(t);
};

// Parsea un bloque que contiene una tabla markdown. Devuelve el texto previo
// (p. ej. un encabezado pegado a la tabla), la fila de cabecera, el separador
// y las filas de cuerpo. Devuelve null si el bloque no es una tabla.
const parseTableBlock = (
    block: string
): { pre: string[]; header: string; sep: string; rows: string[] } | null => {
    const lines = block.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].includes('|') && isTableSeparatorLine(lines[i + 1])) {
            return {
                pre: lines.slice(0, i),
                header: lines[i],
                sep: lines[i + 1],
                rows: lines.slice(i + 2).filter(l => l.trim() !== ''),
            };
        }
    }
    return null;
};

// Parte un bloque más alto que la página para que NUNCA lo recorte overflow-hidden.
// - Tablas: se reparten por filas, repitiendo la cabecera en cada parte.
// - Otros bloques largos: se reparten por líneas.
// Cada parte candidata se mide en vivo para garantizar que cabe.
const splitOversizedBlock = (
    block: string, usablePx: number, wrapperClass: string
): string[] => {
    const measure = (s: string): number =>
        measureMarkdownBlockHeights([s], wrapperClass)?.[0] ?? Infinity;

    const table = parseTableBlock(block);
    if (table && table.rows.length > 1) {
        const { pre, header, sep, rows } = table;
        const preTxt = pre.join('\n').trim();
        const build = (rws: string[], first: boolean): string =>
            (first && preTxt ? preTxt + '\n' : '') + [header, sep, ...rws].join('\n');
        const chunks: string[] = [];
        let curRows: string[] = [];
        for (const row of rows) {
            const trial = [...curRows, row];
            if (curRows.length > 0 && measure(build(trial, chunks.length === 0)) > usablePx) {
                chunks.push(build(curRows, chunks.length === 0));
                curRows = [row];
            } else {
                curRows = trial;
            }
        }
        if (curRows.length > 0) chunks.push(build(curRows, chunks.length === 0));
        if (chunks.length > 0) return chunks;
    }

    // Bloque no-tabla (o tabla no parseable): repartir por líneas.
    const lines = block.split('\n').filter(l => l.trim() !== '');
    if (lines.length <= 1) return [block];
    const chunks: string[] = [];
    let cur: string[] = [];
    for (const line of lines) {
        const trial = [...cur, line];
        if (cur.length > 0 && measure(trial.join('\n')) > usablePx) {
            chunks.push(cur.join('\n'));
            cur = [line];
        } else {
            cur = trial;
        }
    }
    if (cur.length > 0) chunks.push(cur.join('\n'));
    return chunks.length > 0 ? chunks : [block];
};

// Paginación medida con respaldo automático al método por caracteres.
const measuredPaginate = (
    text: string, wrapperClass: string, usableHeightMm: number, fallback: () => string[]
): string[] => {
    const clean = (text || '').trim();
    if (!clean) return [''];
    const blocks = buildAtomicBlocks(clean);
    const heights = measureMarkdownBlockHeights(blocks, wrapperClass);
    if (!heights || heights.length !== blocks.length || heights.some(h => !isFinite(h))) {
        return fallback();
    }
    const total = heights.reduce((a, b) => a + b, 0);
    if (total <= 0) return fallback();
    const usablePx = usableHeightMm * getPxPerMm();

    // Si algún bloque (típicamente una tabla larga) supera el alto de página, se
    // subdivide para que ninguna parte quede recortada. Margen del 4% para
    // absorber pequeñas diferencias entre la medición y el render final.
    const splitLimitPx = usablePx * 0.96;
    const finalBlocks: string[] = [];
    let didSplit = false;
    for (let i = 0; i < blocks.length; i++) {
        if ((heights[i] || 0) > splitLimitPx) {
            const parts = splitOversizedBlock(blocks[i], splitLimitPx, wrapperClass);
            finalBlocks.push(...parts);
            if (parts.length > 1) didSplit = true;
        } else {
            finalBlocks.push(blocks[i]);
        }
    }

    if (!didSplit) {
        return packBlocksByHeight(blocks, heights, usablePx, 8);
    }
    const finalHeights = measureMarkdownBlockHeights(finalBlocks, wrapperClass);
    if (!finalHeights || finalHeights.length !== finalBlocks.length || finalHeights.some(h => !isFinite(h))) {
        return packBlocksByHeight(blocks, heights, usablePx, 8);
    }
    return packBlocksByHeight(finalBlocks, finalHeights, usablePx, 8);
};

// Mide el alto real de cada tarjeta de categoría dietética (cabecera + tabla
// de 3 columnas) replicando su estructura dentro del contexto de #pdf-content.
const measureCategoryCardHeights = (cats: any[]): number[] | null => {
    if (typeof document === 'undefined') return null;
    const host = document.getElementById('pdf-content');
    if (!host || !cats || cats.length === 0) return null;
    const measurer = document.createElement('div');
    measurer.style.cssText =
        `position:absolute;left:-99999px;top:0;width:${PDF_CONTENT_WIDTH_MM}mm;visibility:hidden;pointer-events:none;`;
    const cells: HTMLElement[] = [];
    const esc = (s: string) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const cat of cats) {
        const mejor = ((cat.mejor || []) as string[]).join(', ') || '—';
        const mod = (((cat.pequenas_cantidades || cat.moderacion) || []) as string[]).join(', ') || '—';
        const evitar = ((cat.evitar || []) as string[]).join(', ') || '—';
        const cell = document.createElement('div');
        cell.style.display = 'flow-root';
        cell.style.marginBottom = '24px'; // equivalente a space-y-6 entre tarjetas
        cell.innerHTML =
            `<div class="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                <div class="bg-[#f8fafc] border-b border-[#e2e8f0] px-4 py-2.5">
                    <span class="text-[13px] font-bold font-sans text-[#334155] pdf-base-text">Categoría — ${esc(cat.nombre)}</span>
                    ${cat.consejo ? `<div class="text-[10px] text-[#475569] font-sans italic pdf-subtitle">${esc(cat.consejo)}</div>` : ''}
                </div>
                <table class="w-full text-[12px] font-sans" style="table-layout:fixed">
                    <thead><tr>
                        <th class="px-4 py-2 text-left pdf-meta" style="width:33.33%">MEJOR</th>
                        <th class="px-4 py-2 text-left pdf-meta" style="width:33.33%">MODERACIÓN</th>
                        <th class="px-4 py-2 text-left pdf-meta" style="width:33.33%">EVITAR</th>
                    </tr></thead>
                    <tbody><tr style="vertical-align:top">
                        <td class="px-4 py-3 text-[11.5px] pdf-base-text" style="width:33.33%">${esc(mejor)}</td>
                        <td class="px-4 py-3 text-[11.5px] pdf-base-text" style="width:33.33%">${esc(mod)}</td>
                        <td class="px-4 py-3 text-[11.5px] pdf-base-text" style="width:33.33%">${esc(evitar)}</td>
                    </tr></tbody>
                </table>
            </div>`;
        measurer.appendChild(cell);
        cells.push(cell);
    }
    host.appendChild(measurer);
    let heights: number[] | null;
    try {
        heights = cells.map(c => c.getBoundingClientRect().height);
    } catch {
        heights = null;
    }
    measurer.remove();
    return heights;
};

// Empaqueta categorías dietéticas en páginas según su alto medido.
const packCategoriesByHeight = (cats: any[], heights: number[], usablePx: number): any[][] => {
    const pages: any[][] = [];
    let cur: any[] = [];
    let curH = 0;
    for (let i = 0; i < cats.length; i++) {
        const h = heights[i] || 0;
        if (cur.length > 0 && curH + h > usablePx) {
            pages.push(cur);
            cur = [];
            curH = 0;
        }
        cur.push(cats[i]);
        curH += h;
    }
    if (cur.length > 0) pages.push(cur);
    return pages.length > 0 ? pages : [cats];
};

 const normalizeRecipeOcrText = (text: string) => text
     .replace(/\b(\d+)-(\d)\s+(\d)\b/g, '$1-$2$3')
     .replace(/\b(\d+)\.\s+(\d+)\b/g, '$1.$2')
     .replace(/\b1\s*\/\s*3\b/g, '⅓')
     .replace(/\b1\s*\/\s*2\b/g, '½')
     .replace(/\b1\s*\/\s*4\b/g, '¼')
     .replace(/\b3\s*\/\s*4\b/g, '¾')
     .replace(/\b1\s*\/\s*8\b/g, '⅛')
     .replace(/\b[Iil]\s*(?=(?:[0O]\b|\d|[¼½¾⅛⅓⅔]|a\s+\d|hora|taza|cucharadita|cucharada|litro|manojo|diente|chile|banano|papa|pimiento|hoja|huevo))/g, '1')
     .replace(/\b1\s*[O0]\b/g, '10')
     .replace(/\b(\d)(?=(tazas?|cucharaditas?|cucharadas?|litros?|manojos?|dientes?|chiles?|bananos?|papas?|pimientos?|hojas?|huevos?))/gi, '$1 ')
     .replace(/\b([0-9])\s+([0-9])(?=\s*°C\b)/g, '$1$2')
     .replace(/\s+/g, ' ')
     .trim();

 const DOSHA_MARKER_PATTERN = /(?:^|[\s,])(?:[+\-O0]\s*(?:ligero|leve|moderado)?\s*(?:Vata|Pitta|Kapha)(?:['"])?|(?:Vata|Pitta|Kapha)(?=\s*,))/gi;
 const FIRST_PREPARATION_STEP = /\b(Ponga|Pique|Agregue|Añada|Anada|Mezcle|Licue|Lave|Caliente|Coloque|Corte|Bata|Remoje|Sirva|Precaliente|Pre-caliente|Derrita|Triture|Cocine|Hornee|Hierva|Escurra|Retire|Muela|Muele|Combine|Combina|Haga|Haz|Ruede|Rueda|Vierta|Vierte|Dore|Dora|Tape|Tapa|Reduzca|Reduce|Revuelva|Revuelve|Ase|Asa|Espolvoree|Espolvorea|Guarde|Guarda)\b/i;
 const INGREDIENT_START_PATTERN = /(?<![\d.])(?=(?:\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?|[¼½¾⅛⅓⅔]|\d+\s+[¼½¾⅛⅓⅔])(?:\s+(?:a|o)\s+(?:\d+(?:[.,]\d+)?|[¼½¾⅛⅓⅔]))?\s+(?:tazas?|cucharaditas?|cucharadas?|litros?|manojos?|dientes?|chiles?|bananos?|papas?|pimientos?|hojas?|huevos?|g|kg|cm|astillas?|granos?|vaina|vainas|mel[oó]n|tomates?|zanahorias?|alverjas?|higos?|datiles?|dátiles?|bolitas?))/gi;

 function cleanRecipeIngredientItem(item: string) {
     return cleanSpanishRecipeOcrText(item
         .replace(/^\s*(?:Ingredientes?:|[-•])\s*/iu, '')
         .replace(/^\s*,\s*/u, '')
         .replace(/\s+Guarnici[oó]n:.*$/iu, '')
         .replace(/\s*Preparaci[oó]n:\s*(?:\d+\.)?\s*$/iu, '')
         .replace(/\s*Comentarios?:\s*$/iu, '')
         .replace(/\s*•\s*$/u, '')
         .replace(/\s+/g, ' ')
         .trim());
 }

 function repairStructuredIngredientItems(items: string[]) {
     const repaired: string[] = [];

     for (let i = 0; i < items.length; i++) {
         let item = items[i];

         if (/\(\s*$/u.test(item)) {
             const fragments: string[] = [];
             while (i + 1 < items.length) {
                 fragments.push(items[++i]);
                 if (/\)/u.test(items[i])) break;
             }
             const amount = fragments.join(' ').replace(/[()]/g, '').replace(/\s+/g, '').replace(/(?<=\d)(?=g\b)/iu, ' ');
             item = item.replace(/\(\s*$/u, amount ? `, aproximadamente ${amount}` : '');
         }

         const trailingRangeStart = item.match(/^(.*\S)\s+((?:\d+(?:[.,]\d+)?|[¼½¾⅛⅓⅔])\s*)[-–]\s*$/u);
         if (trailingRangeStart) {
             repaired.push(trailingRangeStart[1]);
             item = `${trailingRangeStart[2].trim()} -`;
         }

         if (/\s[-–]\s*$/u.test(item) && i + 1 < items.length) {
             const next = items[++i].replace(/^\s*(?:I|l)\b/u, '1').trim();
             item = `${item.replace(/\s[-–]\s*$/u, '')} a ${next}`;
         }

         repaired.push(item);
     }

     return repaired;
 }

 function normalizeRecipeIngredientItems(ingredients: string | string[]) {
     const sourceItems = Array.isArray(ingredients)
         ? repairStructuredIngredientItems(ingredients.map(item => normalizeRecipeOcrText(item || '')))
         : null;
     const source: string = sourceItems ? sourceItems.join('\n') : (typeof ingredients === 'string' ? ingredients : '');
     const cleanSource = (sourceItems ? source : normalizeRecipeOcrText(source))
         .replace(/\s*Preparaci[oó]n:\s*(?:\d+\.)?\s*$/iu, '')
         .replace(/^\s*Ingredientes?:\s*/iu, '')
         .replace(/\s+Guarnici[oó]n:.*$/iu, '')
         .replace(/\s*•\s*/g, '\n')
         .trim();

     const items: string[] = (cleanSource.includes('\n')
         ? cleanSource.split(/\n+/)
         : cleanSource.split(INGREDIENT_START_PATTERN)
     )
         .map((item: string) => cleanRecipeIngredientItem(item))
         .filter((item: string) => item && !/^(?:Ingredientes?|Preparaci[oó]n|\d+\.?)$/iu.test(item));

     return items;
 }

 const formatIngredientsAsBullets = (ingredients: string) => {
     const items = normalizeRecipeIngredientItems(ingredients);
     return items.length > 0 ? items.map((item: string) => `- ${item}`).join('\n') : 'No especificados.';
 };

 const cleanRecipePreparation = (preparation: string) => preparation
     .replace(/\s+(?:'\s*)?Efecto\s+al\s+servir.*$/iu, '')
     .replace(/\s+-••.*$/u, '')
     .replace(/\s+LOS\s+CONDIMEN.*$/iu, '')
     .trim();

 const cleanSpanishRecipeOcrText = (text = '') => text
     .replace(/\bchirivias\b/gi, match => match[0] === match[0].toUpperCase() ? 'Chirivías' : 'chirivías')
     .replace(/\bAnada\b/g, 'Añada')
     .replace(/\banada\b/g, 'añada')
     .replace(/\bMezclelo\b/g, 'Mézclelo')
     .replace(/\bmezclelo\b/g, 'mézclelo')
     .replace(/\bLicue\b/g, 'Licúe')
     .replace(/\blicue\b/g, 'licúe')
     .replace(/\bContinue\b/g, 'Continúe')
     .replace(/\bcontinue\b/g, 'continúe')
     .replace(/\besta\b/g, 'está')
     .replace(/\besten\b/g, 'estén')
     .replace(/\bcoccion\b/g, 'cocción')
     .replace(/\bdigestion\b/g, 'digestión')
     .replace(/\blimon\b/g, 'limón')
     .replace(/\bsarten\b/g, 'sartén')
     .replace(/\btazon\b/g, 'tazón')
     .replace(/\bsesamo\b/g, 'sésamo')
     .replace(/\bmani\b/g, 'maní')
     .replace(/\braiz\b/g, 'raíz')
     .replace(/\bplatano\b/g, 'plátano')
     .replace(/\bcalido\b/g, 'cálido')
     .replace(/\bhumeda\b/g, 'húmeda')
     .replace(/\bfacil\b/g, 'fácil')
     .replace(/\baguaellos\b/g, 'aquellos')
     .replace(/\baguaellas\b/g, 'aquellas')
     .replace(/\baguaí\b/g, 'aquí')
     .replace(/\bdesafios\b/g, 'desafíos')
     .replace(/\bprostata\b/g, 'próstata')
     .replace(/\bpara(Pitta|Kapha|Vata)\b/g, 'para $1')
     .replace(/\by(Kapha|Pitta|Vata)\b/g, 'y $1')
     .replace(/\((?:la\s+)?menor cantidad para ([^)]+)\)/giu, 'usando menor cantidad para $1')
     .replace(/\b([¼½¾⅛⅓⅔]|\d+(?:\.\d+)?)\s+taza de agua adicional\b/giu, '$1 taza adicional de agua');

 function cleanRecipeDetailText(text = '') {
     return cleanSpanishRecipeOcrText(normalizeRecipeOcrText(text)
         .replace(/\s*Efectos?\s+en\s+Doshas?:.*$/iu, '')
         .trim());
 }

 function formatRecipePreparationText(preparation = '') {
     return cleanSpanishRecipeOcrText(cleanRecipePreparation(normalizeRecipeOcrText(preparation)
         .replace(/^\s*Preparaci[oó]n:\s*/iu, '')
     ))
         .replace(/\s+(\d+)\.\s+(?=[A-ZÁÉÍÓÚÑ])/g, '\n$1. ')
         .trim() || 'No especificada.';
 }

 function getPreparationStartIndex(content: string, match: RegExpMatchArray) {
     const index = match.index || 0;
     const previous = content.slice(Math.max(0, index - 24), index);
     const numberedStep = previous.match(/(?:Preparaci[oó]n:\s*)?(\d+\.\s*)$/i);
     return numberedStep ? index - numberedStep[1].length : index;
 }

 const findRecipePreparationMatch = (content = '') => {
     const matches = Array.from(content.matchAll(new RegExp(FIRST_PREPARATION_STEP.source, 'gi')));
     return matches.find(match => {
         const word = match[0] || '';
         const index = match.index || 0;
         const previous = content.slice(Math.max(0, index - 24), index);
         const startsUppercase = word[0] === word[0]?.toUpperCase();
         const hasBoundary = index === 0 || /[.!?:]\s*$/.test(previous) || /\n\s*$/.test(previous);

         return startsUppercase || hasBoundary;
     }) || null;
 };

 const parseRecipeTextForPrint = (rawText: string) => {
     const normalized = normalizeRecipeOcrText(rawText || '');
     const [bodyBeforeComments, ...commentParts] = normalized.split(/\bComentarios?:\s*/i);
     let body = bodyBeforeComments
         .replace(/\bEL LIBRO DE COCINA AYURVEDA\b/gi, '')
         .replace(/Quedan1 minuto en el capítulo\s*\.?\s*\d+\/?0?/gi, '')
         .replace(/\s*Efectos?\s+en\s+Doshas?:.*?(?=\s+(?:Rinde(?: para)?|Porciones):|$)/iu, ' ')
         .replace(DOSHA_MARKER_PATTERN, ' ')
         .replace(/\s*,\s*(?=,|\b(?:Rinde|Porciones)\b|$)/gi, ' ')
         .replace(/\s+/g, ' ')
         .trim();

     const comments = commentParts.join('Comentarios: ').trim();
     const timeMatch = body.match(/Tiempo de preparación:\s*(.*?)(?=\s+(?:Rinde(?: para)?|Porciones):|$)/i);
     const yieldLabelMatch = body.match(/\b(Rinde(?: para)?|Porciones):\s*/i);
     const yieldRest = yieldLabelMatch ? body.slice((yieldLabelMatch.index || 0) + yieldLabelMatch[0].length) : '';
     const yieldValueMatch = yieldRest.match(/^((?:Aprox\.\s*)?(?:\d+(?:-\d+)?|[¼½¾⅛⅓⅔]|\d+\s+[¼½¾⅛⅓⅔])(?:\s+(?:a|o)\s+(?:\d+|[¼½¾⅛⅓⅔]))?(?:\s+(?:tazas?|cucharaditas?|cucharadas?|porciones?|barras?|docenas?|litros?|piezas?|de\s+\d+\s+cm))?)/i);

     const time = cleanRecipeDetailText(timeMatch?.[1]?.trim() || '');
     const yieldText = yieldLabelMatch && yieldValueMatch ? `${yieldLabelMatch[1]}: ${cleanRecipeDetailText(yieldValueMatch[1].trim())}` : '';
     const contentStart = yieldLabelMatch && yieldValueMatch
         ? (yieldLabelMatch.index || 0) + yieldLabelMatch[0].length + yieldValueMatch[0].length
         : timeMatch ? (timeMatch.index || 0) + timeMatch[0].length : 0;
     const content = body.slice(contentStart).trim();
     const prepMatch = findRecipePreparationMatch(content);
     const preparationStart = prepMatch ? getPreparationStartIndex(content, prepMatch) : -1;
     const ingredients = prepMatch ? content.slice(0, preparationStart).trim() : content;
     const preparation = prepMatch ? content.slice(preparationStart) : '';

     const sections = [];
     if (time || yieldText) {
         sections.push(['Datos de la receta', [time ? `Tiempo de preparación: ${time}` : '', yieldText].filter(Boolean).join('\n')]);
     }
     sections.push(['Ingredientes', cleanSpanishRecipeOcrText(formatIngredientsAsBullets(ingredients))]);
     sections.push(['Preparación', formatRecipePreparationText(preparation)]);
     if (comments) sections.push(['Comentarios', cleanSpanishRecipeOcrText(comments)]);

     return sections
         .map(([heading, contentText]) => `${heading}\n${contentText}`)
         .join('\n\n');
 };

 const formatStructuredRecipeForPrint = (structured: any) => {
     const sections = [];
     const prepTime = cleanRecipeDetailText(structured?.prepTime || '');
     const yieldText = cleanRecipeDetailText(structured?.yield || '');
     const ingredients = normalizeRecipeIngredientItems(structured?.ingredients || []);
     const details = [
         prepTime ? `Tiempo de preparación: ${prepTime}` : '',
         yieldText
     ].filter(Boolean).join('\n');

     if (details) sections.push(['Datos de la receta', details]);
     sections.push([
         'Ingredientes',
         ingredients.length > 0
             ? ingredients.map((item: string) => `- ${item}`).join('\n')
             : 'No especificados.'
     ]);
     sections.push(['Preparación', formatRecipePreparationText(structured?.preparation || '')]);
     if (structured?.comments?.trim()) sections.push(['Comentarios', cleanSpanishRecipeOcrText(structured.comments.trim())]);

     return sections.map(([heading, contentText]) => `${heading}\n${contentText}`).join('\n\n');
 };

 const getPrintableRecipe = (recipe: any) => {
     const doshas = Array.isArray(recipe.doshas) ? recipe.doshas : [];
     const isTridosha = ['Vata', 'Pitta', 'Kapha'].every(d => doshas.some((item: string) => item?.toLowerCase() === d.toLowerCase()));
     const appropriate = 'Apropiado';

     return {
         ...recipe,
         doshaLabel: isTridosha ? 'Tridosha' : doshas.join(', ') || 'General',
         vataEffect: isTridosha && recipe.vata_effect === 'No especificado' ? appropriate : recipe.vata_effect,
         pittaEffect: isTridosha && recipe.pitta_effect === 'No especificado' ? appropriate : recipe.pitta_effect,
         kaphaEffect: isTridosha && recipe.kapha_effect === 'No especificado' ? appropriate : recipe.kapha_effect,
         printableText: recipe.structured
             ? formatStructuredRecipeForPrint(recipe.structured)
             : parseRecipeTextForPrint(recipe.text || '')
     };
 };
 
 
 const FONT_SIZE_PRESETS = {
     sm: {
         label: 'Pequeño',
         base: '11px',
         title: '16px',
         subtitle: '11.5px',
         heading: '12.5px',
         tableHeader: '9px',
         tableBody: '10.5px',
         meta: '8px'
     },
     base: {
         label: 'Mediano (Normal)',
         base: '13px',
         title: '19px',
         subtitle: '13.5px',
         heading: '14.5px',
         tableHeader: '11px',
         tableBody: '12.5px',
         meta: '10px'
     },
     lg: {
         label: 'Grande',
         base: '15px',
         title: '21px',
         subtitle: '15px',
         heading: '16px',
         tableHeader: '12.5px',
         tableBody: '14px',
         meta: '11px'
     },
     xl: {
         label: 'Muy Grande',
         base: '17px',
         title: '24px',
         subtitle: '17px',
         heading: '18px',
         tableHeader: '14px',
         tableBody: '15.5px',
         meta: '12px'
     }
 };
 
 export const TreatmentPDFModal: React.FC<TreatmentPDFModalProps> = ({
     isOpen,
     onClose,
     patient,
     patientId,
     initialDiagnosis,
     editingRecord = null
 }) => {
     // Guard de inicialización (fix #7): garantiza que el editor se siembre una sola
     // vez por apertura / registro editado. Antes, el useEffect de init dependía del
     // objeto `patient` completo; cada autosave de una fórmula regeneraba `patient`,
     // re-ejecutaba la inicialización y pisaba todo lo que el profesional estaba
     // editando ("el PDF se reiniciaba").
     const initKeyRef = useRef<string | null>(null);
     const [activeTab, setActiveTab] = useState<EditorTabId>('documento');
     // Panel "Notas de consulta" dentro del editor del PDF (fix #2): permite
     // consultar las notas y síntomas del paciente mientras se redacta el PDF.
     const [showConsultNotes, setShowConsultNotes] = useState(false);
     const [pdfFontSize, setPdfFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');
     const [selectedDosha, setSelectedDosha] = useState<DoshaType>('Vata-Pitta');
     const [title, setTitle] = useState('Bienvenido a tu Primer Tratamiento');
     const [subtitle, setSubtitle] = useState('Indicaciones personalizadas · Medicina Ayurvédica');
     const [mainIndication, setMainIndication] = useState('');
     const [lifestyleIndication, setLifestyleIndication] = useState('');
     const [clinicalTreatmentIndication, setClinicalTreatmentIndication] = useState('');
     const [patientDiagnosisText, setPatientDiagnosisText] = useState('');
     const [cerealGuidance, setCerealGuidance] = useState('');
     const [cerealRecipe, setCerealRecipe] = useState('');
    const [herbs, setHerbs] = useState<HerbalFormula[]>([]);
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [isFollowUp, setIsFollowUp] = useState(false);
    const [visitNumber, setVisitNumber] = useState<string>('2');
    const [showLifestylePage, setShowLifestylePage] = useState(true);
    const [showDigestiveRecoveryPage, setShowDigestiveRecoveryPage] = useState(false);
    // Permite ocultar el diagnóstico base en el PDF, sobre todo en seguimientos (fix #5).
    const [showDiagnosis, setShowDiagnosis] = useState(true);
    // Sección "Guía de alimentación saludable" en el PDF (fix #6).
    const [showHealthyEatingGuide, setShowHealthyEatingGuide] = useState(true);
    const [healthyEatingGuide, setHealthyEatingGuide] = useState(HEALTHY_EATING_GUIDE_TEXT);
    // Hábitos seleccionables (el profesional elige cuáles incluir, como las categorías).
    const [selectedHealthyHabits, setSelectedHealthyHabits] = useState<string[]>([...HEALTHY_EATING_HABITS]);
    const toggleHealthyHabit = (habit: string) => {
        setSelectedHealthyHabits(prev => prev.includes(habit) ? prev.filter(h => h !== habit) : [...prev, habit]);
    };
    
    // Recipe states
    const [selectedRecipes, setSelectedRecipes] = useState<any[]>([]);
    const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
    const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<string>('Todos');
    const [recipeDoshaFilter, setRecipeDoshaFilter] = useState<string>('Todos');
    const [recipeSearchQuery, setRecipeSearchQuery] = useState<string>('');
    const [selectedRecipeToAdd, setSelectedRecipeToAdd] = useState<any | null>(null);
    
    // Add herb states
    const [newHerbName, setNewHerbName] = useState('');
    const [newHerbDosage, setNewHerbDosage] = useState('');
    const [newHerbPurpose, setNewHerbPurpose] = useState('');
    const [newHerbInstruction, setNewHerbInstruction] = useState('');
    const [isCustomFormula, setIsCustomFormula] = useState(false);
    const [newHerbIngredients, setNewHerbIngredients] = useState('');
    const [herbSuggestions, setHerbSuggestions] = useState<any[]>([]);
    const [selectedHerbInfo, setSelectedHerbInfo] = useState<any | null>(null);
    const [showHerbSuggestions, setShowHerbSuggestions] = useState(false);
    
    // Add lifestyle states
    const [lifestyleSearchQuery, setLifestyleSearchQuery] = useState('');
    const [lifestyleSuggestions, setLifestyleSuggestions] = useState<any[]>([]);
    const [showLifestyleSuggestions, setShowLifestyleSuggestions] = useState(false);
    const [newLifestyleName, setNewLifestyleName] = useState('');
    
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('Preparando el PDF...');
    const [isSavingPlan, setIsSavingPlan] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [autosaveMessage, setAutosaveMessage] = useState('');
    const [autosavedRecordId, setAutosavedRecordId] = useState<string | null>(editingRecord?.record?.id || null);
    const [autosavedRecordType, setAutosavedRecordType] = useState<'plan' | 'visit'>(editingRecord?.type || 'plan');
    const [isDrafting, setIsDrafting] = useState(false);
    const [showTreatmentPage, setShowTreatmentPage] = useState(false);
    const [aiProvider] = useState<'gemini' | 'deepseek'>('deepseek');

    // States for Treatment AI Chat
    const [treatmentChatMessage, setTreatmentChatMessage] = useState('');
    const [treatmentChatHistory, setTreatmentChatHistory] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
    const [isTreatmentChatLoading, setIsTreatmentChatLoading] = useState(false);

    const handleSendTreatmentChatMessage = async () => {
        if (!treatmentChatMessage.trim()) return;
        const msg = treatmentChatMessage;
        setTreatmentChatMessage('');
        setTreatmentChatHistory(prev => [...prev, { role: 'user', text: msg }]);
        setIsTreatmentChatLoading(true);

        try {
            const currentTreatment = {
                patientDiagnosis: patientDiagnosisText,
                treatment: mainIndication,
                lifestyle: lifestyleIndication,
                clinicalTreatment: clinicalTreatmentIndication,
                categories: selectedCategories,
                herbs: herbs
            };

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    context: patient.fullNotes,
                    patient: patient,
                    provider: aiProvider,
                    history: treatmentChatHistory,
                    chatType: 'treatment',
                    currentTreatment: currentTreatment
                })
            });

            const data = await res.json();
            if (data.success) {
                setTreatmentChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
                if (data.updatedTreatment) {
                    const ut = data.updatedTreatment;
                    if (ut.patientDiagnosis !== undefined) setPatientDiagnosisText(ut.patientDiagnosis);
                    if (ut.treatment !== undefined) {
                        const finalCats = ut.categories || selectedCategories;
                        setMainIndication(updateCategoriesInText(ut.treatment, finalCats));
                    }
                    if (ut.lifestyle !== undefined) setLifestyleIndication(ut.lifestyle);
                    if (ut.clinicalTreatment !== undefined) setClinicalTreatmentIndication(ut.clinicalTreatment);
                    if (ut.categories !== undefined && Array.isArray(ut.categories)) {
                        setSelectedCategories(normalizeFoodCategories(ut.categories));
                    }
                    if (ut.herbs !== undefined && Array.isArray(ut.herbs)) {
                        setHerbs(ut.herbs);
                    }
                }
            } else {
                alert(`Error en el chat de IA: ${data.error || 'Respuesta vacía'}`);
            }
        } catch (error: any) {
            console.error('Error in treatment chat:', error);
            alert(`Error de conexión: ${error.message || error}`);
        } finally {
            setIsTreatmentChatLoading(false);
        }
    };

    // Diet Category selection states
    const categoriesList = [
        'Cereales', 'Lácteos', 'Endulzantes', 'Aceites', 'Frutas', 
        'Hortalizas', 'Nueces', 'Carnes', 'Legumbres', 'Especias', 
        'Condimentos', 'Bebidas'
    ];
    const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_FOOD_CATEGORIES);
    // Páginas calculadas por medición real de altura (ver helpers arriba).
    // Mientras no estén listas, el render usa el respaldo por caracteres.
    const [measuredPages, setMeasuredPages] = useState<Record<string, string[]>>({});
    const [measuredCategoryChunks, setMeasuredCategoryChunks] = useState<any[][] | null>(null);

    const toggleCategory = (cat: string) => {
        let newCategories;
        if (selectedCategories.includes(cat)) {
            newCategories = selectedCategories.filter(c => c !== cat);
        } else {
            if (selectedCategories.length >= MAX_FOOD_CATEGORIES) return;
            newCategories = [...selectedCategories, cat];
        }
        setSelectedCategories(newCategories);
        setMainIndication(prev => updateCategoriesInText(prev, newCategories));
        
        // Dynamically update guidance text based on new categories
        const newGuidance = getGuidanceForCategories(newCategories, selectedDosha);
        setCerealGuidance(newGuidance);
    };

    // Pre-populate fields based on AI diagnosis and patient details
    useEffect(() => {
        if (!isOpen) {
            // Al cerrar, liberamos el guard para que la próxima apertura re-siembre.
            initKeyRef.current = null;
            return;
        }

        // Clave de inicialización: identidad del registro editado (o 'new') +
        // diagnóstico inicial sólo para tratamientos nuevos (para sembrarlo cuando
        // la IA lo devuelve de forma asíncrona). NO incluye el objeto `patient`,
        // así un autosave que regenera `patient` ya no reinicia el editor (fix #7).
        const initKey = `${editingRecord?.record?.id ?? 'new'}::${editingRecord ? 'edit' : (initialDiagnosis || '')}`;
        if (initKeyRef.current === initKey) return;
        initKeyRef.current = initKey;

        setSaveMessage('');
        setAutosaveMessage('');
        setShowTreatmentPage(false);
        setAutosavedRecordId(editingRecord?.record?.id || null);
        setAutosavedRecordType(editingRecord?.type || 'plan');

        if (editingRecord) {
            const rec = editingRecord.record;
            const recDosha = rec.dosha || patient.dosha || 'Vata-Pitta';
            const recCats = normalizeFoodCategories(rec.categories).length > 0
                ? normalizeFoodCategories(rec.categories)
                : DEFAULT_FOOD_CATEGORIES;
            const recordTitle = (rec.title || '').toLowerCase();
            const recordTitleIsInitial = recordTitle.includes('inicial');
            const inferredIsFollowUp = recordTitleIsInitial
                ? false
                : Boolean(
                    rec.isFollowUp ||
                    editingRecord.type === 'visit' ||
                    recordTitle.includes('seguimiento')
                );
            // Compute the follow-up visit number from the visit's position in the
            // patient's history (initial consultation = 1, follow-ups start at 2),
            // matching the numbering shown elsewhere in the app.
            let computedVisitNumber = rec.visitNumber || '';
            if (!computedVisitNumber && editingRecord.type === 'visit' && rec.id) {
                const sortedVisits = [...(patient.visits || [])].sort(
                    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const idx = sortedVisits.findIndex((v: any) => v.id === rec.id);
                if (idx >= 0) computedVisitNumber = String(idx + 2);
            }
            if (!computedVisitNumber) computedVisitNumber = '2';

            // The internal record title is auto-generated as "Consulta seguimiento - <name> - <date>".
            // For the PDF header we prefer the clean "Visita de Seguimiento Nº X" label, while
            // still respecting any custom title the professional typed manually.
            const isAutoInternalTitle = !rec.title
                || recordTitle.startsWith('consulta seguimiento')
                || recordTitle.startsWith('consulta inicial');
            const headerTitle = !isAutoInternalTitle
                ? rec.title
                : inferredIsFollowUp
                    ? `Visita de Seguimiento Nº ${computedVisitNumber}`
                    : 'Bienvenido a tu Primer Tratamiento';

            setSelectedDosha(recDosha);
            setTitle(headerTitle);
            setSubtitle(rec.subtitle || 'Indicaciones personalizadas · Medicina Ayurvédica');
            setPdfFontSize(rec.pdfFontSize || 'lg');
            setClinicalTreatmentIndication(rec.treatment || '');
            setMainIndication(rec.patientTreatment || buildPatientTreatmentFallback(rec.treatment || ''));
            setLifestyleIndication(rec.patientLifestyle || rec.lifestyle || '');
            setPatientDiagnosisText(
                rec.patientDiagnosis ||
                buildPatientDiagnosisFallback(rec.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient), recDosha)
            );
            setCerealGuidance(rec.cerealGuidance || getGuidanceForCategories(recCats, recDosha));
            setCerealRecipe(rec.cerealRecipe || '');
            setVisitDate(rec.visitDate ? rec.visitDate.slice(0, 10) : rec.date ? rec.date.slice(0, 10) : new Date().toISOString().split('T')[0]);
            setIsFollowUp(inferredIsFollowUp);
            setVisitNumber(computedVisitNumber);
            setShowLifestylePage(false);
            setShowDigestiveRecoveryPage(rec.showDigestiveRecoveryPage !== undefined ? rec.showDigestiveRecoveryPage : false);
            // Por defecto, el diagnóstico base se OCULTA en visitas de seguimiento
            // (fix #5): solo aparece en el tratamiento inicial, salvo que el
            // profesional lo active explícitamente y se haya guardado así.
            setShowDiagnosis(rec.showDiagnosis !== undefined ? rec.showDiagnosis : !inferredIsFollowUp);
            setShowHealthyEatingGuide(rec.showHealthyEatingGuide !== undefined ? rec.showHealthyEatingGuide : true);
            setHealthyEatingGuide(rec.healthyEatingGuide || HEALTHY_EATING_GUIDE_TEXT);
            setSelectedHealthyHabits(Array.isArray(rec.healthyEatingHabits) ? rec.healthyEatingHabits : [...HEALTHY_EATING_HABITS]);

            // Herbs — en una visita de seguimiento sin fórmulas propias, reutilizamos
            // automáticamente las del último tratamiento para no recapturarlas (fix #3).
            const ownHerbs = rec.herbs || [];
            if (ownHerbs.length === 0 && inferredIsFollowUp) {
                setHerbs(getLatestTreatmentHerbs(patient));
            } else {
                setHerbs(ownHerbs);
            }
            
            // Categories
            setSelectedCategories(recCats);
            
            // Recipes
            if (rec.recipes && Array.isArray(rec.recipes)) {
                const fullRecipes = rec.recipes.map((item: any) => {
                    if (item && typeof item === 'object') {
                        const freshRecipe = (recipesList as any[]).find(r => r.id === item.id);
                        return freshRecipe ? { ...freshRecipe, ...item, structured: item.structured || freshRecipe.structured } : item;
                    }
                    return (recipesList as any[]).find(r => r.id === item);
                }).filter(Boolean);
                setSelectedRecipes(fullRecipes);
            } else {
                setSelectedRecipes([]);
            }
        } else {
            const effectiveDiagnosis = initialDiagnosis || getLatestLocalDiagnosis(patient);
            // The professional's patient dosha has priority over the AI diagnosis text.
            const matchingDosha = inferDoshaFromText(patient.dosha, effectiveDiagnosis, patient.fullNotes);
            const initialCategories = getLatestTreatmentCategories(patient).length > 0
                ? getLatestTreatmentCategories(patient)
                : DEFAULT_FOOD_CATEGORIES;
            setSelectedDosha(matchingDosha);
            setClinicalTreatmentIndication('');
            setPatientDiagnosisText(buildPatientDiagnosisFallback(effectiveDiagnosis, matchingDosha));
            setCerealGuidance(getGuidanceForCategories(initialCategories, matchingDosha));
            setCerealRecipe('');
            setTitle('Bienvenido a tu Primer Tratamiento');
            setSubtitle('Indicaciones personalizadas · Medicina Ayurvédica');
            setPdfFontSize('lg');
            setVisitDate(new Date().toISOString().split('T')[0]);
            setHerbs([]);
            setSelectedRecipes([]);
            setSelectedCategories(initialCategories);
            setIsFollowUp(false);
            setVisitNumber('2');
            setShowLifestylePage(true);
            setShowDigestiveRecoveryPage(false);
            setShowDiagnosis(true);
            setShowHealthyEatingGuide(true);
            setHealthyEatingGuide(HEALTHY_EATING_GUIDE_TEXT);
            setSelectedHealthyHabits([...HEALTHY_EATING_HABITS]);

            // Pre-fill indications from AI diagnosis text if available
            if (effectiveDiagnosis) {
                const baseText = `En esta etapa no vamos a cambiar todo al mismo tiempo. Vamos a trabajar con dos categorías de comida, el uso diario del raspa lengua y la fórmula herbal indicada.\n\n` +
                    `La alimentación se ajusta poco a poco. Primero revisa las dos categorías marcadas en la tabla y aplica esos cambios con constancia. Las demás categorías pueden seguir igual por ahora.\n\n` +
                    `Cada mañana, antes de tomar agua o desayunar, usa el raspa lengua con suavidad. Es una indicación sencilla, pero muy importante para limpiar la lengua y observar cómo despierta la digestión.`;
                setMainIndication(updateCategoriesInText(baseText, initialCategories));
                setLifestyleIndication(
                    'Raspa lengua al despertar, todos los días. Hazlo con suavidad, de atrás hacia adelante, enjuaga la boca y observa la lengua antes de iniciar el día.'
                );
            } else {
                const baseText = 'En esta etapa el tratamiento se enfoca en tres cosas: dos categorías de comida, el raspa lengua por la mañana y la fórmula herbal indicada. Es mejor hacer pocos cambios bien hechos que muchos cambios sin constancia.';
                setMainIndication(updateCategoriesInText(baseText, initialCategories));
                setLifestyleIndication(
                    'Raspa lengua al despertar, todos los días. Hazlo con suavidad, de atrás hacia adelante, enjuaga la boca y observa la lengua antes de iniciar el día.'
                );
            }
        }

    }, [isOpen, initialDiagnosis, patient, editingRecord]);

    const handleHerbNameChange = (val: string) => {
        setNewHerbName(val);
        setSelectedHerbInfo(null);
        if (!val.trim()) {
            setHerbSuggestions([]);
            setShowHerbSuggestions(false);
            return;
        }

        const query = val.toLowerCase();
        const filtered = (herbsList as any[]).filter(h => 
            h.name.toLowerCase().includes(query)
        ).slice(0, 10);

        setHerbSuggestions(filtered);
        setShowHerbSuggestions(true);
    };

    const handleSelectHerb = (herb: any) => {
        setNewHerbName(herb.name);
        setSelectedHerbInfo(herb);
        setHerbSuggestions([]);
        setShowHerbSuggestions(false);
        setIsCustomFormula(!!herb.isCustom);
        setNewHerbIngredients(herb.ingredients || '');
        setNewHerbInstruction(herb.instruction || herb.howToUse || '');
        
        if (herb.usage) {
            setNewHerbDosage(herb.usage);
        } else {
            setNewHerbDosage('Según indicación');
        }
        
        if (herb.preview) {
            setNewHerbPurpose(herb.preview);
        } else {
            setNewHerbPurpose('');
        }
    };

    const handleSaveHerbDefinition = async () => {
        if (!newHerbName.trim()) return;
        try {
            const res = await fetch('/api/herbs/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newHerbName,
                    preview: newHerbPurpose,
                    usage: newHerbDosage,
                    instruction: newHerbInstruction,
                    isCustom: isCustomFormula,
                    ingredients: isCustomFormula ? newHerbIngredients : ''
                })
            });
            const data = await res.json();
            if (data.success) {
                const existing = (herbsList as any[]).find(h => h.name.toLowerCase() === newHerbName.toLowerCase());
                if (existing) {
                    existing.preview = newHerbPurpose;
                    existing.usage = newHerbDosage;
                    existing.instruction = newHerbInstruction;
                    existing.isCustom = isCustomFormula;
                    existing.ingredients = isCustomFormula ? newHerbIngredients : '';
                } else {
                    (herbsList as any[]).push(data.herb);
                }
                setSelectedHerbInfo(data.herb);
                alert('Definición de la fórmula actualizada en la base de datos.');
            } else {
                alert(`Error al guardar: ${data.error || 'Desconocido'}`);
            }
        } catch (err: any) {
            console.error('Error updating herb:', err);
            alert(`Error al actualizar la base de datos: ${err.message}`);
        }
    };

    const handleAddHerb = () => {
        if (!newHerbName.trim()) return;
        
        // Format dosage and instructions together for clean PDF display:
        // "Dosis e Indicaciones" column
        let finalDosage = newHerbDosage || 'Según indicación';
        if (newHerbInstruction.trim()) {
            finalDosage += `\nCómo usar: ${newHerbInstruction}`;
        }

        setHerbs([...herbs, { 
            formula: newHerbName, 
            dosage: finalDosage,
            purpose: newHerbPurpose || ''
        }]);
        setNewHerbName('');
        setNewHerbDosage('');
        setNewHerbPurpose('');
        setNewHerbInstruction('');
        setIsCustomFormula(false);
        setNewHerbIngredients('');
        setSelectedHerbInfo(null);
    };

    const handleRemoveHerb = (idx: number) => {
        setHerbs(herbs.filter((_, i) => i !== idx));
    };

    const handleLifestyleSearchChange = (val: string) => {
        setLifestyleSearchQuery(val);
        if (!val.trim()) {
            setLifestyleSuggestions([]);
            setShowLifestyleSuggestions(false);
            return;
        }

        const query = val.toLowerCase();
        const filtered = (lifestyleList as any[]).filter(l => 
            l.name.toLowerCase().includes(query) || l.text.toLowerCase().includes(query)
        ).slice(0, 10);

        setLifestyleSuggestions(filtered);
        setShowLifestyleSuggestions(true);
    };

    const handleSelectLifestyle = (item: any) => {
        setLifestyleIndication(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return item.text;
            return trimmed + '\n\n' + item.text;
        });
        setLifestyleSearchQuery('');
        setLifestyleSuggestions([]);
        setShowLifestyleSuggestions(false);
    };

    const handleSaveCustomLifestyle = async () => {
        if (!newLifestyleName.trim()) {
            alert('Por favor introduce un nombre/título para este hábito.');
            return;
        }
        if (!lifestyleIndication.trim()) {
            alert('El texto del Estilo de Vida está vacío.');
            return;
        }

        try {
            const res = await fetch('/api/lifestyles/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newLifestyleName,
                    text: lifestyleIndication
                })
            });
            const data = await res.json();
            if (data.success) {
                const existing = (lifestyleList as any[]).find(l => l.name.toLowerCase() === newLifestyleName.toLowerCase());
                if (existing) {
                    existing.text = lifestyleIndication;
                } else {
                    (lifestyleList as any[]).push(data.lifestyle);
                }
                alert('Hábito de Estilo de Vida guardado en la base de datos.');
                setNewLifestyleName('');
            } else {
                alert(`Error al guardar: ${data.error || 'Desconocido'}`);
            }
        } catch (err: any) {
            console.error('Error saving lifestyle:', err);
            alert(`Error al guardar: ${err.message}`);
        }
    };

    const handleSaveRecipeToDatabase = async (recipe: any) => {
        if (!recipe.title.trim()) {
            alert('Por favor introduce un nombre/título para la receta.');
            return;
        }
        if (!recipe.text.trim()) {
            alert('El texto de la receta está vacío.');
            return;
        }

        try {
            const res = await fetch('/api/recipes/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: recipe.id,
                    title: recipe.title,
                    text: recipe.text
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update the imported list in-memory so it reflects for future selections
                const existing = (recipesList as any[]).find(r => r.id === recipe.id);
                if (existing) {
                    existing.title = recipe.title;
                    existing.text = recipe.text;
                    delete existing.structured;
                }
                alert('Receta guardada exitosamente en la base de datos.');
            } else {
                alert(`Error al guardar receta: ${data.error || 'Desconocido'}`);
            }
        } catch (err: any) {
            console.error('Error saving recipe:', err);
            alert(`Error al guardar receta: ${err.message}`);
        }
    };

    const [hasAutoDrafted, setHasAutoDrafted] = useState(false);


    const handleDraftWithAI = async (diagnosisOverride?: string, doshaOverride?: DoshaType) => {
        setIsDrafting(true);
        try {
            const currentDiagnosis = diagnosisOverride || initialDiagnosis || getLatestLocalDiagnosis(patient);
            const currentDosha = doshaOverride || selectedDosha;
            const doshaLocked = Boolean(patient.dosha?.trim());
            
            // Check if it is initial consultation
            const totalRecords = (patient.treatmentPlans?.length || 0) + (patient.visits?.length || 0);
            const isInitial = editingRecord 
                ? (editingRecord.record.title?.toLowerCase().includes('inicial')) 
                : (totalRecords === 0);

            const res = await fetch('/api/ai/draft-treatment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientName: patient.name,
                    patientAge: patient.age,
                    dosha: currentDosha,
                    diagnosis: currentDiagnosis,
                    symptoms: patient.plainSymptoms,
                    prescribedHerbs: herbs,
                    lifestyle: lifestyleIndication,
                    provider: aiProvider,
                    isInitial,
                    doshaLocked
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.dosha && !doshaLocked) {
                    setSelectedDosha(data.dosha as DoshaType);
                }
                let finalCategories = selectedCategories;
                if (data.foodCategories && Array.isArray(data.foodCategories)) {
                    finalCategories = normalizeFoodCategories(data.foodCategories);
                    setSelectedCategories(finalCategories);
                }
                if (data.herbalFormula && data.herbalFormula.formula) {
                    setHerbs([{
                        formula: data.herbalFormula.formula,
                        dosage: data.herbalFormula.dosage || 'Según indicación'
                    }]);
                } else {
                    setHerbs([]);
                }
                if (data.treatmentDraft) {
                    const formattedTreatment = updateCategoriesInText(data.treatmentDraft, finalCategories);
                    setMainIndication(formattedTreatment);
                    if (data.clinicalTreatmentDraft) {
                        setClinicalTreatmentIndication(data.clinicalTreatmentDraft);
                    } else {
                        setClinicalTreatmentIndication(formattedTreatment);
                    }
                }
                if (data.patientDiagnosisDraft) {
                    setPatientDiagnosisText(data.patientDiagnosisDraft);
                }
                if (data.lifestyleDraft) {
                    setLifestyleIndication(data.lifestyleDraft);
                }
            } else {
                alert(`Error al generar tratamiento con IA: ${data.error || 'Respuesta vacía'}`);
            }
        } catch (error: any) {
            console.error('Error drafting with AI:', error);
            alert(`Error de conexión: ${error.message || error}`);
        } finally {
            setIsDrafting(false);
        }
    };

    // Auto-drafting trigger on load if diagnosis is available and it's a new treatment plan
    useEffect(() => {
        if (!isOpen) {
            setHasAutoDrafted(false);
            return;
        }

        if (isOpen && !editingRecord && !hasAutoDrafted) {
            const effectiveDiagnosis = initialDiagnosis || getLatestLocalDiagnosis(patient);
            if (effectiveDiagnosis && effectiveDiagnosis.trim().length > 0) {
                setHasAutoDrafted(true);
                const matchingDosha = inferDoshaFromText(patient.dosha, effectiveDiagnosis, patient.fullNotes);
                setMainIndication('Generando sugerencias del tratamiento con IA...');
                setLifestyleIndication('Generando estilo de vida con IA...');
                // Small timeout to allow state rendering before fetch
                setTimeout(() => {
                    handleDraftWithAI(effectiveDiagnosis, matchingDosha);
                }, 100);
            }
        }
    }, [isOpen, initialDiagnosis, patient, editingRecord, hasAutoDrafted]);

    const generatePdfDocument = async (onProgress?: (progress: number, status?: string) => void): Promise<jsPDF | null> => {
        const container = document.getElementById('pdf-content');
        if (!container) {
            return null;
        }

        console.log('Iniciando generacion de PDF con html-to-image por páginas separadas...');
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pages = Array.from(container.querySelectorAll('.pdf-page')) as HTMLElement[];
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const totalPages = Math.max(pages.length, 1);
        const renderStage = createPdfRenderStage();

        try {
            for (let i = 0; i < pages.length; i++) {
                const sourcePageEl = pages[i];
                const pageEl = sourcePageEl.cloneNode(true) as HTMLElement;
                pageEl.classList.remove('shadow-xl', 'rounded-sm');
                pageEl.style.margin = '0';
                pageEl.style.boxShadow = 'none';
                pageEl.style.borderRadius = '0';
                pageEl.style.transform = 'none';
                pageEl.style.opacity = '1';

                renderStage.replaceChildren(pageEl);

                onProgress?.(Math.round((i / totalPages) * 86) + 4, `Renderizando página ${i + 1} de ${totalPages}`);
                await waitForBrowserPaint();
                await yieldToMainThread();

                // ── Red de seguridad: escala-para-caber (medición real) ──────────
                // Si el contenido de la página supera el alto A4, se reduce
                // proporcionalmente para que NUNCA se corte. Con la paginación por
                // medición esto casi nunca se activa; es una garantía final.
                try {
                    const boxH = pageEl.getBoundingClientRect().height || pageEl.offsetHeight;
                    const prevOverflow = pageEl.style.overflow;
                    pageEl.style.overflow = 'visible';
                    const naturalH = pageEl.scrollHeight;
                    pageEl.style.overflow = prevOverflow || 'hidden';
                    if (boxH > 0 && naturalH > boxH + 4) {
                        const scale = Math.max(0.55, (boxH / naturalH) * 0.985);
                        const fitWrap = document.createElement('div');
                        fitWrap.style.transformOrigin = 'top center';
                        fitWrap.style.transform = `scale(${scale})`;
                        fitWrap.style.width = '100%';
                        while (pageEl.firstChild) fitWrap.appendChild(pageEl.firstChild);
                        pageEl.appendChild(fitWrap);
                        await waitForBrowserPaint();
                    }
                } catch (fitErr) {
                    console.warn('PDF auto-fit (red de seguridad) omitido:', fitErr);
                }

                const pageWidthPx = pageEl.getBoundingClientRect().width || pageEl.offsetWidth;
                const targetWidthPx = (A4_WIDTH_MM / MM_PER_INCH) * PDF_TARGET_DPI;
                const pixelRatio = Math.max(PDF_PIXEL_RATIO, targetWidthPx / pageWidthPx);
                const dataUrl = await toPng(pageEl, { 
                    pixelRatio,
                    backgroundColor: '#ffffff',
                    cacheBust: false,
                    style: {
                        transform: 'none',
                        margin: '0',
                        boxShadow: 'none',
                        borderRadius: '0',
                        opacity: '1'
                    }
                });

                if (i > 0) {
                    pdf.addPage();
                }

                pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

                // Add clickable links manually over the generated page image
                try {
                    const pageRect = pageEl.getBoundingClientRect();
                    const scaleX = pdfWidth / pageRect.width;
                    const scaleY = pdfHeight / pageRect.height;
                    const links = pageEl.querySelectorAll('a');
                    
                    links.forEach(link => {
                        const url = link.getAttribute('href');
                        if (url) {
                            const linkRect = link.getBoundingClientRect();
                            const x = (linkRect.left - pageRect.left) * scaleX;
                            const y = (linkRect.top - pageRect.top) * scaleY;
                            const w = linkRect.width * scaleX;
                            const h = linkRect.height * scaleY;
                            pdf.link(x, y, w, h, { url });
                        }
                    });
                } catch (linkErr) {
                    console.warn('Error overlaying link in PDF page:', linkErr);
                }

                onProgress?.(Math.round(((i + 1) / totalPages) * 86) + 4, `Página ${i + 1} de ${totalPages} lista`);
                await waitForBrowserPaint();
                await yieldToMainThread(70);
            }
        } finally {
            renderStage.remove();
        }
        return pdf;
    };

    const handleSavePlan = async (options: { saveFlatPdf?: boolean; isAutoSave?: boolean; existingPdf?: jsPDF } = {}) => {
        const { saveFlatPdf = true, isAutoSave = false, existingPdf } = options;
        const targetPatientId = patient.id || patientId || null;
        if (!targetPatientId) {
            const message = 'No se pudo guardar: abre el PDF desde un paciente seleccionado para enlazarlo a su carpeta local.';
            if (isAutoSave) {
                setAutosaveMessage(message);
            } else {
                setSaveMessage(message);
            }
            return false;
        }

        if (isAutoSave) {
            setAutosaveMessage('Guardando...');
        } else {
            setIsSavingPlan(true);
            setSaveMessage('');
            setAutosaveMessage('');
        }
        try {
            let url = `/api/patients/${targetPatientId}/treatment-plans`;
            let method = 'POST';
            
            const existingRecordId = editingRecord?.record?.id || autosavedRecordId;
            const existingRecordType = editingRecord?.type || autosavedRecordType;

            if (existingRecordId) {
                if (existingRecordType === 'plan') {
                    url = `/api/patients/${targetPatientId}/treatment-plans/${existingRecordId}`;
                    method = 'PATCH';
                } else if (existingRecordType === 'visit') {
                    url = `/api/patients/${targetPatientId}/visits/${existingRecordId}`;
                    method = 'PATCH';
                }
            }

            const detailedDiagnosis = editingRecord
                ? (editingRecord.record.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient))
                : (initialDiagnosis || getLatestLocalDiagnosis(patient));
            const patientDiagnosisForPdf = patientDiagnosisText || buildPatientDiagnosisFallback(detailedDiagnosis, selectedDosha);

            const body: any = {
                title,
                dosha: selectedDosha,
                treatment: clinicalTreatmentIndication || mainIndication,
                lifestyle: lifestyleIndication,
                patientDiagnosis: patientDiagnosisForPdf,
                patientTreatment: mainIndication,
                patientLifestyle: lifestyleIndication,
                cerealGuidance,
                cerealRecipe,
                herbs,
                categories: normalizeFoodCategories(selectedCategories),
                adherence: editingRecord?.record?.adherence || {},
                recipes: selectedRecipes.map(r => ({
                    id: r.id,
                    title: r.title,
                    category: r.category,
                    doshas: r.doshas,
                    text: r.text,
                    structured: r.structured,
                    vata_effect: r.vata_effect,
                    pitta_effect: r.pitta_effect,
                    kapha_effect: r.kapha_effect
                })),
                isFollowUp,
                visitNumber,
                showLifestylePage,
                showDigestiveRecoveryPage,
                showDiagnosis,
                showHealthyEatingGuide,
                healthyEatingGuide,
                healthyEatingHabits: selectedHealthyHabits
            };

            if (editingRecord && editingRecord.type === 'visit') {
                body.date = visitDate;
            } else {
                body.visitDate = visitDate;
                body.date = existingRecordId && editingRecord ? editingRecord.record.date : new Date().toISOString();
                body.diagnosis = detailedDiagnosis;
                body.patientName = patient.name || '';
            }

            const token = localStorage.getItem('token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'No se pudo guardar el tratamiento.');
            }

            // Get the record ID to link the PDF filename
            const recordId = existingRecordId 
                ? existingRecordId 
                : (data.plan?.id || data.visit?.id);

            if (recordId) {
                setAutosavedRecordId(recordId);
                setAutosavedRecordType(data.visit ? 'visit' : existingRecordType || 'plan');
            }

            if (recordId && saveFlatPdf) {
                try {
                    setSaveMessage('Generando y guardando copia PDF plana en la carpeta del paciente...');
                    const pdf = existingPdf || await generatePdfDocument();
                    if (pdf) {
                        const pdfBase64 = pdf.output('datauristring').split(',')[1];
                        const uploadRes = await fetch(`/api/patients/${targetPatientId}/pdf/${recordId}`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ pdfBase64 })
                        });
                        const uploadData = await uploadRes.json();
                        if (!uploadData.success) {
                            console.warn('Copia PDF guardada localmente con advertencia:', uploadData.error);
                        }
                    }
                } catch (pdfErr) {
                    console.error('Error generating/uploading flat PDF:', pdfErr);
                }
            }

            if (isAutoSave) {
                setAutosaveMessage(`Guardado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`);
            } else {
                setSaveMessage(saveFlatPdf ? 'Tratamiento guardado localmente (editable y PDF plano actualizados).' : 'Tratamiento editable guardado localmente.');
                setAutosaveMessage(`Guardado ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`);
            }
            return true;
        } catch (error: any) {
            console.error('Error saving treatment plan:', error);
            const message = `No se pudo guardar: ${error.message || error}`;
            if (isAutoSave) {
                setAutosaveMessage(message);
            } else {
                setSaveMessage(message);
            }
            return false;
        } finally {
            if (!isAutoSave) {
                setIsSavingPlan(false);
            }
        }
    };

    const handlePrint = async () => {
        setDownloadProgress(0);
        setDownloadStatus('Preparando el PDF...');
        setIsDownloading(true);
        await waitForBrowserPaint();
        await yieldToMainThread(240);

        try {
            const pdf = await generatePdfDocument((progress, status) => {
                setDownloadProgress(progress);
                if (status) setDownloadStatus(status);
            });
            if (!pdf) {
                setIsDownloading(false);
                return;
            }
            
            const filename = `Tratamiento_${patient.name?.replace(/\s+/g, '_') || 'Ayurveda'}.pdf`;
            setDownloadProgress(94);
            setDownloadStatus('Preparando descarga...');
            await waitForBrowserPaint();
            pdf.save(filename);
            setDownloadProgress(98);
            setDownloadStatus('Guardando copia local...');
            await handleSavePlan({ existingPdf: pdf });
            setShowTreatmentPage(true);
            
            console.log('PDF generado exitosamente');
        } catch (error: any) {
            console.error('Error generando PDF:', error);
            alert(`Ocurrió un error al generar el PDF: ${error.message || error}`);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
            setDownloadStatus('Preparando el PDF...');
        }
    };

    // Recalcula las páginas por medición real de altura cada vez que cambian
    // el contenido o el tamaño de fuente. Cae al método por caracteres si la
    // medición no es posible. Debe ir antes del early-return para cumplir las
    // reglas de hooks de React.
    useLayoutEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const raf = requestAnimationFrame(() => {
            if (cancelled) return;
            const fs = pdfFontSize;
            const dietData = DIET_DATABASES[selectedDosha] || vataPittaDiet;
            const focused = normalizeFoodCategories(selectedCategories);
            const cats = (dietData.categorias || []).filter((cat: any) => focused.includes(cat.nombre));
            const treatmentTxt = removeHerbalFormulaItems(mainIndication || '');
            const recDiag = editingRecord?.record?.diagnosis || '';
            const diagTxt = (
                patientDiagnosisText
                || recDiag
                || buildPatientDiagnosisFallback(initialDiagnosis || getLatestLocalDiagnosis(patient), selectedDosha)
            ).trim();
            const wrap = MEASURE_WRAPPER_CLASS;

            const next: Record<string, string[]> = {
                treatment: measuredPaginate(treatmentTxt, wrap, PDF_USABLE_HEIGHT_MM,
                    () => paginateParagraphs(treatmentTxt, 2200, 2200, fs)),
                lifestyle: measuredPaginate(lifestyleIndication || '', wrap, PDF_USABLE_HEIGHT_MM,
                    () => paginateParagraphs(lifestyleIndication || '', 1800, 2400, fs)),
                digestive: measuredPaginate(DIGESTIVE_RECOVERY_TEXT, wrap, PDF_USABLE_HEIGHT_MM,
                    () => paginateParagraphs(DIGESTIVE_RECOVERY_TEXT, 1200, 1500, fs)),
                diagnosis: measuredPaginate(diagTxt, wrap, PDF_USABLE_HEIGHT_MM,
                    () => paginateParagraphs(diagTxt, 1650, 1750, fs)),
            };
            setMeasuredPages(next);

            const catHeights = measureCategoryCardHeights(cats);
            if (catHeights && catHeights.length === cats.length) {
                const usablePx = PDF_DIET_USABLE_HEIGHT_MM * getPxPerMm();
                setMeasuredCategoryChunks(packCategoriesByHeight(cats, catHeights, usablePx));
            } else {
                setMeasuredCategoryChunks(null);
            }
        });
        return () => { cancelled = true; cancelAnimationFrame(raf); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isOpen, mainIndication, lifestyleIndication, patientDiagnosisText,
        selectedDosha, selectedCategories, pdfFontSize, initialDiagnosis,
        editingRecord?.record?.id, editingRecord?.record?.diagnosis, patient?.id,
    ]);

    if (!isOpen) return null;

    // Filter recipes List based on selected category, dosha and search query
    const filteredRecipes = (recipesList as any[]).filter(recipe => {
        // Category filter
        if (recipeCategoryFilter !== 'Todos' && recipe.category !== recipeCategoryFilter) {
            return false;
        }
        // Dosha filter
        if (recipeDoshaFilter !== 'Todos') {
            const query = recipeDoshaFilter.toLowerCase();
            const isBenefited = recipe.doshas.some((d: string) => d.toLowerCase().includes(query));
            const isVataEffect = recipe.vata_effect.toLowerCase().includes('pacificador') || recipe.vata_effect.toLowerCase().includes('bueno');
            const isPittaEffect = recipe.pitta_effect.toLowerCase().includes('pacificador') || recipe.pitta_effect.toLowerCase().includes('bueno');
            const isKaphaEffect = recipe.kapha_effect.toLowerCase().includes('pacificador') || recipe.kapha_effect.toLowerCase().includes('bueno');
            
            if (query === 'vata' && !isBenefited && !isVataEffect) return false;
            if (query === 'pitta' && !isBenefited && !isPittaEffect) return false;
            if (query === 'kapha' && !isBenefited && !isKaphaEffect) return false;
        }
        // Search query
        if (recipeSearchQuery.trim() !== '') {
            const query = recipeSearchQuery.toLowerCase();
            return recipe.title.toLowerCase().includes(query) || recipe.text.toLowerCase().includes(query);
        }
        return true;
    });

    // Get the current diet data based on selectedDosha
    const currentDietData = DIET_DATABASES[selectedDosha] || vataPittaDiet;
    const treatmentHistory = getPatientTreatmentHistory(patient, editingRecord?.record?.id);

    // Filter categories that are selected by the user
    const focusedCategories = normalizeFoodCategories(selectedCategories);
    const repeatedCategories = focusedCategories
        .map(name => treatmentHistory.categories.find(item => normalizeReuseName(item.name) === normalizeReuseName(name)))
        .filter(Boolean) as Array<{ name: string; count: number; lastDate: string; lastStatus?: string }>;
    const repeatedHerbs = herbs
        .map(herb => treatmentHistory.herbs.find(item => normalizeReuseName(item.name) === normalizeReuseName(herb.formula)))
        .filter(Boolean) as Array<{ name: string; count: number; lastDate: string; lastStatus?: string }>;

    const activeCategories = currentDietData.categorias.filter((cat: any) => 
        focusedCategories.includes(cat.nombre)
    );

    // Group active categories into chunks of 2 for pagination
    const chunkCategories = (cats: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < cats.length; i += size) {
            chunks.push(cats.slice(i, i + size));
        }
        return chunks;
    };

    const categoryChunksFallback = chunkCategories(activeCategories, 2);
    const categoryChunks = measuredCategoryChunks ?? categoryChunksFallback;
    const herbalFormulaPages = chunkHerbalFormulasForPrint(herbs, pdfFontSize);

    const printableTreatmentText = removeHerbalFormulaItems(mainIndication || '');
    const nextPageMax = pdfFontSize === 'sm' ? 2400 : pdfFontSize === 'base' ? 2200 : pdfFontSize === 'lg' ? 1750 : 1350;
    // Since treatment starts on Page 2, we use nextPageMax for all pages of treatment.
    const treatmentPagesFallback = paginateParagraphs(printableTreatmentText, nextPageMax, nextPageMax, pdfFontSize);
    if (treatmentPagesFallback.length === 0) {
        treatmentPagesFallback.push('');
    }
    const lifestyleFirstPageMax = pdfFontSize === 'sm' ? 2000 : pdfFontSize === 'base' ? 1800 : pdfFontSize === 'lg' ? 1400 : 1100;
    const lifestyleNextPageMax = pdfFontSize === 'sm' ? 2600 : pdfFontSize === 'base' ? 2400 : pdfFontSize === 'lg' ? 1900 : 1500;
    const lifestylePagesFallback = paginateParagraphs(lifestyleIndication || '', lifestyleFirstPageMax, lifestyleNextPageMax, pdfFontSize);
    const digestiveRecoveryPagesFallback = paginateParagraphs(DIGESTIVE_RECOVERY_TEXT, 1200, 1500, pdfFontSize);
    // Contenido de la guía = texto introductorio + hábitos seleccionados como viñetas.
    const healthyEatingContent = [
        (healthyEatingGuide || '').trim(),
        selectedHealthyHabits.length > 0 ? selectedHealthyHabits.map(h => `- ${h}`).join('\n') : ''
    ].filter(Boolean).join('\n\n');
    const healthyEatingGuidePages = healthyEatingContent.trim()
        ? paginateParagraphs(healthyEatingContent, 1400, 1800, pdfFontSize)
        : [];
    // The PDF "Diagnóstico Base" must reflect the editable field (patientDiagnosisText)
    // so the professional can change what appears in the PDF. We fall back to the saved
    // record diagnosis or an auto-generated version only when that field is empty.
    const recordDiagnosisPreview = editingRecord?.record?.diagnosis || '';
    const diagnosisPreview = (
        patientDiagnosisText
        || recordDiagnosisPreview
        || buildPatientDiagnosisFallback(initialDiagnosis || getLatestLocalDiagnosis(patient), selectedDosha)
    ).trim();
    // Paginate diagnosis preview to ensure it never overflows a page.
    const diagnosisFirstPageMax = pdfFontSize === 'sm' ? 1900 : pdfFontSize === 'base' ? 1650 : pdfFontSize === 'lg' ? 1300 : 980;
    const diagnosisNextPageMax = pdfFontSize === 'sm' ? 2050 : pdfFontSize === 'base' ? 1750 : pdfFontSize === 'lg' ? 1400 : 1080;
    const diagnosisPagesFallback = paginateParagraphs(diagnosisPreview, diagnosisFirstPageMax, diagnosisNextPageMax, pdfFontSize);

    // Versiones medidas (alto real). Si la medición aún no se ha ejecutado o no
    // fue posible, se usa el respaldo por caracteres — nunca queda indefinido.
    const treatmentPages = measuredPages.treatment ?? treatmentPagesFallback;
    const lifestylePages = measuredPages.lifestyle ?? lifestylePagesFallback;
    const digestiveRecoveryPages = measuredPages.digestive ?? digestiveRecoveryPagesFallback;
    const diagnosisPages = measuredPages.diagnosis ?? diagnosisPagesFallback;
    const rawTreatmentPreviewText = mainIndication.trim();
    const isTreatmentPreviewLoading = isDrafting || rawTreatmentPreviewText.toLowerCase().startsWith('generando');
    const professionalWhatsAppUrl = professionalContact.phone
        ? buildWhatsAppUrl(professionalContact.phone, `Hola ${professionalContact.name}, tengo una duda sobre mi tratamiento de Ayurveda.`)
        : '';
    const professionalContactLine = professionalWhatsAppUrl ? (
        <p>
            <a href={professionalWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="text-[#16a34a] underline font-semibold">
                Haz clic aqui para escribirme por WhatsApp: {professionalContact.phone}
            </a>
            {professionalContact.email ? ` · ${professionalContact.email}` : ''}
        </p>
    ) : (
        <p>{professionalContact.email || 'Escríbeme antes de tu próxima consulta.'}</p>
    );

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 overflow-hidden flex bg-slate-900/60 backdrop-blur-sm print:bg-white print:backdrop-none print:static">
                {autosaveMessage && (
                    <div className={`absolute top-4 right-6 z-20 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm print:hidden ${
                        autosaveMessage.startsWith('No se pudo')
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : autosaveMessage === 'Guardando...' || autosaveMessage === 'Cambios pendientes...'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                        {autosaveMessage}
                    </div>
                )}
                
                {/* Editor Sidebar (Hidden in Print) */}
                <div className="w-[400px] bg-white text-slate-800 flex flex-col border-r border-slate-200 print:hidden shrink-0">
                    <div className="px-6 pt-6 pb-5 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-lg text-slate-900">Editor de Tratamiento</h2>
                            <p className="text-xs text-slate-500">Personaliza la hoja imprimible</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Notas de consulta (fix #2): consultables mientras se edita el PDF */}
                    <div className="px-6 pb-3 print:hidden">
                        <button
                            type="button"
                            onClick={() => setShowConsultNotes(v => !v)}
                            className="w-full flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <ClipboardList size={14} />
                                Notas de consulta
                            </span>
                            <ChevronDown size={14} className={`transition-transform ${showConsultNotes ? 'rotate-180' : ''}`} />
                        </button>
                        {showConsultNotes && (() => {
                            // Muestra específicamente la "Nota general" y el "Tratamiento
                            // indicado" de esta visita (fix #2). Si es un tratamiento inicial
                            // sin esos campos, cae a las notas globales del paciente.
                            const rec: any = editingRecord?.record || {};
                            const notaGeneral = (rec.note || '').trim() || (patient.fullNotes || '').trim();
                            const tratamientoIndicado = (rec.treatment || '').trim();
                            const hayContenido = notaGeneral || tratamientoIndicado;
                            return (
                                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 space-y-3 scrollbar-thin">
                                    {notaGeneral && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Nota general</p>
                                            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{notaGeneral}</div>
                                        </div>
                                    )}
                                    {tratamientoIndicado && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tratamiento indicado</p>
                                            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{tratamientoIndicado}</div>
                                        </div>
                                    )}
                                    {!hayContenido && (
                                        <p className="text-xs text-slate-400 text-center py-2">No hay nota general ni tratamiento indicado en esta visita.</p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Pestañas de navegación del editor */}
                    <div className="flex items-stretch border-b border-slate-200 px-2 print:hidden">
                        {EDITOR_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors ${
                                        isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Icon size={17} />
                                    <span>{tab.label}</span>
                                    {isActive && (
                                        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-600" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                      <div key={activeTab} className="space-y-7 tab-panel-anim">
                        {activeTab === 'documento' && (<>
                        {/* Title Settings */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <FileText size={15} className="text-emerald-600" />
                                Títulos
                            </label>
                            <input 
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                                placeholder="Título principal"
                            />
                            <input 
                                type="text"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                                placeholder="Subtítulo"
                            />
                            <input
                                type="date"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                                title="Fecha de la visita"
                            />
                            <div className="editor-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                <div className="flex items-center gap-2 font-semibold text-slate-800">
                                    <Phone size={15} className="text-emerald-600" />
                                    Contacto en PDF: {professionalContact.name}
                                </div>
                                {professionalContact.phone || professionalContact.email ? (
                                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-slate-500">
                                        {professionalContact.phone && <span>WhatsApp: {professionalContact.phone}</span>}
                                        {professionalContact.email && <span>{professionalContact.email}</span>}
                                        {professionalWhatsAppUrl && (
                                            <a href={professionalWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:text-emerald-700">
                                                Probar enlace
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-1 text-[13px] text-slate-400">Configura VITE_PROFESSIONAL_WHATSAPP para mostrar el número.</div>
                                )}
                            </div>
                        </div>

                        {/* Tipo de Visita Settings */}
                        <div className="editor-card space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <Stethoscope size={15} className="text-emerald-600" />
                                Tipo de consulta
                            </label>
                            <ToggleSwitch
                                checked={isFollowUp}
                                label="Visita de seguimiento"
                                onChange={(checked) => {
                                    setIsFollowUp(checked);
                                    if (checked) {
                                        if (title === 'Bienvenido a tu Primer Tratamiento' || title === '') {
                                            setTitle(`Visita de Seguimiento Nº ${visitNumber}`);
                                        }
                                    } else {
                                        if (title.startsWith('Visita de Seguimiento Nº')) {
                                            setTitle('Bienvenido a tu Primer Tratamiento');
                                        }
                                    }
                                }}
                            />
                            {isFollowUp && (
                                <div className="space-y-1.5 mt-1 animate-fadeIn">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block">Número de visita</label>
                                    <input
                                        type="text"
                                        value={visitNumber}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setVisitNumber(val);
                                            if (title.startsWith('Visita de Seguimiento Nº')) {
                                                setTitle(`Visita de Seguimiento Nº ${val}`);
                                            }
                                        }}
                                        className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                                        placeholder="Ej. 2, 3, etc."
                                    />
                                </div>
                            )}
                        </div>

                        {/* Opciones Adicionales de PDF */}
                        <div className="editor-card space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                <Settings2 size={15} className="text-emerald-600" />
                                Opciones del PDF
                            </label>
                            <ToggleSwitch
                                checked={showLifestylePage}
                                label="Incluir página de estilo de vida"
                                onChange={setShowLifestylePage}
                            />
                            <ToggleSwitch
                                checked={showDigestiveRecoveryPage}
                                label="Incluir recuperación digestiva"
                                onChange={setShowDigestiveRecoveryPage}
                            />
                            <ToggleSwitch
                                checked={showHealthyEatingGuide}
                                label="Incluir guía de alimentación saludable"
                                onChange={setShowHealthyEatingGuide}
                            />
                            <ToggleSwitch
                                checked={showDiagnosis}
                                label="Incluir diagnóstico base"
                                onChange={setShowDiagnosis}
                            />
                        </div>

                        </>)}

                        {activeTab === 'alimentacion' && (<>
                        {/* Dosha Selector */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <Utensils size={15} className="text-emerald-600" />
                                    Tabla de Alimentos (Dosha)
                                </label>
                                <span className="text-xs text-emerald-600 font-medium">Detectado: {selectedDosha}</span>
                            </div>
                            <div className="relative">
                                <select 
                                    value={selectedDosha}
                                    onChange={(e) => {
                                        const newDosha = e.target.value as DoshaType;
                                        setSelectedDosha(newDosha);
                                        setCerealGuidance(getGuidanceForCategories(focusedCategories, newDosha));
                                    }}
                                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                                >
                                    <option value="Vata-Pitta">Vata-Pitta Balance</option>
                                    <option value="Vata">Vata Pacifying</option>
                                    <option value="Pitta">Pitta Pacifying</option>
                                    <option value="Kapha">Kapha Pacifying</option>
                                    <option value="Pitta-Kapha">Pitta-Kapha Balance</option>
                                    <option value="Vata-Kapha">Vata-Kapha Balance</option>
                                    <option value="Tridoshica">Tridoshica (Balance General)</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'documento' && (<>
                        {/* Font Size Selector */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <Type size={15} className="text-emerald-600" />
                                Tamaño de letra del PDF
                            </label>
                            <div className="relative">
                                <select 
                                    value={pdfFontSize}
                                    onChange={(e) => setPdfFontSize(e.target.value as 'sm' | 'base' | 'lg' | 'xl')}
                                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                                >
                                    <option value="sm">Pequeño ({FONT_SIZE_PRESETS.sm.base})</option>
                                    <option value="base">Mediano ({FONT_SIZE_PRESETS.base.base})</option>
                                    <option value="lg">Grande ({FONT_SIZE_PRESETS.lg.base}) (Recomendado)</option>
                                    <option value="xl">Muy Grande ({FONT_SIZE_PRESETS.xl.base})</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'alimentacion' && (<>
                        {/* Diet Categories Checklist */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                                    Categorías de comida
                                </label>
                                <span className="text-[10px] font-bold text-emerald-600">{focusedCategories.length} seleccionadas</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                {categoriesList.map((cat) => {
                                    const isSelected = selectedCategories.includes(cat);
                                    const isDisabled = !isSelected && focusedCategories.length >= MAX_FOOD_CATEGORIES;
                                    const isRepeated = repeatedCategories.some(item => normalizeReuseName(item.name) === normalizeReuseName(cat));
                                    return (
                                        <label key={cat} className={`flex items-center gap-2 text-xs select-none ${isDisabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={isDisabled}
                                                onChange={() => toggleCategory(cat)}
                                                className="rounded border-slate-200 bg-white text-emerald-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                                            />
                                            <span className={isSelected ? "text-emerald-600 font-medium" : "text-slate-500"}>
                                                {cat}
                                            </span>
                                            {isSelected && (
                                                isRepeated ? (
                                                    <span className="ml-auto px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Repetida</span>
                                                ) : (
                                                    <span className="ml-auto px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200">Nueva</span>
                                                )
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] leading-snug text-slate-400">
                                Selecciona las categorías de comida que deseas incluir en el PDF de indicaciones.
                            </p>
                            {repeatedCategories.length > 0 && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] leading-snug text-emerald-800">
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 mb-1">
                                        <AlertCircle size={13} />
                                        Ya usadas antes
                                    </div>
                                    {repeatedCategories.map(item => (
                                        <p key={item.name}>
                                            {item.name}: {item.count} vez/veces, última {formatReuseDate(item.lastDate)} ({formatAdherenceStatus(item.lastStatus)}).
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        </>)}

                        {activeTab === 'ia' && (<>
                        {/* AI Redaction settings */}
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Redacción con IA (DeepSeek)</label>
                                <span className="text-[10px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded">Auto</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDraftWithAI()}
                                disabled={isDrafting}
                                className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow"
                            >
                                {isDrafting ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        Generando tratamiento...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={13} />
                                        Generar Tratamiento Inteligente (IA)
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Chat de IA para Ajustes */}
                        <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
                                    Ajustar tratamiento con IA
                                </label>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">Chat</span>
                            </div>
                            
                            {/* Chat history list */}
                            {treatmentChatHistory.length > 0 && (
                                <div className="max-h-40 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] custom-scrollbar">
                                    {treatmentChatHistory.map((msg, i) => (
                                        <div key={i} className={`p-1.5 rounded ${msg.role === 'user' ? 'bg-emerald-50 text-emerald-800 text-right ml-4' : 'bg-slate-100 text-slate-600 mr-4'}`}>
                                            <div className="font-bold text-[9px] uppercase text-slate-400">{msg.role === 'user' ? 'Tú' : 'IA'}</div>
                                            <div className="mt-0.5 whitespace-pre-wrap">{msg.text}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={treatmentChatMessage}
                                    onChange={(e) => setTreatmentChatMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendTreatmentChatMessage()}
                                    placeholder="Ej: cambia el desayuno, añade jengibre..."
                                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendTreatmentChatMessage}
                                    disabled={isTreatmentChatLoading || !treatmentChatMessage.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                >
                                    {isTreatmentChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                                Pídele a la IA que modifique las indicaciones del PDF, la rutina diaria, las categorías o las hierbas, y los cambios se aplicarán automáticamente.
                            </p>
                        </div>

                        </>)}

                        {activeTab === 'indicaciones' && (<>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Diagnóstico para PDF</label>
                                <ToggleSwitch
                                    checked={showDiagnosis}
                                    onChange={setShowDiagnosis}
                                    label="Mostrar en PDF"
                                />
                            </div>
                            <SpeechTextarea
                                value={patientDiagnosisText}
                                onValueChange={setPatientDiagnosisText}
                                rows={4}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                placeholder="Versión sencilla del diagnóstico para el paciente..."
                            />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPatientDiagnosisText(buildPatientDiagnosisFallback(editingRecord?.record?.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient), selectedDosha))}
                                    className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    Restaurar diagnóstico base
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPatientDiagnosisText('')}
                                    className="text-[11px] font-bold text-slate-500 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    Limpiar
                                </button>
                            </div>
                            {!showDiagnosis && (
                                <p className="text-[11px] text-amber-600">El diagnóstico no aparecerá en el PDF (oculto).</p>
                            )}
                        </div>

                        {/* AI-generated treatment text inserted into the PDF */}
                        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Enfoque automático del PDF
                                </label>
                                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                    IA / Editable
                                </span>
                            </div>
                            {isTreatmentPreviewLoading ? (
                                <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 custom-scrollbar">
                                    <div className="flex items-center gap-2 text-emerald-700">
                                        <Loader2 size={13} className="animate-spin" />
                                        Generando indicaciones para insertarlas en el PDF...
                                    </div>
                                </div>
                            ) : (
                                <SpeechTextarea
                                    value={mainIndication}
                                    onValueChange={setMainIndication}
                                    rows={8}
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                    placeholder="La IA agregará aquí el enfoque de comida, raspa lengua y fórmula herbal cuando se genere el tratamiento."
                                />
                            )}
                            <p className="text-[11px] leading-snug text-slate-400">
                                Esta sección se puede editar manualmente, se actualiza automáticamente con la selección de categorías alimenticias y se coloca en “Tratamiento e Indicaciones” del PDF.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tratamiento clínico para archivo</label>
                            <SpeechTextarea
                                value={clinicalTreatmentIndication}
                                onValueChange={setClinicalTreatmentIndication}
                                rows={5}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                placeholder="Versión detallada que se guardará en el archivo del paciente..."
                            />
                        </div>

                        {/* Lifestyle Text */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estilo de Vida</label>
                            </div>
                            
                            {/* Autocomplete Search for Lifestyle suggestions */}
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={lifestyleSearchQuery}
                                    onChange={(e) => handleLifestyleSearchChange(e.target.value)}
                                    onBlur={() => setTimeout(() => setShowLifestyleSuggestions(false), 200)}
                                    onFocus={() => {
                                        if (lifestyleSearchQuery.trim()) {
                                            setShowLifestyleSuggestions(true);
                                        }
                                    }}
                                    placeholder="🔍 Buscar o seleccionar hábito..."
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                                {showLifestyleSuggestions && lifestyleSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-slate-50 border border-slate-200 rounded-lg shadow-sm max-h-48 overflow-y-auto z-[100] text-xs">
                                        {lifestyleSuggestions.map((item, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSelectLifestyle(item)}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-200 text-slate-800 transition-colors border-b border-slate-200 last:border-0"
                                            >
                                                <div className="font-semibold text-emerald-600">{item.name}</div>
                                                <div className="text-[10px] text-slate-500 truncate">{item.text}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <SpeechTextarea
                                value={lifestyleIndication}
                                onValueChange={setLifestyleIndication}
                                rows={4}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                placeholder="Rutina, descanso, ejercicio, respiración, hábitos graduales..."
                            />

                            {/* Save Custom Lifestyle button */}
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                                <input 
                                    type="text"
                                    value={newLifestyleName}
                                    onChange={(e) => setNewLifestyleName(e.target.value)}
                                    placeholder="Nombre para guardar este estilo (ej. Caminata matutina)"
                                    className="w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveCustomLifestyle}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-emerald-600 border border-slate-200 font-bold text-xs py-1.5 rounded-lg transition-all"
                                >
                                    Guardar como Hábito Base (Futuros usos)
                                </button>
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'alimentacion' && (<>
                        <div className="space-y-2 pt-3 border-t border-slate-200">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cómo comer: {focusedCategories.join(' y ')}</label>
                            <SpeechTextarea
                                value={cerealGuidance}
                                onValueChange={setCerealGuidance}
                                rows={5}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                placeholder={`Indicaciones para preparar y comer ${focusedCategories.map(c => c.toLowerCase()).join(' y ')}...`}
                            />
                        </div>

                        <div className="space-y-2 pt-3 border-t border-slate-200">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guía de alimentación saludable</label>
                                <ToggleSwitch
                                    checked={showHealthyEatingGuide}
                                    onChange={setShowHealthyEatingGuide}
                                    label="Mostrar en PDF"
                                />
                            </div>
                            <SpeechTextarea
                                value={healthyEatingGuide}
                                onValueChange={setHealthyEatingGuide}
                                rows={8}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                placeholder="Guía general de alimentación saludable para el paciente (admite Markdown: # títulos, - viñetas)..."
                            />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setHealthyEatingGuide(HEALTHY_EATING_GUIDE_TEXT)}
                                    className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    Restaurar texto sugerido
                                </button>
                            </div>

                            {/* Selección de hábitos para la guía (como las categorías de comida) */}
                            <div className="space-y-2 pt-3">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Hábitos para comer saludablemente</label>
                                    <span className="text-[10px] font-bold text-emerald-600">{selectedHealthyHabits.length} seleccionados</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHealthyHabits([...HEALTHY_EATING_HABITS])}
                                        className="text-[10px] font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-0.5 transition-colors"
                                    >
                                        Seleccionar todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHealthyHabits([])}
                                        className="text-[10px] font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-0.5 transition-colors"
                                    >
                                        Ninguno
                                    </button>
                                </div>
                                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    {HEALTHY_EATING_HABITS.map((habit) => {
                                        const isSelected = selectedHealthyHabits.includes(habit);
                                        return (
                                            <label key={habit} className="flex items-start gap-2 text-xs select-none cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleHealthyHabit(habit)}
                                                    className="mt-0.5 rounded border-slate-200 bg-white text-emerald-600 focus:ring-0 cursor-pointer w-3.5 h-3.5 shrink-0"
                                                />
                                                <span className={isSelected ? 'text-emerald-700 font-medium leading-snug' : 'text-slate-500 leading-snug'}>
                                                    {habit}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] leading-snug text-slate-400">
                                    Marca los hábitos que quieres incluir en la guía del PDF.
                                </p>
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'hierbas' && (<>
                        {/* Herbal Formulas */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Fórmulas Herbales</label>
                            {repeatedHerbs.length > 0 && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] leading-snug text-emerald-800">
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 mb-1">
                                        <AlertCircle size={13} />
                                        Fórmulas usadas previamente
                                    </div>
                                    {repeatedHerbs.map(item => (
                                        <p key={item.name}>
                                            {item.name}: {item.count} vez/veces, última {formatReuseDate(item.lastDate)} ({formatAdherenceStatus(item.lastStatus)}).
                                        </p>
                                    ))}
                                    <p className="mt-1 text-emerald-600">Puedes repetirlas si lo decides; este aviso es solo para evitar duplicarlas por accidente.</p>
                                </div>
                            )}
                            
                            {/* Herb List */}
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                {herbs.map((h, idx) => {
                                    const isRepeatedHerb = repeatedHerbs.some(item => normalizeReuseName(item.name) === normalizeReuseName(h.formula));
                                    return (
                                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg gap-2 text-xs">
                                        <div className="flex-1 truncate">
                                            <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                                                <span className="truncate">{h.formula}</span>
                                                {isRepeatedHerb ? (
                                                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">Repetida</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200 shrink-0">Nueva</span>
                                                )}
                                            </div>
                                            <div className="text-slate-500 truncate">{h.dosage}</div>
                                            {h.purpose && <div className="text-[10px] text-slate-400 truncate italic">{h.purpose}</div>}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveHerb(idx)}
                                            className="text-slate-400 hover:text-red-400 p-1 hover:bg-slate-200 rounded transition-colors shrink-0"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>

                            {/* Add Herb Form */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 relative">
                                {/* Search input with autocomplete suggestions */}
                                <div className="relative">
                                    <input 
                                        type="text"
                                        value={newHerbName}
                                        onChange={(e) => handleHerbNameChange(e.target.value)}
                                        onBlur={() => setTimeout(() => setShowHerbSuggestions(false), 200)}
                                        onFocus={() => {
                                            if (newHerbName.trim()) {
                                                setShowHerbSuggestions(true);
                                            }
                                        }}
                                        placeholder="Nombre de la hierba/fórmula"
                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                    />
                                    {showHerbSuggestions && herbSuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 mt-1 bg-slate-50 border border-slate-200 rounded-lg shadow-sm max-h-48 overflow-y-auto z-[100] text-xs">
                                            {herbSuggestions.map((h, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => handleSelectHerb(h)}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-200 text-slate-800 transition-colors border-b border-slate-200 last:border-0"
                                                >
                                                    <div className="font-semibold text-emerald-600">{h.name}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{h.preview}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <input 
                                    type="text"
                                    value={newHerbDosage}
                                    onChange={(e) => setNewHerbDosage(e.target.value)}
                                    placeholder="Dosis e indicaciones (ej. 2 caps)"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />

                                <input 
                                    type="text"
                                    value={newHerbInstruction}
                                    onChange={(e) => setNewHerbInstruction(e.target.value)}
                                    placeholder="Cómo usar / Horario (ej. En ayunas con agua tibia)"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />

                                <input 
                                    type="text"
                                    value={newHerbPurpose}
                                    onChange={(e) => setNewHerbPurpose(e.target.value)}
                                    placeholder="¿Para qué sirve? (ej. Equilibrio hormonal)"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />

                                {/* Custom Formula toggle and ingredients box */}
                                <div className="space-y-2 pt-1">
                                    <ToggleSwitch
                                        checked={isCustomFormula}
                                        label="¿Es una fórmula personalizada?"
                                        onChange={setIsCustomFormula}
                                    />

                                    {isCustomFormula && (
                                        <div className="space-y-1 animate-fadeIn">
                                            <textarea
                                                value={newHerbIngredients}
                                                onChange={(e) => setNewHerbIngredients(e.target.value)}
                                                placeholder="Ingredientes / Contenido de la fórmula (ej. Ashwagandha 50%, Shatavari 30%, Brahmi 20%)"
                                                rows={2}
                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Selected Herb Info Card */}
                                {selectedHerbInfo && (
                                    <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs space-y-1 mt-1 text-slate-600">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-emerald-600">{selectedHerbInfo.name}</span>
                                            {selectedHerbInfo.link && (
                                                <a href={selectedHerbInfo.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline">
                                                    Info clásica
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-[11px] leading-snug italic text-slate-500">{selectedHerbInfo.preview}</p>
                                        <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1 text-slate-500 border-t border-slate-200">
                                            <div><span className="font-semibold text-slate-600">Rasa:</span> {selectedHerbInfo.rasa?.join(', ') || 'N/A'}</div>
                                            <div><span className="font-semibold text-slate-600">Virya:</span> {selectedHerbInfo.virya || 'N/A'}</div>
                                            <div><span className="font-semibold text-slate-600">Vipaka:</span> {selectedHerbInfo.vipaka || 'N/A'}</div>
                                            <div><span className="font-semibold text-slate-600">Guna:</span> {selectedHerbInfo.guna?.join(', ') || 'N/A'}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            <span className="font-semibold text-slate-600">Pacifica:</span> {selectedHerbInfo.pacify?.join(', ') || 'N/A'}
                                        </div>
                                    </div>
                                )}

                                {newHerbName.trim() && (
                                    <button
                                        type="button"
                                        onClick={handleSaveHerbDefinition}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-emerald-600 border border-slate-200 font-bold text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                                    >
                                        Actualizar fórmula base (Futuros usos)
                                    </button>
                                )}

                                <button
                                    onClick={handleAddHerb}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Plus size={14} />
                                    Agregar Fórmula
                                </button>
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'alimentacion' && (<>
                        {/* Recetas Recomendadas Section */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Recetas Recomendadas</label>
                            
                            {/* Selected Recipes List */}
                            {selectedRecipes.length > 0 && (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {selectedRecipes.map((r, idx) => {
                                        const isEditing = editingRecipeId === r.id;
                                        return (
                                            <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg text-xs space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-slate-800 truncate">{r.title}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{r.category} · {r.doshas.join(', ') || 'General'}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button 
                                                            onClick={() => setEditingRecipeId(isEditing ? null : r.id)}
                                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                                                isEditing 
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                                                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                                            }`}
                                                            title={isEditing ? "Cerrar edición" : "Editar receta"}
                                                        >
                                                            {isEditing ? "Listo" : "Editar"}
                                                        </button>
                                                        <button 
                                                            onClick={() => setSelectedRecipes(selectedRecipes.filter((_, i) => i !== idx))}
                                                            className="text-slate-400 hover:text-red-400 p-1 hover:bg-slate-200 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {isEditing && (
                                                    <div className="space-y-2 pt-1.5 border-t border-slate-200">
                                                        <div>
                                                            <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Título de la Receta:</label>
                                                            <input
                                                                type="text"
                                                                value={r.title || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...selectedRecipes];
                                                                    updated[idx] = { ...updated[idx], title: e.target.value };
                                                                    setSelectedRecipes(updated);
                                                                }}
                                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-emerald-500 font-sans font-bold"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Modificar Texto de la Receta:</label>
                                                            <textarea
                                                                value={r.text || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...selectedRecipes];
                                                                    updated[idx] = { ...updated[idx], text: e.target.value, structured: undefined };
                                                                    setSelectedRecipes(updated);
                                                                }}
                                                                rows={8}
                                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 outline-none focus:border-emerald-500 font-sans resize-y leading-relaxed"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveRecipeToDatabase(r)}
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[10px] py-1.5 rounded transition-all flex items-center justify-center gap-1 shadow-sm mt-1"
                                                        >
                                                            Guardar en Base de Datos (Futuras Recetas)
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add Recipe Form */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                {/* Category and Dosha Filters */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Categoría</label>
                                        <select
                                            value={recipeCategoryFilter}
                                            onChange={(e) => setRecipeCategoryFilter(e.target.value)}
                                            className="w-full text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 outline-none focus:border-emerald-500"
                                        >
                                            <option value="Todos">Todas</option>
                                            <option value="Recuperación Digestiva">Recuperación Digestiva</option>
                                            <option value="Desayuno">Desayuno</option>
                                            <option value="Comida">Comida</option>
                                            <option value="Cena">Cena</option>
                                            <option value="Snacks">Snacks</option>
                                            <option value="Cereales">Cereales</option>
                                            <option value="Lácteos">Lácteos</option>
                                            <option value="Endulzantes">Endulzantes</option>
                                            <option value="Aceites">Aceites</option>
                                            <option value="Frutas">Frutas</option>
                                            <option value="Hortalizas">Hortalizas</option>
                                            <option value="Nueces">Nueces</option>
                                            <option value="Carnes">Carnes</option>
                                            <option value="Legumbres">Legumbres</option>
                                            <option value="Condimentos">Condimentos</option>
                                            <option value="Bebidas">Bebidas</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Dosha</label>
                                        <select
                                            value={recipeDoshaFilter}
                                            onChange={(e) => setRecipeDoshaFilter(e.target.value)}
                                            className="w-full text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 outline-none focus:border-emerald-500"
                                        >
                                            <option value="Todos">Todos</option>
                                            <option value="Vata">Vata</option>
                                            <option value="Pitta">Pitta</option>
                                            <option value="Kapha">Kapha</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Text Search */}
                                <input 
                                    type="text"
                                    value={recipeSearchQuery}
                                    onChange={(e) => setRecipeSearchQuery(e.target.value)}
                                    placeholder="Buscar receta por nombre..."
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />

                                {/* Recipe Dropdown Selector */}
                                <select
                                    value={selectedRecipeToAdd ? selectedRecipeToAdd.id : ''}
                                    onChange={(e) => {
                                        const r = (recipesList as any[]).find(rec => rec.id === e.target.value);
                                        setSelectedRecipeToAdd(r || null);
                                    }}
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- Selecciona una receta ({filteredRecipes.length} encontradas) --</option>
                                    {filteredRecipes.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.title}
                                        </option>
                                    ))}
                                </select>

                                {/* Selected Recipe Details (Preview) */}
                                {selectedRecipeToAdd && (
                                    <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs space-y-1 text-slate-600">
                                        <div className="font-bold text-emerald-600">{selectedRecipeToAdd.title}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {(() => {
                                                const printableRecipe = getPrintableRecipe(selectedRecipeToAdd);
                                                return `Vata: ${printableRecipe.vataEffect} | Pitta: ${printableRecipe.pittaEffect} | Kapha: ${printableRecipe.kaphaEffect}`;
                                            })()}
                                        </div>
                                        <p className="text-[10px] leading-snug line-clamp-2 text-slate-500 mt-1 italic">
                                            {getPrintableRecipe(selectedRecipeToAdd).printableText.replace(/[\n\r]+/g, ' ')}
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (selectedRecipeToAdd && !selectedRecipes.some(r => r.id === selectedRecipeToAdd.id)) {
                                            setSelectedRecipes([...selectedRecipes, selectedRecipeToAdd]);
                                            setSelectedRecipeToAdd(null);
                                            setRecipeSearchQuery('');
                                        }
                                    }}
                                    disabled={!selectedRecipeToAdd || selectedRecipes.some(r => r.id === selectedRecipeToAdd.id)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Plus size={14} />
                                    Agregar Receta
                                </button>
                            </div>
                        </div>
                        </>)}
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200 bg-white">
                        {saveMessage && (
                            <p className={`mb-2 text-xs font-medium ${saveMessage.startsWith('No se pudo') ? 'text-red-600' : 'text-emerald-700'}`}>
                                {saveMessage}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => handleSavePlan()}
                            disabled={isSavingPlan}
                            className="w-full mb-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isSavingPlan ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            Guardar local editable
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={isDownloading || isSavingPlan}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Generando Documento...
                                </>
                            ) : (
                                <>
                                    <Printer size={18} />
                                    Imprimir / Descargar PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Printable Document Preview Area */}
                <div 
                    className={`flex-1 bg-[#cbd5e1] overflow-y-auto p-8 flex flex-col items-center gap-8 print:bg-white print:p-0 print:overflow-visible ${
                        isDownloading ? 'opacity-0 pointer-events-none' : ''
                    }`}
                    id="pdf-content"
                    style={{
                        '--pdf-font-base': FONT_SIZE_PRESETS[pdfFontSize].base,
                        '--pdf-font-title': FONT_SIZE_PRESETS[pdfFontSize].title,
                        '--pdf-font-subtitle': FONT_SIZE_PRESETS[pdfFontSize].subtitle,
                        '--pdf-font-heading': FONT_SIZE_PRESETS[pdfFontSize].heading,
                        '--pdf-font-table-header': FONT_SIZE_PRESETS[pdfFontSize].tableHeader,
                        '--pdf-font-table-body': FONT_SIZE_PRESETS[pdfFontSize].tableBody,
                        '--pdf-font-meta': FONT_SIZE_PRESETS[pdfFontSize].meta,
                    } as React.CSSProperties}
                >
                    
                    {/* PAGE 1: Intro and General Instructions */}
                    <div className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                        
                        {/* Document Header */}
                        <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                <div>
                                    <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                    <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                </div>
                            </div>
                            <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                <p className="font-semibold text-[#334155]">Paciente: <span className="font-bold text-[#0f172a] font-serif text-sm">{patient.name}</span></p>
                                <p>Edad: {patient.age || 'N/A'} años</p>
                                <p>Fecha: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p>Dosha principal: <span className="font-semibold text-[#16a34a]">{selectedDosha}</span></p>
                                <p>Profesional: <span className="font-semibold text-[#334155]">{professionalContact.name}</span></p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-5 flex-1">
                            {/* Welcome Banner */}
                            <div className="text-center bg-[#22c55e]/5 py-3 px-5 rounded-xl border border-[#22c55e]/10">
                                <h2 className="text-[18px] font-bold text-[#1e293b] mb-1 pdf-title">{title}</h2>
                                <p className="text-[12.5px] text-[#64748b] font-sans italic pdf-subtitle">{subtitle}</p>
                            </div>

                            {!isFollowUp ? (
                                <>
                                    {/* CÓMO SEGUIR LAS INDICACIONES */}
                                    <div className="space-y-2">
                                        <div className="bg-[#113f26] text-white flex items-center border-l-[5px] border-[#d4a853] py-1.5 px-3">
                                            <span className="font-sans font-bold tracking-wider text-[11px] uppercase">01 CÓMO SEGUIR LAS INDICACIONES</span>
                                        </div>
                                        <ol className="list-decimal pl-5 space-y-1.5 text-[11px] leading-relaxed text-[#334155] font-sans pdf-base-text">
                                            <li>Lee las indicaciones generales que vienen en este documento.</li>
                                            <li>Descarga y revisa los archivos adjuntos. A lado de tratamientos se indicará si hay anexo. <span className="italic text-[#64748b]">(No siempre hay archivos adjuntos.)</span></li>
                                            <li>Mantente en contacto conmigo; no esperes hasta la consulta para resolver dudas o reportar cualquier cambio en tu salud.</li>
                                            <li>
                                                Visita los siguientes videos para el mejor entendimiento del Ayurveda:
                                                <div className="mt-1 pl-1 space-y-1 text-[#113f26]">
                                                    <div className="flex items-start gap-1">
                                                        <span className="text-[#d4a853]">→</span>
                                                        <span>
                                                            <strong className="text-[#113f26]">Doshas:</strong>{' '}
                                                            <a href="https://youtu.be/iHlND1C8WoE" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-[#22c55e] underline font-semibold break-all">
                                                                https://youtu.be/iHlND1C8WoE
                                                            </a>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-1">
                                                        <span className="text-[#d4a853]">→</span>
                                                        <span>
                                                            <strong className="text-[#113f26]">Los tres pilares de la salud:</strong>{' '}
                                                            <a href="https://youtu.be/v8aPGf8LNSk" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-[#22c55e] underline font-semibold break-all">
                                                                https://youtu.be/v8aPGf8LNSk
                                                            </a>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-start gap-1">
                                                        <span className="text-[#d4a853]">→</span>
                                                        <span>
                                                            <strong className="text-[#113f26]">La verdadera salud con Ayurveda:</strong>{' '}
                                                            <a href="https://youtu.be/g2FqJDZGS_A" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-[#22c55e] underline font-semibold break-all">
                                                                https://youtu.be/g2FqJDZGS_A
                                                            </a>
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        </ol>
                                    </div>

                                    {/* Alimentacion instructions intro */}
                                    <div className="space-y-2.5">
                                        <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-[#16a34a] font-sans pdf-heading">Cómo Seguir la Alimentación</h3>
                                        <p className="text-[12px] leading-relaxed text-[#475569] font-sans pdf-base-text">
                                            En la alimentación la clave es hacer cambios graduales para permitir al cuerpo adaptarse. En Ayurveda la alimentación se basa en los seis sabores; para elegir los alimentos adecuados estos tienen que tener los sabores correctos para tu constitución.
                                            Empezaremos haciendo cambios en dos categorías a la vez, esto quiere decir que todas las demás categorías seguirán sin ningún cambio.
                                        </p>
                                        
                                        {/* Color Legend */}
                                        <div className="grid grid-cols-3 gap-2.5 bg-[#f8fafc] p-2 rounded-lg border border-[#f1f5f9] text-[10px] font-sans mt-0.5 pdf-meta">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded bg-[#22c55e] block shrink-0"></span>
                                                <div><span className="font-bold text-[#15803d]">■ Mejor:</span> Sin reservas.</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 border-x border-[#e2e8f0] px-2.5">
                                                <span className="w-2 h-2 rounded bg-[#f59e0b] block shrink-0"></span>
                                                <div><span className="font-bold text-[#b45309]">■■ Moderación:</span> Porción pequeña.</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 pl-1.5">
                                                <span className="w-2 h-2 rounded bg-[#ef4444] block shrink-0"></span>
                                                <div><span className="font-bold text-[#b91c1c]">■ Evitar:</span> Raras ocasiones.</div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="my-auto py-8 px-6 rounded-xl border border-[#d4a853] bg-[#fffbeb]/50 text-center font-sans space-y-4 shadow-sm">
                                    <div className="w-12 h-12 rounded-full bg-[#113f26] text-[#d4a853] flex items-center justify-center font-bold text-xl mx-auto shadow-md">
                                        i
                                    </div>
                                    <h4 className="text-[15px] font-bold uppercase tracking-wider text-[#113f26] font-bold">
                                        Indicación de Seguimiento Importante
                                    </h4>
                                    <p className="text-[13px] leading-relaxed text-[#334155] max-w-[85%] mx-auto font-medium">
                                        Es importante continuar con las pautas y tratamientos indicados en las visitas anteriores, sumando de manera gradual el nuevo tratamiento y las modificaciones detalladas en este documento.
                                    </p>
                                </div>
                            )}

                        </div>

                        {/* Page 1 Footer */}
                        <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                            <div>
                                <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                {professionalContactLine}
                            </div>
                        </div>
                    </div>

                    {/* PAGE 2: Base Diagnosis Pages */}
                    {showDiagnosis && (!isFollowUp || recordDiagnosisPreview.trim() || patientDiagnosisText.trim()) && diagnosisPreview && diagnosisPages.map((pageText, idx) => (
                        <div key={`diagnosis-${idx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                            {/* Document Header */}
                            <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                    <div>
                                        <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                        <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                    </div>
                                </div>
                                <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                    <p className="font-semibold text-[#334155]">Diagnóstico Base</p>
                                    {diagnosisPages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {diagnosisPages.length}</p>}
                                    <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4 flex-1">
                                <div className="space-y-1.5">
                                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-[#16a34a] font-sans pdf-heading">
                                        Diagnóstico Base {diagnosisPages.length > 1 ? `(Parte ${idx + 1})` : ''}
                                    </h3>
                                    <div className="diagnosis-markdown bg-[#f8fafc] p-4 rounded-xl border border-[#dbeafe] text-[12px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none prose-p:text-[#334155] prose-p:my-1 prose-headings:text-slate-800 prose-headings:font-bold prose-headings:text-[13px] prose-headings:my-1.5 prose-strong:text-slate-900 prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1 prose-li:my-0.5 pdf-base-text">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>

                            {/* Page Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* PAGES 3+: Treatment Pages */}
                    {treatmentPages.length > 0 && treatmentPages.map((pageText, idx) => (
                        <div key={`treatment-${idx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                            
                            {/* Document Header */}
                            <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                    <div>
                                        <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                        <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                    </div>
                                </div>
                                <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                    <p className="font-semibold text-[#334155]">Tratamiento e Indicaciones</p>
                                    <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {treatmentPages.length}</p>
                                    <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4 flex-1">
                                <div className="space-y-1.5">
                                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-[#16a34a] font-sans pdf-heading">
                                        Tratamiento e Indicaciones {treatmentPages.length > 1 ? `(Parte ${idx + 1})` : ''}
                                    </h3>
                                    <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#fde68a] prose prose-sm prose-emerald max-w-none text-[12px] leading-relaxed text-[#334155] font-sans prose-p:text-[#334155] prose-p:my-1 prose-headings:text-slate-800 prose-headings:font-bold prose-headings:text-[13px] prose-headings:my-1.5 prose-strong:text-slate-900 prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1 prose-li:my-0.5 pdf-base-text">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>

                            {/* Page Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}



                    {/* Lifestyle Pages */}
                    {showLifestylePage && lifestylePages.length > 0 && lifestylePages.map((pageText, idx) => (
                        <div key={`lifestyle-${idx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                            
                            {/* Document Header */}
                            <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                    <div>
                                        <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                        <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                    </div>
                                </div>
                                <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                    <p className="font-semibold text-[#334155]">Estilo de Vida</p>
                                    <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {lifestylePages.length}</p>
                                    <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4 flex-1">
                                <div className="space-y-1.5">
                                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-[#16a34a] font-sans pdf-heading">
                                        Estilo de Vida {lifestylePages.length > 1 ? `(Parte ${idx + 1})` : ''}
                                    </h3>
                                    <div className="bg-[#ecfdf5] p-4 rounded-xl border border-[#bbf7d0] text-[12px] leading-relaxed text-[#334155] font-sans whitespace-pre-line pdf-base-text">
                                        {pageText}
                                    </div>
                                </div>
                            </div>

                            {/* Page Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Digestive Recovery Pages */}
                    {showDigestiveRecoveryPage && digestiveRecoveryPages.map((pageText, idx) => (
                        <div key={`digestive-recovery-${idx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                            <div className="flex-1 flex flex-col">
                                {/* Document Header */}
                                <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                        <div>
                                            <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                            <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                        <p className="font-semibold text-[#334155]">Recuperación Digestiva</p>
                                        <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {digestiveRecoveryPages.length}</p>
                                        <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-4 flex-1 flex flex-col">
                                    <div className="space-y-1.5 flex-1 bg-[#fffbeb] p-5 rounded-xl border border-[#fde68a] overflow-hidden">
                                        <div className="text-[11.5px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none prose-p:text-[#334155] prose-p:my-1.5 prose-strong:text-slate-900 prose-em:text-[#475569] prose-h1:text-[13px] prose-h1:font-bold prose-h1:uppercase prose-h1:tracking-wider prose-h1:text-[#b45309] prose-h1:mt-0 prose-h1:mb-2 prose-h2:text-[11.5px] prose-h2:font-bold prose-h2:text-[#92400e] prose-h2:mt-2.5 prose-h2:mb-1 prose-ul:my-1 prose-li:my-0.5 pdf-base-text">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Guía de alimentación saludable (fix #6) */}
                    {showHealthyEatingGuide && healthyEatingGuidePages.map((pageText, idx) => (
                        <div key={`healthy-eating-${idx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                            <div className="flex-1 flex flex-col">
                                <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                        <div>
                                            <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                            <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                        <p className="font-semibold text-[#334155]">Guía de Alimentación Saludable</p>
                                        {healthyEatingGuidePages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {healthyEatingGuidePages.length}</p>}
                                        <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-4 flex-1 flex flex-col">
                                    <div className="space-y-1.5 flex-1 bg-[#f0fdf4] p-5 rounded-xl border border-[#bbf7d0] overflow-hidden">
                                        <div className="text-[11.5px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none prose-p:text-[#334155] prose-p:my-1.5 prose-strong:text-slate-900 prose-em:text-[#475569] prose-h1:text-[13px] prose-h1:font-bold prose-h1:uppercase prose-h1:tracking-wider prose-h1:text-[#16a34a] prose-h1:mt-0 prose-h1:mb-2 prose-h2:text-[11.5px] prose-h2:font-bold prose-h2:text-[#15803d] prose-h2:mt-2.5 prose-h2:mb-1 prose-ul:my-1 prose-li:my-0.5 pdf-base-text">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pageText}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* PAGES 3+: Dynamic Diet Category Tables (Paged in pairs) */}
                    {categoryChunks.map((chunk, chunkIdx) => (
                        <div key={chunkIdx} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                            <div className="space-y-6 flex-1">
                                {/* Header */}
                                <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                        <div>
                                            <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                            <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                        <p className="font-semibold text-[#334155]">Pautas Dietéticas {selectedDosha}</p>
                                        <p className="text-[10px] text-[#64748b]">Parte {chunkIdx + 1} de {categoryChunks.length}</p>
                                        <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                    </div>
                                </div>

                                {/* Chunk categories */}
                                <div className="space-y-6 mt-4">
                                    {chunk.map((cat: any, catIdx: number) => (
                                        <div key={catIdx} className="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-[#f8fafc]/85 border-b border-[#e2e8f0] px-4 py-2.5 flex flex-col md:flex-row justify-between md:items-center gap-1">
                                                <span className="text-[13px] font-bold font-sans text-[#334155] pdf-base-text">
                                                    Categoría — {cat.nombre}
                                                </span>
                                                {cat.consejo && (
                                                    <span className="text-[10px] text-[#475569] font-sans italic leading-tight max-w-[70%] text-left md:text-right pdf-subtitle">
                                                        {cat.consejo}
                                                    </span>
                                                )}
                                            </div>
                                            <table className="w-full text-[12px] font-sans border-separate border-spacing-0">
                                                <thead>
                                                    <tr className="bg-[#ffffff] text-[10px] uppercase font-bold border-b border-[#e2e8f0] pdf-meta">
                                                        <th className="w-1/3 px-4 py-2 text-left text-[#15803d] border-r border-[#e2e8f0]">
                                                            <span className="text-[#16a34a] mr-1.5 text-[9px]">■</span>MEJOR
                                                        </th>
                                                        <th className="w-1/3 px-4 py-2 text-left text-[#b45309] border-r border-[#e2e8f0]">
                                                            <span className="text-[#d97706] mr-1.5 tracking-tighter text-[9px]">■■</span>MODERACIÓN
                                                        </th>
                                                        <th className="w-1/3 px-4 py-2 text-left text-[#b91c1c]">
                                                            <span className="text-[#dc2626] mr-1.5 text-[9px]">■</span>EVITAR
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="align-top bg-[#ffffff] divide-x divide-[#e2e8f0] pdf-base-text">
                                                        <td className="px-4 py-3 text-[#475569] leading-relaxed border-r border-[#e2e8f0] text-[11.5px] pdf-base-text">
                                                            {cat.mejor && cat.mejor.length > 0 ? cat.mejor.join(', ') : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-[#475569] leading-relaxed border-r border-[#e2e8f0] text-[11.5px] pdf-base-text">
                                                            {((cat.pequenas_cantidades || cat.moderacion) && (cat.pequenas_cantidades || cat.moderacion).length > 0)
                                                                ? (cat.pequenas_cantidades || cat.moderacion).join(', ')
                                                                : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-[#475569] leading-relaxed text-[11.5px] pdf-base-text">
                                                            {cat.evitar && cat.evitar.length > 0 ? cat.evitar.join(', ') : '—'}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Cereals and manual recipes page */}
                    <div className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                        <div className="space-y-6 flex-1">
                            {/* Header */}
                            <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                    <div>
                                        <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                        <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                    </div>
                                </div>
                                <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                    <p className="font-semibold text-[#334155]">Cómo Comer los Cereales</p>
                                    <p className="text-[10px] text-[#64748b]">Preparación y Recetas</p>
                                    <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                </div>
                            </div>

                            <div className="space-y-4 mt-5">
                                <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
                                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#16a34a] font-sans mb-2 pdf-subtitle">
                                        Guía práctica
                                    </h4>
                                    <div className="text-[12px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none prose-p:text-[#334155] prose-p:my-1 prose-strong:text-slate-900 prose-em:text-[#475569] pdf-base-text">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cerealGuidance}</ReactMarkdown>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5 min-h-[148mm] flex flex-col">
                                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#b45309] font-sans mb-3 pdf-subtitle">
                                        Recetas recomendadas
                                    </h4>
                                    {selectedRecipes.length > 0 ? (
                                        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-white/60 rounded-xl border border-dashed border-[#fde68a] text-slate-600 font-sans">
                                            <p className="font-bold text-[#b45309] text-[12.5px] mb-2">
                                                Se han adjuntado las siguientes recetas personalizadas en las páginas siguientes:
                                            </p>
                                            <ul className="list-disc text-left text-[11.5px] text-[#334155] space-y-1.5 mt-1 max-w-[85%]">
                                                {selectedRecipes.map((r, i) => (
                                                    <li key={i} className="font-semibold">
                                                        {r.title} <span className="font-normal text-slate-500">({r.category} · {r.doshas.join(', ')})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : cerealRecipe.trim() ? (
                                        <div className="text-[12px] leading-relaxed text-[#334155] font-sans whitespace-pre-line pdf-base-text">
                                            {cerealRecipe}
                                        </div>
                                    ) : (
                                        <div className="flex-1 grid grid-rows-[auto_auto_1fr] gap-4 text-[#94a3b8] font-sans pdf-meta">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mb-2 pdf-meta">Nombre</p>
                                                <div className="border-b border-dashed border-[#d6a64a] h-8"></div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mb-2 pdf-meta">Ingredientes</p>
                                                <div className="space-y-4">
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mb-2 pdf-meta">Preparación</p>
                                                <div className="space-y-4">
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                    <div className="border-b border-dashed border-[#d6a64a] h-5"></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                            <div>
                                <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                {professionalContactLine}
                            </div>
                        </div>
                    </div>

                    {/* Dedicated page for each selected recipe */}
                    {selectedRecipes.map((recipe, index) => {
                        const printableRecipe = getPrintableRecipe(recipe);
                        const recipePageLimit = pdfFontSize === 'sm' ? 2100 : pdfFontSize === 'base' ? 1750 : pdfFontSize === 'lg' ? 1350 : 1050;
                        const recipePages = paginateParagraphs(printableRecipe.printableText, recipePageLimit - 300, recipePageLimit, pdfFontSize);
                        return recipePages.map((pageText, pageIdx) => (
                            <div key={`recipe-page-${recipe.id}-${index}-${pageIdx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                                <div className="space-y-6 flex-1">
                                    {/* Header */}
                                    <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                        <div className="flex items-center gap-3">
                                            <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                            <div>
                                                <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                                <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                            </div>
                                        </div>
                                        <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                            <p className="font-semibold text-[#334155]">Receta Recomendada</p>
                                            <p className="text-[10px] text-[#64748b]">
                                                {recipePages.length > 1 ? `Parte ${pageIdx + 1} de ${recipePages.length}` : 'Detalle'}
                                            </p>
                                            <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mt-6">
                                        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-6 flex flex-col">
                                            {pageIdx === 0 && (
                                                <>
                                                    <div className="flex justify-between items-start gap-3 border-b border-[#fde68a] pb-3">
                                                        <div>
                                                            <h4 className="text-[16px] font-bold text-[#1e293b] font-sans leading-snug">{recipe.title}</h4>
                                                            <p className="text-[10px] uppercase tracking-wider text-[#b45309] font-bold mt-1 font-sans">
                                                                Categoría: {recipe.category} · Doshas: {printableRecipe.doshaLabel}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Dosha Effects */}
                                                    <div className="grid grid-cols-3 gap-2 bg-white/60 p-2.5 rounded-lg border border-[#fde68a]/50 text-[10px] text-[#475569] mt-3 font-sans">
                                                        <div><span className="font-bold text-[#334155]">Vata:</span> {printableRecipe.vataEffect}</div>
                                                        <div><span className="font-bold text-[#334155]">Pitta:</span> {printableRecipe.pittaEffect}</div>
                                                        <div><span className="font-bold text-[#334155]">Kapha:</span> {printableRecipe.kaphaEffect}</div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Recipe Content - Large and Readable */}
                                            <div className="text-[13.5px] leading-relaxed text-[#334155] mt-4 font-sans pdf-base-text">
                                                {pageText.split('\n').map((line, lineIdx) => {
                                                    const isSectionTitle = ['Datos de la receta', 'Ingredientes', 'Preparación', 'Comentarios'].includes(line.trim());
                                                    if (isSectionTitle) {
                                                        return (
                                                            <h5 key={lineIdx} className="text-[12px] font-extrabold uppercase tracking-wider text-[#b45309] mt-4 mb-1 first:mt-0">
                                                                {line}
                                                            </h5>
                                                        );
                                                    }
                                                    if (line.trim().startsWith('- ')) {
                                                        return (
                                                            <div key={lineIdx} className="mb-1.5 flex items-start gap-2">
                                                                <span className="mt-[0.55em] h-1.5 w-1.5 rounded-full bg-[#b45309] shrink-0" />
                                                                <span>{line.trim().slice(2)}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <p key={lineIdx} className={line.trim() ? 'mb-1.5' : 'h-2'}>
                                                            {line}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                    <div>
                                        <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                        <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                        {professionalContactLine}
                                    </div>
                                </div>
                            </div>
                        ));
                    })}

                    {/* Final pages: Herbal formulas, only when manually added */}
                    {herbalFormulaPages.map((herbalPage, herbalPageIdx) => (
                        <div key={`herbal-formulas-${herbalPageIdx}`} className="pdf-page w-[210mm] h-[297mm] overflow-hidden shrink-0 bg-[#ffffff] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
                            <div className="space-y-6 flex-1">
                                {/* Header */}
                                <div className="border-b border-[#22c55e]/20 pb-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-11 w-auto object-contain shrink-0" />
                                        <div>
                                            <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                            <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                                        <p className="font-semibold text-[#334155]">Prescripción Herbal</p>
                                        <p className="text-[10px] text-[#64748b]">
                                            {herbalFormulaPages.length > 1 ? `Parte ${herbalPageIdx + 1} de ${herbalFormulaPages.length}` : 'Suplementación y Fitoterapia'}
                                        </p>
                                        <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                    </div>
                                </div>

                                <div className="space-y-4 mt-6">
                                    <h3 className="text-[15px] font-bold uppercase tracking-wider text-[#16a34a] font-sans pdf-heading">Fórmulas Herbales Recomendadas</h3>
                                    <div className="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-[12.5px] font-sans border-separate border-spacing-0">
                                            <thead>
                                                <tr className="bg-[#f8fafc]/60 text-[#64748b] font-bold text-left border-b border-[#e2e8f0] pdf-meta">
                                                    <th className="px-4 py-2.5 w-3/12 border-r border-[#e2e8f0]">Fórmula / Hierba</th>
                                                    <th className="px-4 py-2.5 w-4/12 border-r border-[#e2e8f0]">Dosis e Indicaciones</th>
                                                    <th className="px-4 py-2.5 w-5/12">¿Para qué sirve?</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-[#ffffff] divide-y divide-[#f1f5f9]">
                                                {herbalPage.map((h, idx) => {
                                                    const { dosage, purpose } = getHerbParts(h);
                                                    return (
                                                        <tr key={idx} className="align-top divide-x divide-[#f1f5f9]/65 pdf-base-text">
                                                            <td className="px-4 py-2.5 font-bold text-[#1e293b] pr-6 leading-snug border-r border-[#f1f5f9]/60 pdf-base-text">{h.formula}</td>
                                                            <td className="px-4 py-2.5 text-[#475569] leading-snug whitespace-pre-line pdf-base-text">{dosage}</td>
                                                            <td className="px-4 py-2.5 text-[#475569] leading-snug whitespace-pre-line pdf-base-text">{purpose}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Document Footer */}
                            <div className="border-t border-[#22c55e]/25 pt-3 mt-4 flex justify-between items-center text-[9px] font-sans text-[#64748b] shrink-0 pdf-meta">
                                <div>
                                    <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                                    <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                                    {professionalContactLine}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <AnimatePresence>
                    {isDownloading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[80] bg-slate-950/70 flex items-center justify-center print:hidden"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.16 }}
                                className="w-[min(92vw,28rem)] rounded-2xl bg-white shadow-2xl border border-emerald-100 p-7 text-center will-change-transform"
                            >
                                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/70">
                                    <span className="text-lg font-black tabular-nums">{downloadProgress}%</span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900">Generando tratamiento</h3>
                                <p className="text-sm text-slate-500 mt-2">{downloadStatus}</p>
                                <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-emerald-500"
                                        style={{
                                            width: `${Math.max(downloadProgress, 8)}%`,
                                            transition: 'width 180ms ease-out'
                                        }}
                                    />
                                </div>
                                <p className="text-xs font-semibold text-slate-400 mt-3">
                                    El PDF se crea en alta calidad; cada página puede pausar la interfaz por un momento.
                                </p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showTreatmentPage && !isDownloading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[75] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
                        >
                            <motion.div
                                initial={{ scale: 0.94, y: 18 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.96, y: 10 }}
                                className="w-[min(94vw,46rem)] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/70 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <CheckCircle size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900">Tratamiento generado</h3>
                                            <p className="text-xs text-slate-500">Paciente: {patient.name || 'Paciente'} · Dosha: {selectedDosha}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowTreatmentPage(false)}
                                        className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white flex items-center justify-center"
                                        title="Cerrar vista"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                                    <section>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Tratamiento e indicaciones</h4>
                                        <div className="prose prose-sm max-w-none text-slate-700 prose-p:my-2 prose-strong:text-slate-900">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{printableTreatmentText}</ReactMarkdown>
                                        </div>
                                    </section>
                                    {lifestyleIndication && (
                                        <section className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Estilo de vida</h4>
                                            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{lifestyleIndication}</p>
                                        </section>
                                    )}
                                    {herbs.length > 0 && (
                                        <section>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Fórmulas herbales</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {herbs.map((herb, index) => (
                                                    <div key={`${herb.formula}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                                                        <p className="text-sm font-bold text-slate-800">{herb.formula}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{herb.dosage}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                    {selectedRecipes.length > 0 && (
                                        <section>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Recetas recomendadas</h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedRecipes.map((recipe, index) => (
                                                    <div key={`${recipe.id}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                                                        <p className="text-sm font-bold text-slate-800">{recipe.title}</p>
                                                        <p className="text-xs text-slate-500 mt-1">Categoría: {recipe.category} · Doshas: {recipe.doshas.join(', ') || 'General'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowTreatmentPage(false)}
                                        className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-100"
                                    >
                                        Seguir editando
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                                    >
                                        <Printer size={16} />
                                        Descargar otra vez
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Print specific CSS styled layout injection */}
            <style>{`
                /* Neutralize Tailwind v4 oklab/oklch defaults for html2canvas */
                :where(#pdf-content *) {
                    border-color: #e2e8f0;
                    outline-color: transparent;
                    text-decoration-color: transparent;
                }
                #pdf-content * {
                    box-shadow: none !important;
                    text-shadow: none !important;
                    ring-color: transparent !important;
                }
                
                #pdf-content {
                    font-size: var(--pdf-font-base) !important;
                }
                #pdf-content .pdf-base-text {
                    font-size: var(--pdf-font-base) !important;
                }
                #pdf-content .pdf-title {
                    font-size: var(--pdf-font-title) !important;
                }
                #pdf-content .pdf-subtitle {
                    font-size: var(--pdf-font-subtitle) !important;
                }
                #pdf-content .pdf-heading {
                    font-size: var(--pdf-font-heading) !important;
                }
                #pdf-content .pdf-meta {
                    font-size: var(--pdf-font-meta) !important;
                }
                #pdf-content .prose p {
                    font-size: var(--pdf-font-base) !important;
                    line-height: 1.5 !important;
                }
                #pdf-content .prose li {
                    font-size: var(--pdf-font-base) !important;
                }
                #pdf-content .prose h1, #pdf-content .prose h2, #pdf-content .prose h3, #pdf-content .prose h4 {
                    font-size: var(--pdf-font-heading) !important;
                }
                #pdf-content .diagnosis-markdown p > strong:first-child {
                    display: block !important;
                    margin: 0 0 4px !important;
                    color: #0f172a !important;
                    font-size: var(--pdf-font-heading) !important;
                    line-height: 1.25 !important;
                }
                
                /* GFM Tables layout and typography styling inside PDF */
                #pdf-content table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin-top: 10px !important;
                    margin-bottom: 10px !important;
                    font-size: var(--pdf-font-table-body) !important;
                    line-height: 1.35 !important;
                }
                #pdf-content th {
                    background-color: #f1f5f9 !important;
                    color: #1e293b !important;
                    font-weight: 700 !important;
                    text-align: left !important;
                    padding: 6px 8px !important;
                    border: 1px solid #cbd5e1 !important;
                    font-size: var(--pdf-font-table-header) !important;
                }
                #pdf-content td {
                    padding: 6px 8px !important;
                    border: 1px solid #e2e8f0 !important;
                    color: #334155 !important;
                    vertical-align: top !important;
                    white-space: normal !important;
                    font-size: var(--pdf-font-table-body) !important;
                }
                #pdf-content tr:nth-child(even) {
                    background-color: rgba(248, 250, 252, 0.5) !important;
                }
                
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        font-size: 12pt;
                        line-height: 1.5;
                    }
                    /* Remove print header/footer injected by browsers */
                    @page {
                        margin: 1.5cm;
                        size: portrait;
                    }
                }

                /* --- Editor: animaciones "más vivas" --- */
                @keyframes tabPanelIn {
                    0%   { opacity: 0; transform: translateY(10px) scale(0.985); }
                    60%  { opacity: 1; transform: translateY(-2px) scale(1.004); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .tab-panel-anim > * { animation: tabPanelIn 0.42s cubic-bezier(0.34, 1.4, 0.5, 1) both; }
                .tab-panel-anim > *:nth-child(2) { animation-delay: 0.04s; }
                .tab-panel-anim > *:nth-child(3) { animation-delay: 0.08s; }
                .tab-panel-anim > *:nth-child(4) { animation-delay: 0.12s; }
                .tab-panel-anim > *:nth-child(5) { animation-delay: 0.16s; }
                .tab-panel-anim > *:nth-child(n+6) { animation-delay: 0.20s; }

                .editor-card {
                    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
                                border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
                }
                .editor-card:hover {
                    transform: translateY(-2px);
                    border-color: #6ee7b7;
                    box-shadow: 0 6px 18px -8px rgba(16, 185, 129, 0.35);
                }

                @keyframes toggleKnob {
                    0%   { transform: translateX(var(--knob-from)) scale(1); }
                    45%  { transform: translateX(var(--knob-to)) scale(1.18, 0.9); }
                    100% { transform: translateX(var(--knob-to)) scale(1); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .tab-panel-anim, .tab-panel-anim > *, .editor-card { animation: none !important; transition: none !important; }
                }
            `}</style>
        </AnimatePresence>
    );
};
