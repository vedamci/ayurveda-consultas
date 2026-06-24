const fs = require('fs');
const path = require('path');

const recipesDir = '/Users/krishnadas/Documents/VEDAMCI importante/Apps/Ayurveda consultas app/Recursos/Recetas para app/wiki/recetas';
const files = fs.readdirSync(recipesDir).filter(f => f.endsWith('.md'));

const categorized = {
  'Cereales': [],
  'Lácteos': [],
  'Endulzantes': [],
  'Aceites': [],
  'Frutas': [],
  'Hortalizas': [],
  'Nueces': [],
  'Carnes': [],
  'Legumbres': [],
  'Especias': [],
  'Condimentos': [],
  'Bebidas': [],
  'Sin Clasificar': []
};

function classify(title, content) {
  const t = title.toUpperCase();
  
  // Bebidas (Té, Jugo, etc.)
  if (t.includes('TE ') || t.startsWith('TE ') || t.includes('CHAI') || t.includes('CIDRA') || t.includes('JUGO') || t.includes('FLOR DE JAMAICA') || t.includes('TULIP') || t.includes('BEBIDA DE DESAYUNO') || t.includes('LASSI') || t.includes('SUERO DE LECHE')) {
    return 'Bebidas';
  }
  
  // Aceites
  if (t.includes('GHEE') || t.includes('MANTEQUILLA')) {
    return 'Aceites';
  }
  
  // Lácteos (Lassi/Suero already in Bebidas, so here we do yogurt, cottage, etc.)
  if (t.includes('YOGUR') || t.includes('COTTAGE') || t.includes('LECHE') || t.includes('KEFIR') || t.includes('CREMA AGRIADA') || t.includes('QUESO')) {
    return 'Lácteos';
  }
  
  // Endulzantes / Postres
  if (t.includes('ALGARROBA') || t.includes('BARRAS DE CIRUELA') || t.includes('PUDIN') || t.includes('PUDiN') || t.includes('BUDIN') || t.includes('HALVA') || t.includes('POSTRE') || t.includes('BOLITAS') || t.includes('BROWNIES') || t.includes('MACARRONES') || t.includes('SHIRO') || t.includes('MERMELADA') || t.includes('DULCES') || t.includes('DULCE') || t.includes('CARAMELO')) {
    return 'Endulzantes';
  }
  
  // Frutas
  if (t.includes('FRUAS') || t.includes('FRUTAS') || t.includes('BANANO') || t.includes('HIGO') || t.includes('MELON') || t.includes('MELoN') || t.includes('DATILES') || t.includes('ARANDANOS') || t.includes('MANZANAS') || t.includes('MANZANA') || t.includes('PERAS') || t.includes('PERA') || t.includes('COMPOTA') || t.includes('PAPAYA') || t.includes('PINA') || t.includes('PIÑA')) {
    return 'Frutas';
  }
  
  // Nueces y Semillas
  if (t.includes('SEMILLAS') || t.includes('SEMILIAS') || t.includes('GIRASOL') || t.includes('AJONJOLI') || t.includes('SESAMO') || t.includes('MARANON') || t.includes('IIIIARANONES') || t.includes('ALMENDRAS') || t.includes('NUECES') || t.includes('NUEZ')) {
    return 'Nueces';
  }
  
  // Carnes / Huevos
  if (t.includes('HUEVO') || t.includes('HUEVOS')) {
    return 'Carnes';
  }
  
  // Legumbres
  if (t.includes('DAL') || t.includes('FRIJOL') || t.includes('FRIJOLES') || t.includes('TOFU') || t.includes('GARBANZOS') || t.includes('GARBANZO') || t.includes('LENTEJAS') || t.includes('MUNGO') || t.includes('ALVERJAS') || t.includes('ALVERJA') || t.includes('HABAS')) {
    return 'Legumbres';
  }
  
  // Especias y Condimentos (chutney, raita, salsa, aderezo, pesto)
  if (t.includes('ADEREZO') || t.includes('SALSA') || t.includes('CHUTNEY') || t.includes('PESTO') || t.includes('RAITA') || t.includes('RAtTA') || t.includes('UNTAR') || t.includes('MASALA')) {
    // Note: Masala de patatas is veggie, let's make it veggie unless it's a spice mix
    if (t.includes('PATATAS')) return 'Hortalizas';
    return 'Condimentos';
  }
  
  // Cereales (arroz, avena, cebada, centeno, trigo, mijo, kichadi, chapati, pan, crepa, panqueque)
  if (t.includes('ARROZ') || t.includes('AVENA') || t.includes('CEBADA') || t.includes('CENTENO') || t.includes('CEIXryENO') || t.includes('TRIGO') || t.includes('MIJO') || t.includes('KICHADI') || t.includes('KtCHADI') || t.includes('CHAPATI') || t.includes('ROTALIS') || t.includes('ROTIS') || t.includes('PAN ') || t.startsWith('PAN ') || t.includes('CREPAS') || t.includes('PANQUEQUES') || t.includes('GRANOLA') || t.includes('CHEVADO') || t.includes('DOSAS') || t.includes('AMARANfo') || t.includes('AMARANTO') || t.includes('BULGUR') || t.includes('FIDEOS') || t.includes('MACARRONES')) {
    return 'Cereales';
  }
  
  // Hortalizas / Vegetales (papas, camotes, calabaza, calabacin, zucchini, cebollas, champiñones, coliflor, brocoli, esparragos, remolacha, repollo, col, ocra, chirivias, alcachofas, colinabos, berenjena, bhaji, verduras, vegetales, etc.)
  if (t.includes('PAPA') || t.includes('PAPAS') || t.includes('CAMOTE') || t.includes('CAMOTES') || t.includes('CALABACIN') || t.includes('CALABACiN') || t.includes('ZUCCHINI') || t.includes('CALABAZA') || t.includes('CEBOLLA') || t.includes('CEBOLLAS') || t.includes('CHAMPINON') || t.includes('CHAMPINONES') || t.includes('HONGOS') || t.includes('COLIFLOR') || t.includes('BROCOLI') || t.includes('ESPARRAGOS') || t.includes('ESPIiRRAGOS') || t.includes('REMOLACHA') || t.includes('REPOLLO') || t.includes('COL ') || t.startsWith('COL ') || t.includes('OCRA') || t.includes('CHIRIVIAS') || t.includes('CHIRIViAS') || t.includes('ALCACHOFAS') || t.includes('ALCACHOFA') || t.includes('COLINABOS') || t.includes('BERENJENA') || t.includes('BHAJI') || t.includes('VERDURAS') || t.includes('VEGETALES') || t.includes('HOJAS VERDES') || t.includes('SOUFFLE') || t.includes('ESPINACAS') || t.includes('PUERRO') || t.includes('RABANO') || t.includes('BROTES') || t.includes('KADHI') || t.includes('SOPA') || t.includes('CALDO') || t.includes('ENSALADA') || t.includes('MEZCLA JARDINERA') || t.includes('ZANAHORIA') || t.includes('ZANAHORIAS') || t.includes('RUGULA') || t.includes('COLINABO')) {
    return 'Hortalizas';
  }

  // Fallback check content
  const c = content.toUpperCase();
  if (c.includes('SOPA') || c.includes('CALDO') || c.includes('VEGETALES') || c.includes('VERDURAS')) {
    return 'Hortalizas';
  }
  if (c.includes('ARROZ') || c.includes('TRIGO') || c.includes('AVENA') || c.includes('CEBADA')) {
    return 'Cereales';
  }
  if (c.includes('YOGUR') || c.includes('LECHE')) {
    return 'Lácteos';
  }

  return 'Sin Clasificar';
}

files.forEach(file => {
    const filePath = path.join(recipesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Simple YAML frontmatter parser
    const fmMatch = content.match(/^---([\s\S]*?)---/);
    let frontmatter = {};
    if (fmMatch) {
        const fmText = fmMatch[1];
        fmText.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                let val = parts.slice(1).join(':').trim();
                if (val.startsWith('[') && val.endsWith(']')) {
                    val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                }
                frontmatter[key] = val;
            }
        });
    }

    // Get the title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');

    const cat = classify(title, content);
    categorized[cat].push({
      file,
      title,
      doshas_beneficiados: frontmatter.doshas_beneficiados || [],
      tags: frontmatter.tags || []
    });
});

console.log('--- Classification results ---');
for (const [cat, items] of Object.entries(categorized)) {
  console.log(`${cat}: ${items.length} recipes`);
}

if (categorized['Sin Clasificar'].length > 0) {
  console.log('\n--- Unclassified recipes ---');
  categorized['Sin Clasificar'].forEach(item => {
    console.log(`- ${item.title} (${item.file})`);
  });
}
