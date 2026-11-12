# Conectar Consultas VEDAMCI a ChatGPT

Revisión: 11 de noviembre de 2026. Estado: preparación y diagnóstico; **no instalado ni verificado de extremo a extremo**.

Actualización de implementación: [MCP remoto 0.1.0](MCP-REMOTE.md). La rama de
implementación conserva este diagnóstico y añade un servidor opt-in de solo
lectura. Su despliegue, permisos e instalación en ChatGPT siguen pendientes.

## Qué existe y qué falta

La app de este repositorio ofrece una API Express y una interfaz React. El dominio
configurado para cPanel es **https://consultas.vedamci.com.mx**: aparece en
[DEPLOY.md](../DEPLOY.md) y en el origen de generación de PDF de
[server/index.js](../server/index.js). Las referencias a Render y Vercel son
alternativas o configuración histórica; no prueban qué servicio está activo hoy.

La revisión de código se hizo sobre el árbol de main
a0d8c1dc8aaa148902f78adf4b6b3322aa5c86c3. No contiene un servidor MCP,
dependencias del SDK MCP, una ruta de transporte /mcp ni descubrimiento de
autorización OAuth para MCP. La ruta /mcp-pdf es una página interna para
exportar PDF y no es un transporte MCP. MCP_RENDER_ORIGIN controla ese renderizado,
no instala una conexión en ChatGPT.

Un puente MCP configurado en un cliente local no queda automáticamente disponible
en ChatGPT web. Hay que verificar por separado el proceso del puente, su
autenticación con Consultas y la instalación en el workspace de ChatGPT.

La herramienta web de esta revisión no pudo acceder al sitio. Una comprobación
posterior desde un runner de GitHub sí obtuvo evidencia pública, el 11 de
noviembre de 2026 a las 23:37 UTC:

| Destino | Observado |
| --- | --- |
| consultas.vedamci.com.mx | DNS resolvió; HEAD /login respondió HTTPS 200. |
| https://consultas.vedamci.com.mx/mcp | POST initialize respondió 404. No es un transporte MCP utilizable en esa ruta. |
| consultas.yurveda.com | DNS resolvió; no se verificó identidad ni relación con esta app. |
| consultas.vedamsi.com | DNS no resolvió desde el runner. |

No enviar credenciales a los dominios alternativos sin comprobar su titularidad.
Las pruebas no recorrieron otras rutas MCP desconocidas ni autenticaron una cuenta.
El 404 solo describe la ruta probada, no descarta un servicio alojado en otro sitio.

Evidencia: [ejecución de diagnóstico](https://github.com/vedamci/ayurveda-consultas/actions/runs/43121265683).
La sintaxis y las 20 pruebas sintéticas pasaron. La comprobación pública devolvió
código de salida 1 por el 404; ese paso es informativo y tolera el fallo, de modo
que el estado verde global del workflow **no acredita que el MCP funcione**.

## Ruta inicial: conexión privada al MCP existente

Es la propuesta inicial si se quiere reutilizar un puente local. Su código,
comando real, catálogo de herramientas y almacenamiento de sesión todavía deben
inspeccionarse en la computadora donde está instalado. No se debe reconstruir a
ciegas una segunda copia.

OpenAI permite un Secure MCP Tunnel hacia un servidor privado stdio o HTTP.
Necesita un proceso tunnel-client activo, permisos de la organización de Platform
y asociación al workspace correcto de ChatGPT. No equivale a publicar un plugin
público. Véase la [guía oficial del túnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

Pasos operativos, pendientes de ejecutar en el host real:

1. Identificar la copia vigente del puente y ejecutar una revisión de sus
   herramientas, límites y manejo de errores. No copiar archivos de sesión,
   bases de pacientes ni archivos .env al repositorio.
2. Comprobar el login local con la app correcta sin mostrar la contraseña ni el
   token. Confirmar cómo comunica una sesión vencida. Una sesión de navegador y
   la sesión que guarda un puente pueden ser distintas.
3. Seleccionar la organización de Platform y el workspace de ChatGPT del
   propietario. Reutilizar un túnel adecuado si ya existe. Crear uno solo
   después de revisar sus asociaciones y permisos; introducir la clave de
   ejecución mediante un mecanismo local seguro.
4. Instalar el cliente oficial desde Platform o su
   [repositorio oficial](https://github.com/openai/tunnel-client/releases/latest)
   y revisar la ayuda actual. El siguiente ejemplo tiene marcadores; no ejecutarlo
   hasta sustituirlos por valores verificados:

       tunnel-client help quickstart
       tunnel-client init --sample sample_mcp_stdio_local --profile consultas-privado --tunnel-id TUNNEL_VERIFICADO --mcp-command "python3 /RUTA_VERIFICADA/server.py"
       tunnel-client doctor --profile consultas-privado --explain
       tunnel-client run --profile consultas-privado

5. Mantener el cliente activo y comprobar readiness. Limitar la conexión al
   propietario autorizado durante la prueba. Un puente con una única sesión
   clínica compartida no debe ofrecerse a otros usuarios como si hubiera
   separación de cuentas.

La Mac debe permanecer encendida y conectada. El túnel transporta solicitudes;
no corrige por sí solo sesiones vencidas, autorización clínica ni errores del puente.

## Cómo aparecer en ChatGPT

En [Plugins](https://chatgpt.com/plugins), añadir un servidor MCP personalizado,
nombrarlo **VEDAMCI · Consultas**, elegir **Tunnel** y el túnel verificado.
Revisar la autenticación y el aviso de conexión antes de crear el plugin.
La selección del workspace y sus políticas pueden limitar esta opción.

Después de revisar las herramientas, instalar el plugin, abrir una conversación
nueva y seleccionarlo escribiendo @. Para cambios futuros del catálogo,
reiniciar el servidor, actualizar la conexión desde su ficha y repetir la prueba.

La [guía oficial de conexión](https://developers.openai.com/plugins/deploy/connect-chatgpt)
describe este flujo. Si la interfaz de la cuenta difiere, verificarla antes de
dar instrucciones más específicas. La presencia de un icono y el éxito de una
llamada desde ChatGPT son comprobaciones distintas.

Prompt de aceptación propuesto:

> Muestra el estado de la conexión de VEDAMCI Consultas sin buscar pacientes ni
> leer expedientes.

Este prompt requiere una herramienta de estado que no consulte datos clínicos.
Su nombre real debe salir del catálogo inspeccionado; no asumir que ya existe.

## Ruta permanente: MCP remoto

Para usarlo con la computadora apagada, implementar y alojar un servicio MCP con
HTTPS estable y Streamable HTTP, por ejemplo en /mcp. Esa URL es una **propuesta**,
no un endpoint comprobado en producción.

Reutilizar operaciones acotadas de la app mediante un adaptador; no exponer una
herramienta genérica que acepte cualquier URL, ruta, método HTTP o comando del host.
Separar el perfil autenticado, estado, búsqueda acotada, lectura seleccionada,
preparación de borrador y guardado. Eliminar borrados de la primera entrega.

Antes de habilitar datos privados:

- Autenticar por usuario y autorizar cada operación y recurso en el servidor.
  Una cuenta registrada en la web no debe recibir automáticamente acceso clínico.
- Definir permisos independientes para lectura y escritura; empezar con estado
  y datos sintéticos. No confiar en anotaciones MCP como control de acceso.
- La sesión web actual no implementa el contrato OAuth de MCP. Configurar
  descubrimiento del recurso y del emisor, authorization code con PKCE S256,
  audiencia del recurso, caducidad y revocación. Registrar la URI de retorno
  exacta que muestre ChatGPT, sin comodines ni una URI adivinada.
- Mantener credenciales exclusivamente en almacenamiento privado del servidor.
  No incluir tokens, expedientes ni cuerpos clínicos en logs o errores.
- La herramienta de guardado debe validar destino, contenido y versión; conservar
  auditoría mínima e impedir duplicados en reintentos. La autorización del usuario
  debe corresponder a esa escritura concreta.

Consúltese la [autenticación oficial](https://developers.openai.com/plugins/build/auth)
y la [construcción de servidores MCP](https://developers.openai.com/plugins/build/mcp-server).

En Express, registrar /mcp y los documentos /.well-known antes del fallback de
React. Un GET 200 que devuelve index.html no acredita compatibilidad MCP.
Comprobar el proxy del alojamiento con POST y streaming, además de los encabezados
de sesión y versión; no dar por hecho que el despliegue de la web los soporta.

## Diagnóstico público sin expedientes

El script nuevo no inicia sesión, no recibe tokens, no llama herramientas y no
lee endpoints clínicos. Comprueba DNS de los tres dominios mencionados, HEAD
/login, initialize del transporte /mcp y, si se anuncia en un 401, metadatos
públicos de OAuth del mismo origen. No sigue redirecciones, no imprime respuestas,
cookies ni identificadores de sesión y limita el tiempo y el tamaño de respuesta HTTP.
Los emisores OAuth externos se dejan para inspección posterior.

Requiere Node 20 o posterior, sin instalar dependencias:

    node scripts/check-mcp-discovery.mjs --self-test
    node scripts/check-mcp-discovery.mjs
    node scripts/check-mcp-discovery.mjs https://DOMINIO_VERIFICADO/mcp

Es una comprobación de descubrimiento HTTP. Para el puente stdio privado, usar
Inspector y tunnel-client doctor, no apuntar este script al servidor web esperando
que pruebe el puente local.

| Resultado | Interpretación |
| --- | --- |
| dns resolved | Hay resolución desde ese host; no acredita propiedad ni identidad de la app. |
| html_instead_of_mcp | La URL devuelve HTML, posiblemente el fallback de React. |
| authentication_required_metadata_advertised | Hay desafío de autenticación con metadatos; falta probar OAuth. |
| authentication_required_discovery_missing | Falta revisar el descubrimiento anunciado para ChatGPT. |
| transport_initialized_authorization_not_tested | Funciona initialize; no prueba instalación, autorización ni herramientas. |
| request_failed_from_this_host | Revisar red, DNS y TLS desde otro entorno; no declarar una caída solo por este resultado. |

El código de salida 0 solo indica inicialización o desafío de autenticación
reconocido. Incluso entonces la instalación completa sigue pendiente.

No usar /api/health para esta prueba: la implementación actual consulta Notion
internamente. Un estado sin acceso clínico debe comprobar solo el proceso y
configuración pública inocua. No cambiar ese contrato de producción sin una revisión
separada de sus consumidores.

## Aceptación antes de declarar terminado

Registrar resultados sin nombres, teléfonos, notas clínicas ni secretos:

- Transporte: initialize y catálogo de herramientas válidos.
- Identidad: conectar, desconectar y reautorizar la cuenta; sesión vencida devuelve
  un error útil, sin recurrir a una cuenta clínica compartida.
- Autorización: rechazo de usuario no habilitado, permiso de escritura ausente e
  identificador de recurso no autorizado, usando fixtures.
- Lectura: estado y catálogo ficticio; búsquedas vacías o ambiguas no descargan la
  base completa ni eligen un paciente arbitrariamente.
- Escritura: borrador sintético, destino confirmado, conflicto de versión,
  doble envío y fallo de persistencia. Ejecutar esto en staging aislado, sin
  crear registros de prueba en Notion de producción.
- PDF: trabajo asíncrono, comprobación del estado y descarga privada con sesiones
  ficticias distintas. No hacer pública una URL de PDF para facilitar su entrega.
- ChatGPT: plugin visible y seleccionado; al menos una llamada inocua exitosa
  iniciada desde una conversación nueva.

La instalación termina cuando se observa esa llamada en ChatGPT. Esta revisión
no ha configurado un túnel, creado credenciales, cambiado permisos ni conectado una
cuenta; tampoco ha desplegado el adaptador remoto.
