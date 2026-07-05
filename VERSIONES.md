# Bitacora de versiones

Esta bitacora registra los puntos importantes del proyecto para poder volver a una version anterior sin depender del chat.

Repositorio GitHub:
https://github.com/vedamci/ayurveda-consultas

## Version actual guardada

### v2026.07.05-pdf-chromium-en-main

- Fecha: 2026-07-05
- Rama: `main` (fusion de `fix/pdf-chromium-print`)
- Commit: `41841ef`
- Tag: `v2026.07.05-pdf-chromium-en-main`
- Mensaje del commit: `Seguimiento terapéutico en servidor + opciones de PDF (subtítulo, visitas de seguimiento, secciones activables)`
- Estado: subido a GitHub

Cambios principales (todo el trabajo de la rama `fix/pdf-chromium-print` llevado a `main`):

- Arreglo de raiz del PDF: generacion con Chromium (impresion nativa) en lugar del metodo anterior que cortaba tablas.
- Autosave del formulario de pacientes con indicador visual (`useAutosave`, `useDraftPersist`, `AutosaveIndicator`).
- Nuevas opciones del PDF: subtitulo, tamano de fuente, visitas de seguimiento numeradas y secciones activables (diagnostico, guia de alimentacion, recetas, terapias).
- Catalogos nuevos de terapias (`therapies.json`) y habitos de alimentacion saludable (`healthy-eating-habits.json`).
- Seguimiento terapeutico: el servidor genera archivos de seguimiento por paciente en `seguimiento-terapeutico/registros`.
- Formulas herbales con proposito e instruccion opcionales.
- Limpieza de datos de recetas (ingredientes corruptos).
- Dev: nodemon ignora `local-data` y `dist` para evitar reinicios en cascada.

Verificacion realizada:

- `npm run build` paso correctamente (2026-07-05).
- La advertencia de tamano de bundle no bloqueo la compilacion.

Enlaces:

- Commit: https://github.com/vedamci/ayurveda-consultas/commit/41841ef
- Version/tag: https://github.com/vedamci/ayurveda-consultas/tree/v2026.07.05-pdf-chromium-en-main

## Versiones anteriores

### v2026.07.04-checkpoint-pdf-terapias

- Fecha: 2026-07-04
- Rama: `fix/pdf-chromium-print`
- Commit: `7c1cb29`
- Tag: `v2026.07.04-checkpoint-pdf-terapias`
- Mensaje del commit: `Checkpoint: mejoras PDF y datos de terapias`
- Estado: subido a GitHub

Cambios principales:

- Mejora del formato e instrucciones del PDF de tratamiento.
- Ajustes visuales del fondo tipo acuarela del PDF.
- Agregado de videos introductorios de Ayurveda en las indicaciones.
- Actualizacion de datos de `Digestión Perfecta`.
- Agregado de terapias `Netra basti` y `Shirodhara`.

Verificacion realizada:

- `npm run build` paso correctamente.
- La advertencia de tamano de bundle no bloqueo la compilacion.

Enlaces:

- Commit: https://github.com/vedamci/ayurveda-consultas/commit/7c1cb29
- Version/tag: https://github.com/vedamci/ayurveda-consultas/tree/v2026.07.04-checkpoint-pdf-terapias

## Como consultar versiones

Ver historial reciente:

```bash
git log --oneline --decorate -n 10
```

Ver tags disponibles:

```bash
git tag --list
```

Ver ramas:

```bash
git branch -vv
```

## Como volver a una version sin perder el trabajo actual

La forma mas segura es crear una rama nueva desde el tag:

```bash
git switch -c recuperar-pdf-terapias v2026.07.04-checkpoint-pdf-terapias
```

Eso permite revisar o continuar desde esa version sin borrar avances posteriores.

## Regla de trabajo

Antes de cambios grandes:

1. Revisar estado:

```bash
git status -sb
```

2. Crear commit checkpoint:

```bash
git add archivo1 archivo2
git commit -m "Checkpoint: descripcion corta"
```

3. Crear tag si es una version estable:

```bash
git tag -a vAAAA.MM.DD-nombre-corto -m "Version estable AAAA-MM-DD: descripcion"
```

4. Subir a GitHub:

```bash
git push origin nombre-de-rama
git push origin vAAAA.MM.DD-nombre-corto
```

## Notas

- Evitar usar comandos destructivos para regresar versiones si hay cambios sin guardar.
- Si algo se rompe, pedir: "regresa a la version `v2026.07.04-checkpoint-pdf-terapias`".
- Si se hace una version nueva estable, agregarla arriba de esta lista.
