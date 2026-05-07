# GitHub + Railway update steps — v8

1. Descomprime el ZIP v8.
2. Abre tu carpeta oficial conectada a GitHub (`40-online-ecuador`), la que contiene `.git`.
3. Copia desde la carpeta v8 hacia la carpeta oficial:
   - `public/`
   - `src/`
   - `tests/`
   - `package.json`
   - `package-lock.json`
   - `README.md`
   - `QA_REPORT.md`
   - `GITHUB_RAILWAY_UPDATE_STEPS.md`
4. No copies `.git` ni `node_modules`.
5. Abre GitHub Desktop.
6. Commit sugerido: `v8 production polish - popup queue and missed capture fix`.
7. Click `Commit to main`.
8. Click `Push origin`.
9. Railway detectará el push y hará redeploy automático.
10. Verifica que Railway muestre `Deployment successful` y `Active`.
11. Prueba la URL pública.
