# Desplegar un MCP independiente de solo estado

Entrada preparada: `server/mcp/status-app.js`. No importa `server/index.js`, no
carga `.env`, no crea secretos de la web y no habilita herramientas clínicas.
Su uso permite probar un servicio separado sin fusionar main, reemplazar la app
existente o reiniciar sus procesos. La instalación y conexión reales siguen
pendientes; este documento no acredita un endpoint HTTPS activo.

## Configuración explícita

Instalar únicamente las dependencias de `server/mcp/package-lock.json` en una
copia aislada. Preparar un archivo JSON privado fuera del document root, basado
en `standalone-config.example.json`; el ejemplo está desactivado. El archivo debe
ser regular, no symlink, con acceso solo para su propietario (por ejemplo 0600).
No contiene tokens ni contraseñas: solo metadata OAuth aprobada y rutas privadas.
No copiar .env ni credenciales de la aplicación web.

`MCP_CONFIG_FILE` debe apuntar a ese JSON mediante ruta absoluta. Cuando existe,
el JSON es la configuración autoritativa: no se mezclan variables de la web.
Solo admite los campos del ejemplo. Rechaza claves de Notion, DATA_DIR y cualquier
activación clínica. `MCP_ENABLED` debe ser el string `true` para arrancar;
`MCP_CLINICAL_ENABLED` debe estar ausente o ser `false`. El grant, la cuenta y el
emisor deben estar aprobados antes de conceder acceso real.

`MCP_USERS_FILE` y `MCP_POLICY_FILE` son rutas explícitas. El servidor no crea ni
modifica esos archivos. En QA usar exclusivamente usuarios y grants sintéticos;
para una cuenta real, verificar primero la correspondencia de identidad. La
política de solo estado debe tener `consultas:status` y cero pacientes.

## Proceso independiente

Para una prueba privada directa, usar Node 22 verificado con `PORT=0` y el archivo
privado dedicado. `status-app.js` escucha únicamente en `127.0.0.1`; con puerto 0
el sistema elige uno libre. Se registran solo modo y puerto local, nunca cuerpos,
configuración, contraseñas o tokens. No servirlo en 0.0.0.0 para facilitar pruebas.
El servicio devuelve metadata OAuth pública y 401 sin bearer, pero no incluye
la interfaz web, /api/health ni rutas clínicas.

Para Passenger, usar **otra** raíz de aplicación, document root vacío y grupo de
aplicación exclusivo para MCP. El startup file relativo es
`server/mcp/status-app.js` y el tipo es `node`. Conservar la ruta exacta de Node
observada en el host. El launcher explícito funciona aunque Passenger importe el
archivo mediante su loader; solo crea un listener. Passenger realiza reverse port
binding a su socket Unix, por lo que un puerto numérico no acredita aislamiento
entre apps Passenger. Son la raíz y el grupo dedicados los que deben comprobarse.

No pegar un .htaccess nuevo sobre producción ni recrear la app existente porque
una lista administrativa esté vacía. Preparar los cambios del nuevo vhost o
contexto y revisar su alcance antes de aplicarlos. Mantener la ruta MCP pública
como /mcp en un hostname QA verificado: la configuración actual no admite /qa/mcp.
El proxy debe preservar Host y Authorization y publicar HTTPS; el código valida
el host configurado y no confía arbitrariamente en encabezados reenviados.

El proceso acepta SIGTERM/SIGINT para cerrar su propio listener. Si falla el
arranque, solo emite startup_failed y sale con error; no imprime la causa con
valores privados ni recurre a una sesión web compartida. Nunca detener procesos
lsnode de otras apps para actualizar este servicio.

## Verificación y límites

- Suite ampliada: 41 pruebas, incluida caracterización OAuth y entrada autónoma;
  20 pruebas originales del diagnóstico y sonda privada de estado.
- La entrada autónoma se probó con Node 22.23.5 en Linux, incluida ejecución en un
  proceso hijo que escucha en loopback y termina con su propio SIGTERM.
- Comprobar en el host real listener/Passenger, TLS, metadata, 401, OAuth con PKCE,
  cuenta sin grant, identidad autorizada, revocación y catálogo de dos herramientas.
- La validación de audiencia sigue intacta. El parche candidato Auth0 no está
  integrado: cotejar primero un token real de prueba en el entorno aprobado sin
  imprimirlo, antes de cambiar esa validación.
- Finalmente instalar en ChatGPT y observar una llamada efectiva a
  connection_status. No declarar conexión funcional por un CI verde o un 401.

No se ha creado una credencial, grant real, dominio, vhost o conexión ChatGPT al
preparar este código. Las aprobaciones necesarias de identidad, acceso, OAuth y
producción siguen aplicándose; la lectura clínica necesita otra etapa.

Referencias: [reverse port binding de Passenger](https://www.phusionpassenger.com/library/indepth/nodejs/reverse_port_binding.html)
y [configuración Apache](https://www.phusionpassenger.com/library/config/apache/reference/).
