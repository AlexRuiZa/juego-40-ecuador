# QA Report — 40 Online Ecuador v7

## Estado
Aprobado para subir a GitHub y redeploy en Railway.

## Cambios incluidos

### Gameplay crítico
- Corrección de falso positivo en “carta no levantada” cuando el jugador elige una captura válida por suma + escalera y deja una carta igual alternativa en mesa.
- Detección consistente de carta no levantada en escalera parcial.
- Captura mixta validada: suma con A–7, de 2 o más cartas, más escalera posterior continua.
- Suma bloqueada para J, Q y K.
- Ronda: los mensajes públicos ya no revelan la carta de la ronda.

### Salas, reconexión y salida
- Nuevo flujo de salida explícita de sala.
- Reemplazo controlado de asientos desconectados en salas de espera.
- Expiración de asientos desconectados en sala de espera.
- Al finalizar partida se limpia sesión local para evitar reingreso automático a una sala finalizada.
- Botones de “Nueva partida” y “Salir al inicio”.

### UX / Folklore
- Pop-ups visuales reforzados con alto contraste.
- Juez de aguas como overlay temporal para eventos relevantes.
- Frases aleatorias para limpia, caída, ronda, cartón y barajado.
- Audio opcional vía Web Speech API cuando el navegador lo permite.
- Se evita lenguaje de humillación agresiva.

## Baterías ejecutadas

### Batería 1 — Gameplay core
- Comando: `npm test`
- Resultado: 166/166 OK

### Batería 2 — Regresión
- Comando: `npm run test:regression`
- Resultado: 166/166 OK

### Batería 3 — Producción v7
- Comando: `npm run test:production`
- Resultado: 10/10 OK

### Healthcheck
- `npm start`: OK
- `/health`: OK

## Resultado final
- Total validado: 342 tests OK + healthcheck OK.
- Fallos abiertos: 0.
