# GitHub + Railway Update Steps — v6 Production Hotfix

## Objetivo
Actualizar GitHub y Railway con la versión v6 para que el juego online no dependa de archivos locales.

## Paso 1 — Copiar archivos sobre la carpeta oficial

Descomprime este ZIP y copia estos elementos sobre tu carpeta oficial conectada a GitHub:

```txt
src/
public/
tests/
package.json
package-lock.json
README.md
QA_REPORT.md
GITHUB_RAILWAY_UPDATE_STEPS.md
```

Cuando Windows pregunte si deseas reemplazar, selecciona **Sí**.

No copies:

```txt
.git
node_modules
```

## Paso 2 — Verificar cambios en GitHub Desktop

Abre GitHub Desktop. Deben aparecer archivos modificados.

Commit message sugerido:

```txt
v6 production hotfix - reconnection and 2v2 sync
```

Haz:

```txt
Commit to main
Push origin
```

## Paso 3 — Verificar GitHub web

En GitHub, confirma que el último commit sea:

```txt
v6 production hotfix - reconnection and 2v2 sync
```

## Paso 4 — Railway

Railway debe redeployar automáticamente al detectar el push.

Verifica:

```txt
Deployments → Success → Active
```

## Paso 5 — Prueba en producción

Probar:

```txt
1v1 sigue funcionando
2v2 inicia correctamente
los 4 jugadores ven los mismos equipos
si un jugador minimiza/cambia de app, puede reconectar
la sala no expira mientras hay jugadores conectados
pop-ups visibles y legibles
```
