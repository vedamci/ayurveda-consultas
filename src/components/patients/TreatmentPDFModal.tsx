import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Printer, Plus, Trash2, ChevronDown, Loader2, Sparkles, CheckCircle, AlertCircle, Send, FileText, Salad, Leaf, ClipboardList, Stethoscope, Settings2, Phone, Type, Utensils, HeartHandshake, Search, Monitor, Smartphone } from 'lucide-react';

type EditorTabId = 'documento' | 'ia' | 'alimentacion' | 'hierbas' | 'terapias' | 'indicaciones';

const EDITOR_TABS: { id: EditorTabId; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
    { id: 'documento', label: 'Documento', icon: FileText },
    { id: 'ia', label: 'IA', icon: Sparkles },
    { id: 'alimentacion', label: 'Comida', icon: Salad },
    { id: 'hierbas', label: 'Hierbas', icon: Leaf },
    { id: 'terapias', label: 'Terapias', icon: HeartHandshake },
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
import healthyHabitsSeed from '../../data/healthy-eating-habits.json';
import therapiesSeed from '../../data/therapies.json';

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
// Cada hábito es una plantilla {name, text} editable desde la app y persistida en
// src/data/healthy-eating-habits.json (endpoints /api/healthy-habits). El profesional
// elige cuáles incluir, igual que las categorías de alimentos.
interface HealthyHabit {
    name: string;
    text: string;
}
// Semilla de plantillas (respaldo si la API no responde). La lista viva se carga al abrir el modal.
const HEALTHY_EATING_HABITS: HealthyHabit[] = (healthyHabitsSeed as HealthyHabit[]);

// Catálogo de terapias ayurvédicas seleccionables (Abhyanga, Nasya, Basti, etc.).
// Cada terapia es una plantilla {id, name, emoji, text} editable desde la app y
// persistida en src/data/therapies.json (endpoints /api/therapies). El profesional
// elige cuáles asignar al paciente, igual que los hábitos saludables.
interface TherapyItem {
    id: string;
    name: string;
    emoji?: string;
    text: string;
}
// Semilla generada desde la carpeta "Terapias" (respaldo si la API no responde).
const THERAPIES_SEED: TherapyItem[] = (therapiesSeed as TherapyItem[]);

const slugifyTherapyName = (name: string) => name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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

// Fondo "acuarela" (río en tonos verde/dorado) que va detrás del contenido
// de cada página del PDF. Se codifica como data URI SVG e inyecta vía CSS
// background-image, así que aparece tanto en la vista previa como en la
// impresión nativa (Chromium).
const PDF_WATERCOLOR_BG_COLOR = '#F5EEDC';
const PDF_WATERCOLOR_BG_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 990' preserveAspectRatio='xMidYMid slice'>
  <defs>
    <filter id='wcBlur' x='-60%' y='-60%' width='220%' height='220%'>
      <feGaussianBlur stdDeviation='24'/>
    </filter>
    <linearGradient id='riverGreen' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#4A7C2F' stop-opacity='0.20'/>
      <stop offset='100%' stop-color='#2D5016' stop-opacity='0.09'/>
    </linearGradient>
    <linearGradient id='riverGold' x1='1' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#C9A84C' stop-opacity='0.16'/>
      <stop offset='100%' stop-color='#C9A84C' stop-opacity='0.06'/>
    </linearGradient>
  </defs>
  <rect x='0' y='0' width='700' height='990' fill='${PDF_WATERCOLOR_BG_COLOR}'/>
  <path d='M -80,140 C 120,70 170,270 370,230 C 550,195 590,390 780,350 L 780,540 C 590,485 555,310 390,350 C 210,390 170,225 -80,310 Z' fill='url(#riverGreen)' filter='url(#wcBlur)'/>
  <path d='M -80,600 C 150,555 195,730 410,680 C 590,640 630,800 780,780 L 780,930 C 610,890 590,720 410,760 C 210,805 175,660 -80,725 Z' fill='url(#riverGold)' filter='url(#wcBlur)'/>
  <circle cx='95' cy='945' r='70' fill='#4A7C2F' fill-opacity='0.10' filter='url(#wcBlur)'/>
  <circle cx='630' cy='60' r='80' fill='#C9A84C' fill-opacity='0.13' filter='url(#wcBlur)'/>
</svg>`;

const waitForBrowserPaint = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
    });
});

const yieldToMainThread = (delay = 35) => new Promise<void>(resolve => {
    window.setTimeout(resolve, delay);
});

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

    if (records[0]?.diagnosis) return records[0].diagnosis;

    // Sin diagnóstico en planes/visitas: usamos el más reciente del historial IA,
    // para que el diagnóstico generado con IA llegue al PDF sin pasos manuales.
    const aiRecords = [...(patient.aiDiagnoses || [])].sort((a, b) =>
        new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    );
    return aiRecords[0]?.diagnosis || '';
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
 
 // (La paginación manual por conteo de caracteres se eliminó: ahora pagina
// Chromium con CSS de paged media. Ver bloque @media print más abajo.)

// (Los motores de paginación por medición de DOM se eliminaron: la paginación
// real la hace ahora el motor de impresión de Chromium.)

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

 // Builds a plain-text fallback (used for search/DB storage) from the structured
 // ingredient/preparation fields, so "Preparación" always stays under its own
 // heading regardless of what the professional types.
 const buildRecipeTextFromStructured = (structured: { prepTime?: string; yield?: string; ingredients?: string[]; preparation?: string; comments?: string }) => {
     const prepTime = (structured.prepTime || '').trim();
     const yieldText = (structured.yield || '').trim();
     const ingredients = (structured.ingredients || []).map(s => s.trim()).filter(Boolean);
     const preparation = (structured.preparation || '').trim();
     const comments = (structured.comments || '').trim();
     return [
         [prepTime && `Tiempo de preparación: ${prepTime}`, yieldText && `Porciones: ${yieldText}`].filter(Boolean).join(' · '),
         ingredients.length > 0 ? `Ingredientes:\n${ingredients.join('\n')}` : '',
         preparation ? `Preparación:\n${preparation}` : '',
         comments ? `Comentarios:\n${comments}` : ''
     ].filter(Boolean).join('\n\n').trim();
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

 // Formatos de hoja del PDF. Ambos motores Chromium (Electron y Puppeteer)
 // imprimen con preferCSSPageSize, así que el tamaño real lo dicta @page.
 // El móvil usa una hoja estrecha (~9:16): al ajustarse al ancho del teléfono,
 // el texto se ve ~1.75x más grande que en A4 sin necesidad de hacer zoom.
 const PDF_PAGE_FORMATS = {
     desktop: {
         label: 'Escritorio',
         pageSize: 'A4 portrait',
         headPadding: '10mm 18mm 0 18mm',
         bodyPadding: '2mm 18mm 0 18mm',
         footPadding: '0 18mm 8mm 18mm',
     },
     mobile: {
         label: 'Móvil',
         pageSize: '120mm 213mm',
         headPadding: '6mm 8mm 0 8mm',
         bodyPadding: '2mm 8mm 0 8mm',
         footPadding: '0 8mm 6mm 8mm',
     },
 } as const;
 type PdfPageFormat = keyof typeof PDF_PAGE_FORMATS;

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
     // Autoguardado (ver efecto junto a handleSavePlan): autosaveSkipRef evita que
     // la siembra inicial de datos dispare un guardado; autosaveTimeoutRef guarda
     // el temporizador con debounce entre una edición y el guardado real.
     const autosaveSkipRef = useRef(false);
     const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // Permite quitar la sección de recetas recomendadas del PDF sin borrar las recetas seleccionadas.
    const [showRecipesSection, setShowRecipesSection] = useState(true);
    const [healthyEatingGuide, setHealthyEatingGuide] = useState(HEALTHY_EATING_GUIDE_TEXT);
    // Catálogo vivo de plantillas de hábitos (se refresca desde la API al abrir el modal).
    const [healthyHabitsList, setHealthyHabitsList] = useState<HealthyHabit[]>([...HEALTHY_EATING_HABITS]);
    // Hábitos seleccionados: se guardan por NOMBRE de plantilla (el profesional elige cuáles incluir).
    const allHabitNames = (list: HealthyHabit[]) => list.map(h => h.name);
    const [selectedHealthyHabits, setSelectedHealthyHabits] = useState<string[]>(allHabitNames(HEALTHY_EATING_HABITS));
    const toggleHealthyHabit = (habitName: string) => {
        setSelectedHealthyHabits(prev => prev.includes(habitName) ? prev.filter(h => h !== habitName) : [...prev, habitName]);
    };
    // Estados para editar / agregar plantillas de hábitos dentro del modal.
    const [editingHabitName, setEditingHabitName] = useState<string | null>(null);
    const [habitDraftName, setHabitDraftName] = useState('');
    const [habitDraftText, setHabitDraftText] = useState('');
    const [isAddingHabit, setIsAddingHabit] = useState(false);
    const [savingHabit, setSavingHabit] = useState(false);

    // Carga el catálogo más reciente de hábitos desde la API (con respaldo a la semilla).
    const refreshHealthyHabits = async () => {
        try {
            const res = await fetch('/api/healthy-habits', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.habits) && data.habits.length > 0) {
                    setHealthyHabitsList(data.habits);
                }
            }
        } catch (err) {
            console.error('Error cargando hábitos saludables:', err);
        }
    };

    const startEditHabit = (habit: HealthyHabit) => {
        setIsAddingHabit(false);
        setEditingHabitName(habit.name);
        setHabitDraftName(habit.name);
        setHabitDraftText(habit.text);
    };

    const startAddHabit = () => {
        setEditingHabitName(null);
        setIsAddingHabit(true);
        setHabitDraftName('');
        setHabitDraftText('');
    };

    const cancelHabitEdit = () => {
        setEditingHabitName(null);
        setIsAddingHabit(false);
        setHabitDraftName('');
        setHabitDraftText('');
    };

    const saveHabitTemplate = async () => {
        const name = habitDraftName.trim();
        const text = habitDraftText.trim();
        if (!name || !text) return;
        setSavingHabit(true);
        try {
            const res = await fetch('/api/healthy-habits/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name, text, originalName: editingHabitName || undefined })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const newList: HealthyHabit[] = Array.isArray(data.habits) ? data.habits : healthyHabitsList;
                setHealthyHabitsList(newList);
                // Si se renombró una plantilla seleccionada, conserva la selección con el nuevo nombre.
                if (editingHabitName && editingHabitName !== name) {
                    setSelectedHealthyHabits(prev => prev.map(n => n === editingHabitName ? name : n));
                } else if (isAddingHabit) {
                    setSelectedHealthyHabits(prev => prev.includes(name) ? prev : [...prev, name]);
                }
                cancelHabitEdit();
            } else {
                alert(data.error || 'No se pudo guardar el hábito.');
            }
        } catch (err) {
            console.error('Error guardando hábito:', err);
            alert('Error de conexión al guardar el hábito.');
        } finally {
            setSavingHabit(false);
        }
    };

    const deleteHabitTemplate = async (name: string) => {
        if (!window.confirm(`¿Eliminar la plantilla "${name}"?`)) return;
        try {
            const res = await fetch('/api/healthy-habits/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const newList: HealthyHabit[] = Array.isArray(data.habits) ? data.habits : healthyHabitsList.filter(h => h.name !== name);
                setHealthyHabitsList(newList);
                setSelectedHealthyHabits(prev => prev.filter(n => n !== name));
                if (editingHabitName === name) cancelHabitEdit();
            } else {
                alert(data.error || 'No se pudo eliminar el hábito.');
            }
        } catch (err) {
            console.error('Error eliminando hábito:', err);
            alert('Error de conexión al eliminar el hábito.');
        }
    };

    // ============ Terapias (catálogo editable + selección por paciente) ============
    // Catálogo vivo de terapias (se refresca desde la API al abrir el modal).
    const [therapiesList, setTherapiesList] = useState<TherapyItem[]>([...THERAPIES_SEED]);
    // Terapias seleccionadas para este paciente: se guardan por ID de plantilla.
    const [selectedTherapies, setSelectedTherapies] = useState<string[]>([]);
    // Controla si la sección "Terapias Recomendadas" aparece en el PDF.
    const [showTherapiesSection, setShowTherapiesSection] = useState(false);
    const [therapyFrequency, setTherapyFrequency] = useState('');
    const [therapyCount, setTherapyCount] = useState('');
    const [therapyNoteTitle, setTherapyNoteTitle] = useState('');
    const [therapyNoteBody, setTherapyNoteBody] = useState('');
    const [therapySearchQuery, setTherapySearchQuery] = useState('');
    const [expandedTherapyId, setExpandedTherapyId] = useState<string | null>(null);
    // Estados para editar / agregar plantillas de terapias dentro del modal.
    const [editingTherapyId, setEditingTherapyId] = useState<string | null>(null);
    const [isAddingTherapy, setIsAddingTherapy] = useState(false);
    const [therapyDraftName, setTherapyDraftName] = useState('');
    const [therapyDraftEmoji, setTherapyDraftEmoji] = useState('');
    const [therapyDraftText, setTherapyDraftText] = useState('');
    const [savingTherapy, setSavingTherapy] = useState(false);

    const toggleTherapy = (therapyId: string) => {
        setSelectedTherapies(prev => prev.includes(therapyId) ? prev.filter(t => t !== therapyId) : [...prev, therapyId]);
    };

    // Carga el catálogo más reciente de terapias desde la API (con respaldo a la semilla).
    const refreshTherapies = async () => {
        try {
            const res = await fetch('/api/therapies', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.therapies) && data.therapies.length > 0) {
                    setTherapiesList(data.therapies);
                }
            }
        } catch (err) {
            console.error('Error cargando terapias:', err);
        }
    };

    const startEditTherapy = (therapy: TherapyItem) => {
        setIsAddingTherapy(false);
        setEditingTherapyId(therapy.id);
        setTherapyDraftName(therapy.name);
        setTherapyDraftEmoji(therapy.emoji || '');
        setTherapyDraftText(therapy.text);
    };

    const startAddTherapy = () => {
        setEditingTherapyId(null);
        setIsAddingTherapy(true);
        setTherapyDraftName('');
        setTherapyDraftEmoji('');
        setTherapyDraftText('');
    };

    const cancelTherapyEdit = () => {
        setEditingTherapyId(null);
        setIsAddingTherapy(false);
        setTherapyDraftName('');
        setTherapyDraftEmoji('');
        setTherapyDraftText('');
    };

    const saveTherapyTemplate = async () => {
        const name = therapyDraftName.trim();
        const text = therapyDraftText.trim();
        if (!name || !text) return;
        setSavingTherapy(true);
        try {
            const newId = slugifyTherapyName(name);
            const res = await fetch('/api/therapies/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    id: newId,
                    name,
                    emoji: therapyDraftEmoji.trim(),
                    text,
                    originalId: editingTherapyId || undefined
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const newList: TherapyItem[] = Array.isArray(data.therapies) ? data.therapies : therapiesList;
                setTherapiesList(newList);
                // Si se renombró una terapia seleccionada, conserva la selección con el nuevo id.
                if (editingTherapyId && editingTherapyId !== newId) {
                    setSelectedTherapies(prev => prev.map(t => t === editingTherapyId ? newId : t));
                } else if (isAddingTherapy) {
                    setSelectedTherapies(prev => prev.includes(newId) ? prev : [...prev, newId]);
                }
                cancelTherapyEdit();
            } else {
                alert(data.error || 'No se pudo guardar la terapia.');
            }
        } catch (err) {
            console.error('Error guardando terapia:', err);
            alert('Error de conexión al guardar la terapia.');
        } finally {
            setSavingTherapy(false);
        }
    };

    const deleteTherapyTemplate = async (therapy: TherapyItem) => {
        if (!window.confirm(`¿Eliminar la terapia "${therapy.name}" del catálogo?`)) return;
        try {
            const res = await fetch('/api/therapies/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ id: therapy.id })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const newList: TherapyItem[] = Array.isArray(data.therapies) ? data.therapies : therapiesList.filter(t => t.id !== therapy.id);
                setTherapiesList(newList);
                setSelectedTherapies(prev => prev.filter(t => t !== therapy.id));
                if (editingTherapyId === therapy.id) cancelTherapyEdit();
            } else {
                alert(data.error || 'No se pudo eliminar la terapia.');
            }
        } catch (err) {
            console.error('Error eliminando terapia:', err);
            alert('Error de conexión al eliminar la terapia.');
        }
    };

    // Recipe states
    const [selectedRecipes, setSelectedRecipes] = useState<any[]>([]);
    const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
    const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<string>('Todos');
    const [recipeDoshaFilter, setRecipeDoshaFilter] = useState<string>('Todos');
    const [recipeSearchQuery, setRecipeSearchQuery] = useState<string>('');
    const [selectedRecipeToAdd, setSelectedRecipeToAdd] = useState<any | null>(null);
    const [showManualRecipeForm, setShowManualRecipeForm] = useState(false);
    const [manualRecipeTitle, setManualRecipeTitle] = useState('');
    const [manualRecipePrepTime, setManualRecipePrepTime] = useState('');
    const [manualRecipeYield, setManualRecipeYield] = useState('');
    const [manualRecipeIngredients, setManualRecipeIngredients] = useState('');
    const [manualRecipePreparation, setManualRecipePreparation] = useState('');
    const [manualRecipeComments, setManualRecipeComments] = useState('');
    const [isSavingManualRecipe, setIsSavingManualRecipe] = useState(false);

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
    // Formato de hoja usado por la plantilla de impresión. Se elige en el
    // diálogo previo a la descarga y vuelve a 'desktop' al terminar para que
    // las copias planas guardadas en segundo plano salgan siempre en A4.
    const [pdfPageFormat, setPdfPageFormat] = useState<PdfPageFormat>('desktop');
    const [showFormatChooser, setShowFormatChooser] = useState(false);
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

        // Al abrir, refrescamos el catálogo de plantillas de hábitos desde la API.
        refreshHealthyHabits();
        // Y el catálogo de terapias.
        refreshTherapies();

        // Clave de inicialización: identidad del registro editado (o 'new') +
        // diagnóstico inicial sólo para tratamientos nuevos (para sembrarlo cuando
        // la IA lo devuelve de forma asíncrona). NO incluye el objeto `patient`,
        // así un autosave que regenera `patient` ya no reinicia el editor (fix #7).
        const initKey = `${editingRecord?.record?.id ?? 'new'}::${editingRecord ? 'edit' : (initialDiagnosis || '')}`;
        if (initKeyRef.current === initKey) return;
        initKeyRef.current = initKey;

        // El resto de este efecto llena el editor con datos existentes (o valores
        // por defecto). Esos cambios de estado NO son una edición del profesional,
        // así que el próximo disparo del efecto de autoguardado debe ignorarse.
        autosaveSkipRef.current = true;

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
            // El diagnóstico completo (IA o clínico) se pega tal cual en el PDF;
            // el resumen breve solo aparece cuando no hay ningún diagnóstico.
            setPatientDiagnosisText(
                rec.patientDiagnosis ||
                (rec.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient) || '').trim() ||
                buildPatientDiagnosisFallback('', recDosha)
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
            setShowRecipesSection(rec.showRecipesSection !== undefined ? rec.showRecipesSection : true);
            setHealthyEatingGuide(rec.healthyEatingGuide || HEALTHY_EATING_GUIDE_TEXT);
            // Si el registro se guardó con la sección apagada, los hábitos vienen
            // vacíos; volvemos al default completo para que al reactivar la sección
            // no aparezca sin nada seleccionado.
            setSelectedHealthyHabits(
                Array.isArray(rec.healthyEatingHabits) && rec.healthyEatingHabits.length > 0
                    ? rec.healthyEatingHabits
                    : allHabitNames(healthyHabitsList)
            );
            // Terapias guardadas en el registro (por id de plantilla).
            const recTherapies = Array.isArray(rec.therapies) ? rec.therapies : [];
            setSelectedTherapies(recTherapies);
            setShowTherapiesSection(rec.showTherapiesSection !== undefined ? rec.showTherapiesSection : recTherapies.length > 0);
            setTherapyFrequency(rec.therapyFrequency || '');
            setTherapyCount(rec.therapyCount || '');
            setTherapyNoteTitle(rec.therapyNoteTitle || '');
            setTherapyNoteBody(rec.therapyNoteBody || '');

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
            // Pega el diagnóstico IA completo en el PDF; el resumen breve queda
            // como respaldo cuando todavía no se ha generado ningún diagnóstico.
            setPatientDiagnosisText(
                (effectiveDiagnosis || '').trim() || buildPatientDiagnosisFallback('', matchingDosha)
            );
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
            setShowRecipesSection(true);
            setHealthyEatingGuide(HEALTHY_EATING_GUIDE_TEXT);
            setSelectedHealthyHabits(allHabitNames(healthyHabitsList));
            setSelectedTherapies([]);
            setShowTherapiesSection(false);
            setTherapyFrequency('');
            setTherapyCount('');
            setTherapyNoteTitle('');
            setTherapyNoteBody('');

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

    const handleSaveRecipeToDatabase = async (recipe: any, options: { silent?: boolean } = {}) => {
        const { silent = false } = options;
        if (!recipe.title.trim()) {
            if (!silent) alert('Por favor introduce un nombre/título para la receta.');
            return false;
        }
        if (!recipe.text.trim()) {
            if (!silent) alert('El texto de la receta está vacío.');
            return false;
        }

        try {
            const res = await fetch('/api/recipes/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: recipe.id,
                    title: recipe.title,
                    text: recipe.text,
                    category: recipe.category,
                    doshas: recipe.doshas,
                    vata_effect: recipe.vata_effect,
                    pitta_effect: recipe.pitta_effect,
                    kapha_effect: recipe.kapha_effect,
                    structured: recipe.structured
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update the imported list in-memory so it reflects for future selections
                const existing = (recipesList as any[]).find(r => r.id === recipe.id);
                if (existing) {
                    existing.title = recipe.title;
                    existing.text = recipe.text;
                    if (recipe.structured) {
                        existing.structured = recipe.structured;
                    } else {
                        delete existing.structured;
                    }
                    if (recipe.category) existing.category = recipe.category;
                    if (Array.isArray(recipe.doshas)) existing.doshas = recipe.doshas;
                } else if (data.recipe) {
                    // New recipe created on the server (e.g. a manual recipe) — reflect it locally too.
                    (recipesList as any[]).push(data.recipe);
                }
                if (!silent) alert('Receta guardada exitosamente en la base de datos.');
                return true;
            } else {
                if (!silent) alert(`Error al guardar receta: ${data.error || 'Desconocido'}`);
                return false;
            }
        } catch (err: any) {
            console.error('Error saving recipe:', err);
            if (!silent) alert(`Error al guardar receta: ${err.message}`);
            return false;
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

    // Convierte bytes a base64 sin reventar el call-stack con archivos grandes.
    const bytesToBase64 = (bytes: Uint8Array): string => {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
        }
        return btoa(binary);
    };

    // Dispara la descarga de un PDF a partir de bytes (sin jsPDF).
    const downloadPdfBytes = (bytes: Uint8Array, filename: string) => {
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const blob = new Blob([ab], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    };

    // Reúne el CSS de la página (Tailwind incluido) para enviarlo al servidor Puppeteer.
    const collectDocumentCss = (): string => {
        let css = '';
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                const rules = (sheet as CSSStyleSheet).cssRules;
                if (!rules) continue;
                for (const rule of Array.from(rules)) css += rule.cssText + '\n';
            } catch {
                /* hoja cross-origin: se ignora */
            }
        }
        return css;
    };

    // ── Motor unificado de PDF (raíz del arreglo) ─────────────────────────────
    // La plantilla continua (#pdf-print-content) es la ÚNICA fuente del PDF:
    // Chromium pagina de verdad (texto vectorial, sin cortes, página llena).
    //  1) App de escritorio → Chromium nativo (webContents.printToPDF).
    //  2) Web → Puppeteer en el servidor (Chromium headless), misma plantilla.
    //  3) Último recurso → diálogo de impresión del navegador (sin bytes).
    const generatePdfBytes = async (
        onProgress?: (progress: number, status?: string) => void
    ): Promise<Uint8Array | null> => {
        const electronPrint = (typeof window !== 'undefined') ? (window as any).vedamciPrint : undefined;

        // 1) Escritorio (Electron)
        if (electronPrint?.isElectron) {
            try {
                onProgress?.(15, 'Imprimiendo con Chromium...');
                if ((document as any).fonts?.ready) {
                    try { await (document as any).fonts.ready; } catch { /* noop */ }
                }
                await waitForBrowserPaint();
                const buf: ArrayBuffer = await electronPrint.toPDF({
                    // Margen 0: el fondo crema cubre toda la hoja. El encabezado y
                    // el pie de marca se repiten por página vía thead/tfoot de la
                    // plantilla de impresión.
                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                });
                onProgress?.(90, 'PDF listo');
                return new Uint8Array(buf);
            } catch (e) {
                console.warn('printToPDF (Electron) falló, intentando respaldo:', e);
            }
        }

        // 2) Web (Puppeteer en el servidor)
        try {
            const node = document.getElementById('pdf-print-content') || document.getElementById('pdf-content');
            if (node) {
                onProgress?.(20, 'Generando PDF en el servidor...');
                const html = node.outerHTML;
                const css = collectDocumentCss();
                const token = localStorage.getItem('token');
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const res = await fetch('/api/print/treatment-pdf', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ html, css, origin: window.location.origin }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.success && data.pdfBase64) {
                        onProgress?.(90, 'PDF listo');
                        const binary = atob(data.pdfBase64);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        return bytes;
                    }
                } else {
                    console.warn('Endpoint Puppeteer no disponible (', res.status, '), usando el último recurso.');
                }
            }
        } catch (e) {
            console.warn('PDF por servidor falló:', e);
        }

        // 3) Último recurso: sin Chromium disponible se abre el diálogo de
        // impresión del navegador (misma plantilla y paginación nativa); el
        // usuario puede «Guardar como PDF» desde ahí. No devuelve bytes.
        onProgress?.(60, 'Abriendo el diálogo de impresión del navegador...');
        try { window.print(); } catch { /* noop */ }
        return null;
    };

    const handleSavePlan = async (options: { saveFlatPdf?: boolean; isAutoSave?: boolean; existingBytes?: Uint8Array } = {}) => {
        const { saveFlatPdf = true, isAutoSave = false, existingBytes } = options;
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
            const selectedHealthyHabitDetails = selectedHealthyHabits
                .map(name => healthyHabitsList.find(habit => habit.name === name) || { name, text: '' })
                .map(habit => ({ name: habit.name, text: habit.text || '' }));
            const selectedTherapyDetails = selectedTherapies
                .map(id => therapiesList.find(therapy => therapy.id === id || therapy.name === id) || { id, name: id, emoji: '', text: '' })
                .map(therapy => ({
                    id: therapy.id,
                    name: therapy.name,
                    emoji: therapy.emoji || '',
                    text: therapy.text || ''
                }));

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
                showRecipesSection,
                healthyEatingGuide,
                // Si la sección no va en el PDF, no registrar hábitos/terapias en el
                // seguimiento terapéutico (antes se guardaba la lista completa siempre).
                healthyEatingHabits: showHealthyEatingGuide ? selectedHealthyHabits : [],
                healthyEatingHabitDetails: showHealthyEatingGuide ? selectedHealthyHabitDetails : [],
                therapies: showTherapiesSection ? selectedTherapies : [],
                therapyDetails: showTherapiesSection ? selectedTherapyDetails : [],
                showTherapiesSection,
                therapyFrequency,
                therapyCount,
                therapyNoteTitle,
                therapyNoteBody
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
                    const bytes = existingBytes || await generatePdfBytes();
                    if (bytes) {
                        const pdfBase64 = bytesToBase64(bytes);
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

    // Autoguardado: cada edición real del profesional (texto, hábitos, hierbas,
    // recetas, categorías, toggles de secciones, etc.) programa un guardado del
    // registro editable con debounce, sin regenerar el PDF plano (saveFlatPdf:
    // false) para que sea rápido y silencioso. El PDF plano se sigue regenerando
    // al descargar/imprimir o al pulsar "Guardar" manualmente.
    useEffect(() => {
        if (!isOpen) return;

        if (autosaveSkipRef.current) {
            // Este disparo del efecto vino de sembrar el editor (abrir un registro
            // existente o preparar uno nuevo), no de una edición real: se ignora.
            autosaveSkipRef.current = false;
            return;
        }

        setAutosaveMessage('Cambios pendientes...');
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = setTimeout(() => {
            autosaveTimeoutRef.current = null;
            handleSavePlan({ isAutoSave: true, saveFlatPdf: false });
        }, 1500);

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isOpen,
        title, subtitle, selectedDosha, pdfFontSize,
        mainIndication, lifestyleIndication, clinicalTreatmentIndication, patientDiagnosisText,
        cerealGuidance, cerealRecipe, herbs, selectedCategories, selectedRecipes,
        isFollowUp, visitNumber, visitDate,
        showLifestylePage, showDigestiveRecoveryPage, showDiagnosis, showHealthyEatingGuide, showRecipesSection,
        healthyEatingGuide, selectedHealthyHabits,
        selectedTherapies, showTherapiesSection, therapyFrequency, therapyCount, therapyNoteTitle, therapyNoteBody
    ]);

    const handlePrint = async (format: PdfPageFormat = 'desktop') => {
        // Aplicar el formato ANTES de esperar el repintado: la plantilla y su
        // CSS (@page, paddings) se regeneran con el tamaño de hoja elegido.
        setPdfPageFormat(format);
        setDownloadProgress(0);
        setDownloadStatus(format === 'mobile' ? 'Preparando el PDF para móvil...' : 'Preparando el PDF...');
        setIsDownloading(true);
        await waitForBrowserPaint();
        await yieldToMainThread(240);

        try {
            const bytes = await generatePdfBytes((progress, status) => {
                setDownloadProgress(progress);
                if (status) setDownloadStatus(status);
            });
            if (!bytes) {
                // Motores Chromium no disponibles: se abrió el diálogo de impresión.
                setSaveMessage('Se abrió el diálogo de impresión del navegador; guarda el PDF desde ahí.');
                setIsDownloading(false);
                return;
            }

            const filename = `Tratamiento_${patient.name?.replace(/\s+/g, '_') || 'Ayurveda'}${format === 'mobile' ? '_Movil' : ''}.pdf`;
            setDownloadProgress(94);
            setDownloadStatus('Preparando descarga...');
            await waitForBrowserPaint();
            downloadPdfBytes(bytes, filename);
            setDownloadProgress(98);
            setDownloadStatus('Guardando copia local...');
            await handleSavePlan({ existingBytes: bytes });
            setShowTreatmentPage(true);
            
            console.log('PDF generado exitosamente');
        } catch (error: any) {
            console.error('Error generando PDF:', error);
            alert(`Ocurrió un error al generar el PDF: ${error.message || error}`);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
            setDownloadStatus('Preparando el PDF...');
            setPdfPageFormat('desktop');
        }
    };

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

    // ── Contenido por sección (sin paginación manual) ─────────────────────────
    // Cada sección se renderiza UNA sola vez con su contenido completo; los
    // saltos de página reales los decide Chromium al imprimir. Los arrays de
    // "páginas" quedan con un solo elemento para la vista previa en pantalla.
    const categoryChunks = activeCategories.length > 0 ? [activeCategories] : [];
    const herbalFormulaPages: HerbalFormula[][] = herbs.filter(h =>
        h.formula?.trim() || h.dosage?.trim() || h.purpose?.trim()
    ).length > 0 ? [herbs.filter(h => h.formula?.trim() || h.dosage?.trim() || h.purpose?.trim())] : [];

    const printableTreatmentText = removeHerbalFormulaItems(mainIndication || '');
    // Contenido de la guía = texto introductorio + plantillas de hábitos seleccionadas.
    // Cada hábito se imprime como título (nombre de la plantilla) + su texto completo.
    // Para registros antiguos que guardaron el texto del hábito directamente (no el nombre),
    // se mantiene compatibilidad imprimiéndolos como viñeta.
    const healthyHabitsRendered = selectedHealthyHabits.map(sel => {
        const tpl = healthyHabitsList.find(h => h.name === sel);
        if (tpl) return `## ${tpl.name}\n${tpl.text.trim()}`;
        return `- ${sel}`;
    }).join('\n\n');
    const healthyEatingContent = [
        (healthyEatingGuide || '').trim(),
        healthyHabitsRendered.trim()
    ].filter(Boolean).join('\n\n');
    const healthyEatingGuidePages = healthyEatingContent.trim()
        ? [healthyEatingContent]
        : [];
    // Contenido de la sección "Terapias Recomendadas": cada terapia seleccionada
    // se imprime como título (emoji + nombre) + su texto completo en Markdown.
    const selectedTherapyItems = selectedTherapies
        .map(sel => therapiesList.find(t => t.id === sel || t.name === sel))
        .filter(Boolean) as TherapyItem[];

    let therapiesIntro = '';
    if (therapyCount || therapyFrequency || (therapyNoteTitle && therapyNoteBody)) {
        therapiesIntro += `## Planificación de las Terapias\n\n`;
        if (therapyCount) {
            therapiesIntro += `**Cantidad de terapias programadas:** ${therapyCount}\n\n`;
        }
        if (therapyFrequency) {
            therapiesIntro += `**Frecuencia:** ${therapyFrequency}\n\n`;
        }
        if (therapyNoteTitle && therapyNoteBody) {
            therapiesIntro += `### ${therapyNoteTitle}\n${therapyNoteBody}\n\n`;
        }
        therapiesIntro += `---\n\n`;
    }

    const therapiesContent = [
        therapiesIntro.trim(),
        selectedTherapyItems
            .map(t => `# ${t.emoji ? `${t.emoji} ` : ''}${t.name}\n\n${t.text.trim()}`)
            .join('\n\n')
    ].filter(Boolean).join('\n\n');
    const therapiesPages = showTherapiesSection && therapiesContent.trim()
        ? [therapiesContent]
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
    // Cada sección se muestra completa en una sola tarjeta de la vista previa;
    // la paginación real la hace Chromium al generar el PDF.
    const treatmentPages = [printableTreatmentText];
    const lifestylePages = (lifestyleIndication || '').trim() ? [lifestyleIndication] : [];
    const digestiveRecoveryPages = [DIGESTIVE_RECOVERY_TEXT];
    const diagnosisPages = diagnosisPreview ? [diagnosisPreview] : [];
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
                            onClick={() => {
                                // Si había una edición reciente esperando el debounce del
                                // autoguardado, dispararla ahora mismo antes de cerrar para
                                // no perder el último cambio.
                                if (autosaveTimeoutRef.current) {
                                    clearTimeout(autosaveTimeoutRef.current);
                                    autosaveTimeoutRef.current = null;
                                    handleSavePlan({ isAutoSave: true, saveFlatPdf: false });
                                }
                                onClose();
                            }}
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
                            <ToggleSwitch
                                checked={showRecipesSection}
                                label="Incluir sección de recetas"
                                onChange={setShowRecipesSection}
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
                                rows={8}
                                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                placeholder="Diagnóstico que aparecerá en el PDF..."
                            />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const fullDiagnosis = (editingRecord?.record?.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient) || '').trim();
                                        if (fullDiagnosis) setPatientDiagnosisText(fullDiagnosis);
                                    }}
                                    className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    Pegar diagnóstico IA completo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPatientDiagnosisText(buildPatientDiagnosisFallback(editingRecord?.record?.diagnosis || initialDiagnosis || getLatestLocalDiagnosis(patient), selectedDosha))}
                                    className="text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition-colors"
                                >
                                    Usar resumen breve
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

                            {/* Plantillas de hábitos: seleccionar, editar texto y agregar/eliminar */}
                            <div className="space-y-2 pt-3">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Hábitos para comer saludablemente</label>
                                    <span className="text-[10px] font-bold text-emerald-600">{selectedHealthyHabits.length} seleccionados</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHealthyHabits(allHabitNames(healthyHabitsList))}
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
                                    <button
                                        type="button"
                                        onClick={startAddHabit}
                                        className="text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2 py-0.5 transition-colors ml-auto"
                                    >
                                        + Nueva plantilla
                                    </button>
                                </div>

                                {/* Formulario para agregar una nueva plantilla */}
                                {isAddingHabit && (
                                    <div className="space-y-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                                        <input
                                            type="text"
                                            value={habitDraftName}
                                            onChange={(e) => setHabitDraftName(e.target.value)}
                                            placeholder="Título del hábito (p. ej. Masticar bien y comer sin distracciones)"
                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                        />
                                        <SpeechTextarea
                                            value={habitDraftText}
                                            onValueChange={setHabitDraftText}
                                            rows={5}
                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                            placeholder="Texto de la plantilla (admite Markdown: - viñetas)..."
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={savingHabit || !habitDraftName.trim() || !habitDraftText.trim()}
                                                onClick={saveHabitTemplate}
                                                className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1 transition-colors"
                                            >
                                                {savingHabit ? 'Guardando…' : 'Guardar plantilla'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelHabitEdit}
                                                className="text-[11px] font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-3 py-1 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    {healthyHabitsList.map((habit) => {
                                        const isSelected = selectedHealthyHabits.includes(habit.name);
                                        const isEditing = editingHabitName === habit.name;
                                        return (
                                            <div key={habit.name} className="border-b border-slate-100 last:border-b-0 pb-1.5 last:pb-0">
                                                <div className="flex items-start gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleHealthyHabit(habit.name)}
                                                        className="mt-0.5 rounded border-slate-200 bg-white text-emerald-600 focus:ring-0 cursor-pointer w-3.5 h-3.5 shrink-0"
                                                    />
                                                    <span className={`flex-1 leading-snug ${isSelected ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                                                        {habit.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => isEditing ? cancelHabitEdit() : startEditHabit(habit)}
                                                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 shrink-0"
                                                    >
                                                        {isEditing ? 'Cerrar' : 'Editar'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteHabitTemplate(habit.name)}
                                                        className="text-[10px] font-bold text-slate-400 hover:text-red-600 shrink-0"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                                {isEditing && (
                                                    <div className="mt-2 ml-5 space-y-2">
                                                        <input
                                                            type="text"
                                                            value={habitDraftName}
                                                            onChange={(e) => setHabitDraftName(e.target.value)}
                                                            placeholder="Título del hábito"
                                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                                        />
                                                        <SpeechTextarea
                                                            value={habitDraftText}
                                                            onValueChange={setHabitDraftText}
                                                            rows={6}
                                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                                            placeholder="Texto de la plantilla..."
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={savingHabit || !habitDraftName.trim() || !habitDraftText.trim()}
                                                                onClick={saveHabitTemplate}
                                                                className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1 transition-colors"
                                                            >
                                                                {savingHabit ? 'Guardando…' : 'Guardar'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelHabitEdit}
                                                                className="text-[11px] font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-3 py-1 transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] leading-snug text-slate-400">
                                    Marca los hábitos a incluir en el PDF. Cada hábito es una plantilla editable: los cambios se guardan y quedan disponibles para todos los pacientes.
                                </p>
                            </div>
                        </div>

                        </>)}

                        {activeTab === 'terapias' && (<>
                        <div className="space-y-3">
                            {/* Encabezado + toggle de visibilidad en PDF */}
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <HeartHandshake size={14} className="text-emerald-600" />
                                    Terapias Recomendadas
                                </label>
                                <ToggleSwitch
                                    checked={showTherapiesSection}
                                    onChange={setShowTherapiesSection}
                                    label="Mostrar en PDF"
                                />
                            </div>

                            {/* Campos de frecuencia, cantidad y anotación especial */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                    Planificación para el Paciente
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            Frecuencia de las terapias
                                        </label>
                                        <input
                                            type="text"
                                            value={therapyFrequency}
                                            onChange={(e) => setTherapyFrequency(e.target.value)}
                                            placeholder="Ej. 3 veces por semana"
                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                            ¿Cuántas terapias serán?
                                        </label>
                                        <input
                                            type="text"
                                            value={therapyCount}
                                            onChange={(e) => setTherapyCount(e.target.value)}
                                            placeholder="Ej. 10 sesiones"
                                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60">
                                    <div className="text-[9px] font-bold text-slate-500">
                                        Anotación Especial (Título y Cuerpo)
                                    </div>
                                    <input
                                        type="text"
                                        value={therapyNoteTitle}
                                        onChange={(e) => setTherapyNoteTitle(e.target.value)}
                                        placeholder="Título (ej. Recomendación de aplicación)"
                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                    />
                                    <SpeechTextarea
                                        value={therapyNoteBody}
                                        onValueChange={setTherapyNoteBody}
                                        rows={2}
                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y"
                                        placeholder="Detalles del procedimiento o recomendación especial..."
                                    />
                                </div>
                            </div>

                            {/* Resumen de selección */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-emerald-600">{selectedTherapies.length} seleccionadas</span>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTherapies([])}
                                        className="text-[10px] font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-0.5 transition-colors"
                                    >
                                        Ninguna
                                    </button>
                                    <button
                                        type="button"
                                        onClick={startAddTherapy}
                                        className="text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2 py-0.5 transition-colors"
                                    >
                                        + Nueva terapia
                                    </button>
                                </div>
                            </div>

                            {/* Buscador */}
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={therapySearchQuery}
                                    onChange={(e) => setTherapySearchQuery(e.target.value)}
                                    placeholder="Buscar terapia (Abhyanga, Nasya, Basti...)"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Formulario para agregar una nueva terapia */}
                            {isAddingTherapy && (
                                <div className="space-y-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={therapyDraftEmoji}
                                            onChange={(e) => setTherapyDraftEmoji(e.target.value)}
                                            placeholder="🌿"
                                            className="w-14 text-center text-sm bg-white border border-slate-200 rounded-lg px-1 py-1.5 focus:outline-none focus:border-emerald-500"
                                        />
                                        <input
                                            type="text"
                                            value={therapyDraftName}
                                            onChange={(e) => setTherapyDraftName(e.target.value)}
                                            placeholder="Nombre de la terapia (p. ej. Shirodhara)"
                                            className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <SpeechTextarea
                                        value={therapyDraftText}
                                        onValueChange={setTherapyDraftText}
                                        rows={7}
                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                        placeholder="Descripción, beneficios y procedimiento (admite Markdown: ## títulos, - viñetas, **negrita**)..."
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={savingTherapy || !therapyDraftName.trim() || !therapyDraftText.trim()}
                                            onClick={saveTherapyTemplate}
                                            className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1 transition-colors"
                                        >
                                            {savingTherapy ? 'Guardando…' : 'Guardar terapia'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelTherapyEdit}
                                            className="text-[11px] font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-3 py-1 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Catálogo de terapias */}
                            <div className="space-y-2">
                                {therapiesList
                                    .filter(t => {
                                        const q = therapySearchQuery.trim().toLowerCase();
                                        if (!q) return true;
                                        return t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q);
                                    })
                                    .map((therapy) => {
                                        const isSelected = selectedTherapies.includes(therapy.id);
                                        const isEditing = editingTherapyId === therapy.id;
                                        const isExpanded = expandedTherapyId === therapy.id || isEditing;
                                        return (
                                            <div
                                                key={therapy.id}
                                                className={`rounded-xl border transition-colors ${isSelected ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}
                                            >
                                                <div className="flex items-center gap-2.5 px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleTherapy(therapy.id)}
                                                        className="rounded border-slate-300 bg-white text-emerald-600 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                                                    />
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${isSelected ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                                        {therapy.emoji || '🌿'}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedTherapyId(isExpanded && !isEditing ? null : therapy.id)}
                                                        className="flex-1 text-left min-w-0"
                                                    >
                                                        <p className={`text-xs leading-snug truncate ${isSelected ? 'text-emerald-800 font-bold' : 'text-slate-700 font-semibold'}`}>
                                                            {therapy.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 truncate">
                                                            {therapy.text.replace(/[#*_>\-]/g, '').trim().slice(0, 70)}…
                                                        </p>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedTherapyId(isExpanded && !isEditing ? null : therapy.id)}
                                                        className="shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                                                        title={isExpanded ? 'Cerrar' : 'Ver contenido'}
                                                    >
                                                        <ChevronDown size={15} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="border-t border-slate-100 px-3 py-2.5 space-y-2">
                                                        {isEditing ? (
                                                            <>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={therapyDraftEmoji}
                                                                        onChange={(e) => setTherapyDraftEmoji(e.target.value)}
                                                                        placeholder="🌿"
                                                                        className="w-14 text-center text-sm bg-white border border-slate-200 rounded-lg px-1 py-1.5 focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={therapyDraftName}
                                                                        onChange={(e) => setTherapyDraftName(e.target.value)}
                                                                        placeholder="Nombre de la terapia"
                                                                        className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                </div>
                                                                <SpeechTextarea
                                                                    value={therapyDraftText}
                                                                    onValueChange={setTherapyDraftText}
                                                                    rows={10}
                                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y font-sans"
                                                                    placeholder="Descripción de la terapia..."
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        disabled={savingTherapy || !therapyDraftName.trim() || !therapyDraftText.trim()}
                                                                        onClick={saveTherapyTemplate}
                                                                        className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1 transition-colors"
                                                                    >
                                                                        {savingTherapy ? 'Guardando…' : 'Guardar'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={cancelTherapyEdit}
                                                                        className="text-[11px] font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-3 py-1 transition-colors"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="max-h-56 overflow-y-auto bg-slate-50 rounded-lg p-3 prose prose-sm max-w-none text-[11px] leading-relaxed text-slate-600 prose-headings:text-emerald-700 prose-headings:text-xs prose-headings:font-bold prose-headings:my-1.5 prose-p:my-1 prose-li:my-0.5 prose-strong:text-slate-800">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{therapy.text}</ReactMarkdown>
                                                                </div>
                                                                <div className="flex gap-2 justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEditTherapy(therapy)}
                                                                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 transition-colors"
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteTherapyTemplate(therapy)}
                                                                        className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors"
                                                                    >
                                                                        Eliminar
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                            <p className="text-[11px] leading-snug text-slate-400">
                                Marca las terapias a incluir en el PDF del paciente. Cada terapia es una plantilla editable: los cambios se guardan en el catálogo y quedan disponibles para todos los pacientes.
                            </p>
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
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recetas Recomendadas</label>
                                <ToggleSwitch
                                    checked={showRecipesSection}
                                    onChange={setShowRecipesSection}
                                    label="Mostrar en PDF"
                                />
                            </div>

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
                                                        {(() => {
                                                            const structured = r.structured || { prepTime: '', yield: '', ingredients: r.text ? [] : [], preparation: r.text || '', comments: '' };
                                                            const updateStructured = (patch: Record<string, any>) => {
                                                                const nextStructured = { ...structured, ...patch };
                                                                const updated = [...selectedRecipes];
                                                                updated[idx] = { ...updated[idx], structured: nextStructured, text: buildRecipeTextFromStructured(nextStructured) };
                                                                setSelectedRecipes(updated);
                                                            };
                                                            return (
                                                                <>
                                                                    <div className="grid grid-cols-2 gap-1.5">
                                                                        <div>
                                                                            <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Tiempo de preparación:</label>
                                                                            <input
                                                                                type="text"
                                                                                value={structured.prepTime || ''}
                                                                                onChange={(e) => updateStructured({ prepTime: e.target.value })}
                                                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-emerald-500 font-sans"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Porciones:</label>
                                                                            <input
                                                                                type="text"
                                                                                value={structured.yield || ''}
                                                                                onChange={(e) => updateStructured({ yield: e.target.value })}
                                                                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 outline-none focus:border-emerald-500 font-sans"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Ingredientes (uno por línea):</label>
                                                                        <textarea
                                                                            value={(structured.ingredients || []).join('\n')}
                                                                            onChange={(e) => updateStructured({ ingredients: e.target.value.split('\n') })}
                                                                            rows={4}
                                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 outline-none focus:border-emerald-500 font-sans resize-y leading-relaxed"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Preparación:</label>
                                                                        <textarea
                                                                            value={structured.preparation || ''}
                                                                            onChange={(e) => updateStructured({ preparation: e.target.value })}
                                                                            rows={4}
                                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 outline-none focus:border-emerald-500 font-sans resize-y leading-relaxed"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-semibold text-emerald-600 block mb-0.5">Comentarios:</label>
                                                                        <textarea
                                                                            value={structured.comments || ''}
                                                                            onChange={(e) => updateStructured({ comments: e.target.value })}
                                                                            rows={2}
                                                                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 outline-none focus:border-emerald-500 font-sans resize-y leading-relaxed"
                                                                        />
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
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
                                            <option value="Recetas Propias">Recetas Propias</option>
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

                                {/* Manual Recipe Form */}
                                <div className="pt-2 border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setShowManualRecipeForm(v => !v)}
                                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1.5"
                                    >
                                        <Plus size={13} className={`transition-transform ${showManualRecipeForm ? 'rotate-45' : ''}`} />
                                        {showManualRecipeForm ? 'Cancelar receta manual' : 'Añadir receta manual'}
                                    </button>
                                    {showManualRecipeForm && (
                                        <div className="space-y-2 mt-1.5">
                                            <input
                                                type="text"
                                                value={manualRecipeTitle}
                                                onChange={(e) => setManualRecipeTitle(e.target.value)}
                                                placeholder="Título de la receta"
                                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                            />
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <input
                                                    type="text"
                                                    value={manualRecipePrepTime}
                                                    onChange={(e) => setManualRecipePrepTime(e.target.value)}
                                                    placeholder="Tiempo de preparación (opcional)"
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                                />
                                                <input
                                                    type="text"
                                                    value={manualRecipeYield}
                                                    onChange={(e) => setManualRecipeYield(e.target.value)}
                                                    placeholder="Porciones (opcional)"
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Ingredientes (uno por línea)</label>
                                                <textarea
                                                    value={manualRecipeIngredients}
                                                    onChange={(e) => setManualRecipeIngredients(e.target.value)}
                                                    rows={4}
                                                    placeholder={'1 taza de leche\n1/4 cdta de canela\n...'}
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Preparación</label>
                                                <textarea
                                                    value={manualRecipePreparation}
                                                    onChange={(e) => setManualRecipePreparation(e.target.value)}
                                                    rows={4}
                                                    placeholder="Pasos de preparación..."
                                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed"
                                                />
                                            </div>
                                            <textarea
                                                value={manualRecipeComments}
                                                onChange={(e) => setManualRecipeComments(e.target.value)}
                                                rows={2}
                                                placeholder="Comentarios (opcional)"
                                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed"
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const title = manualRecipeTitle.trim();
                                                    const ingredients = manualRecipeIngredients.split('\n').map(s => s.trim()).filter(Boolean);
                                                    const preparation = manualRecipePreparation.trim();
                                                    if (!title || ingredients.length === 0 || !preparation) return;

                                                    const prepTime = manualRecipePrepTime.trim();
                                                    const yieldText = manualRecipeYield.trim();
                                                    const comments = manualRecipeComments.trim();
                                                    const structured = { prepTime, yield: yieldText, ingredients, preparation, comments };
                                                    const combinedText = buildRecipeTextFromStructured(structured);

                                                    const manualRecipe = {
                                                        id: `manual-${Date.now()}`,
                                                        title,
                                                        category: 'Recetas Propias',
                                                        doshas: [] as string[],
                                                        vata_effect: 'No especificado',
                                                        pitta_effect: 'No especificado',
                                                        kapha_effect: 'No especificado',
                                                        text: combinedText,
                                                        structured
                                                    };

                                                    setSelectedRecipes([...selectedRecipes, manualRecipe]);
                                                    setIsSavingManualRecipe(true);
                                                    await handleSaveRecipeToDatabase(manualRecipe, { silent: true });
                                                    setIsSavingManualRecipe(false);

                                                    setManualRecipeTitle('');
                                                    setManualRecipePrepTime('');
                                                    setManualRecipeYield('');
                                                    setManualRecipeIngredients('');
                                                    setManualRecipePreparation('');
                                                    setManualRecipeComments('');
                                                    setShowManualRecipeForm(false);
                                                }}
                                                disabled={!manualRecipeTitle.trim() || !manualRecipeIngredients.trim() || !manualRecipePreparation.trim() || isSavingManualRecipe}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                                            >
                                                {isSavingManualRecipe ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                                Agregar Receta Manual
                                            </button>
                                            <p className="text-[10px] text-slate-400 leading-snug">
                                                Se guardará en tu base de datos bajo la categoría <span className="font-semibold text-slate-500">"Recetas Propias"</span> para reutilizarla en futuros pacientes.
                                            </p>
                                        </div>
                                    )}
                                </div>
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
                            onClick={() => setShowFormatChooser(true)}
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
                    className={`print-area flex-1 bg-[#cbd5e1] overflow-y-auto p-8 flex flex-col items-center gap-8 print:bg-white print:p-0 print:overflow-visible ${
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
                    <div className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                        
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
                        <div key={`diagnosis-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
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
                        <div key={`treatment-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                            
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
                                    {treatmentPages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {treatmentPages.length}</p>}
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
                        <div key={`lifestyle-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col font-serif relative">
                            
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
                                    {lifestylePages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {lifestylePages.length}</p>}
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
                        <div key={`digestive-recovery-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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
                                        {digestiveRecoveryPages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {digestiveRecoveryPages.length}</p>}
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
                        <div key={`healthy-eating-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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

                    {/* Terapias Recomendadas */}
                    {showTherapiesSection && therapiesPages.map((pageText, idx) => (
                        <div key={`therapies-${idx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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
                                        <p className="font-semibold text-[#334155]">Terapias Recomendadas</p>
                                        {therapiesPages.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {idx + 1} de {therapiesPages.length}</p>}
                                        <p>Paciente: <span className="font-bold text-[#0f172a]">{patient.name}</span></p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-4 flex-1 flex flex-col">
                                    <div className="space-y-1.5 flex-1 bg-[#fffbeb] p-5 rounded-xl border border-[#fde68a] overflow-hidden">
                                        <div className="text-[11.5px] leading-relaxed text-[#334155] font-sans prose prose-sm max-w-none prose-p:text-[#334155] prose-p:my-1.5 prose-strong:text-slate-900 prose-em:text-[#475569] prose-h1:text-[13px] prose-h1:font-bold prose-h1:uppercase prose-h1:tracking-wider prose-h1:text-[#b45309] prose-h1:mt-3 prose-h1:mb-2 prose-h1:first:mt-0 prose-h2:text-[11.5px] prose-h2:font-bold prose-h2:text-[#15803d] prose-h2:mt-2.5 prose-h2:mb-1 prose-h3:text-[11px] prose-h3:font-bold prose-h3:text-[#334155] prose-h3:mt-2 prose-h3:mb-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 pdf-base-text">
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
                        <div key={chunkIdx} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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
                                        {categoryChunks.length > 1 && <p className="text-[10px] text-[#64748b]">Parte {chunkIdx + 1} de {categoryChunks.length}</p>}
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
                    <div className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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
                                    {showRecipesSection && selectedRecipes.length > 0 ? (
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
                    {showRecipesSection && selectedRecipes.map((recipe, index) => {
                        const printableRecipe = getPrintableRecipe(recipe);
                        const recipePages = [printableRecipe.printableText];
                        return recipePages.map((pageText, pageIdx) => (
                            <div key={`recipe-page-${recipe.id}-${index}-${pageIdx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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
                                                {pageText.split('\n').map((line: string, lineIdx: number) => {
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
                        <div key={`herbal-formulas-${herbalPageIdx}`} className="pdf-page w-[210mm] min-h-[297mm] shrink-0 bg-[#F5EEDC] text-[#1e293b] pt-[15mm] pb-[15mm] px-[20mm] rounded-sm shadow-xl print:shadow-none print:w-full print:p-0 print:m-0 flex flex-col justify-between font-serif relative">
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


                {/* Continuous Chromium print template (hidden on screen, sole source for real PDF output) */}
                <div
                    id="pdf-print-content"
                    className="print-area print-flow hidden bg-[#F5EEDC] text-[#1e293b] font-serif"
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
                    {/* Fondo acuarela POR PÁGINA: los elementos position:fixed se
                        repintan en cada hoja del PDF (técnica de marca de agua),
                        así cada página luce la acuarela completa como en pantalla
                        en vez de un único fondo estirado sobre todo el documento. */}
                    <div className="print-page-bg" aria-hidden="true"></div>
                    {/* Estructura de tabla: thead y tfoot se REPITEN en cada hoja
                        impresa → encabezado y pie de marca por página, y con
                        @page margin:0 el fondo crema cubre la hoja completa. */}
                    <table className="print-layout-table">
                    <thead className="print-layout-head">
                    <tr><td className="plt-head">
                    <div className="print-flow-header">
                        <div className="flex items-center gap-3">
                            <img src="/LOGO_2020_VEDAMCI.png" alt="VEDAMCI Logo" className="h-12 w-auto object-contain shrink-0" />
                            <div>
                                <h1 className="text-2xl font-extrabold tracking-wide text-[#16a34a] font-serif uppercase leading-none">VEDAMCI</h1>
                                <p className="text-[10px] uppercase tracking-wider text-[#d4a853] font-sans font-bold mt-1">Instituto de Medicina Ayurvédica</p>
                            </div>
                        </div>
                        <div className="text-right text-xs font-sans text-[#64748b] space-y-0.5 pdf-meta">
                            <p className="font-semibold text-[#334155]">Paciente: <span className="font-bold text-[#0f172a] font-serif text-sm">{patient.name}</span></p>
                            <p>Edad: {patient.age ? `${String(patient.age).replace(/\s*años?\s*$/i, '')} años` : 'N/A'}</p>
                            <p>Fecha: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p>Dosha principal: <span className="font-semibold text-[#16a34a]">{selectedDosha}</span></p>
                            <p>Profesional: <span className="font-semibold text-[#334155]">{professionalContact.name}</span></p>
                        </div>
                    </div>
                    </td></tr>
                    </thead>
                    <tbody className="print-layout-rows">
                    <tr><td className="plt-body">

                    <section className="print-flow-section print-flow-hero print-avoid text-center bg-[#22c55e]/5 py-4 px-6 rounded-xl border border-[#22c55e]/10">
                        <h2 className="font-bold text-[#1e293b] mb-1 pdf-title">{title}</h2>
                        <p className="text-[#64748b] font-sans italic pdf-subtitle">{subtitle}</p>
                    </section>

                    <section className="print-flow-section print-avoid">
                        {!isFollowUp ? (
                            <div className="space-y-5">
                                <div className="print-flow-instruction-block">
                                    <div className="print-flow-kicker">
                                        <span>01 CÓMO SEGUIR LAS INDICACIONES</span>
                                    </div>
                                    <ol className="list-decimal pl-5 space-y-1.5 text-[#334155] font-sans pdf-base-text">
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
                                <div className="print-flow-food-intro">
                                    <h3 className="print-flow-title">Cómo seguir la alimentación</h3>
                                    <p className="font-sans text-[#475569] pdf-base-text">
                                        En la alimentación la clave es hacer cambios graduales para permitir al cuerpo adaptarse. En Ayurveda la alimentación se basa en los seis sabores; para elegir los alimentos adecuados estos tienen que tener los sabores correctos para tu constitución.
                                        Empezaremos haciendo cambios en dos categorías a la vez, esto quiere decir que todas las demás categorías seguirán sin ningún cambio.
                                    </p>
                                    <div className="print-flow-legend grid grid-cols-3 gap-2.5 bg-[#f8fafc] p-2 rounded-lg border border-[#f1f5f9] text-[10px] font-sans mt-3 pdf-meta print-avoid">
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#22c55e] inline-block shrink-0"></span><div><span className="font-bold text-[#15803d]">■ Mejor:</span> Sin reservas.</div></div>
                                        <div className="flex items-center gap-1.5 border-x border-[#e2e8f0] px-2.5"><span className="w-2 h-2 rounded bg-[#f59e0b] inline-block shrink-0"></span><div><span className="font-bold text-[#b45309]">■■ Moderación:</span> Porción pequeña.</div></div>
                                        <div className="flex items-center gap-1.5 pl-1.5"><span className="w-2 h-2 rounded bg-[#ef4444] inline-block shrink-0"></span><div><span className="font-bold text-[#b91c1c]">■ Evitar:</span> Raras ocasiones.</div></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-[#d4a853] bg-[#fffbeb]/60 p-5 text-center font-sans print-avoid">
                                <h3 className="print-flow-title">Indicación de seguimiento importante</h3>
                                <p className="text-[#334155] font-medium pdf-base-text">
                                    Es importante continuar con las pautas y tratamientos indicados en las visitas anteriores, sumando de manera gradual el nuevo tratamiento y las modificaciones detalladas en este documento.
                                </p>
                            </div>
                        )}
                    </section>

                    {showDiagnosis && (!isFollowUp || recordDiagnosisPreview.trim() || patientDiagnosisText.trim()) && diagnosisPreview && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Diagnóstico base</h3>
                            <div className="print-flow-card diagnosis-markdown prose prose-sm max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{diagnosisPreview}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {printableTreatmentText.trim() && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Tratamiento e indicaciones</h3>
                            <div className="print-flow-card prose prose-sm prose-emerald max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{printableTreatmentText}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {showLifestylePage && lifestyleIndication.trim() && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Estilo de vida</h3>
                            <div className="print-flow-card bg-[#ecfdf5] border-[#bbf7d0] whitespace-pre-line font-sans pdf-base-text">
                                {lifestyleIndication}
                            </div>
                        </section>
                    )}

                    {showDigestiveRecoveryPage && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Recuperación digestiva</h3>
                            <div className="print-flow-card prose prose-sm max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{DIGESTIVE_RECOVERY_TEXT}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {showHealthyEatingGuide && healthyEatingContent.trim() && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Guía de alimentación saludable</h3>
                            <div className="print-flow-card prose prose-sm max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{healthyEatingContent}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {showTherapiesSection && therapiesContent.trim() && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Terapias recomendadas</h3>
                            <div className="print-flow-card prose prose-sm max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{therapiesContent}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {activeCategories.length > 0 && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Pautas dietéticas {selectedDosha}</h3>
                            <div className="space-y-5">
                                {activeCategories.map((cat: any, catIdx: number) => (
                                    <div key={catIdx} className="print-flow-table-card print-avoid">
                                        <div className="bg-[#f8fafc]/85 border-b border-[#e2e8f0] px-4 py-2.5">
                                            <span className="font-bold font-sans text-[#334155] pdf-base-text">Categoría — {cat.nombre}</span>
                                            {cat.consejo && <div className="text-[#475569] font-sans italic pdf-meta mt-1">{cat.consejo}</div>}
                                        </div>
                                        <table className="w-full font-sans">
                                            <thead>
                                                <tr>
                                                    <th className="w-1/3 diet-th-best">■ MEJOR</th>
                                                    <th className="w-1/3 diet-th-mod">■■ MODERACIÓN</th>
                                                    <th className="w-1/3 diet-th-avoid">■ EVITAR</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>{cat.mejor && cat.mejor.length > 0 ? cat.mejor.join(', ') : '-'}</td>
                                                    <td>{((cat.pequenas_cantidades || cat.moderacion) && (cat.pequenas_cantidades || cat.moderacion).length > 0) ? (cat.pequenas_cantidades || cat.moderacion).join(', ') : '-'}</td>
                                                    <td>{cat.evitar && cat.evitar.length > 0 ? cat.evitar.join(', ') : '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {cerealGuidance.trim() && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Guía práctica de alimentos</h3>
                            <div className="print-flow-card prose prose-sm max-w-none font-sans pdf-base-text">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{cerealGuidance}</ReactMarkdown>
                            </div>
                        </section>
                    )}

                    {(showRecipesSection && selectedRecipes.length > 0) || cerealRecipe.trim() ? (
                        <section className={`print-flow-section${cerealGuidance.trim() ? '' : ' print-page-break-before'}`}>
                            <h3 className="print-flow-title">Recetas recomendadas</h3>
                            {showRecipesSection && selectedRecipes.length > 0 ? (
                                <div className="space-y-5">
                                    {selectedRecipes.map((recipe: any, index: number) => {
                                        const printableRecipe = getPrintableRecipe(recipe);
                                        return (
                                            <article key={'print-recipe-' + (recipe.id || index)} className="print-flow-card print-avoid">
                                                <h4 className="font-bold text-[#1e293b] font-sans pdf-heading">{recipe.title}</h4>
                                                <p className="uppercase tracking-wider text-[#b45309] font-bold mt-1 font-sans pdf-meta">
                                                    Categoría: {recipe.category} · Doshas: {printableRecipe.doshaLabel}
                                                </p>
                                                <div className="grid grid-cols-3 gap-2 bg-white/60 p-2.5 rounded-lg border border-[#fde68a]/50 text-[#475569] mt-3 font-sans pdf-meta print-avoid">
                                                    <div><span className="font-bold text-[#334155]">Vata:</span> {printableRecipe.vataEffect}</div>
                                                    <div><span className="font-bold text-[#334155]">Pitta:</span> {printableRecipe.pittaEffect}</div>
                                                    <div><span className="font-bold text-[#334155]">Kapha:</span> {printableRecipe.kaphaEffect}</div>
                                                </div>
                                                <div className="mt-4 whitespace-pre-line font-sans pdf-base-text">{printableRecipe.printableText}</div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="print-flow-card whitespace-pre-line font-sans pdf-base-text">{cerealRecipe}</div>
                            )}
                        </section>
                    ) : null}

                    {herbs.length > 0 && (
                        <section className="print-flow-section print-page-break-before">
                            <h3 className="print-flow-title">Fórmulas herbales recomendadas</h3>
                            <div className="print-flow-table-card">
                                <table className="w-full font-sans">
                                    <thead>
                                        <tr>
                                            <th className="w-3/12">Fórmula / Hierba</th>
                                            <th className="w-4/12">Dosis e indicaciones</th>
                                            <th className="w-5/12">¿Para qué sirve?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {herbs.map((h, idx) => {
                                            const { dosage, purpose } = getHerbParts(h);
                                            return (
                                                <tr key={idx} className="align-top print-avoid">
                                                    <td className="font-bold text-[#1e293b]">{h.formula}</td>
                                                    <td className="whitespace-pre-line">{dosage}</td>
                                                    <td className="whitespace-pre-line">{purpose}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    </td></tr>
                    </tbody>
                    <tfoot className="print-layout-foot">
                    <tr><td className="plt-foot">
                    <div className="print-flow-footer">
                        <div>
                            <p className="font-semibold text-[#334155]">VEDAMCI · Instituto de Medicina Ayurvédica</p>
                            <p className="italic">Indicaciones personalizadas · Todos los derechos reservados</p>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold text-[#16a34a]">Contacto: {professionalContact.name}</p>
                            {professionalContactLine}
                        </div>
                    </div>
                    </td></tr>
                    </tfoot>
                    </table>
                </div>

                <AnimatePresence>
                    {showFormatChooser && !isDownloading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[85] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
                            onClick={() => setShowFormatChooser(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.16 }}
                                className="w-[min(92vw,30rem)] rounded-2xl bg-white shadow-2xl border border-emerald-100 p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">¿Cómo se leerá este PDF?</h3>
                                        <p className="text-xs text-slate-500 mt-1">Elige el formato de hoja antes de generar el documento.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowFormatChooser(false)}
                                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                                        title="Cancelar"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowFormatChooser(false); handlePrint('desktop'); }}
                                        className="group text-left rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 transition-colors p-4"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                                            <Monitor size={20} />
                                        </div>
                                        <p className="font-bold text-slate-900 text-sm">Escritorio / Impresión</p>
                                        <p className="text-xs text-slate-500 mt-1 leading-snug">Hoja A4 clásica, ideal para imprimir o leer en computadora.</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowFormatChooser(false); handlePrint('mobile'); }}
                                        className="group text-left rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 transition-colors p-4"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                                            <Smartphone size={20} />
                                        </div>
                                        <p className="font-bold text-slate-900 text-sm">Móvil</p>
                                        <p className="text-xs text-slate-500 mt-1 leading-snug">Hoja estrecha con letra más grande, para leer en el teléfono sin hacer zoom.</p>
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                    El PDF se genera con texto real (seleccionable) usando el motor de impresión de Chromium.
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
                                    {showRecipesSection && selectedRecipes.length > 0 && (
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
                                        onClick={() => { setShowTreatmentPage(false); setShowFormatChooser(true); }}
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

                /* Fondo "acuarela" (río verde/dorado sobre beige) en cada página */
                #pdf-content .pdf-page {
                    background-color: ${PDF_WATERCOLOR_BG_COLOR} !important;
                    background-image: url("data:image/svg+xml,${encodeURIComponent(PDF_WATERCOLOR_BG_SVG)}") !important;
                    background-size: cover !important;
                    background-position: center !important;
                    background-repeat: no-repeat !important;
                    print-color-adjust: exact !important;
                    -webkit-print-color-adjust: exact !important;
                }


                #pdf-print-content {
                    font-size: var(--pdf-font-base) !important;
                    line-height: 1.5 !important;
                    color: #1e293b !important;
                    background-color: ${PDF_WATERCOLOR_BG_COLOR} !important;
                    background-image: url("data:image/svg+xml,${encodeURIComponent(PDF_WATERCOLOR_BG_SVG)}") !important;
                    background-size: cover !important;
                    background-position: center !important;
                    background-repeat: repeat-y !important;
                    print-color-adjust: exact !important;
                    -webkit-print-color-adjust: exact !important;
                }
                #pdf-print-content .pdf-base-text { font-size: var(--pdf-font-base) !important; }
                #pdf-print-content .pdf-title { font-size: var(--pdf-font-title) !important; }
                #pdf-print-content .pdf-subtitle { font-size: var(--pdf-font-subtitle) !important; }
                #pdf-print-content .pdf-heading { font-size: var(--pdf-font-heading) !important; }
                #pdf-print-content .pdf-meta { font-size: var(--pdf-font-meta) !important; }
                #pdf-print-content .print-flow-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    border-bottom: 1px solid rgba(34, 197, 94, 0.22);
                    padding-bottom: 12px;
                    margin-bottom: 18px;
                }
                #pdf-print-content .print-flow-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    border-top: 1px solid rgba(34, 197, 94, 0.25);
                    padding-top: 10px;
                    margin-top: 16px;
                    color: #64748b;
                    font-family: ui-sans-serif, system-ui, sans-serif;
                    font-size: var(--pdf-font-meta) !important;
                }
                #pdf-print-content .print-flow-section { margin: 0 0 9mm 0; }
                #pdf-print-content .print-flow-hero {
                    padding-top: 10px !important;
                    padding-bottom: 11px !important;
                    background-color: rgba(34, 197, 94, 0.05) !important;
                    border-color: rgba(34, 197, 94, 0.12) !important;
                }
                #pdf-print-content .print-flow-kicker {
                    display: flex;
                    align-items: center;
                    background: #113f26 !important;
                    color: #ffffff !important;
                    border-left: 5px solid #d4a853 !important;
                    padding: 6px 12px !important;
                    margin: 0 0 8px 0 !important;
                    font-family: ui-sans-serif, system-ui, sans-serif;
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    letter-spacing: 0.02em !important;
                    text-transform: uppercase !important;
                }
                #pdf-print-content .print-flow-kicker span {
                    color: #ffffff !important;
                }
                #pdf-print-content .print-flow-food-intro p {
                    margin-top: 0 !important;
                }
                #pdf-print-content .print-flow-legend {
                    background-color: #f8fafc !important;
                    border-color: #f1f5f9 !important;
                }
                #pdf-print-content .print-flow-title {
                    display: block;
                    margin: 0 0 8px 0;
                    color: #16a34a;
                    font-family: ui-sans-serif, system-ui, sans-serif;
                    font-size: var(--pdf-font-heading) !important;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }
                #pdf-print-content .print-flow-card,
                #pdf-print-content .print-flow-table-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.72);
                    padding: 14px;
                    box-shadow: none !important;
                }
                #pdf-print-content .print-flow-table-card { overflow: hidden; padding: 0; }
                #pdf-print-content .prose p,
                #pdf-print-content .prose li {
                    font-size: var(--pdf-font-base) !important;
                    line-height: 1.5 !important;
                    color: #334155 !important;
                }
                #pdf-print-content .prose h1,
                #pdf-print-content .prose h2,
                #pdf-print-content .prose h3,
                #pdf-print-content .prose h4 {
                    font-size: var(--pdf-font-heading) !important;
                    color: #0f172a !important;
                    line-height: 1.25 !important;
                }
                #pdf-print-content table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: var(--pdf-font-table-body) !important;
                    line-height: 1.35 !important;
                }
                #pdf-print-content th {
                    background-color: #f1f5f9 !important;
                    color: #1e293b !important;
                    font-weight: 700 !important;
                    text-align: left !important;
                    padding: 7px 9px !important;
                    border: 1px solid #cbd5e1 !important;
                    font-size: var(--pdf-font-table-header) !important;
                }
                /* Colores de marca en las cabeceras de las tablas dietéticas */
                #pdf-print-content th.diet-th-best { color: #15803d !important; background-color: #ffffff !important; }
                #pdf-print-content th.diet-th-mod { color: #b45309 !important; background-color: #ffffff !important; }
                #pdf-print-content th.diet-th-avoid { color: #b91c1c !important; background-color: #ffffff !important; }

                /* ── Tabla de LAYOUT de impresión ─────────────────────────────
                   No es una tabla de datos: sus celdas no llevan bordes ni
                   estilos de tabla. Sus paddings son los márgenes visuales de
                   la hoja (la impresión va con @page margin: 0 para que el
                   fondo crema cubra la página completa). */
                #pdf-print-content table.print-layout-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin: 0 !important;
                }
                #pdf-print-content td.plt-head,
                #pdf-print-content td.plt-body,
                #pdf-print-content td.plt-foot {
                    border: none !important;
                    background: transparent !important;
                    vertical-align: top !important;
                }
                #pdf-print-content td.plt-head { padding: ${PDF_PAGE_FORMATS[pdfPageFormat].headPadding} !important; }
                #pdf-print-content td.plt-body { padding: ${PDF_PAGE_FORMATS[pdfPageFormat].bodyPadding} !important; }
                #pdf-print-content td.plt-foot { padding: ${PDF_PAGE_FORMATS[pdfPageFormat].footPadding} !important; }
                #pdf-print-content td {
                    padding: 8px 9px !important;
                    border: 1px solid #e2e8f0 !important;
                    color: #334155 !important;
                    vertical-align: top !important;
                    white-space: normal !important;
                    font-size: var(--pdf-font-table-body) !important;
                }
${pdfPageFormat === 'mobile' ? `
                /* ── Formato MÓVIL: hoja estrecha (120mm) ─────────────────────
                   El encabezado y el pie de marca se apilan en columna (no caben
                   lado a lado), la leyenda de colores pasa a una columna y las
                   celdas de tabla se compactan para las tablas de 3 columnas. */
                #pdf-print-content .print-flow-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                }
                #pdf-print-content .print-flow-header img { height: 34px !important; }
                #pdf-print-content .print-flow-header h1 { font-size: 18px !important; }
                #pdf-print-content .print-flow-header .pdf-meta { text-align: left !important; }
                #pdf-print-content .print-flow-footer {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
                #pdf-print-content .print-flow-footer .text-right { text-align: left !important; }
                #pdf-print-content .print-flow-legend {
                    grid-template-columns: 1fr !important;
                    gap: 4px !important;
                }
                #pdf-print-content .print-flow-legend > div {
                    border: none !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
                #pdf-print-content .print-flow-section { margin: 0 0 6mm 0; }
                #pdf-print-content .print-flow-card,
                #pdf-print-content .print-flow-table-card { padding: 10px; }
                #pdf-print-content .print-flow-table-card { padding: 0; }
                #pdf-print-content th { padding: 5px 6px !important; }
                #pdf-print-content td { padding: 5px 6px !important; }
` : ''}
                /* Oculto fuera de impresión: solo existe para el PDF. */
                .print-page-bg { display: none; }

                @media print {
                    body * {
                        visibility: hidden;
                    }
                    /* Fondo crema a PÁGINA COMPLETA: el color del body pinta toda
                       la hoja (incluidos los márgenes), eliminando el marco blanco.
                       OJO: la ACUARELA no va aquí — un background del body se
                       estira sobre TODO el documento (N páginas) y cada hoja
                       mostraría solo un trozo borroso. La acuarela por hoja la
                       pinta .print-page-bg (position:fixed se repite por página). */
                    html, body {
                        background: ${PDF_WATERCOLOR_BG_COLOR} !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    #pdf-print-content .print-page-bg {
                        display: block !important;
                        visibility: visible !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        z-index: -1 !important;
                        background-color: ${PDF_WATERCOLOR_BG_COLOR} !important;
                        background-image: url("data:image/svg+xml,${encodeURIComponent(PDF_WATERCOLOR_BG_SVG)}") !important;
                        background-size: cover !important;
                        background-position: center !important;
                        background-repeat: no-repeat !important;
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    #pdf-print-content, #pdf-print-content * {
                        visibility: visible;
                    }
                    #pdf-content {
                        display: none !important;
                    }
                    #pdf-print-content {
                        display: block !important;
                        /* Absoluto para escapar del layout flex del modal: si no,
                           los paneles ocultos (visibility) siguen ocupando espacio. */
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        gap: 0 !important;
                        opacity: 1 !important;
                        pointer-events: auto !important;
                        /* Transparente: la acuarela por hoja la pinta .print-page-bg;
                           un fondo aquí se estiraría sobre todo el documento y
                           además crearía una "costura" al acabar el contenido. */
                        background: transparent !important;
                    }

                    /* Vista previa vieja: queda solo como respaldo visual; la salida real usa #pdf-print-content. */
                    #pdf-content .pdf-page {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        overflow: visible !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        transform: none !important;
                        margin: 0 !important;
                        break-after: page;
                        page-break-after: always;
                        break-inside: auto;
                    }
                    #pdf-content .pdf-page:last-child {
                        break-after: auto;
                        page-break-after: avoid;
                    }

                    /* No partir filas, cabeceras de tabla, tarjetas pequeñas ni títulos.
                       OJO: las tarjetas y tablas GRANDES no llevan avoid — deben poder
                       fluir entre hojas; si no, dejan medias páginas vacías. */
                    #pdf-print-content thead,
                    #pdf-print-content tr,
                    #pdf-print-content .print-avoid,
                    #pdf-print-content h1,
                    #pdf-print-content h2,
                    #pdf-print-content h3,
                    #pdf-print-content h4,
                    #pdf-print-content h5 {
                        break-inside: avoid;
                    }
                    /* Control de líneas huérfanas/viudas en párrafos */
                    #pdf-print-content p {
                        orphans: 3;
                        widows: 3;
                    }
                    /* Un encabezado nunca queda solo al pie de página */
                    #pdf-print-content h1, #pdf-print-content h2, #pdf-print-content h3,
                    #pdf-print-content h4, #pdf-print-content h5 {
                        break-after: avoid;
                    }
                    /* Subtítulos en negrita (párrafos tipo "**Título:**" del markdown)
                       tampoco quedan huérfanos al pie de la hoja */
                    #pdf-print-content p:has(> strong:only-child) {
                        break-after: avoid;
                        break-inside: avoid;
                    }
                    /* No partir un elemento de lista por la mitad */
                    #pdf-print-content li {
                        break-inside: avoid;
                    }
                    /* Repetir la cabecera de las tablas si una se parte entre hojas */
                    #pdf-print-content thead {
                        display: table-header-group;
                    }
                    /* Encabezado y pie de marca REPETIDOS en cada hoja impresa */
                    #pdf-print-content .print-layout-head {
                        display: table-header-group;
                    }
                    #pdf-print-content .print-layout-foot {
                        display: table-footer-group;
                    }
                    /* La fila de contenido del layout SÍ debe poder fluir entre
                       hojas (anula el break-inside:avoid genérico de tr) */
                    #pdf-print-content table.print-layout-table > tbody > tr,
                    #pdf-print-content td.plt-body {
                        break-inside: auto !important;
                    }
                    #pdf-print-content .print-page-break-before {
                        break-before: page;
                        page-break-before: always;
                    }
                    /* Enlaces visibles y clicables (PDF de texto, no imagen) */
                    #pdf-print-content a {
                        color: #047857 !important;
                        text-decoration: underline;
                    }

                    /* Margen 0: es la ÚNICA manera de que Chromium pinte el fondo
                       crema hasta el borde de la hoja (el área de márgenes de
                       impresión siempre queda blanca). Los márgenes visuales los
                       ponen los paddings de plt-head / plt-body / plt-foot. */
                    @page {
                        size: ${PDF_PAGE_FORMATS[pdfPageFormat].pageSize};
                        margin: 0;
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
