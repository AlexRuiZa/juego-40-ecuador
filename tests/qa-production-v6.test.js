const assert = require('assert');
const engine = require('../src/gameEngine');
const roomManager = require('../src/roomManager');

let seq = 0;
function makeRoom(n = 4) {
  const s = engine.createInitialState(`P${seq++}`);
  for (let i = 0; i < n; i++) engine.addPlayer(s, `socket-${i}-${seq}`, `Jugador${i+1}`);
  return s;
}
const tests=[];
function test(name, fn){ tests.push({name, fn}); }

test('2v2 inicia con currentTurn asignado a jugador real', () => {
  const s = makeRoom(4);
  engine.startGame(s, s.hostId);
  assert.equal(s.status, engine.STATES.IN_PROGRESS);
  assert.ok(s.players[s.currentTurn]);
  assert.equal(s.players[s.currentTurn].id, s.players[0].id);
});

test('2v2 todos ven los mismos equipos desde servidor', () => {
  const s = makeRoom(4);
  engine.startGame(s, s.hostId);
  const expected = s.players.map(p => [p.name, p.teamId]);
  for (const p of s.players) {
    const view = engine.getPublicState(s, p.id);
    assert.deepEqual(view.players.map(x => [x.name, x.teamId]), expected);
  }
});

test('2v2 todos reciben un currentPlayerId visible', () => {
  const s = makeRoom(4);
  engine.startGame(s, s.hostId);
  for (const p of s.players) {
    const view = engine.getPublicState(s, p.id);
    assert.ok(view.currentPlayerId);
    assert.ok(view.players.some(x => x.id === view.currentPlayerId));
  }
});

test('desconexión no finaliza partida en progreso', () => {
  const s = makeRoom(2);
  engine.startGame(s, s.hostId);
  engine.removePlayer(s, s.players[1].id);
  assert.equal(s.status, engine.STATES.IN_PROGRESS);
  assert.equal(s.players[1].connected, false);
});

test('reconexión recupera mismo equipo y posición', () => {
  const s = makeRoom(4);
  engine.startGame(s, s.hostId);
  const old = s.players[2];
  const pos = old.position;
  const team = old.teamId;
  engine.removePlayer(s, old.id);
  const re = engine.reconnectPlayer(s, 'new-socket-p3', old.name);
  assert.equal(re.position, pos);
  assert.equal(re.teamId, team);
  assert.equal(re.connected, true);
  assert.equal(re.id, 'new-socket-p3');
});

test('reconexión de host conserva permisos de host', () => {
  const s = makeRoom(2);
  const hostName = s.players[0].name;
  const oldHost = s.hostId;
  engine.removePlayer(s, oldHost);
  engine.reconnectPlayer(s, 'host-new-socket', hostName);
  assert.equal(s.hostId, 'host-new-socket');
  assert.equal(engine.getPublicState(s, 'host-new-socket').isHost, true);
});

test('no permite suplantar jugador conectado', () => {
  const s = makeRoom(2);
  assert.throws(() => engine.reconnectPlayer(s, 'fake-socket', s.players[0].name), /ya está conectado/);
});

test('sala waiting con jugadores conectados no expira por cleanup', () => {
  const r = roomManager.createRoom();
  engine.addPlayer(r, `live-${Date.now()}`, 'Vivo');
  r.lastActivityAt = Date.now() - 999999999;
  roomManager.cleanupInactiveRooms({ emptyTtlMs: 999999999, waitingTtlMs: 1 });
  assert.ok(roomManager.getRoom(r.roomCode));
});

test('sala vacía offline sí se limpia', () => {
  const r = roomManager.createRoom();
  r.players = [];
  r.lastActivityAt = Date.now() - 999999999;
  const removed = roomManager.cleanupInactiveRooms({ emptyTtlMs: 1, waitingTtlMs: 1 });
  assert.ok(removed >= 1);
});

test('jugador desconectado queda visible en public state', () => {
  const s = makeRoom(2);
  engine.startGame(s, s.hostId);
  const id = s.players[1].id;
  engine.removePlayer(s, id);
  const view = engine.getPublicState(s, s.players[0].id);
  const p = view.players.find(x => x.name === 'Jugador2');
  assert.equal(p.connected, false);
});

(async () => {
  let passed=0;
  for (const [i,t] of tests.entries()) {
    try { await t.fn(); passed++; console.log(`✅ P${String(i+1).padStart(3,'0')} ${t.name}`); }
    catch(e) { console.error(`❌ P${String(i+1).padStart(3,'0')} ${t.name}`); console.error(e); process.exitCode=1; break; }
  }
  if (passed === tests.length) console.log(`PRODUCTION V6 RESULT: ${passed}/${tests.length} passed`);
})();
