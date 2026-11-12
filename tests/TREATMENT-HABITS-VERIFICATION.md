# Hábitos del tratamiento: corrección y verificación

Fecha de verificación: 2026-11-12, 21:41 UTC.
Repositorio: `vedamci/ayurveda-consultas`.
Rama local: `fix/treatment-habits-empty-default`.
Base: `a0d8c1dc8aaa148902f78adf4b6b3322aa5c86c3` (`main`, comprobado por GitHub).

## Resultado

El estado inicial del editor y la apertura de un tratamiento nuevo usan `[]`.
Al editar un registro se copia su lista guardada, incluso si está vacía; un campo
antiguo ausente o nulo usa `[]`. Las listas guardadas no vacías, su orden y sus
nombres se conservan, incluidos nombres que ya no figuran en el catálogo.
«Seleccionar todos», «Ninguno» y la selección individual siguen disponibles.

La modificación de producción se limita a tres inicializaciones en
`src/components/patients/TreatmentPDFModal.tsx`. No modifica endpoints,
serialización, catálogos, datos clínicos ni migraciones. La serialización
preexistente de una sección oculta del PDF sigue omitiendo sus hábitos en el
payload; la corrección conserva la selección guardada al abrir el editor.

## Evidencia ejecutada

- `node --test tests/treatment-habits.test.mjs`: 18 checks aprobados
  (17 escenarios y su suite). Se renderiza el editor con React real; se ejecutan
  hooks, efectos, handlers y el debounce de autoguardado. Las llamadas de red se
  interceptan en memoria y solo se aceptan rutas sintéticas conocidas. Animación
  y exportación PDF se sustituyen por dobles de prueba.
- Antes del cambio: 8 checks aprobados y 10 fallidos. La inicialización nueva
  seleccionaba los 11 hábitos de la semilla; vacíos/ausentes/nulos también
  seleccionaban el catálogo completo. Es evidencia de regresión reproducida.
- Después: nuevos vacíos antes/después de una carga tardía del catálogo;
  selección manual, todos/ninguno, actualización del paciente y reapertura;
  planes y visitas con listas parciales/completas/vacías/ausentes/nulas,
  secciones ocultas y hábitos fuera del catálogo. Payloads comprobados,
  registros fuente congelados y JSON sin cambios. 109 solicitudes simuladas,
  cero llamadas de red nativas, cero escrituras clínicas reales.
- `node --test tests/treatment-history.test.ts`: 6 pruebas aprobadas.
- `node tests/treatment-markdown.test.mjs`: aprobado.
- `node_modules/.bin/tsc -b`: aprobado.
- `node_modules/.bin/vite build --outDir dist-verify`: aprobado.
- `node_modules/.bin/vite build --config vite.calendar.config.ts --outDir ../dist-verify/calendar`: aprobado.
- `node --check tests/treatment-habits.test.mjs` y `git diff --check`: aprobados.

La compilación conserva el aviso preexistente de bundles mayores de 500 kB.
React Test Renderer informa su deprecación; se usa únicamente como dependencia
de desarrollo. El workflow preparado ejecuta los tests y build en Node 24,
pero no se ha publicado ni ejecutado en GitHub Actions.

## Coordinación con propuestas abiertas

Se detectaron PR #6 (ingreso), #8/#9 (MCP) y #10 (notas de consulta).
Se creó un worktree propio; las otras ramas y sus cambios no se alteraron.

PR #10 (`feat/consultation-notes-categories`) también cambia el editor.
Su HEAD consultado fue `dc8773937d09e5286d972ccfdea98db74cbc1277`.
El blob del editor es `512d4c23873a2392024c7d8eb33a7fed26ed19a9`,
idéntico a la copia local usada para la comprobación. El parche de la corrección
se aplicó limpiamente a una copia aislada de ese código (`git apply --check`
y aplicación real en la copia), y los 18 checks volvieron a pasar.

Al integrar, aplicar el cambio de fuente y recompilar desde el árbol combinado.
El build de este worktree parte de main y no incluye la propuesta de notas de
PR #10. No sustituir un build combinado con estos artefactos de verificación.

## Despliegue y límites reales

No se hizo push, PR nuevo, merge, publicación ni despliegue. No se arrancó el
backend clínico ni se consultaron o modificaron registros reales. Los archivos
`dist` desplegables del repositorio permanecen intactos; los builds se generaron
solo en `dist-verify` dentro del worktree local.

SHA-256 del HTML compilado de verificación:
`d3b002fdd8fc46832371570ad00f382e5bfc808843e6a0bc11000672399c04eb`.
Bundle principal: `index-DBFKer-o.js`, SHA-256
`56bfee0d1756908bf7df5fc29859e5ca6cfdc7b85342a8c1b28fc6a33d6be8f6`.

La prueba visual en Chromium no pudo ejecutarse: el entorno rechazó la creación
del socket del navegador (`Operation not permitted`), y el navegador disponible
no pudo alcanzar el servidor de pruebas (`ERR_CONNECTION_REFUSED`). Las pruebas
React sí se completaron; no se afirma validación visual ni exportación PDF.

Una lectura del HTML público de `https://consultas.vedamci.com.mx/` devolvió
HTTP 403. Por tanto no se pudo identificar el bundle actualmente servido y no
se afirma que producción ya tenga esta corrección. Publicar/merge/desplegar
siguen pendientes de autorización específica, conforme al pedido.
