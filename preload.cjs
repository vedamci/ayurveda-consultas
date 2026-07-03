// Preload: puente seguro entre el renderer (la app web) y el proceso principal de Electron.
// Expone únicamente una API mínima para imprimir el PDF con el motor nativo de Chromium.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vedamciPrint', {
  // Imprime el documento actualmente visible (#pdf-content marcado como .print-area)
  // usando webContents.printToPDF. Devuelve un ArrayBuffer con el PDF (texto vectorial real).
  toPDF: async (options = {}) => {
    const result = await ipcRenderer.invoke('vedamci:print-to-pdf', options);
    if (result && result.ok && result.data) {
      // result.data llega como Uint8Array/Buffer serializado; normalizar a ArrayBuffer.
      const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    throw new Error(result && result.error ? result.error : 'No se pudo generar el PDF en Electron.');
  },
  // Indica al renderer que está corriendo dentro de la app de escritorio.
  isElectron: true,
});
