# Cómo actualizar el repositorio GitHub oficial

Esta versión no incluye `.git` ni `node_modules`.

## Opción recomendada

1. Abre tu carpeta oficial del proyecto, la que ya está conectada con GitHub y contiene `.git`.
2. Copia desde este ZIP y reemplaza en tu carpeta oficial:
   - `src/`
   - `public/`
   - `tests/`
   - `package.json`
   - `package-lock.json`
   - `README.md`
   - `QA_REPORT.md`
3. En esa carpeta oficial, abre PowerShell.
4. Ejecuta:

```bash
npm install
npm test
npm start
```

5. Si todo está correcto, abre GitHub Desktop.
6. Revisa los cambios.
7. Commit sugerido:

```txt
v4 fixes: mixed captures and hand continuation
```

8. Haz `Push origin`.
9. Railway debería redeployar automáticamente si está conectado a ese repositorio.

## Nota importante

No copies `node_modules`. Se reconstruye con `npm install`.
