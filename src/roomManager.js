// src/roomManager.js
// Gestor de salas en memoria. Sin DB.
// Cada sala tiene un código de 4 letras y contiene un estado de juego.

const { createInitialState } = require('./gameEngine');

// Mapa: roomCode -> gameState
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin chars confusos (I, O, 0, 1)
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = generateRoomCode();
  const state = createInitialState(code);
  rooms.set(code, state);
  return state;
}

function getRoom(code) {
  const state = rooms.get(code) || null;
  if (state) state.lastActivityAt = Date.now();
  return state;
}

function cleanupInactiveRooms({ emptyTtlMs = 10 * 60 * 1000, waitingTtlMs = 2 * 60 * 60 * 1000 } = {}) {
  const now = Date.now();
  let removed = 0;
  for (const [code, state] of rooms.entries()) {
    const activePlayers = state.players.filter(p => p.connected !== false).length;
    const idleMs = now - (state.lastActivityAt || state.createdAt || now);
    const isWaiting = state.status === 'WAITING_PLAYERS' || state.status === 'READY';
    if ((activePlayers === 0 && idleMs > emptyTtlMs) || (isWaiting && idleMs > waitingTtlMs)) {
      rooms.delete(code);
      removed += 1;
    }
  }
  return removed;
}


function deleteRoom(code) {
  rooms.delete(code);
}

/**
 * Busca la sala donde participa un socketId. Útil para manejar desconexiones
 * sin tener que mantener un índice inverso adicional (las salas son pocas en MVP).
 */
function findRoomByPlayerId(playerId) {
  for (const state of rooms.values()) {
    if (state.players.some(p => p.id === playerId)) return state;
  }
  return null;
}

module.exports = {
  createRoom,
  getRoom,
  deleteRoom,
  findRoomByPlayerId,
  cleanupInactiveRooms,
};
