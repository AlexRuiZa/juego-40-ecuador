# Actualización GitHub + Railway — v10

## 1. Copiar archivos
Descomprime este ZIP y copia sobre la carpeta oficial conectada a GitHub:

- public
- src
- tests
- package.json
- package-lock.json
- README.md
- QA_REPORT.md
- GITHUB_RAILWAY_UPDATE_STEPS.md

No copies:

- .git
- node_modules

## 2. Verificar local
En la carpeta oficial:

```bash
npm install
npm test
npm run test:regression
npm run test:production:v10
npm start
```

## 3. Commit en GitHub Desktop
Summary sugerido:

```txt
v10 Don Evaristo visual and tones
```

Luego:

```txt
Commit to main
Push origin
```

## 4. Railway
Railway debe detectar el push y redeployar automáticamente.

Verifica:

```txt
Deployments → Success / Active
```

## 5. Validación producción
Probar:

- 1v1
- 2v2
- Don Evaristo visible en pop-ups
- tones activos/desactivables
- fin de partida
- nueva partida / salir al inicio
