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
      socket.data.roomCode = state.roomCode;
      socket.data.playerName = name;
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

  // Unirse a sala existente o reconectar a un asiento reservado
  socket.on('joinRoom', ({ roomCode, name }, ack) => {
    try {
      const code = (roomCode || '').toUpperCase().trim();
      const state = roomManager.getRoom(code);
      if (!state) throw new Error('Sala no encontrada');
      gameEngine.expireDisconnectedPlayers(state);
      const cleanName = String(name || '').trim();

      const existingByName = state.players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
      if (existingByName && existingByName.connected === false) {
        gameEngine.reconnectPlayer(state, socket.id, cleanName);
        socket.join(code);
        socket.data.roomCode = code;
        socket.data.playerName = cleanName;
        if (typeof ack === 'function') ack({ ok: true, roomCode: code, playerId: socket.id, reconnected: true });
        broadcastState(code);
        console.log(`[~] ${cleanName} se reconectó a ${code}`);
        return;
      }

      if (state.status !== gameEngine.STATES.WAITING_PLAYERS &&
          state.status !== gameEngine.STATES.READY) {
        throw new Error('La partida ya está en curso');
      }
      const replaced = gameEngine.replaceDisconnectedPlayer(state, socket.id, cleanName);
      if (!replaced) gameEngine.addPlayer(state, socket.id, cleanName);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerName = cleanName;
      if (typeof ack === 'function') {
        ack({ ok: true, roomCode: code, playerId: socket.id, replaced: !!replaced });
      }
      broadcastState(code);
      console.log(`[+] ${cleanName} se unió a ${code}${replaced ? ' reemplazando asiento desconectado' : ''}`);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
      sendError(socket, err.message);
    }
  });

  // Reconexión automática desde el mismo navegador/sesión
  socket.on('reconnectRoom', ({ roomCode, name }, ack) => {
    try {
      const code = (roomCode || '').toUpperCase().trim();
      const state = roomManager.getRoom(code);
      if (!state) throw new Error('Sala no encontrada');
      const player = gameEngine.reconnectPlayer(state, socket.id, name);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerName = player.name;
      if (typeof ack === 'function') ack({ ok: true, roomCode: code, playerId: socket.id, reconnected: true });
      broadcastState(code);
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
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


  // Recoger cartas no levantadas sin consumir turno normal
  socket.on('claimMissedCapture', ({ roomCode }, ack) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) throw new Error('Sala no encontrada');
      const result = gameEngine.claimMissedCapture(state, socket.id);
      if (typeof ack === 'function') ack({ ok: true, result });
      broadcastState(roomCode);

      if (state.status === gameEngine.STATES.GAME_FINISHED) {
        io.to(roomCode).emit('endGame', { winner: state.winner, teams: state.teams });
      } else if (state.status === gameEngine.STATES.HAND_FINISHED) {
        io.to(roomCode).emit('endHand', {
          handNumber: state.handNumber,
          teams: { A: { score: state.teams.A.score }, B: { score: state.teams.B.score } },
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


  // Salir de sala de manera explícita: libera asiento y limpia sesión del cliente.
  socket.on('leaveRoom', ({ roomCode }, ack) => {
    try {
      const code = (roomCode || socket.data.roomCode || '').toUpperCase().trim();
      const state = roomManager.getRoom(code);
      if (!state) {
        if (typeof ack === 'function') ack({ ok: true });
        return;
      }
      gameEngine.leavePlayer(state, socket.id);
      socket.leave(code);
      socket.data.roomCode = null;
      socket.data.playerName = null;
      if (state.players.length === 0 || state.status === gameEngine.STATES.GAME_FINISHED) {
        if (state.players.length === 0) roomManager.deleteRoom(code);
      }
      if (typeof ack === 'function') ack({ ok: true });
      broadcastState(code);
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

setInterval(() => {
  let expired = 0;
  for (const state of roomManager.getAllRooms()) expired += gameEngine.expireDisconnectedPlayers(state);
  const removed = roomManager.cleanupInactiveRooms();
  if (expired > 0) console.log(`[cleanup] Asientos desconectados liberados: ${expired}`);
  if (removed > 0) console.log(`[cleanup] Salas inactivas eliminadas: ${removed}`);
}, 5 * 60 * 1000).unref();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 40 Online Ecuador corriendo en http://localhost:${PORT}`);
});
