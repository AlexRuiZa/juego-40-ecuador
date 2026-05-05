# QA Report — 40 Online Ecuador v4.1 / 166 Tests

## Estado final

- Total de pruebas ejecutadas: **166**
- Pruebas aprobadas: **166**
- Pruebas fallidas: **0**
- Resultado: **APROBADO**

## Corrección adicional detectada durante QA ampliado

Durante la ampliación de la batería de 33 a 166 pruebas se detectó un punto de robustez:

- `startGame()` podía ser invocado nuevamente sobre una sala en estado no listo, por ejemplo luego de una finalización por desconexión si se llamaba directamente desde el backend.

### Fix aplicado

- `startGame()` ahora solo permite iniciar cuando la sala está en estado `READY`.
- Esto protege contra reinicios no autorizados o estados manipulados.

## Baterías ejecutadas

### 1. Batería funcional normal
Incluye:

- Inicio 1v1 y 2v2
- Asignación de equipos
- Mesa inicial vacía
- Reparto de cartas
- Captura por carta igual
- Captura por suma
- Captura por escalera
- Captura mixta: suma + escalera
- Limpia
- Caída
- Caída + limpia
- Ronda
- Cartón
- Continuación de mano
- Victoria a 40 puntos
- Regla especial de 38 puntos

### 2. Batería de errores y manipulación
Incluye:

- Nombres duplicados
- Jugador 5 no permitido
- Inicio con 1 o 3 jugadores
- Inicio por jugador no host
- Jugar fuera de turno
- Índices de mano inválidos
- Índices de mesa inválidos
- Índices duplicados
- Capturas inválidas
- Intentos de jugar en estados incorrectos
- Continuar mano sin pertenecer a sala
- Continuar luego de partida finalizada
- Intento de reinicio irregular de partida

### 3. Batería extrema y regresión
Incluye:

- Mano completa 1v1
- Mano completa 2v2
- Repartos posteriores
- Ronda en manos posteriores
- Múltiples rondas simultáneas
- Cartón con empate y desempate
- Regla de 38 puntos con cartón bloqueado
- Escalera desordenada
- Captura mixta desordenada
- Captura parcial sin capturar cartas no seleccionadas
- Turnos en 2v2
- Estado público sin revelar mano ajena
- Límite de log visible
- Desconexiones

## Resultado técnico

```txt
QA RESULT: 166/166 passed, 0 failed
npm start: OK
/health: OK
```

## Conclusión

La versión queda aprobada para reemplazar archivos en el proyecto oficial conectado a GitHub y avanzar luego con commit/push y despliegue en Railway.
