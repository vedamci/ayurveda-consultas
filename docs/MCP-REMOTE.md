# MCP remoto de Consultas VEDAMCI — implementación 0.1.0

Estado al 12 de noviembre de 2026: implementado y probado con datos sintéticos;
**no desplegado, sin credenciales creadas, sin acceso concedido a Durga y sin
conexión funcional verificada desde ChatGPT**.

## Alcance y arquitectura

Este cambio parte de la rama de la [PR de diagnóstico #8](https://github.com/vedamci/ayurveda-consultas/pull/8)
(commit `a3aafb6c03967c2d55ffea59d17a462129bf2b2a`). Conserva su script y sus 20
pruebas; no reconstruye el puente local desconocido. El servidor real es Express,
con expedientes en Notion y visitas/planes en `USER_DATA_DIR/local-data`.
`/mcp-pdf` sigue siendo una página interna y no es este transporte.

Se monta `/mcp` antes de CORS, del parser web de 25 MB y del fallback de React.
El SDK oficial implementa Streamable HTTP sin sesiones, con respuestas JSON.
Cada POST crea su propio servidor y contexto de identidad; no hay cuenta clínica
compartida, token web delegado, sesión MCP reutilizable ni caché de expedientes.
GET y DELETE del transporte devuelven 405 después de autenticar. Las
notificaciones usan el comportamiento del SDK. Las rutas de descubrimiento
son públicas, no consultan Notion y no contienen credenciales.

Con `MCP_ENABLED=true` y `MCP_CLINICAL_ENABLED` ausente o `false`, el modo inicial
es **solo estado**: publica únicamente `connection_status` y `get_profile`, y
anuncia solo `consultas:status`. No construye el adaptador clínico, no lee las
variables de Notion ni necesita base o directorio de pacientes. Aunque un token o
un grant incluyan scopes clínicos o IDs, se descartan en este modo; las cinco
herramientas clínicas no existen en el catálogo y no pueden invocarse por nombre.
El estado devuelve `mode:status_only` y `clinicalBackendChecked:false`.

El modo de solo estado sigue exigiendo OAuth válido, política privada aprobada y
cuenta web vigente. No convierte el estado en un endpoint anónimo, no crea
identidades y no omite revocación. Cambiar a `MCP_CLINICAL_ENABLED=true` es una
activación separada que requiere revisión y aprobación de acceso: entonces se
exigen Notion y las rutas clínicas, se anuncian los scopes de lectura y el catálogo
pasa a siete herramientas. El estado devuelve `mode:read_only` sin sondear Notion.
Una configuración clínica incompleta falla cerrada al arrancar.

La entrega clínica es **solo lectura**. No permite guardar, borrar, generar diagnósticos,
mandar mensajes, abrir carpetas, descargar adjuntos ni generar PDFs. Esas funciones
necesitan una implementación posterior con autorización, confirmación ligada a
contenido/destino, control de versión e idempotencia; no quedan habilitadas por
pedirlas en el chat ni por agregar scopes inventados.

| Herramienta | Datos y límites |
| --- | --- |
| `connection_status` | Estado del proceso y modo de lectura; no verifica backend clínico. |
| `get_profile` | ID opaco estable configurado para la cuenta conectada, sin nombre/correo. |
| `search_patients` | Nombre explícito de 3–80 caracteres; hasta 5 resultados, únicamente entre los 20 expedientes asignados como máximo. |
| `read_patient_summary` | Nombre, ID y fecha de modificación de un expediente seleccionado. |
| `read_patient_notes` | Campo Notas de Notion, hasta 8000 caracteres y aviso de truncamiento. |
| `list_patient_entries` | Hasta 5 IDs, títulos y fechas de visitas o planes; desplazamiento máximo 1000. |
| `read_patient_entry` | Campos de texto permitidos de una visita o plan seleccionado; máximo 4000 caracteres por campo y aviso de truncamiento. |

Si la búsqueda indica `hasMore`, precisar el nombre; no existe una herramienta
para volcar la base. El listado de visitas/planes usa el orden existente en
`records.json`. La lectura de una entrada incluye `date`, `title`, `note`,
`diagnosis`, `treatment`, `lifestyle`, `patientDiagnosis`, `patientTreatment`,
`patientLifestyle` y `dosha` cuando son texto. No representa el expediente completo:
no incluye fórmulas herbales estructuradas, recetas, fotos, PDFs, pulsos ni anexos.
Los valores retornados son datos no confiables, no instrucciones para el modelo.

## Autenticación y autorización

Usar un proveedor OAuth establecido; este paquete es un **servidor de recursos**,
no un proveedor de identidad ni un servidor que reciba contraseñas.
El proveedor debe publicar descubrimiento de autorización y ofrecer authorization
code con PKCE S256, consentimiento de scopes y parámetro `resource` para esta API.
Usar un cliente previamente registrado, con la URI exacta de retorno que muestre
ChatGPT; no adivinarla ni permitir comodines. CIMD o DCR solo se configuran si el
proveedor los soporta y se revisan expresamente. Ningún endpoint de registro de
clientes ni de emisión de tokens se añade a la app.

Contrato exigido para el **access token** JWT:

- Firma RS256 o ES256, verificada mediante JWKS fijo del mismo origen del emisor.
- `iss` idéntico a `MCP_OAUTH_ISSUER`; no se toma del token para buscar claves.
- `aud` debe ser exactamente el string `MCP_RESOURCE_URL`; se rechazan múltiples
  audiencias, ID tokens dirigidos al cliente y los tokens web de dos partes.
- `sub`, `jti`, `iat`, `exp` obligatorios; `scope` como string separado por espacios.
- Caducidad máxima de 15 minutos desde emisión; `nbf`, expiración e `iat` futuro
  se comprueban sin tolerancia. Sincronizar reloj del host y del emisor.
- `client_id` o, si no existe, `azp`, debe coincidir con un cliente aprobado.
- Las claves se consultan con timeout de 3 s y caché de 5 minutos. La rotación
  del proveedor debe mantener las claves antiguas hasta vencer los tokens.

El MCP exige `consultas:status` para cualquier petición autenticada. Los otros
scopes son `consultas:patients:search`, `consultas:patients:read` y
`consultas:clinical:read`. Las notas y visitas/planes necesitan ambos permisos de
lectura. El permiso efectivo es la **intersección** del token y el archivo de
asignaciones; el rol web `admin`, el email, registrarse en la web o claims de rol
no conceden acceso MCP.

El archivo privado de política se relee en cada solicitud y antes/después de cada
herramienta. Debe existir la cuenta por ID en el `users.json` vigente. Borrar la
cuenta, deshabilitar el grant, retirar un expediente/scope, añadir un `jti` revocado
o elevar `revokedBefore` bloquea solicitudes posteriores. Si cambia la política
mientras se lee, el resultado no sale. La comprobación final y el envío HTTP no
son una transacción con el sistema de archivos: no puede recuperar datos ya
entregados. La revocación del proveedor por sí sola no es introspectada; combinar
los tokens breves con el bloqueo local inmediato. La política ausente/corrupta
falla cerrada. El proveedor debe revocar también refresh tokens al desconectar.

`get_profile.id` es un UUID opaco persistente asignado una sola vez a ese perfil;
no se deriva del nombre o email, no se cambia al reconectar y nunca se reasigna.
No usar el perfil de ejemplo como identidad real.

Ejemplo **solo de estructura**, no es una asignación válida ni debe instalarse:

```json
{
  "version": 1,
  "issuer": "https://EMISOR_VERIFICADO/",
  "grants": [{
    "subject": "SUB_INMUTABLE_VERIFICADO",
    "userId": "UUID_DE_CUENTA_WEB_EXISTENTE",
    "profileId": "UUID_OPACO_PERSISTENTE_NO_REASIGNABLE",
    "enabled": true,
    "scopes": ["consultas:status"],
    "patientIds": [],
    "revokedBefore": 0,
    "revokedTokenIds": []
  }]
}
```

Los UUID deben usar minúsculas y guiones. El archivo incluido
`server/mcp/access-policy.example.json` contiene **cero grants**. No se ha supuesto
la identidad, email, cuenta web, perfil ni expedientes de Durga. Verificar esa
asociación por un administrador antes de concederla. Empezar únicamente con
`consultas:status` y sin pacientes. Un paso posterior, separado y confirmado,
puede asignar expedientes concretos; nunca `*` ni toda una base implícitamente.
El piloto impone 20 IDs por usuario y 100 grants en total.

## Preparación e instalación

Requiere Node >=20.19. Las dependencias están aisladas para que la web con MCP
apagado no cambie su instalación actual:

```sh
npm ci --prefix server/mcp --ignore-scripts --no-audit --no-fund
npm run check --prefix server/mcp
npm test --prefix server/mcp
npm run probe --prefix server/mcp
node --check server/index.js
node scripts/check-mcp-discovery.mjs --self-test
```

`npm run probe --prefix server/mcp` ejecuta una sonda independiente con identidad
ficticia y firma efímera en memoria. Solo escucha en `127.0.0.1` y un puerto libre
asignado por el sistema; comprueba 401, catálogo de dos herramientas, estado,
perfil, rechazo clínico y revocación, y termina cerrando el listener y borrando
sus archivos sintéticos. No carga `.env`, no usa credenciales reales ni el emisor
OAuth externo. Su salida incluye `oauthFlowVerified:false`: no acredita PKCE,
HTTPS, Passenger o ChatGPT. Usar un `TMPDIR` privado para la prueba del host.

No iniciar `server/index.js` como prueba inocua: el arranque histórico puede crear
`JWT_SECRET`, copiar datos y migrar archivos. La suite usa otra app Express mínima,
un listener de loopback, archivos temporales ficticios, fetch simulado de Notion y
claves de firma efímeras exclusivamente de prueba. No necesita `.env`, red clínica
ni credenciales reales. No usa `/api/health`, que sí consulta Notion.

Variables privadas que el administrador deberá preparar **después de confirmar**
el proveedor, el acceso y el entorno:

| Variable | Valor requerido |
| --- | --- |
| `MCP_ENABLED` | Ausente o `false` mantiene MCP desactivado. Solo `true` lo monta. |
| `MCP_CLINICAL_ENABLED` | Ausente o `false`: solo estado/perfil, sin Notion ni herramientas clínicas. `true`: lectura clínica solo tras aprobación separada. |
| `MCP_RESOURCE_URL` | `https://consultas.vedamci.com.mx/mcp` para el destino de producción propuesto; en staging, URL distinta. |
| `MCP_OAUTH_ISSUER` | Emisor HTTPS exacto del proveedor verificado, incluida ruta/barra final. |
| `MCP_OAUTH_JWKS_URL` | JWKS HTTPS fijo, mismo origen del emisor. |
| `MCP_OAUTH_CLIENT_IDS` | IDs aprobados separados por coma; no secretos. |
| `MCP_POLICY_FILE` | Ruta absoluta del archivo privado fuera del checkout, sin symlink final. |
| `MCP_NOTION_API_KEY` | Solo para `MCP_CLINICAL_ENABLED=true`: integración de Notion dedicada de **solo lectura**, aprobada; no usa la clave de escritura de la web ni variables VITE. |
| `NOTION_DATABASE_ID` | Solo para modo clínico: base existente que contiene los pacientes autorizados; verificar en el host. |
| `DATA_DIR` | Conservar el directorio real de la app; no inventar uno nuevo. El MCP de solo estado no accede a su subdirectorio clínico. |

Para la primera prueba, dejar **sin definir** `MCP_NOTION_API_KEY` y no conceder
permisos de Notion. Usar `MCP_ENABLED=true`, `MCP_CLINICAL_ENABLED=false`, OAuth y
un grant concreto con `scopes:["consultas:status"]`, `patientIds:[]`. La creación
de ese grant y la activación HTTP aún requieren autorización; preparar el archivo
no equivale a instalarlo. No se ha realizado ninguna de esas operaciones reales.

No guardar secretos, asignaciones, copias de `users.json` o datos de pacientes en
Git, una PR, logs, capturas o el chat. Inyectar el token de Notion por el mecanismo
privado del alojamiento. El archivo de política debe pertenecer al administrador,
ser legible solo por el servicio y actualizarse atómicamente (archivo temporal y
rename); crear/modificar asignaciones es una modificación de permisos y requiere
confirmación. La integración Notion debe tener capacidad de lectura y acceso solo
al origen necesario. Su creación y concesión también requieren confirmación.

El adaptador verifica el ID y la pertenencia a la base antes de devolver datos.
No usa `/api/patients/search` (descarga la colección del profesional) ni la ruta web
por ID (carece de ACL de expedientes). Lee únicamente las páginas asignadas, con
un máximo de 4 solicitudes en paralelo, timeout 5 s y respuesta de 1 MB por página.
Una búsqueda de 20 asignaciones puede tardar hasta unos 25 s en el peor caso.
La integración Notion se usa exclusivamente mediante GET al endpoint fijo de
páginas; nunca se pasa el bearer OAuth a Notion.

Los archivos locales se resuelven mediante `patient_folders.json` y `records.json`
dentro de `local-data`; máximo 2 MB por expediente, sin symlinks internos ni rutas
fuera del directorio. No crea, migra ni renombra carpetas al leer. Los formatos
legados sin mapa no se migran: devuelven error genérico y necesitan revisión
separada. El sistema de archivos y la relación ID/carpeta deben ser mantenidos por
la app/administrador de confianza. En producción ambos procesos necesitan el mismo
volumen y los nombres reales de los archivos; confirmar esto sin copiar su contenido.

### Alojamiento y reversión

Esta implementación se incorpora al proceso Express existente, no abre un segundo
puerto. El proxy de cPanel/Passenger debe preservar `Host`, `Authorization`,
`Accept`, `Content-Type` y `MCP-Protocol-Version`. Solo admitir HTTPS público y
bloquear HTTP antes de que llegue a Node. No registrar Authorization ni cuerpos
RPC/resultados en proxy, APM, WAF o logs de petición. No cachear `/mcp` ni
`/.well-known/oauth-protected-resource*`; permitir POST de 16 KB y latencia de
búsqueda. No hay SSE continuo ni sesión que fijar a un worker.

`Host` debe coincidir con el host configurado, sin confiar en X-Forwarded-Host.
Las solicitudes sin Origin son válidas (cliente backend); si hay Origin debe
coincidir exactamente con el origen del recurso. Si el cliente real usa otro
Origin, inspeccionarlo y revisar una lista explícita en otro cambio, no usar `*`.
No se hereda el CORS abierto de la web. Verificar el hostname visto por Passenger
en staging; no desactivar esta validación para acomodar el proxy.

Hay límites por proceso: 120 solicitudes/IP/min, 30/perfil/min, 8 POST en curso,
1000 buckets como máximo. El proxy debe limitar también tamaño, concurrencia,
frecuencia global y conexiones lentas; con varios workers las cuotas locales se
multiplican y el IP puede ser el del proxy compartido. No activar `trust proxy`
para aceptar encabezados arbitrarios. Ajustes de infraestructura necesitan revisión
y confirmación. Las respuestas y errores no imprimen cuerpos clínicos ni secretos.
La auditoría emite requestId, ID opaco del actor, nombre fijo de herramienta y
resultado; no argumentos, IDs de pacientes, nombres, tokens o texto clínico. Estos
identificadores de perfil siguen siendo seudónimos privados: limitar lectores y
retención, y excluirlos de logs públicos. Las denegaciones de esquema previas al
handler no generan eventos por herramienta; sí quedan en la respuesta RPC.

El webhook actual de cPanel instala solo las dependencias raíz. **No instala
`server/mcp/package-lock.json`**. Antes de activar el módulo, ejecutar su `npm ci`
en el host y repetirlo cuando cambie ese lockfile. Si falta el paquete o la
configuración es inválida con `MCP_ENABLED=true`, el arranque falla cerrado; no
hay fallback anónimo. No fusionar este cambio a main para probar: main tiene
mecanismos de despliegue automático. Preparar primero staging aislado y planificar
la instalación/reinicio expresamente autorizados.

Para detener acceso, deshabilitar todos los grants y luego `MCP_ENABLED=false`
y reiniciar mediante el procedimiento aprobado. Verificar 404 JSON en las rutas
MCP y mantener la web operativa. No hace falta borrar expedientes ni cambiar
permisos de la web. Una reversión de código requiere el mismo control de despliegue.

## Aceptación antes de habilitar Durga

1. En staging aislado, empezar por solo estado sin clave de Notion, base ni volumen
   clínico. Usar proveedor/cuenta sintéticos y verificar
   descubrimiento del emisor, PKCE S256, callback exacto, consentimiento y tokens
   dirigidos a la URL de staging. Probar refresh, expiración y revocación del
   proveedor. La suite local **no demuestra el flujo OAuth del proveedor**.
2. Validar el proxy con Inspector y el cliente SDK: initialize, tools/list,
   notificación initialized, estado/perfil, 401 sin bearer, 403 sin asignación,
   límites y errores. Comprobar logs del alojamiento sin mostrar secretos.
3. Confirmar identidad inmutable de Durga, cuenta web y profileId persistente;
   presentar el grant concreto de solo estado antes de instalarlo. No crear una
   cuenta, contraseña, cliente OAuth o integración Notion sin autorización.
4. Después de aprobar OAuth, grant de solo estado, despliegue y acceso, añadir el MCP
   personalizado en ChatGPT Plugins con OAuth y el cliente registrado. Instalar,
   iniciar conversación nueva, seleccionarlo con @ y pedir: «Comprueba el estado
   de VEDAMCI Consultas sin buscar pacientes». Observar una llamada exitosa a
   `connection_status`; el resultado debe decir `clinicalBackendChecked:false`.
5. Solo tras una autorización separada, configurar la integración Notion de solo
   lectura y `MCP_CLINICAL_ENABLED=true`; probar búsqueda/lectura de un expediente
   explícitamente asignado y verificar rechazo de otro, sin copiar los resultados
   clínicos a la PR. Un estado verde o un icono en ChatGPT no verifica lectura.

Pendiente también una revisión del sistema web: este MCP no corrige el login
histórico, las ACL de la API, los adjuntos públicos o la gestión global de secretos.
La cuenta web existente se comprueba para evitar acceso tras borrado, pero una
concesión MCP siempre necesita identidad OAuth verificada y política independiente.

## Evidencia reproducible

Prueba local del 12 de noviembre de 2026, Node v24.22.1:

- 30/30 pruebas en `server/mcp/test/security.test.mjs` aprobadas.
- Cliente oficial SDK: initialize y catálogos de siete herramientas (lectura) y
  dos (solo estado); llamadas a estado y perfil.
- Rechazo de token alterado, issuer/aud/client incorrectos, expiración, nbf futuro,
  iat futuro, vida excesiva y claims ausentes; rechazo de sesión web.
- Separación entre cuentas/expedientes, scopes intersectados, denegación de roles
  inventados, política corrupta/ausente/excesiva, borrado de usuario y revocación.
- Revocación durante lectura, filtro por base, página archivada, límites HTTP y de
  upstream, truncamiento explícito, symlinks y traversal.
- Ninguna llamada clínica para estado/perfil ni para un ID no asignado; errores y
  auditoría no contienen valores clínicos o credenciales sintéticas.
- Cinco pruebas adicionales verifican arranque sin leer credenciales Notion,
  directorios clínicos ausentes, catálogo/scopes de solo estado, rechazo de
  llamadas clínicas con tokens amplios y revocación de identidad.
- 20/20 pruebas originales del diagnóstico de #8 aprobadas.
- Sintaxis de `server/index.js` y módulos MCP, `git diff --check` aprobados.
- `npm audit --omit=dev --prefix server/mcp`: 0 vulnerabilidades reportadas para
  las 94 dependencias instaladas en ese momento. No sustituye una revisión futura.

El workflow `mcp-server.yml` repite instalación del lockfile, sintaxis y suites
sintéticas sin secretos ni peticiones clínicas. No simula una instalación de
ChatGPT ni acredita disponibilidad del endpoint de producción.

Referencias oficiales consultadas:
[servidor MCP](https://developers.openai.com/plugins/build/mcp-server),
[autenticación](https://developers.openai.com/plugins/build/auth),
[conectar y probar](https://developers.openai.com/plugins/deploy/connect-chatgpt).
