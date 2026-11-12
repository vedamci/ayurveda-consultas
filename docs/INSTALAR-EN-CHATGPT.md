# Añadir Consultas a las aplicaciones de ChatGPT

Estado: código preparado en la PR #9; **sin URL MCP instalable verificada ni una
instalación de ChatGPT comprobada**. La dirección web de la aplicación y una
carpeta del alojamiento no sustituyen la dirección de su servidor MCP.

## Comprobar la cuenta

Usar ChatGPT en el navegador y seleccionar la cuenta y el workspace donde debe
aparecer VEDAMCI Consultas. La documentación actual ofrece el flujo **Plugins → +
→ Add custom MCP server**. Las políticas de cuenta, workspace y seguridad pueden
limitarlo. Antes de indicar cambios de plan, roles o permisos, comprobar en la
interfaz real si existe esa opción y quién puede administrarla. El plan y rol de
la cuenta de Krishna no se han verificado en esta rama ni desde estos tests.

Si la cuenta todavía presenta Aplicaciones en lugar de Plugins, inspeccionar sus
controles reales y seguir la ruta de creación que ofrezca esa interfaz. No pedir
que active Developer Mode indiscriminadamente ni afirmar que su cuenta lo exige
sin comprobarlo. No modificar políticas del workspace para hacer aparecer el botón.

## Añadir la conexión cuando esté preparada

1. Abrir Plugins y elegir + → Add custom MCP server.
2. Escribir el nombre **VEDAMCI · Consultas** y una descripción breve.
3. En Connection, introducir exclusivamente la URL HTTPS de transporte MCP que
   haya pasado la verificación, o seleccionar un Secure MCP Tunnel previamente
   configurado y aprobado. **No hay todavía un valor verificado para introducir.**
4. Seleccionar **OAuth**. Para esta implementación no usar No authentication:
   incluso estado/perfil exigen una cuenta autorizada. Configurar el cliente
   aprobado; registrar en el proveedor la URI de retorno exacta que muestre
   ChatGPT. No introducir una contraseña de la app, un token de Notion o la sesión
   web como si fueran credenciales OAuth del cliente.
5. Completar la autorización con la identidad aprobada, revisar el aviso de riesgo
   y los permisos concretos antes de confirmar Create as a plugin.
6. Revisar el catálogo descubierto. La primera versión activa de pruebas debe
   contener únicamente connection_status y get_profile, con consultas:status.
   Si aparecen herramientas clínicas en esta etapa, detener la instalación y
   revisar la configuración antes de conceder acceso.
7. Instalar el plugin resultante. Crear una conversación nueva, escribir @ y
   seleccionar VEDAMCI · Consultas.
8. Pedir: «Comprueba el estado de VEDAMCI Consultas sin buscar pacientes». Verificar
   una llamada real a connection_status con status:ok, mode:status_only y
   clinicalBackendChecked:false. La presencia de un icono no completa esta prueba.

La adición de un MCP personalizado tiene un flujo distinto de la publicación en
el catálogo público. No se ha presentado esta integración al catálogo público ni
se ha publicado para todo un workspace.

## Qué falta antes de poder terminar el formulario

- Un endpoint HTTPS o túnel realmente accesible con initialize, tools/list y
  desafío OAuth comprobados. El listener 127.0.0.1 usado por los tests no es una
  dirección remota instalable en ChatGPT.
- Proveedor/cliente OAuth compatibles: PKCE S256, metadatos, recurso/audiencia,
  claims y caducidad acordes al verificador. Auth0 se evaluó como candidato pero
  su formato de audiencia con OIDC necesita una comprobación o adaptación acotada;
  no se ha demostrado su compatibilidad solo configurando variables.
- Identidad y grant aprobados para la cuenta que autorizará a Durga, inicialmente
  consultas:status y cero pacientes. No hace falta una credencial de Notion para
  esta prueba de estado.
- Confirmar el destino de ChatGPT y el permiso de creación en la cuenta real.

Credenciales, permisos, publicación de acceso y producción requieren las
confirmaciones previstas. Las pruebas privadas preparadas no conceden esos
permisos. No se ha creado una conexión ni se ha cambiado ninguna configuración de
la cuenta de ChatGPT en esta entrega.

Después de una activación clínica separada y autorizada, actualizar la conexión
con Refresh y revisar el nuevo catálogo antes de probar lecturas. La versión de
solo estado no acredita que se puedan consultar expedientes.

## Evidencia y referencias

La PR #9 contiene el servidor, 30 pruebas sintéticas, 20 del diagnóstico y una
sonda privada independiente; CI las ejecuta sin secretos ni datos reales. Estas
pruebas acreditan el código y el transporte local, no OAuth real ni la conexión
instalada en ChatGPT.

Guías oficiales consultadas el 12 de noviembre de 2026:

- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/auth

Para instalación técnica del servicio y sus límites, ver [MCP-REMOTE.md](MCP-REMOTE.md).
