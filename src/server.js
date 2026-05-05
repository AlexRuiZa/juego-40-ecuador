// src/server.js
// Servidor Express + Socket.IO. Punto único de entrada.
// El servidor es la única fuente de verdad: valida todo y emite estado.

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const roomManager = require('./roomManager');
const gameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // CORS abierto para MVP local. En Railway, ajustar al dominio del frontend si se separa.
  cors: { origin: '*' },
});

// Servir el frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

// Healthcheck simple para Railway
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

/**
 * Emite el estado de la sala a cada jugador, personalizando la vista
 * para que cada uno solo vea su propia mano.
 */
function broadcastState(roomCode) {
  const state = roomManager.getRoom(roomCode);
  if (!state) return;
  for (const player of state.players) {
    const view = gameEngine.getPublicState(state, player.id);
    io.to(player.id).emit('updateGameState', view);
  }
}

/**
 * Helper: envía un error al cliente sin tumbar la conexión.
 */
function sendError(socket, message) {
  socket.emit('errorMessage', { message });
}

io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);

  // Crear sala
  socket.on('createRoom', ({ name }, ack) => {
    try {
      const state = roomManager.createRoom();
      gameEngine.addPlayer(state, socket.id, name);
      socket.join(state.roomCode);
      if (typeof ack === 'function') {
        ack({ ok: true, roomCode: state.roomCode, playerId: socket.id });
      }
      broadcastState(state.roomCode);
      console.log(`[+] Sala creada: ${state.roomCode} por ${name}`);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Unirse a sala existente
  socket.on('joinRoom', ({ roomCode, name }, ack) => {
    try {
      const code = (roomCode || '').toUpperCase().trim();
      const state = roomManager.getRoom(code);
      if (!state) throw new Error('Sala no encontrada');
      if (state.status !== gameEngine.STATES.WAITING_PLAYERS &&
          state.status !== gameEngine.STATES.READY) {
        throw new Error('La partida ya está en curso');
      }
      gameEngine.addPlayer(state, socket.id, name);
      socket.join(code);
      if (typeof ack === 'function') {
        ack({ ok: true, roomCode: code, playerId: socket.id });
      }
      broadcastState(code);
      console.log(`[+] ${name} se unió a ${code}`);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Iniciar partida (solo cuando hay 4 jugadores)
  socket.on('startGame', ({ roomCode }, ack) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) throw new Error('Sala no encontrada');
      if (!state.players.some(p => p.id === socket.id)) {
        throw new Error('No perteneces a esta sala');
      }
      gameEngine.startGame(state, socket.id);
      if (typeof ack === 'function') ack({ ok: true });
      broadcastState(roomCode);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Jugar carta
  socket.on('playCard', ({ roomCode, handIndex, tableIndices }, ack) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) throw new Error('Sala no encontrada');

      const result = gameEngine.playCard(
        state,
        socket.id,
        handIndex,
        Array.isArray(tableIndices) ? tableIndices : []
      );

      if (typeof ack === 'function') ack({ ok: true, result });
      broadcastState(roomCode);

      // Si la partida finalizó, notificar
      if (state.status === gameEngine.STATES.GAME_FINISHED) {
        io.to(roomCode).emit('endGame', {
          winner: state.winner,
          teams: state.teams,
        });
      } else if (state.status === gameEngine.STATES.HAND_FINISHED) {
        io.to(roomCode).emit('endHand', {
          handNumber: state.handNumber,
          teams: {
            A: { score: state.teams.A.score },
            B: { score: state.teams.B.score },
          },
        });
      }
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Continuar a la siguiente mano (cuando la mano terminó pero la partida no)
  socket.on('nextHand', ({ roomCode }, ack) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) throw new Error('Sala no encontrada');
      gameEngine.continueToNextHand(state, socket.id);
      if (typeof ack === 'function') ack({ ok: true });
      broadcastState(roomCode);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Manejo de desconexión
  socket.on('disconnect', () => {
    console.log(`[-] Desconexión: ${socket.id}`);
    const state = roomManager.findRoomByPlayerId(socket.id);
    if (!state) return;

    const code = state.roomCode;
    gameEngine.removePlayer(state, socket.id);
    io.to(code).emit('disconnectPlayer', { playerId: socket.id });

    // Si la sala queda vacía, eliminarla
    if (state.players.length === 0) {
      roomManager.deleteRoom(code);
      console.log(`[x] Sala eliminada: ${code}`);
    } else {
      broadcastState(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 40 Online Ecuador corriendo en http://localhost:${PORT}`);
});
