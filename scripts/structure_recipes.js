import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const recipesPath = join(__dirname, '../src/data/recipes.json');

const DOSHA_MARKER_PATTERN = /(?:^|[\s,])(?:[+\-O0]\s*(?:ligero|leve|moderado)?\s*(?:Vata|Pitta|Kapha)(?:['"])?|(?:Vata|Pitta|Kapha)(?=\s*,))/gi;
const FIRST_PREPARATION_STEP = /\b(Ponga|Pique|Agregue|Añada|Anada|Mezcle|Licue|Lave|Caliente|Coloque|Corte|Bata|Remoje|Sirva|Precaliente|Pre-caliente|Derrita|Triture|Cocine|Hornee|Hierva|Escurra|Retire|Muela|Muele|Combine|Combina|Haga|Haz|Ruede|Rueda|Vierta|Vierte|Dore|Dora|Tape|Tapa|Reduzca|Reduce|Revuelva|Revuelve|Ase|Asa|Espolvoree|Espolvorea|Guarde|Guarda)\b/i;
const INGREDIENT_START_PATTERN = /(?=(?:\d+(?:-\d+)?|[¼½¾⅛⅓⅔]|\d+\s+[¼½¾⅛⅓⅔])(?:\s+(?:a|o)\s+(?:\d+|[¼½¾⅛⅓⅔]))?\s+(?:tazas?|cucharaditas?|cucharadas?|litros?|manojos?|dientes?|chiles?|bananos?|papas?|pimientos?|hojas?|huevos?|g|kg|cm|astillas?|granos?|vaina|vainas|mel[oó]n|tomates?|zanahorias?|alverjas?|higos?|datiles?|dátiles?|bolitas?))/gi;

const normalizeRecipeOcrText = (text = '') => text
    .replace(/\b(\d+)-(\d)\s+(\d)\b/g, '$1-$2$3')
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

const cleanRecipePreparation = (preparation = '') => preparation
    .replace(/\s+(?:'\s*)?Efecto\s+al\s+servir.*$/iu, '')
    .replace(/\s+-••.*$/u, '')
    .replace(/\s+LOS\s+CONDIMEN.*$/iu, '')
    .trim();

const cleanSpanishOcrText = (text = '') => text
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
    .replace(/\bdemasiado\b/g, 'demasiado');

const repairIngredientFragments = (items = []) => {
    const repaired = [];
    for (let i = 0; i < items.length; i += 1) {
        const current = items[i];
        const next = items[i + 1];

        if (/^(?:\d+|[¼½¾⅛⅓⅔])$/.test(current) && next) {
            repaired.push(`${current} ${next}`);
            i += 1;
            continue;
        }

        if (/\($/.test(current) && next && /\)$/.test(next)) {
            repaired.push(`${current}${next}`);
            i += 1;
            continue;
        }

        repaired.push(current);
    }
    return repaired;
};

const findPreparationMatch = (content = '') => {
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

const splitIngredients = (ingredients = '') => {
    const items = ingredients
        .trim()
        .split(INGREDIENT_START_PATTERN)
        .map(item => item.trim())
        .filter(Boolean);

    const splitItems = items.length > 1 ? items : (ingredients.trim() ? [ingredients.trim()] : []);
    return repairIngredientFragments(splitItems);
};

const parseStructuredRecipe = (rawText = '') => {
    const normalized = normalizeRecipeOcrText(rawText);
    const [bodyBeforeComments, ...commentParts] = normalized.split(/\bComentarios?:\s*/i);
    let body = bodyBeforeComments
        .replace(/\bEL LIBRO DE COCINA AYURVEDA\b/gi, '')
        .replace(/Quedan1 minuto en el capítulo\s*\.?\s*\d+\/?0?/gi, '')
        .replace(DOSHA_MARKER_PATTERN, ' ')
        .replace(/\s*,\s*(?=,|\b(?:Rinde|Porciones)\b|$)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const comments = commentParts.join('Comentarios: ').trim();
    const timeMatch = body.match(/Tiempo de preparación:\s*(.*?)(?=\s+(?:Rinde(?: para)?|Porciones):|$)/i);
    const yieldLabelMatch = body.match(/\b(Rinde(?: para)?|Porciones):\s*/i);
    const yieldRest = yieldLabelMatch ? body.slice((yieldLabelMatch.index || 0) + yieldLabelMatch[0].length) : '';
    const yieldValueMatch = yieldRest.match(/^((?:Aprox\.\s*)?(?:\d+(?:\s*-\s*\d+)?|[¼½¾⅛⅓⅔]|\d+\s+[¼½¾⅛⅓⅔])(?:\s+(?:a|o)\s+(?:\d+|[¼½¾⅛⅓⅔]))?(?:\s+(?:tazas?|cucharaditas?|cucharadas?|porciones?|barras?|docenas?|litros?|piezas?|bolitas?|de\s+\d+(?:\.\d+)?\s*cm))?)/i);

    const prepTime = timeMatch?.[1]?.trim() || '';
    const yieldText = yieldLabelMatch && yieldValueMatch ? `${yieldLabelMatch[1]}: ${yieldValueMatch[1].replace(/\s+/g, ' ').trim()}` : '';
    const contentStart = yieldLabelMatch && yieldValueMatch
        ? (yieldLabelMatch.index || 0) + yieldLabelMatch[0].length + yieldValueMatch[0].length
        : timeMatch ? (timeMatch.index || 0) + timeMatch[0].length : 0;
    const content = body.slice(contentStart).trim();
    const prepMatch = findPreparationMatch(content);
    const ingredientText = prepMatch ? content.slice(0, prepMatch.index).trim() : content;
    const preparation = prepMatch ? cleanRecipePreparation(content.slice(prepMatch.index)) : '';

    const structured = {
        prepTime: cleanSpanishOcrText(prepTime),
        yield: cleanSpanishOcrText(yieldText),
        ingredients: splitIngredients(ingredientText).map(cleanSpanishOcrText),
        preparation: cleanSpanishOcrText(preparation),
        comments: cleanSpanishOcrText(comments)
    };

    const first = structured.ingredients[0] || '';
    const second = structured.ingredients[1] || '';
    if (/^de\s+\d+\.$/i.test(first) && /^\d+\s*cm$/i.test(second)) {
        structured.yield = [structured.yield, `${first} ${second}`].filter(Boolean).join(' ').replace(/(\d+)\.\s+(\d+\s*cm)/, '$1.$2');
        structured.ingredients = structured.ingredients.slice(2);
    }

    return structured;
};

const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
const structured = recipes.map(recipe => ({
    ...recipe,
    structured: parseStructuredRecipe(recipe.text || '')
}));

fs.writeFileSync(recipesPath, `${JSON.stringify(structured, null, 2)}\n`, 'utf8');
console.log(`Structured ${structured.length} recipes.`);
