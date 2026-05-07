# Actualizar GitHub y Railway — v7

1. Descomprime el ZIP v7.
2. Abre la carpeta oficial del repo desde GitHub Desktop con **Show in Explorer**.
3. Copia desde la carpeta v7 hacia la carpeta oficial:
   - `public/`
   - `src/`
   - `tests/`
   - `package.json`
   - `package-lock.json`
   - `README.md`
   - `QA_REPORT.md`
   - `GITHUB_RAILWAY_UPDATE_STEPS.md`
4. No copies:
   - `.git`
   - `node_modules`
5. En GitHub Desktop confirma que aparecen cambios.
6. Commit sugerido:
   `v7 gameplay folklore hotfix - 342 tests approved`
7. Click **Commit to main**.
8. Click **Push origin**.
9. En Railway verifica que el deployment del nuevo commit termine en **SUCCESS / ACTIVE**.
10. Prueba producción con 1v1 y 2v2.
