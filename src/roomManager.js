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
  return rooms.get(code) || null;
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
};
