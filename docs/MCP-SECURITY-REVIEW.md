# Revisión independiente de seguridad y compatibilidad OAuth

Revisión: 12 noviembre 2026. Base: PR #9, commit 4923f86489890320ea929f4e91494bef1e26927b.
No despliega, crea identidades ni otorga acceso. No se usaron datos clínicos.

## Evidencia

- Suite original: 30/30 pruebas sintéticas pasan.
- Suite ampliada de caracterización: 35/35 pasan.
- Cinco casos nuevos muestran requisitos actuales del servidor, no que un proveedor real ya los cumpla.
- No se ejecutó autorización real de ChatGPT, login, consentimiento, renovación, ni revocación en proveedor.

## Bloqueo confirmado

`auth.mjs` exige `aud` como string único, `jti`, cliente aprobado y vida máxima de 900 segundos.
La documentación Auth0 muestra dos diferencias importantes: el perfil estándar no incluye `jti`; las muestras con OpenID usan una lista de audiencia que incluye la API y `/userinfo`, incluso en RFC9068.
Los tests nuevos reproducen el rechazo esperado de esas formas mediante JWT firmados sintéticos.
No quitar estos controles para conseguir un primer login.

## Ruta mínima recomendada

1. Primer despliegue independiente con `MCP_CLINICAL_ENABLED=false`, sin clave de Notion y sin directorio clínico. Mantener OAuth; no usar autenticación anónima.
2. Proveedor establecido y cliente dedicado aprobado. Con Auth0, elegir RFC9068 y vigencia de 900 segundos o menos. Comprobar el token de prueba sin imprimirlo ni subirlo a repositorio.
3. Verificar metadatos reales del proveedor, PKCE S256 y que `resource` se refleje correctamente en la audiencia. Usar el callback exacto mostrado por la conexión ChatGPT y cliente predeterminado aprobado como opción inicial. CIMD/DCR no son sustitutos automáticos de la lista local de clientes.
4. Preferir un token destinado únicamente a esta API. Si el proveedor confirmado exige `[recurso, issuer/userinfo]`, preparar una adaptación opt-in y pruebas que solo admitan ese par exacto, conservando firma, `iss`, `jti`, cliente, vida, revocación y rechazo de ID tokens. No aceptar cualquier lista que contenga el recurso.
5. Grant explícito a una identidad verificada, scope único `consultas:status`, `patientIds: []`. No inferir identidad por email o rol web.
6. Prueba real: anónimo devuelve 401 y metadata; autorizado lista solo dos herramientas y devuelve `mode:status_only`. Usuario sin grant devuelve 403. Revocación local elimina acceso. Solo entonces declarar instalada.
7. Activar lectura clínica en etapa separada, con permisos acotados y confirmación correspondiente. No reutilizar la clave Notion amplia de la aplicación web.

## Otros puntos de operación

- El límite por IP usa `req.socket.remoteAddress`; detrás del proxy puede agrupar todos los clientes. No es un bypass de permisos, pero exige prueba de carga y encabezados Host conservados. No confiar arbitrariamente en X-Forwarded-For.
- La ruta de pruebas local no es un endpoint remoto. Un preview Vercel de la interfaz no demuestra servicio MCP.
- Una página de configuración con credenciales rellenadas no equivale a una autorización OAuth completada.

## Fuentes verificadas

- OpenAI: https://developers.openai.com/plugins/build/auth
- Auth0: https://auth0.com/docs/secure/tokens/access-tokens/access-token-profiles
