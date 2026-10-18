// Reject empty/error responses before offering them as downloadable PDFs.
export const assertPdfBytes = (bytes: Uint8Array): Uint8Array => {
    const signature = String.fromCharCode(...bytes.subarray(0, 5));
    if (bytes.byteLength < 32 || signature !== '%PDF-') {
        throw new Error('El generador no devolvió un PDF válido. Intenta descargarlo nuevamente.');
    }
    return bytes;
};
