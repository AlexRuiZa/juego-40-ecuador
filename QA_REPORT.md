# QA Report — 40 Online Ecuador v8 Production Polish

## Estado
Aprobado para actualización en GitHub/Railway.

## Cambios incluidos
- Corrige falso positivo de “carta no levantada” cuando el jugador elige captura por suma válida y deja una carta igual en mesa.
  - Ejemplo corregido: mano 4, mesa A+3+4. Si levanta A+3, el 4 puede quedar en mesa sin penalización.
  - Ejemplo corregido: mano 5, mesa 5+2+3+6+7+J+Q+K. Si levanta 2+3+6+7+J+Q+K, el 5 puede quedar en mesa sin penalización.
- Mantiene detección correcta de carta no levantada cuando la captura parcial sí omite una escalera válida.
  - Ejemplo: mano J, mesa J+Q+K. Si levanta solo J, Q+K quedan pendientes para el oponente.
- Refuerza regla de suma: una captura por suma requiere 2 o más cartas numéricas A–7.
- Agrega cola visual de pop-ups para evitar superposición entre caída/limpia/cartón/juez/partida finalizada.
- La partida finalizada tiene prioridad final y aparece sola luego de los eventos previos.
- Agrega tone/audio de victoria vía SpeechSynthesis.

## Pruebas ejecutadas

### Batería 1 — Gameplay completo
- Comando: `npm test`
- Resultado: `166/166 OK`

### Batería 2 — Regresión
- Comando: `npm run test:regression`
- Resultado: `166/166 OK`

### Batería 3 — Producción v7
- Comando: `npm run test:production:v7`
- Resultado: `10/10 OK`

### Batería 4 — Producción v6
- Comando: `npm run test:production:v6`
- Resultado: `10/10 OK`

### Batería 5 — Producción v8
- Comando: `npm run test:production`
- Resultado: `10/10 OK`

### Healthcheck
- Comando: `npm start` + `GET /health`
- Resultado: `OK`

## Resultado consolidado
- Tests lógicos/regresión: 332/332 OK
- Tests producción específicos: 30/30 OK
- Total ejecutado: 362/362 OK
- Fallos: 0

## Commit sugerido
`v8 production polish - popup queue and missed capture fix`
