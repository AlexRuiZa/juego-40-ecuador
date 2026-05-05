const assert = require('assert');
const engine = require('../src/gameEngine');

function c(rank, suit = 'corazones') {
  const v = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, J: 8, Q: 9, K: 10 }[rank];
  return { id: `${rank}-${suit}-${Math.random().toString(36).slice(2)}`, rank, suit, value: v };
}

function room(n = 2) {
  const s = engine.createInitialState('TEST');
  for (let i = 0; i < n; i++) engine.addPlayer(s, `p${i+1}`, `Jugador${i+1}`);
  return s;
}

function setInProgress(s) { s.status = engine.STATES.IN_PROGRESS; s.gameMode = s.players.length === 2 ? '1v1' : '2v2'; }

function run(name, fn) {
  try { fn(); console.log(`✅ ${name}`); return true; }
  catch (e) { console.error(`❌ ${name}\n   ${e.stack}`); return false; }
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// BATERÍA 1: lógica normal y reglas solicitadas
test('1v1: permite iniciar con 2 jugadores y asigna equipos A/B', () => {
  const s = room(2); engine.startGame(s, 'p1');
  assert.equal(s.status, engine.STATES.IN_PROGRESS); assert.equal(s.gameMode, '1v1');
  assert.equal(s.players[0].teamId, 'A'); assert.equal(s.players[1].teamId, 'B');
});

test('2v2: permite iniciar con 4 jugadores y asigna A/B/A/B', () => {
  const s = room(4); engine.startGame(s, 'p1');
  assert.equal(s.status, engine.STATES.IN_PROGRESS); assert.equal(s.gameMode, '2v2');
  assert.deepEqual(s.players.map(p => p.teamId), ['A', 'B', 'A', 'B']);
});

test('solo host puede iniciar la partida', () => {
  const s = room(2); assert.throws(() => engine.startGame(s, 'p2'), /Solo el creador/);
});

test('rechaza inicio con 1 jugador y con 3 jugadores', () => {
  let s = room(1); assert.throws(() => engine.startGame(s, 'p1'), /requiere 2 jugadores/);
  s = room(3); assert.throws(() => engine.startGame(s, 'p1'), /requiere 2 jugadores/);
});

test('captura por escalera A,2,3,4 iniciando con A es válida', () => {
  assert.equal(engine.isValidCapture(c('A'), [c('A'), c('2'), c('3'), c('4')]), true);
});

test('captura por escalera 4,5,6 iniciando con 4 es válida', () => {
  assert.equal(engine.isValidCapture(c('4'), [c('4'), c('5'), c('6')]), true);
});

test('captura por escalera que no inicia en carta jugada es inválida', () => {
  assert.equal(engine.isValidCapture(c('A'), [c('2'), c('3'), c('4')]), false);
});


test('captura mixta: 7 puede levantar A+6 y continuar J,Q', () => {
  assert.equal(engine.isValidCapture(c('7'), [c('A'), c('6'), c('J'), c('Q')]), true);
});

test('captura mixta real: 6 levanta 2+4 y 7 si el jugador selecciona todo', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0;
  s.players[0].hand = [c('6')]; s.players[1].hand = [c('K')];
  s.table = [c('2'), c('4'), c('7')];
  engine.playCard(s, 'p1', 0, [0,1,2]);
  assert.equal(s.table.length, 0);
  assert.equal(s.teams.A.capturedCards.length, 4);
});

test('captura parcial: 6 levanta solo 2+4 y deja 7 si no fue seleccionada', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0;
  s.players[0].hand = [c('6')]; s.players[1].hand = [c('K')];
  s.table = [c('2'), c('4'), c('7')];
  engine.playCard(s, 'p1', 0, [0,1]);
  assert.equal(s.table.length, 1);
  assert.equal(s.table[0].rank, '7');
  assert.equal(s.teams.A.capturedCards.length, 3);
});

test('escalera que limpia mesa otorga +2 limpia', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0;
  s.players[0].hand = [c('A')]; s.players[1].hand = [c('K')];
  s.table = [c('A'), c('2'), c('3'), c('4')];
  engine.playCard(s, 'p1', 0, [0,1,2,3]);
  assert.equal(s.table.length, 0); assert.equal(s.teams.A.score, 2);
});

test('ronda se detecta, suma +2 y queda registrada en log', () => {
  const s = room(2); setInProgress(s);
  s.players[0].hand = [c('Q'), c('Q','picas'), c('Q','treboles'), c('2'), c('3')];
  s.players[1].hand = [c('A'), c('2'), c('3'), c('4'), c('5')];
  engine.detectRondas(s);
  assert.equal(s.teams.A.score, 2);
  assert.ok(s.log.some(m => m.includes('Ronda de Q')));
});

test('ronda se detecta también en repartos posteriores dentro de la mano', () => {
  const s = room(2); setInProgress(s);
  s.deck = [
    c('Q'), c('Q','picas'), c('Q','treboles'), c('2'), c('3'),
    c('A'), c('2'), c('3'), c('4'), c('5')
  ];
  engine.dealNextBatch(s);
  assert.equal(s.teams.A.score, 2);
  assert.ok(s.log.some(m => m.includes('Ronda de Q')));
});

test('carta no levantada: si juega 2 sin seleccionar 2 de mesa, captura automática rival', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0;
  s.players[0].hand = [c('2')]; s.players[1].hand = [c('K')]; s.table = [c('2')];
  const r = engine.playCard(s, 'p1', 0, []);
  assert.equal(r.missedCapture, true); assert.equal(r.penaltyCapturedBy, 'B'); assert.equal(s.teams.B.capturedCards.length, 2); assert.equal(s.table.length, 0);
});

test('jugador/equipo gana inmediatamente al llegar a 40 por limpia', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.teams.A.score = 38;
  s.players[0].hand = [c('A')]; s.players[1].hand = [c('K')]; s.table = [c('A')];
  engine.playCard(s, 'p1', 0, [0]);
  assert.equal(s.status, engine.STATES.GAME_FINISHED); assert.equal(s.winner, 'A'); assert.match(s.winnerMessage, /Jugador1 gana/);
});

test('al finalizar partida se bloquean nuevas jugadas', () => {
  const s = room(2); setInProgress(s); s.status = engine.STATES.GAME_FINISHED;
  assert.throws(() => engine.playCard(s, 'p1', 0, []), /ya finalizó/);
});

test('regla 38: cartón no cierra partida desde 38', () => {
  const s = room(2); setInProgress(s); s.handNumber = 1; s.teams.A.score = 38; s.teams.B.score = 20;
  s.teams.A.capturedCards = Array.from({length: 22}, (_, i) => c('A', `x${i}`));
  s.teams.B.capturedCards = Array.from({length: 18}, (_, i) => c('2', `y${i}`));
  s.deck = []; s.table = [];
  engine.finishHand(s);
  assert.equal(s.teams.A.score, 38); assert.equal(s.status, engine.STATES.HAND_FINISHED); assert.equal(s.handSummary.blockedBy38.A, true);
});

test('fin de mano genera resumen de cartón y marcador', () => {
  const s = room(2); setInProgress(s); s.handNumber = 1;
  s.teams.A.capturedCards = Array.from({length: 20}, (_, i) => c('A', `a${i}`));
  s.teams.B.capturedCards = Array.from({length: 20}, (_, i) => c('2', `b${i}`));
  s.deck = []; s.table = [];
  engine.finishHand(s);
  assert.equal(s.handSummary.carton.A, 6); assert.equal(s.handSummary.carton.B, 6); assert.equal(s.teams.A.score, 6); assert.equal(s.status, engine.STATES.HAND_FINISHED);
});

// BATERÍA 2: errores, fraude y datos manipulados
test('bloquea nombres duplicados', () => {
  const s = engine.createInitialState('DUP'); engine.addPlayer(s, 'p1', 'Alex'); assert.throws(() => engine.addPlayer(s, 'p2', 'alex'), /Ya existe/);
});

test('bloquea quinto jugador', () => {
  const s = room(4); assert.throws(() => engine.addPlayer(s, 'p5', 'Jugador5'), /llena/);
});

test('bloquea jugada fuera de turno', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('A')]; s.players[1].hand = [c('2')];
  assert.throws(() => engine.playCard(s, 'p2', 0, []), /No es tu turno/);
});

test('bloquea índice de carta inexistente', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('A')];
  assert.throws(() => engine.playCard(s, 'p1', 9, []), /Carta inválida/);
});

test('bloquea índices duplicados de mesa', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('A')]; s.table = [c('A')];
  assert.throws(() => engine.playCard(s, 'p1', 0, [0,0]), /duplicados/);
});

test('bloquea índice de mesa inexistente', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('A')];
  assert.throws(() => engine.playCard(s, 'p1', 0, [9]), /Índice de mesa inválido/);
});

test('bloquea captura inválida manipulada', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('3')]; s.table = [c('5')];
  assert.throws(() => engine.playCard(s, 'p1', 0, [0]), /Captura inválida/);
});

test('permite continuar nueva mano a cualquier jugador de la sala', () => {
  const s = room(2); setInProgress(s); s.status = engine.STATES.HAND_FINISHED; s.handNumber = 1;
  engine.continueToNextHand(s, 'p2');
  assert.equal(s.status, engine.STATES.IN_PROGRESS);
  assert.equal(s.handNumber, 2);
});

test('bloquea continuar nueva mano si la partida ya finalizó', () => {
  const s = room(2); s.status = engine.STATES.GAME_FINISHED;
  assert.throws(() => engine.continueToNextHand(s, 'p1'), /ya finalizó/);
});

// BATERÍA 3: extremos y regresión multimodal
test('2v2: victoria indica equipo y jugadores', () => {
  const s = room(4); setInProgress(s); s.gameMode = '2v2'; s.currentTurn = 0; s.teams.A.score = 38;
  s.players[0].hand = [c('A')]; s.players[1].hand = [c('K')]; s.players[2].hand = [c('K')]; s.players[3].hand = [c('K')]; s.table = [c('A')];
  engine.playCard(s, 'p1', 0, [0]);
  assert.equal(s.status, engine.STATES.GAME_FINISHED); assert.match(s.winnerMessage, /Equipo A/); assert.match(s.winnerMessage, /Jugador1/); assert.match(s.winnerMessage, /Jugador3/);
});

test('caída + limpia suma 4 y puede ganar', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.teams.A.score = 36;
  s.players[0].hand = [c('5')]; s.players[1].hand = [c('K')]; const five = c('5'); s.table = [five]; s.lastCardPlayed = five; s.lastPlayerToPlay = 'p2';
  const r = engine.playCard(s, 'p1', 0, [0]);
  assert.equal(r.caida, true); assert.equal(r.limpia, true); assert.equal(s.teams.A.score, 40); assert.equal(s.status, engine.STATES.GAME_FINISHED);
});

test('mesa vacía: jugar sin captura deja carta en mesa sin penalización', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('7')]; s.table = [];
  const r = engine.playCard(s, 'p1', 0, []);
  assert.equal(r.missedCapture, false); assert.equal(s.table.length, 1);
});

test('fin de mano asigna mesa restante al último capturador', () => {
  const s = room(2); setInProgress(s); s.lastCapturer = 'B'; s.table = [c('A'), c('2')];
  s.teams.A.capturedCards = []; s.teams.B.capturedCards = []; s.deck = [];
  s.players.forEach(p => p.hand = []);
  engine.playCard = engine.playCard;
  engine.finishHand(s);
  assert.equal(s.table.length, 0); assert.equal(s.teams.B.capturedCards.length, 2);
});

test('calculateCarton base y pares adicionales', () => {
  assert.equal(engine.calculateCarton(19), 0); assert.equal(engine.calculateCarton(20), 6); assert.equal(engine.calculateCarton(22), 8); assert.equal(engine.calculateCarton(26), 12);
});

test('vista pública no revela mano ajena', () => {
  const s = room(2); setInProgress(s); s.players[0].hand = [c('A')]; s.players[1].hand = [c('K')];
  const view = engine.getPublicState(s, 'p1');
  assert.ok(view.players.find(p => p.id === 'p1').hand); assert.equal(view.players.find(p => p.id === 'p2').hand, null);
});

let passed = 0;
for (const [name, fn] of tests) if (run(name, fn)) passed++;
const failed = tests.length - passed;
console.log(`\nQA RESULT: ${passed}/${tests.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
