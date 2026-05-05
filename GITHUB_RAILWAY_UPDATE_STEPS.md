# Actualización GitHub + Railway

## 1. Copiar archivos sobre la carpeta oficial conectada a GitHub

Copiar desde este paquete hacia tu carpeta oficial del repo:

- `src/`
- `public/`
- `tests/`
- `package.json`
- `package-lock.json`
- `README.md`
- `QA_REPORT.md`
- `GITHUB_RAILWAY_UPDATE_STEPS.md`

No copiar ni borrar:

- `.git`
- `node_modules`

## 2. Validar localmente

```bash
npm install
npm test
npm run test:regression
npm start
```

Abrir:

```txt
http://localhost:3000/health
```

Debe responder:

```json
{"status":"ok"}
```

## 3. GitHub Desktop

1. Abrir GitHub Desktop.
2. Verificar cambios.
3. Summary:

```txt
v5 production fixes - 166 tests approved
```

4. Click `Commit to main`.
5. Click `Push origin`.

## 4. Railway

Railway debería redeployar automáticamente.

Validar:

- Deployment del último commit: `SUCCESS`.
- URL pública abre correctamente.
- `/health` responde OK.

## 5. QA producción

Probar:

- 1v1.
- 2v2.
- suma A–7 con varias cartas.
- bloqueo de suma con J/Q/K.
- escalera numérica/letras/combinada.
- captura mixta.
- carta no levantada + botón `Recoger cartas`.
- fin en 40.
