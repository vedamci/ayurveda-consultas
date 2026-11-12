# Notas de consulta: propuesta sin despliegue

Base inspeccionada: `a0d8c1d` (resúmenes y detalles desplegables), `e6a090d` (Markdown de recomendaciones), `2cab5af` y `28639c2`.

`ConsultationNotes` reemplaza el texto plano del editor. Agrupa encabezados Markdown y etiquetas antiguas en negrita sin clasificar ni reescribir prosa clínica. Conserva la prioridad de la nota de la visita y el respaldo de `fullNotes`. Los fragmentos `source` reconstruyen exactamente la nota original en pruebas. No cambia API, guardado, dosis, PDF ni registros.

El propósito viene de `patient.clinicalData['Propósito de Consulta']`, construido por `server/index.js`. El respaldo antiguo lee el campo real `Motivo Consulta` en la lista generada por `formatSummary`, ignorando código y citas. Se identifica como ficha de ingreso; si falta, se indica que no está registrado.

React Markdown/GFM muestra títulos, listas, tablas, referencias y cantidades. Sin HTML crudo ni `dangerouslySetInnerHTML`; el HTML literal queda escapado. Enlaces e imágenes se muestran como texto sin navegación ni cargas remotas. No se consultaron ni modificaron datos de pacientes.

Verificado localmente:

- `npm run build`: pasó; la versión final del frontend también se compiló con `npx vite build --emptyOutDir false`, conservando todos los bundles anteriores. Calendario sin cambios.
- `npx tsc -b`: pasó.
- `npx eslint src/utils/consultationNotes.ts src/components/patients/ConsultationNotes.tsx`: pasó.
- `node tests/consultation-notes.test.mjs`: pasó (12 formatos, títulos y referencias, texto exacto, cantidades, precedencia, propósito estructurado/antiguo/ausente y HTML/URLs/imágenes inertes).
- `node --test tests/treatment-history.test.ts`: 6 pruebas aprobadas.
- `node tests/treatment-markdown.test.mjs`: pasó.
- `git diff --check` sobre fuentes, pruebas y documentación: pasó. Los bundles generados contienen espacios finales de dependencias; no se alteraron manualmente.

La prueba visual preparada en `tests/consultation-notes-browser.mjs` usa una API sintética aislada. NO se completó localmente: Chromium falló al iniciar por `socket() failed: Operation not permitted`; el navegador CUA devolvió `ERR_CONNECTION_REFUSED`. No hay capturas aprobadas. El workflow de CI propuesto ejecutaría esa verificación al abrir un PR.

Estado de entrega: propuesta para revisión en una rama separada de `main`. La autorización permite subir código, pruebas y configuración y abrir un PR; no permite fusionar ni desplegar en consultas.vedamci.com.mx. La comprobación visual en CI queda pendiente de su resultado y revisión de capturas sintéticas.
