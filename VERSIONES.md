# Bitacora de versiones

Esta bitacora registra los puntos importantes del proyecto para poder volver a una version anterior sin depender del chat.

Repositorio GitHub:
https://github.com/vedamci/ayurveda-consultas

## Version actual guardada

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
