import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// This harness never starts server/index.js or connects to patient data.
const counters = { printRequests: 0, blockedWrites: 0 };

const server = await createServer({
    configFile: false,
    root: process.cwd(),
    cacheDir: '../vite-cache',
    define: {
        'import.meta.env.VITE_PROFESSIONAL_NAME': JSON.stringify('Equipo de prueba'),
        'import.meta.env.VITE_PROFESSIONAL_WHATSAPP': JSON.stringify('0000000000'),
        'import.meta.env.VITE_PROFESSIONAL_EMAIL': JSON.stringify('test@example.invalid'),
    },
    resolve: { alias: [{ find: 'html-to-image', replacement: fileURLToPath(new URL('../tests/pdf-capture-observer.ts', import.meta.url)) }] },
    plugins: [
        (await import('@vitejs/plugin-react')).default(),
        (await import('@tailwindcss/vite')).default(),
        {
            name: 'isolated-pdf-test-api',
            configureServer(vite) {
                vite.middlewares.use('/__pdf-test-status', (_req, res) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(counters));
                });
                vite.middlewares.use('/api', (req, res) => {
                    res.setHeader('Content-Type', 'application/json');
                    if (req.url === '/print/treatment-pdf') {
                        counters.printRequests++;
                        console.log('PDF endpoint unavailable (simulated hosting failure)');
                        res.statusCode = 501;
                        res.end(JSON.stringify({ error: 'Puppeteer/Chromium no disponible en el servidor.' }));
                        return;
                    }
                    if (req.method === 'GET') {
                        res.end(JSON.stringify({ success: true, habits: [], therapies: [] }));
                        return;
                    }
                    console.log('Blocked test write:', req.method, req.url);
                    counters.blockedWrites++;
                    res.statusCode = 409;
                    res.end(JSON.stringify({ error: 'Las escrituras están bloqueadas en esta prueba ficticia.' }));
                });
            },
        },
    ],
    server: { host: '127.0.0.1', port: 4179, strictPort: true },
});
await server.listen();
console.log('Synthetic PDF editor: http://pdf-test.localhost:4179/tests/pdf-fixture.html');
export { server, counters };
