import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env variables
dotenv.config({ path: join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('Error: GEMINI_API_KEY no encontrada en el archivo .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const inputDir = join(__dirname, '../scratch-pdf-text');
const outputDir = join(__dirname, '../src/data/diets');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const jsonSchema = {
    dosha: "Vata | Pitta | Kapha | Vata-Pitta | Vata-Kapha | Pitta-Kapha | Tridoshica",
    sabores: {
        mejor: ["Sabor1", "Sabor2"],
        evitar: ["Sabor3", "Sabor4"]
    },
    categorias: [
        {
            nombre: "Cereales | Lácteos | Endulzantes | Aceites | Frutas | Hortalizas | Nueces | Carnes | Legumbres | Especias | Condimentos | Bebidas",
            mejor: ["Alimento 1", "Alimento 2"],
            pequenas_cantidades: ["Alimento 3", "Alimento 4"],
            evitar: ["Alimento 5", "Alimento 6"],
            consejo: "Recomendación o nota particular para esta categoría si existe en el texto"
        }
    ]
};

async function parseFile(filename) {
    const doshaName = filename.replace('Dieta ', '').replace('.txt', '');
    const outputPath = join(outputDir, `${doshaName.toLowerCase()}.json`);

    // Skip if already parsed successfully
    if (fs.existsSync(outputPath)) {
        try {
            const content = fs.readFileSync(outputPath, 'utf8');
            JSON.parse(content);
            console.log(`Dieta ${doshaName} ya existe y es válida. Saltando.`);
            return;
        } catch (e) {
            console.log(`Dieta ${doshaName} existe pero está corrupta. Re-procesando...`);
        }
    }

    const filePath = join(inputDir, filename);
    const text = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Procesando dieta para Dosha: ${doshaName}...`);

    const prompt = `
Eres un experto en Ayurveda y extracción de datos.
Tengo el siguiente texto extraído de un PDF de recomendaciones dietéticas para la dieta ${doshaName}.
Quiero que estructures esta información exactamente bajo el siguiente esquema JSON:

${JSON.stringify(jsonSchema, null, 2)}

Reglas de extracción:
1. El campo "dosha" debe ser "${doshaName}".
2. En "sabores", extrae los sabores recomendados (mejor) y los que se deben evitar.
3. Para cada categoría de alimentos (como Cereales, Lácteos, Endulzantes, Aceites, Frutas, Hortalizas, Nueces/Semillas, Carnes, Legumbres, Especias, Condimentos, Bebidas):
   - Separa los elementos de las columnas correspondientes en listas limpias en "mejor", "pequenas_cantidades" (o cantidades moderadas), y "evitar".
   - Limpia los saltos de línea incorrectos o palabras cortadas a la mitad producidos por la lectura del PDF. Por ejemplo, "quí-\\nnoa" o "quínoa" debe ser "quínoa", "arroz\\n(blanco" debe ser "arroz (blanco o integral)".
   - Extrae el texto descriptivo o consejos (usualmente al final de cada sección de categoría) y colócalo en el campo "consejo".
4. Retorna ÚNICAMENTE el JSON estructurado válido, sin comentarios, sin markdown de tipo \`\`\`json. Solo el contenido JSON.

Texto de la Dieta:
---
${text}
---
`;

    const maxRetries = 5;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            const result = await model.generateContent(prompt);
            let responseText = result.response.text().trim();
            
            // Remove code block markdown if present
            if (responseText.startsWith('```')) {
                responseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
            }
            
            // Validate JSON
            const parsedJson = JSON.parse(responseText);
            
            fs.writeFileSync(outputPath, JSON.stringify(parsedJson, null, 2), 'utf8');
            console.log(`Guardado exitosamente: ${outputPath}`);
            return; // Success, exit retry loop
        } catch (error) {
            attempt++;
            console.warn(`Error procesando ${filename} (Intento ${attempt}/${maxRetries}):`, error.message || error);
            if (attempt < maxRetries) {
                const delayMs = attempt * 8000;
                console.log(`Esperando ${delayMs / 1000} segundos antes de reintentar...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error(`Se alcanzaron todos los intentos para ${filename}. Falló.`);
            }
        }
    }
}

async function run() {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.txt'));
    console.log(`Encontrados ${files.length} archivos de texto para procesar.`);
    
    for (const file of files) {
        await parseFile(file);
        // Delay to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 4000));
    }
}

run();
