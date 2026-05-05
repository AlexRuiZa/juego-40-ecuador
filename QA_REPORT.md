# QA Report — 40 Online Ecuador

Versión: v5 production action points
Fecha: 2026-05-05

## Resultado ejecutivo

- `npm test`: 166 / 166 aprobados
- `npm run test:regression`: 166 / 166 aprobados
- `npm start`: OK
- `/health`: OK

## Cambios cubiertos

1. Captura por suma solo para A–7, con 2, 3, 4 o más cartas.
2. Bloqueo de sumas con J, Q y K.
3. Captura por escalera numérica, letras y combinada.
4. Captura mixta: suma o igual + escalera continua posterior.
5. Carta no levantada: ya no se entrega automáticamente al rival.
6. Carta no levantada: se genera oportunidad pendiente para el rival/equipo contrario.
7. El rival puede recoger cartas pendientes sin perder su turno normal.
8. Mensajes visuales diferenciados:
   - `NO!! Dejaste cartas en la mesa!`
   - `SI!! Quedaron cartas en la mesa para ti!`
9. Pop-up visual y cartas resaltadas para carta no levantada.
10. Tema visual de mesa inspirado en la bandera de Ecuador.
11. Limpieza periódica de salas inactivas/vacías.
12. Validación de mazo de 40 cartas: A–7, J, Q, K, cuatro por valor.

## Cobertura de pruebas

La batería de 166 tests cubre:

- Mazo de 40 cartas.
- 1v1 y 2v2.
- Inicio solo por host.
- Sumas válidas e inválidas.
- Escaleras válidas e inválidas.
- Capturas mixtas.
- Capturas parciales y cartas no levantadas.
- Reclamo de cartas no levantadas por rival.
- Ronda en repartos iniciales y posteriores.
- Caída, limpia y caída+limpia.
- Cartón.
- Regla de 38 puntos.
- Fin de partida en 40.
- Protección contra jugadas manipuladas.
- Limpieza de salas antiguas.
- Regresión general.

## Estado

Aprobado para subir a GitHub y Railway.
