import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const dietsDir = '../Recursos/DIetas en PDF';
const outputDir = './scratch-pdf-text';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function extract() {
    const files = fs.readdirSync(dietsDir).filter(f => f.endsWith('.pdf'));
    console.log(`Encontrados ${files.length} archivos PDF.`);
    
    for (const file of files) {
        const filePath = path.join(dietsDir, file);
        const dataBuffer = fs.readFileSync(filePath);
        try {
            const parser = new PDFParse({ data: dataBuffer });
            const data = await parser.getText();
            await parser.destroy();
            const textPath = path.join(outputDir, file.replace('.pdf', '.txt'));
            fs.writeFileSync(textPath, data.text);
            console.log(`Extraído: ${file} -> ${textPath} (${data.text.length} caracteres)`);
        } catch (err) {
            console.error(`Error en ${file}:`, err);
        }
    }
}

extract();

