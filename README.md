# 🃏 40 Online Ecuador

MVP funcional del juego tradicional ecuatoriano **40**, en versión multijugador online en tiempo real.

## Tecnologías

- **Backend:** Node.js + Express
- **Tiempo real:** Socket.IO
- **Frontend:** HTML + CSS + JavaScript vanilla
- **Sin base de datos** (estado en memoria)
- **Sin login** (los jugadores ingresan con un nombre)

## Estructura del proyecto

```
40-online-ecuador/
├── package.json
├── README.md
├── src/
│   ├── server.js         # Servidor Express + Socket.IO
│   ├── gameEngine.js     # Lógica del juego (reglas, capturas, puntajes)
│   ├── roomManager.js    # Gestión de salas en memoria
│   └── deck.js           # Baraja de 40 cartas
└── public/
    ├── index.html        # UI del cliente
    ├── style.css         # Estilos de la mesa
    └── app.js            # Cliente Socket.IO
```

## Cómo correr localmente

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Iniciar el servidor:
   ```bash
   npm start
   ```
3. Abrir `http://localhost:3000` en **4 pestañas** (o 4 dispositivos en la misma red).
4. En la primera pestaña: escribir nombre → **Crear sala** → copiar código de 4 letras.
5. En las otras 3 pestañas: escribir nombre → pegar código → **Unirse**.
6. Cuando haya 4 jugadores, el botón **Iniciar partida** se habilita.

## Cómo se juega (resumen)

- 4 jugadores divididos en 2 equipos automáticamente (A: pos 1 y 3, B: pos 2 y 4).
- Cada jugador recibe 5 cartas. Quedan cartas en el mazo.
- En tu turno: seleccionás 1 carta de tu mano, opcionalmente seleccionás cartas de la mesa para capturar, y confirmás.
- **Capturas válidas:**
  - Misma carta (igual valor numérico)
  - Suma exacta del valor
  - Combinaciones que se particionen en grupos válidos
- **Caída:** capturar la última carta jugada por un rival usando una del mismo valor → +2.
- **Limpia:** dejar la mesa vacía → +2.
- **Ronda:** recibir 3 cartas iguales en el reparto → +2.
- **Cartón:** 20 cartas capturadas = 6 puntos. Cada par adicional = +2.
- Gana el equipo que llegue primero a **40 puntos**.

## Eventos Socket.IO

| Evento (cliente → servidor) | Descripción |
|-----------------------------|-------------|
| `createRoom`                | Crea sala con código único |
| `joinRoom`                  | Une a sala existente |
| `startGame`                 | Inicia partida (con 4 jugadores) |
| `playCard`                  | Juega carta con índices opcionales de mesa |
| `nextHand`                  | Continúa a la siguiente mano |

| Evento (servidor → cliente) | Descripción |
|-----------------------------|-------------|
| `updateGameState`           | Estado público + mano del receptor |
| `endHand`                   | Notifica fin de mano |
| `endGame`                   | Notifica fin de partida con ganador |
| `disconnectPlayer`          | Aviso de desconexión |
| `errorMessage`              | Error de validación |

## Decisiones de arquitectura

- **Estado autoritativo en servidor:** el cliente solo envía intenciones (`handIndex`, `tableIndices`). El servidor valida todo. Si el cliente intenta jugar fuera de turno o hacer una captura inválida, el servidor rechaza con error.
- **Vista personalizada por jugador:** cada cliente ve su mano completa pero solo el conteo de cartas de los demás (`getPublicState` en `gameEngine.js`).
- **Lógica pura desacoplada:** `gameEngine.js` no conoce sockets ni HTTP — recibe estado y lo muta. Esto facilita testear y mantener.
- **Salas en memoria con `Map`:** sin DB. Las salas se eliminan cuando todos los jugadores se desconectan.
- **Capturas combinadas:** validadas con backtracking que verifica si las cartas seleccionadas se pueden particionar en grupos donde cada grupo o es del mismo valor o suma el valor de la carta jugada.

## Despliegue en Railway

1. Crear cuenta en [railway.app](https://railway.app) y conectar tu repo de GitHub.
2. **New Project → Deploy from GitHub repo** → seleccionar este repo.
3. Railway detecta automáticamente Node.js y ejecuta `npm install` + `npm start`.
4. **Variables de entorno:** no hay obligatorias. `PORT` lo provee Railway automáticamente (el servidor lo lee con `process.env.PORT`).
5. **Generar dominio público:** Settings → Networking → **Generate Domain**.
6. Listo: `https://tu-app.up.railway.app` ya queda accesible.

### Notas de producción

- **Socket.IO con Railway:** funciona out-of-the-box. Railway soporta WebSockets sin configuración extra.
- **Estado en memoria:** si Railway reinicia el contenedor, todas las salas se pierden. Es esperable para un MVP. Para producción seria, mover salas a Redis.
- **CORS:** el servidor usa `cors: { origin: '*' }` para simplicidad. Si separás frontend y backend en dominios distintos, restringilo al dominio del frontend.
- **Escalado horizontal:** este MVP **no escala horizontalmente** porque el estado vive en la memoria de un solo proceso. Si necesitás múltiples instancias, hay que adaptar a Redis adapter de Socket.IO.

## Limitaciones conocidas del MVP

- El cliente debe seleccionar manualmente las cartas a capturar (no hay sugerencia automática).
- No hay sistema de reconexión: si un jugador pierde conexión, la partida se finaliza.
- No hay chat de jugadores.
- No hay timer por turno.
- No hay sonidos ni animaciones.

Estas son extensiones naturales para una v2.

## Actualización v3

Esta versión incluye correcciones posteriores al feedback real de juego:

- Modalidades 1 vs 1 y 2 vs 2.
- Inicio de partida solo por host.
- Ronda en cada reparto.
- Captura por escalera.
- Carta no levantada.
- Finalización inmediata al llegar a 40.
- Regla especial de 38 puntos para cartón.
- Pop-up/resumen de fin de mano con cartón y marcador.

### Ejecutar pruebas

```bash
npm test
```



## QA actualizado

`npm test` ejecuta ahora la batería ampliada de 166 pruebas.


## v6 Production Hotfix

Incluye reconexión mobile-friendly, conservación de asiento/equipo, inicio 2v2 robusto, sincronización de equipos desde servidor, limpieza segura de salas y mejora de contraste visual en pop-ups.

Scripts QA:

```bash
npm test
npm run test:regression
npm run test:production
```


## v8 Production Polish

Incluye corrección de falso positivo en carta no levantada cuando se elige suma válida, cola visual de pop-ups para evitar superposiciones, y tone de victoria en partida finalizada. QA: 362/362 tests OK.


## v9 - Don Evaristo Corral y Chancleta

Esta versión incorpora a Don Evaristo Corral y Chancleta como “juecito de aguas” visual del juego:

- Imagen del personaje en los pop-ups del juez.
- Botellita/canelazo como elemento visual folklórico.
- Frases del juez durante caída, limpia, ronda, cartón y cambio de mano.
- Botón para activar/desactivar la voz del juecito.
- Voz vía Web Speech API del navegador en español.

Nota: la app no clona una voz real desde una imagen. Para una voz exacta/actoral de Don Evaristo, se pueden reemplazar las frases TTS por archivos `.mp3` autorizados en una futura versión.

## v10 — Don Evaristo visual + tones actuales

Esta versión integra a Don Evaristo Corral y Chancleta como juecito de aguas visual, mantiene los tones actuales y elimina el TTS sintético. La arquitectura queda preparada para audios MP3 autorizados en una futura versión.
