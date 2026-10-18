// Use the same local font files in the editor and in every exported page.
const faces = [
    {
        "family": "Eczar",
        "weight": 500,
        "url": "/fonts/pdf/Eczar-6e905878c39a.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Eczar",
        "weight": 500,
        "url": "/fonts/pdf/Eczar-1084ee287454.woff2",
        "range": "U+1F00-1FFF"
    },
    {
        "family": "Eczar",
        "weight": 500,
        "url": "/fonts/pdf/Eczar-196ef7666f05.woff2",
        "range": "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF"
    },
    {
        "family": "Eczar",
        "weight": 500,
        "url": "/fonts/pdf/Eczar-ccde7efe681b.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Eczar",
        "weight": 500,
        "url": "/fonts/pdf/Eczar-ad918e23e71c.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Eczar",
        "weight": 600,
        "url": "/fonts/pdf/Eczar-6e905878c39a.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Eczar",
        "weight": 600,
        "url": "/fonts/pdf/Eczar-1084ee287454.woff2",
        "range": "U+1F00-1FFF"
    },
    {
        "family": "Eczar",
        "weight": 600,
        "url": "/fonts/pdf/Eczar-196ef7666f05.woff2",
        "range": "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF"
    },
    {
        "family": "Eczar",
        "weight": 600,
        "url": "/fonts/pdf/Eczar-ccde7efe681b.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Eczar",
        "weight": 600,
        "url": "/fonts/pdf/Eczar-ad918e23e71c.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Eczar",
        "weight": 700,
        "url": "/fonts/pdf/Eczar-6e905878c39a.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Eczar",
        "weight": 700,
        "url": "/fonts/pdf/Eczar-1084ee287454.woff2",
        "range": "U+1F00-1FFF"
    },
    {
        "family": "Eczar",
        "weight": 700,
        "url": "/fonts/pdf/Eczar-196ef7666f05.woff2",
        "range": "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF"
    },
    {
        "family": "Eczar",
        "weight": 700,
        "url": "/fonts/pdf/Eczar-ccde7efe681b.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Eczar",
        "weight": 700,
        "url": "/fonts/pdf/Eczar-ad918e23e71c.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Mukta",
        "weight": 400,
        "url": "/fonts/pdf/Mukta-afc56ae914fe.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Mukta",
        "weight": 400,
        "url": "/fonts/pdf/Mukta-7e12e48e1547.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Mukta",
        "weight": 400,
        "url": "/fonts/pdf/Mukta-510168c76778.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Mukta",
        "weight": 500,
        "url": "/fonts/pdf/Mukta-80e35c0c4c31.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Mukta",
        "weight": 500,
        "url": "/fonts/pdf/Mukta-ff4ef061714f.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Mukta",
        "weight": 500,
        "url": "/fonts/pdf/Mukta-42fe1664fe5c.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Mukta",
        "weight": 600,
        "url": "/fonts/pdf/Mukta-872b98024fdb.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Mukta",
        "weight": 600,
        "url": "/fonts/pdf/Mukta-56aefc606af1.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Mukta",
        "weight": 600,
        "url": "/fonts/pdf/Mukta-1e86a6af02ae.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    },
    {
        "family": "Mukta",
        "weight": 700,
        "url": "/fonts/pdf/Mukta-c043d23a6d8c.woff2",
        "range": "U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A"
    },
    {
        "family": "Mukta",
        "weight": 700,
        "url": "/fonts/pdf/Mukta-e1a528190579.woff2",
        "range": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
    },
    {
        "family": "Mukta",
        "weight": 700,
        "url": "/fonts/pdf/Mukta-1907b5bc922c.woff2",
        "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    }
] as const;

const faceRule = (face: typeof faces[number], url: string = face.url) =>
    `@font-face { font-family: '${face.family}'; font-style: normal; font-weight: ${face.weight}; font-display: block; src: url("${url}") format('woff2'); unicode-range: ${face.range}; }`;

export const PDF_FONT_FACE_CSS = faces.map(face => faceRule(face)).join('\n');

export async function loadPdfFonts(): Promise<void> {
    const weights = [...new Map(faces.map(face => [`${face.family}-${face.weight}`, face])).values()];
    await Promise.all(weights.map(async face => {
        const loaded = await document.fonts.load(`${face.weight} 16px "${face.family}"`);
        if (!loaded.length) throw new Error(`No se pudo cargar la fuente ${face.family}. Vuelve a intentar la descarga.`);
    }));
}

let embeddedFonts: Promise<string> | undefined;
export async function embedPdfFonts(): Promise<string> {
    await loadPdfFonts();
    if (!embeddedFonts) {
        const dataUrls = new Map<string, Promise<string>>();
        embeddedFonts = Promise.all(faces.map(async face => {
            if (!dataUrls.has(face.url)) dataUrls.set(face.url, (async () => {
                const response = await fetch(face.url);
                if (!response.ok) throw new Error(`No se pudo incluir la fuente ${face.family} en el PDF.`);
                const blob = await response.blob();
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error('No se pudo preparar la tipografía del PDF.'));
                    reader.readAsDataURL(blob);
                });
            })());
            return faceRule(face, await dataUrls.get(face.url)!);
        })).then(rules => rules.join('\n')).catch(error => {
            embeddedFonts = undefined;
            throw error;
        });
    }
    return embeddedFonts;
}
