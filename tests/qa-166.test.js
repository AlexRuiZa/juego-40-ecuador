const assert = require('assert');
const engine = require('../src/gameEngine');

let idSeq = 0;
const VALUES = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, J: 8, Q: 9, K: 10 };
const RANKS = Object.keys(VALUES);
function c(rank, suit = 'corazones') {
  return { id: `${rank}-${suit}-${++idSeq}`, rank, suit, value: VALUES[rank] };
}
function room(n = 2) {
  const s = engine.createInitialState(`T${++idSeq}`);
  for (let i = 0; i < n; i++) engine.addPlayer(s, `p${i + 1}`, `Jugador${i + 1}`);
  return s;
}
function setInProgress(s) { s.status = engine.STATES.IN_PROGRESS; s.gameMode = s.players.length === 2 ? '1v1' : '2v2'; }
function run(name, fn) {
  try { fn(); console.log(`✅ ${name}`); return true; }
  catch (e) { console.error(`❌ ${name}\n   ${e.stack}`); return false; }
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function assertThrowsMsg(fn, rx) { assert.throws(fn, rx); }

// =====================================================
// BATERÍA 1 — Funcionamiento normal y reglas del juego
// =====================================================

test('001 estado inicial correcto', () => {
  const s = engine.createInitialState('ABC');
  assert.equal(s.status, engine.STATES.WAITING_PLAYERS);
  assert.equal(s.teams.A.score, 0);
  assert.equal(s.teams.B.score, 0);
  assert.equal(s.table.length, 0);
});

test('002 agrega primer jugador y lo define como host', () => {
  const s = engine.createInitialState('ABC');
  engine.addPlayer(s, 'p1', 'Alex');
  assert.equal(s.hostId, 'p1');
  assert.equal(s.players[0].teamId, 'A');
});

test('003 dos jugadores dejan sala READY', () => {
  const s = room(2);
  assert.equal(s.status, engine.STATES.READY);
});

test('004 cuatro jugadores dejan sala READY', () => {
  const s = room(4);
  assert.equal(s.status, engine.STATES.READY);
});

test('005 1v1 inicia con 2 jugadores', () => {
  const s = room(2); engine.startGame(s, 'p1');
  assert.equal(s.status, engine.STATES.IN_PROGRESS);
  assert.equal(s.gameMode, '1v1');
  assert.equal(s.players.length, 2);
});

test('006 2v2 inicia con 4 jugadores', () => {
  const s = room(4); engine.startGame(s, 'p1');
  assert.equal(s.status, engine.STATES.IN_PROGRESS);
  assert.equal(s.gameMode, '2v2');
  assert.equal(s.players.length, 4);
});

test('007 equipos 1v1 A/B', () => {
  const s = room(2);
  assert.deepEqual(s.players.map(p => p.teamId), ['A', 'B']);
});

test('008 equipos 2v2 A/B/A/B', () => {
  const s = room(4);
  assert.deepEqual(s.players.map(p => p.teamId), ['A', 'B', 'A', 'B']);
});

test('009 mesa inicia vacía al empezar', () => {
  const s = room(2); engine.startGame(s, 'p1');
  assert.equal(s.table.length, 0);
});

test('010 cada jugador recibe 5 cartas al iniciar', () => {
  const s = room(4); engine.startGame(s, 'p1');
  assert.ok(s.players.every(p => p.hand.length === 5));
});

test('011 queda mazo después de reparto 1v1', () => {
  const s = room(2); engine.startGame(s, 'p1');
  assert.equal(s.deck.length, 30);
});

test('012 queda mazo después de reparto 2v2', () => {
  const s = room(4); engine.startGame(s, 'p1');
  assert.equal(s.deck.length, 20);
});

test('013 captura por carta igual A', () => assert.equal(engine.isValidCapture(c('A'), [c('A')]), true));
test('014 captura por carta igual 7', () => assert.equal(engine.isValidCapture(c('7'), [c('7')]), true));
test('015 captura por carta igual K', () => assert.equal(engine.isValidCapture(c('K'), [c('K')]), true));
test('016 captura varias cartas iguales', () => assert.equal(engine.isValidCapture(c('5'), [c('5'), c('5', 'picas')]), true));

test('017 captura por suma A+6 con 7', () => assert.equal(engine.isValidCapture(c('7'), [c('A'), c('6')]), true));
test('018 captura por suma 2+3 con 5', () => assert.equal(engine.isValidCapture(c('5'), [c('2'), c('3')]), true));
test('019 captura por suma A+2+4 con 7', () => assert.equal(engine.isValidCapture(c('7'), [c('A'), c('2'), c('4')]), true));
test('020 captura por suma 4+6 con K', () => assert.equal(engine.isValidCapture(c('K'), [c('4'), c('6')]), true));

test('021 captura por escalera A-2-3-4', () => assert.equal(engine.isValidCapture(c('A'), [c('A'), c('2'), c('3'), c('4')]), true));
test('022 captura por escalera 2-3-4', () => assert.equal(engine.isValidCapture(c('2'), [c('2'), c('3'), c('4')]), true));
test('023 captura por escalera 5-6-7-J', () => assert.equal(engine.isValidCapture(c('5'), [c('5'), c('6'), c('7'), c('J')]), true));
test('024 captura por escalera 7-J-Q-K', () => assert.equal(engine.isValidCapture(c('7'), [c('7'), c('J'), c('Q'), c('K')]), true));

test('025 captura mixta 7: A+6,J,Q', () => assert.equal(engine.isValidCapture(c('7'), [c('A'), c('6'), c('J'), c('Q')]), true));
test('026 captura mixta 6: 2+4,7,J', () => assert.equal(engine.isValidCapture(c('6'), [c('2'), c('4'), c('7'), c('J')]), true));
test('027 captura mixta 5: A+4,6,7', () => assert.equal(engine.isValidCapture(c('5'), [c('A'), c('4'), c('6'), c('7')]), true));
test('028 captura mixta K: 4+6', () => assert.equal(engine.isValidCapture(c('K'), [c('4'), c('6')]), true));

test('029 jugar a mesa vacía deja carta en mesa', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('7')]; s.players[1].hand = [c('K')];
  const r = engine.playCard(s, 'p1', 0, []);
  assert.equal(r.missedCapture, false);
  assert.equal(s.table.length, 1);
  assert.equal(s.table[0].rank, '7');
});

test('030 captura real por igual retira carta de mesa', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('3')]; s.table = [c('3')];
  engine.playCard(s, 'p1', 0, [0]);
  assert.equal(s.table.length, 0);
  assert.equal(s.teams.A.capturedCards.length, 2);
});

test('031 captura real por suma retira cartas', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('7')]; s.table = [c('A'), c('6')];
  engine.playCard(s, 'p1', 0, [0,1]);
  assert.equal(s.table.length, 0);
  assert.equal(s.teams.A.capturedCards.length, 3);
});

test('032 captura real por escalera retira todas las seleccionadas', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('5')]; s.table = [c('5'), c('6'), c('7'), c('J')];
  engine.playCard(s, 'p1', 0, [0,1,2,3]);
  assert.equal(s.table.length, 0);
  assert.equal(s.teams.A.capturedCards.length, 5);
});

test('033 captura real mixta 7 con A+6,J,Q', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('7')]; s.table = [c('A'), c('6'), c('J'), c('Q')];
  engine.playCard(s, 'p1', 0, [0,1,2,3]);
  assert.equal(s.table.length, 0);
  assert.equal(s.teams.A.capturedCards.length, 5);
});

test('034 captura parcial deja carta no seleccionada', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('6')]; s.players[1].hand = [c('K')]; s.table = [c('2'), c('4'), c('7')];
  engine.playCard(s, 'p1', 0, [0,1]);
  assert.equal(s.table.length, 1);
  assert.equal(s.table[0].rank, '7');
});

test('035 limpia suma 2', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('A')]; s.table = [c('A')];
  engine.playCard(s, 'p1', 0, [0]);
  assert.equal(s.teams.A.score, 2);
  assert.ok(s.log.some(x => x.includes('Limpia')));
});

test('036 caída suma 2 sin limpia cuando quedan cartas', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('5')]; const five = c('5'); s.table = [five, c('A')]; s.lastCardPlayed = five; s.lastPlayerToPlay = 'p2';
  const r = engine.playCard(s, 'p1', 0, [0]);
  assert.equal(r.caida, true);
  assert.equal(r.limpia, false);
  assert.equal(s.teams.A.score, 2);
});

test('037 caída + limpia suma 4', () => {
  const s = room(2); setInProgress(s); s.currentTurn = 0; s.players[0].hand = [c('5')]; const five = c('5'); s.table = [five]; s.lastCardPlayed = five; s.lastPlayerToPlay = 'p2';
  const r = engine.playCard(s, 'p1', 0, [0]);
  assert.equal(r.caida, true); assert.equal(r.limpia, true); assert.equal(s.teams.A.score, 4);
});

test('038 ronda Q detectada', () => {
  const s = room(2); setInProgress(s); s.players[0].hand = [c('Q'), c('Q','p'), c('Q','t'), c('2'), c('3')];
  engine.detectRondas(s);
  assert.equal(s.teams.A.score, 2);
});

test('039 ronda A detectada', () => {
  const s = room(2); setInProgress(s); s.players[1].hand = [c('A'), c('A','p'), c('A','t'), c('2'), c('3')];
  engine.detectRondas(s);
  assert.equal(s.teams.B.score, 2);
});

test('040 ronda no suma si no hay tres iguales', () => {
  const s = room(2); setInProgress(s); s.players[0].hand = [c('Q'), c('Q','p'), c('J'), c('2'), c('3')];
  engine.detectRondas(s);
  assert.equal(s.teams.A.score, 0);
});

test('041 dealNextBatch detecta ronda en reparto posterior', () => {
  const s = room(2); setInProgress(s); s.deck = [c('Q'), c('Q','p'), c('Q','t'), c('2'), c('3'), c('A'), c('2'), c('3'), c('4'), c('5')];
  engine.dealNextBatch(s);
  assert.equal(s.teams.A.score, 2);
});

test('042 fin de mano con 20 cartas da 6 puntos', () => {
  const s = room(2); setInProgress(s); s.teams.A.capturedCards = Array.from({length:20}, (_,i)=>c('A',`a${i}`)); s.deck=[]; s.table=[];
  engine.finishHand(s);
  assert.equal(s.teams.A.score, 6);
});

test('043 cartón 22 cartas da 8 puntos', () => assert.equal(engine.calculateCarton(22), 8));
test('044 cartón 24 cartas da 10 puntos', () => assert.equal(engine.calculateCarton(24), 10));
test('045 cartón 26 cartas da 12 puntos', () => assert.equal(engine.calculateCarton(26), 12));
test('046 cartón 19 cartas da 0 puntos', () => assert.equal(engine.calculateCarton(19), 0));

test('047 fin de mano asigna mesa restante al último capturador A', () => {
  const s = room(2); setInProgress(s); s.lastCapturer='A'; s.table=[c('A'),c('2')]; s.deck=[]; s.players.forEach(p=>p.hand=[]);
  engine.finishHand(s);
  assert.equal(s.table.length, 0); assert.equal(s.teams.A.capturedCards.length, 2);
});

test('048 fin de mano asigna mesa restante al último capturador B', () => {
  const s = room(2); setInProgress(s); s.lastCapturer='B'; s.table=[c('A'),c('2'),c('3')]; s.deck=[]; s.players.forEach(p=>p.hand=[]);
  engine.finishHand(s);
  assert.equal(s.table.length, 0); assert.equal(s.teams.B.capturedCards.length, 3);
});

test('049 fin de mano genera handSummary', () => {
  const s = room(2); setInProgress(s); s.teams.A.capturedCards = Array.from({length:20}, (_,i)=>c('A',`a${i}`)); s.deck=[]; s.table=[];
  engine.finishHand(s);
  assert.ok(s.handSummary); assert.equal(s.handSummary.carton.A, 6);
});

test('050 continuar mano desde jugador invitado', () => {
  const s = room(2); setInProgress(s); s.status = engine.STATES.HAND_FINISHED; s.handNumber=1;
  engine.continueToNextHand(s, 'p2');
  assert.equal(s.status, engine.STATES.IN_PROGRESS); assert.equal(s.handNumber, 2);
});

test('051 continuar mano desde host', () => {
  const s = room(2); setInProgress(s); s.status = engine.STATES.HAND_FINISHED; s.handNumber=1;
  engine.continueToNextHand(s, 'p1');
  assert.equal(s.status, engine.STATES.IN_PROGRESS); assert.equal(s.handNumber, 2);
});

test('052 victoria inmediata al llegar a 40 por limpia', () => {
  const s = room(2); setInProgress(s); s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('A')]; s.table=[c('A')];
  engine.playCard(s,'p1',0,[0]);
  assert.equal(s.status, engine.STATES.GAME_FINISHED); assert.equal(s.winner,'A');
});

test('053 victoria 2v2 muestra equipo y jugadores', () => {
  const s = room(4); setInProgress(s); s.gameMode='2v2'; s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('A')]; s.table=[c('A')];
  engine.playCard(s,'p1',0,[0]);
  assert.match(s.winnerMessage, /Equipo A/); assert.match(s.winnerMessage, /Jugador1/); assert.match(s.winnerMessage, /Jugador3/);
});

test('054 regla 38 bloquea victoria por cartón', () => {
  const s = room(2); setInProgress(s); s.teams.A.score=38; s.teams.A.capturedCards=Array.from({length:22},(_,i)=>c('A',`a${i}`)); s.deck=[]; s.table=[];
  engine.finishHand(s);
  assert.equal(s.teams.A.score, 38); assert.notEqual(s.status, engine.STATES.GAME_FINISHED);
});

test('055 equipo con 37 sí puede superar 40 por cartón', () => {
  const s = room(2); setInProgress(s); s.teams.A.score=37; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); s.deck=[]; s.table=[];
  engine.finishHand(s);
  assert.equal(s.status, engine.STATES.GAME_FINISHED); assert.equal(s.winner,'A');
});

test('056 score 38 puede ganar por caída', () => {
  const s = room(2); setInProgress(s); s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('5')]; const five=c('5'); s.table=[five,c('A')]; s.lastCardPlayed=five; s.lastPlayerToPlay='p2';
  engine.playCard(s,'p1',0,[0]);
  assert.equal(s.status, engine.STATES.GAME_FINISHED);
});

test('057 score 38 puede ganar por limpia', () => {
  const s = room(2); setInProgress(s); s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('4')]; s.table=[c('4')];
  engine.playCard(s,'p1',0,[0]);
  assert.equal(s.status, engine.STATES.GAME_FINISHED);
});

test('058 checkWinner empate si ambos >=40 igualados', () => {
  const s = room(2); setInProgress(s); s.teams.A.score=40; s.teams.B.score=40;
  engine.checkWinner(s);
  assert.equal(s.winner,'EMPATE');
});

test('059 vista pública revela solo mano propia', () => {
  const s = room(2); setInProgress(s); s.players[0].hand=[c('A')]; s.players[1].hand=[c('K')];
  const v=engine.getPublicState(s,'p1');
  assert.ok(v.players.find(p=>p.id==='p1').hand); assert.equal(v.players.find(p=>p.id==='p2').hand,null);
});

test('060 estado público marca host', () => {
  const s = room(2); const v=engine.getPublicState(s,'p1');
  assert.equal(v.isHost, true); assert.equal(v.players.find(p=>p.id==='p1').isHost, true);
});

test('061 gameMode público 1v1 con 2 jugadores', () => {
  const s = room(2); const v=engine.getPublicState(s,'p1'); assert.equal(v.gameMode,'1v1');
});

test('062 gameMode público 2v2 con 4 jugadores', () => {
  const s = room(4); const v=engine.getPublicState(s,'p1'); assert.equal(v.gameMode,'2v2');
});

test('063 log público queda limitado a 15 eventos', () => {
  const s = room(2); setInProgress(s); for(let i=0;i<30;i++) s.log.push(`e${i}`);
  const v=engine.getPublicState(s,'p1'); assert.equal(v.log.length,15); assert.equal(v.log[0],'e15');
});

test('064 removePlayer antes de partida reasigna host', () => {
  const s = room(2); engine.removePlayer(s,'p1'); assert.equal(s.hostId,'p2'); assert.equal(s.players.length,1);
});

test('065 removePlayer durante partida finaliza por desconexión', () => {
  const s=room(2); setInProgress(s); engine.removePlayer(s,'p2'); assert.equal(s.status, engine.STATES.GAME_FINISHED); assert.match(s.winnerMessage,/desconexión/);
});

test('066 carta no levantada penaliza rival con carta igual omitida', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('2')]; s.table=[c('2')];
  const r=engine.playCard(s,'p1',0,[]); assert.equal(r.missedCapture,true); assert.equal(r.penaltyCapturedBy,'B'); assert.equal(s.teams.B.capturedCards.length,2);
});

test('067 carta no levantada por escalera omitida penaliza rival', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('5')]; s.table=[c('5'),c('6')];
  const r=engine.playCard(s,'p1',0,[]); assert.equal(r.missedCapture,true); assert.equal(s.teams.B.capturedCards.length,3);
});

test('068 carta no levantada por suma omitida penaliza rival', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('7')]; s.table=[c('A'),c('6')];
  const r=engine.playCard(s,'p1',0,[]); assert.equal(r.missedCapture,true); assert.equal(s.teams.B.capturedCards.length,3);
});

test('069 después de jugada válida pasa turno', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.players[1].hand=[c('K')]; s.table=[];
  engine.playCard(s,'p1',0,[]); assert.equal(s.currentTurn,1);
});

test('070 después de captura válida pasa turno si no gana', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.players[1].hand=[c('K')]; s.table=[c('A'),c('2')];
  engine.playCard(s,'p1',0,[0]); assert.equal(s.currentTurn,1);
});

// =====================================================
// BATERÍA 2 — Errores, manipulación, inputs no lógicos
// =====================================================

test('071 rechaza nombre vacío', () => { const s=engine.createInitialState('X'); assertThrowsMsg(()=>engine.addPlayer(s,'p1','   '),/Nombre inválido/); });
test('072 rechaza nombre duplicado case-insensitive', () => { const s=engine.createInitialState('X'); engine.addPlayer(s,'p1','Alex'); assertThrowsMsg(()=>engine.addPlayer(s,'p2','alex'),/Ya existe/); });
test('073 rechaza quinto jugador', () => { const s=room(4); assertThrowsMsg(()=>engine.addPlayer(s,'p5','Jugador5'),/llena/); });
test('074 rechaza agregar jugador con partida en curso', () => { const s=room(2); setInProgress(s); assertThrowsMsg(()=>engine.addPlayer(s,'p3','X'),/en curso/); });
test('075 rechaza iniciar con 1 jugador', () => { const s=room(1); assertThrowsMsg(()=>engine.startGame(s,'p1'),/requiere 2 jugadores|sala está lista/); });
test('076 rechaza iniciar con 3 jugadores', () => { const s=room(3); assertThrowsMsg(()=>engine.startGame(s,'p1'),/requiere 2 jugadores|sala está lista/); });
test('077 rechaza inicio por invitado', () => { const s=room(2); assertThrowsMsg(()=>engine.startGame(s,'p2'),/Solo el creador/); });
test('078 rechaza jugada fuera de turno', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[1].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p2',0,[]),/No es tu turno/); });
test('079 rechaza índice hand negativo', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',-1,[]),/Carta inválida/); });
test('080 rechaza índice hand fuera de rango', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',1,[]),/Carta inválida/); });
test('081 rechaza índice hand no entero', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0.5,[]),/Carta inválida/); });
test('082 rechaza tableIndices no array', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,'x'),/Selección de mesa inválida/); });
test('083 rechaza mesa duplicada', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[0,0]),/duplicados/); });
test('084 rechaza índice mesa negativo', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[-1]),/Índice de mesa inválido/); });
test('085 rechaza índice mesa fuera de rango', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[2]),/Índice de mesa inválido/); });
test('086 rechaza índice mesa no entero', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[0.2]),/Índice de mesa inválido/); });
test('087 rechaza captura inválida 3 contra 5', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('3')]; s.table=[c('5')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[0]),/Captura inválida/); });
test('088 rechaza escalera que no inicia en jugada', () => assert.equal(engine.isValidCapture(c('A'),[c('2'),c('3')]), false));
test('089 rechaza suma mayor que carta jugada', () => assert.equal(engine.isValidCapture(c('5'),[c('2'),c('4')]), false));
test('090 rechaza selección vacía como captura', () => assert.equal(engine.isValidCapture(c('5'),[]), false));
test('091 bloquea jugar si status WAITING', () => { const s=room(1); s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[]),/no está en curso/); });
test('092 bloquea jugar si HAND_FINISHED', () => { const s=room(2); setInProgress(s); s.status=engine.STATES.HAND_FINISHED; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[]),/no está en curso/); });
test('093 bloquea jugar si GAME_FINISHED', () => { const s=room(2); setInProgress(s); s.status=engine.STATES.GAME_FINISHED; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[]),/ya finalizó/); });
test('094 bloquea continuar si no es HAND_FINISHED', () => { const s=room(2); setInProgress(s); assertThrowsMsg(()=>engine.continueToNextHand(s,'p1'),/Solo se puede continuar/); });
test('095 bloquea continuar por usuario fuera de sala', () => { const s=room(2); setInProgress(s); s.status=engine.STATES.HAND_FINISHED; assertThrowsMsg(()=>engine.continueToNextHand(s,'px'),/No perteneces/); });
test('096 bloquea continuar si ya finalizó', () => { const s=room(2); s.status=engine.STATES.GAME_FINISHED; assertThrowsMsg(()=>engine.continueToNextHand(s,'p1'),/ya finalizó/); });
test('097 no permite startGame si ya finalizada por desconexión y 2 players', () => { const s=room(2); setInProgress(s); engine.removePlayer(s,'p2'); assertThrowsMsg(()=>engine.startGame(s,'p1'),/en curso|finalizó|Solo|requiere|sala está lista/); });
test('098 removePlayer inexistente no altera jugadores', () => { const s=room(2); engine.removePlayer(s,'px'); assert.equal(s.players.length,2); });
test('099 no captura automáticamente carta no seleccionada si hizo captura parcial válida', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('6')]; s.players[1].hand=[c('K')]; s.table=[c('2'),c('4'),c('7')]; engine.playCard(s,'p1',0,[0,1]); assert.equal(s.table.length,1); });
test('100 selección mixta inválida con hueco de escalera', () => assert.equal(engine.isValidCapture(c('7'),[c('A'),c('6'),c('Q')]), false));
test('101 selección mixta inválida con resto no secuencial', () => assert.equal(engine.isValidCapture(c('6'),[c('2'),c('4'),c('J')]), false));
test('102 escalera con duplicados no válida', () => assert.equal(engine.isValidCapture(c('5'),[c('5'),c('6'),c('6')]), false));
test('103 captura combinada no permite usar cartas repetidas por índice', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('5')]; s.table=[c('5'),c('6')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[0,1,1]),/duplicados/); });
test('104 no permite manipular mano ajena', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[1].hand=[c('K')]; assertThrowsMsg(()=>engine.playCard(s,'p2',0,[]),/No es tu turno/); });
test('105 no permite ganar por cartón si ya terminó por 40 antes de finishHand', () => { const s=room(2); setInProgress(s); s.teams.A.score=40; engine.checkWinner(s); assertThrowsMsg(()=>engine.continueToNextHand(s,'p1'),/ya finalizó/); });
test('106 selección de mesa vacía no penaliza si no hay captura posible', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('2')]; s.table=[c('5')]; const r=engine.playCard(s,'p1',0,[]); assert.equal(r.missedCapture,false); });
test('107 captura inválida no muta mesa', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('2')]; s.table=[c('5')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,[0]),/Captura inválida/); assert.equal(s.table.length,1); assert.equal(s.players[0].hand.length,1); });
test('108 intento con handIndex string se rechaza', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1','0',[]),/Carta inválida/); });
test('109 intento con tableIndex string se rechaza', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,['0']),/Índice de mesa inválido/); });
test('110 intento con tableIndices null se rechaza', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; assertThrowsMsg(()=>engine.playCard(s,'p1',0,null),/Selección de mesa inválida/); });
test('111 no revela winner antes de final', () => { const s=room(2); setInProgress(s); assert.equal(s.winner,null); assert.equal(s.winnerMessage,null); });
test('112 clear hands al ganar', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('A')]; s.players[1].hand=[c('K')]; s.table=[c('A')]; engine.playCard(s,'p1',0,[0]); assert.ok(s.players.every(p=>p.hand.length===0)); assert.equal(s.deck.length,0); });
test('113 no duplica cartón si finishHand se llama dos veces en GAME_FINISHED', () => { const s=room(2); setInProgress(s); s.teams.A.score=39; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); s.deck=[]; s.table=[]; engine.finishHand(s); const score=s.teams.A.score; engine.finishHand(s); assert.equal(s.teams.A.score,score); });
test('114 findBestMissedCapture prioriza iguales/run', () => { const played=c('5'); const best=engine.findBestMissedCapture(played,[c('5'),c('6'),c('A'),c('4')]); assert.ok(best.length>=2); });
test('115 findBestMissedCapture devuelve [] sin posibilidad', () => { const best=engine.findBestMissedCapture(c('2'),[c('5'),c('6')]); assert.equal(best.length,0); });
test('116 remove host en waiting reasigna posiciones', () => { const s=room(4); engine.removePlayer(s,'p1'); assert.deepEqual(s.players.map(p=>p.position),[0,1,2]); assert.deepEqual(s.players.map(p=>p.teamId),['A','B','A']); });
test('117 sala con 3 luego de remove queda WAITING', () => { const s=room(4); engine.removePlayer(s,'p1'); assert.equal(s.status, engine.STATES.WAITING_PLAYERS); });
test('118 sala con 2 luego de remove desde 3 queda READY', () => { const s=room(3); engine.removePlayer(s,'p3'); assert.equal(s.status, engine.STATES.READY); });
test('119 nombre se normaliza con trim', () => { const s=engine.createInitialState('X'); const p=engine.addPlayer(s,'p1','  Alex  '); assert.equal(p.name,'Alex'); });
test('120 log de carta no levantada registra evento', () => { const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('2')]; s.table=[c('2')]; engine.playCard(s,'p1',0,[]); assert.ok(s.log.some(x=>x.includes('Carta no levantada'))); });

// =====================================================
// BATERÍA 3 — Extremos, regresión, secuencias largas
// =====================================================

test('121 secuencia completa 1v1: mano termina y pasa a HAND_FINISHED', () => {
  const s=room(2); setInProgress(s); s.deck=[]; s.currentTurn=0; s.players[0].hand=[c('A')]; s.players[1].hand=[]; s.table=[];
  engine.playCard(s,'p1',0,[]);
  assert.equal(s.status, engine.STATES.HAND_FINISHED);
});

test('122 secuencia completa 2v2: último jugador termina mano', () => {
  const s=room(4); setInProgress(s); s.deck=[]; s.currentTurn=3; s.players[3].hand=[c('A')]; s.players[0].hand=[]; s.players[1].hand=[]; s.players[2].hand=[]; s.table=[];
  engine.playCard(s,'p4',0,[]);
  assert.equal(s.status, engine.STATES.HAND_FINISHED);
});

test('123 cuando quedan cartas en deck reparte nueva tanda en vez de fin de mano', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.players[1].hand=[]; s.deck=[c('2'),c('3'),c('4'),c('5'),c('6'),c('7'),c('J'),c('Q'),c('K'),c('A','p')];
  engine.playCard(s,'p1',0,[]);
  assert.equal(s.status, engine.STATES.IN_PROGRESS); assert.equal(s.players[0].hand.length,5);
});

test('124 continueToNextHand incrementa mano y limpia handSummary', () => {
  const s=room(2); setInProgress(s); s.status=engine.STATES.HAND_FINISHED; s.handNumber=3; s.handSummary={x:1}; engine.continueToNextHand(s,'p1'); assert.equal(s.handNumber,4); assert.equal(s.handSummary,null);
});

test('125 nueva mano reinicia capturas pero conserva marcador', () => {
  const s=room(2); setInProgress(s); s.status=engine.STATES.HAND_FINISHED; s.handNumber=1; s.teams.A.score=10; s.teams.A.capturedCards=[c('A')]; engine.continueToNextHand(s,'p1'); assert.equal(s.teams.A.score,10); assert.equal(s.teams.A.capturedCards.length,0);
});

test('126 si ronda lleva a 40 termina partida', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=38; s.players[0].hand=[c('Q'),c('Q','p'),c('Q','t'),c('2'),c('3')]; engine.detectRondas(s); engine.checkWinner(s); assert.equal(s.status, engine.STATES.GAME_FINISHED);
});

test('127 multiple rondas de ambos equipos suman a cada uno', () => {
  const s=room(2); setInProgress(s); s.players[0].hand=[c('Q'),c('Q','p'),c('Q','t'),c('2'),c('3')]; s.players[1].hand=[c('A'),c('A','p'),c('A','t'),c('4'),c('5')]; engine.detectRondas(s); assert.equal(s.teams.A.score,2); assert.equal(s.teams.B.score,2);
});

test('128 ronda con cuatro iguales suma una vez por rank', () => {
  const s=room(2); setInProgress(s); s.players[0].hand=[c('Q'),c('Q','p'),c('Q','t'),c('Q','d'),c('3')]; engine.detectRondas(s); assert.equal(s.teams.A.score,2);
});

test('129 mano final con ambos carton y A gana', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=34; s.teams.B.score=30; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); s.teams.B.capturedCards=Array.from({length:18},(_,i)=>c('2',`b${i}`)); engine.finishHand(s); assert.equal(s.status,engine.STATES.GAME_FINISHED); assert.equal(s.winner,'A');
});

test('130 mano final con B gana por cartón', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=30; s.teams.B.score=34; s.teams.A.capturedCards=Array.from({length:18},(_,i)=>c('A',`a${i}`)); s.teams.B.capturedCards=Array.from({length:20},(_,i)=>c('2',`b${i}`)); engine.finishHand(s); assert.equal(s.status,engine.STATES.GAME_FINISHED); assert.equal(s.winner,'B');
});

test('131 si ambos superan 40 por cartón gana mayor puntaje', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=35; s.teams.B.score=36; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); s.teams.B.capturedCards=Array.from({length:22},(_,i)=>c('2',`b${i}`)); engine.finishHand(s); assert.equal(s.winner,'B');
});

test('132 si ambos empatan >=40 winner EMPATE', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=34; s.teams.B.score=34; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); s.teams.B.capturedCards=Array.from({length:20},(_,i)=>c('2',`b${i}`)); engine.finishHand(s); assert.equal(s.winner,'EMPATE');
});

test('133 38 puntos de A bloquea cartón pero B sí puede sumar', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=38; s.teams.B.score=10; s.teams.A.capturedCards=Array.from({length:22},(_,i)=>c('A',`a${i}`)); s.teams.B.capturedCards=Array.from({length:20},(_,i)=>c('2',`b${i}`)); engine.finishHand(s); assert.equal(s.teams.A.score,38); assert.equal(s.teams.B.score,16);
});

test('134 captura mixta con base igual y continuación de escalera', () => assert.equal(engine.isValidCapture(c('5'),[c('5'),c('6'),c('7')]), true));
test('135 captura mixta con base suma y continuación hasta K', () => assert.equal(engine.isValidCapture(c('7'),[c('3'),c('4'),c('J'),c('Q'),c('K')]), true));
test('136 captura mixta con base A+2+4 y J,Q', () => assert.equal(engine.isValidCapture(c('7'),[c('A'),c('2'),c('4'),c('J'),c('Q')]), true));
test('137 captura mixta orden desordenado funciona', () => assert.equal(engine.isValidCapture(c('7'),[c('Q'),c('A'),c('J'),c('6')]), true));
test('138 escalera simple orden desordenado funciona', () => assert.equal(engine.isValidCapture(c('5'),[c('7'),c('5'),c('6')]), true));
test('139 suma simple orden desordenado funciona', () => assert.equal(engine.isValidCapture(c('7'),[c('4'),c('A'),c('2')]), true));
test('140 múltiples grupos independientes válidos', () => assert.equal(engine.isValidCapture(c('5'),[c('2'),c('3'),c('A'),c('4')]), true));

test('141 play real captura múltiples grupos 5: 2+3 y A+4', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('5')]; s.table=[c('2'),c('3'),c('A'),c('4')]; engine.playCard(s,'p1',0,[0,1,2,3]); assert.equal(s.table.length,0); assert.equal(s.teams.A.capturedCards.length,5);
});

test('142 play real captura mixta desordenada por índices', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('7')]; s.table=[c('Q'),c('A'),c('J'),c('6')]; engine.playCard(s,'p1',0,[0,1,2,3]); assert.equal(s.table.length,0);
});

test('143 al capturar no deja lastCardPlayed', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[c('A')]; engine.playCard(s,'p1',0,[0]); assert.equal(s.lastCardPlayed,null);
});

test('144 al jugar sin captura setea lastCardPlayed', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('A')]; s.table=[]; engine.playCard(s,'p1',0,[]); assert.ok(s.lastCardPlayed); assert.equal(s.lastCardPlayed.rank,'A');
});

test('145 caída no ocurre contra propia última carta', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('5')]; const five=c('5'); s.table=[five,c('A')]; s.lastCardPlayed=five; s.lastPlayerToPlay='p1'; const r=engine.playCard(s,'p1',0,[0]); assert.equal(r.caida,false);
});

test('146 caída requiere mismo valor', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('6')]; const five=c('5'); s.table=[five,c('A')]; s.lastCardPlayed=five; s.lastPlayerToPlay='p2'; const r=engine.playCard(s,'p1',0,[0,1]); assert.equal(r.caida,false);
});

test('147 limpia ocurre en captura mixta total', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('7')]; s.table=[c('A'),c('6'),c('J'),c('Q')]; const r=engine.playCard(s,'p1',0,[0,1,2,3]); assert.equal(r.limpia,true); assert.equal(s.teams.A.score,2);
});

test('148 no limpia si queda carta no seleccionada', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('6')]; s.players[1].hand=[c('K')]; s.table=[c('2'),c('4'),c('7')]; const r=engine.playCard(s,'p1',0,[0,1]); assert.equal(r.limpia,false); assert.equal(s.teams.A.score,0);
});

test('149 carta no levantada en 2v2 penaliza siguiente equipo', () => {
  const s=room(4); setInProgress(s); s.currentTurn=0; s.players[0].hand=[c('2')]; s.table=[c('2')]; const r=engine.playCard(s,'p1',0,[]); assert.equal(r.penaltyCapturedBy,'B');
});

test('150 carta no levantada de jugador B penaliza equipo A', () => {
  const s=room(2); setInProgress(s); s.currentTurn=1; s.players[1].hand=[c('2')]; s.table=[c('2')]; const r=engine.playCard(s,'p2',0,[]); assert.equal(r.penaltyCapturedBy,'A');
});

test('151 startGame resetea scores anteriores', () => {
  const s=room(2); s.teams.A.score=10; engine.startGame(s,'p1'); assert.equal(s.teams.A.score,0);
});

test('152 startGame limpia winner previo', () => {
  const s=room(2); s.winner='A'; s.winnerMessage='x'; engine.startGame(s,'p1'); assert.equal(s.winner,null); assert.equal(s.winnerMessage,null);
});

test('153 getPublicState final no tiene currentPlayerId', () => {
  const s=room(2); setInProgress(s); s.status=engine.STATES.GAME_FINISHED; const v=engine.getPublicState(s,'p1'); assert.equal(v.currentPlayerId,null);
});

test('154 getPublicState incluye handSummary', () => {
  const s=room(2); setInProgress(s); s.handSummary={x:1}; const v=engine.getPublicState(s,'p1'); assert.deepEqual(v.handSummary,{x:1});
});

test('155 finishHand sin lastCapturer deja mesa pero resume sin crash', () => {
  const s=room(2); setInProgress(s); s.table=[c('A')]; s.deck=[]; engine.finishHand(s); assert.ok(s.handSummary);
});

test('156 calculateCarton ignora impar adicional', () => { assert.equal(engine.calculateCarton(21),6); assert.equal(engine.calculateCarton(23),8); });

test('157 calculateCarton 40 cartas', () => { assert.equal(engine.calculateCarton(40),26); });

test('158 long log after winner includes winner message', () => {
  const s=room(2); setInProgress(s); s.currentTurn=0; s.teams.A.score=38; s.players[0].hand=[c('A')]; s.table=[c('A')]; engine.playCard(s,'p1',0,[0]); assert.ok(s.log.some(x=>x.includes('gana') || x.includes('Gana')));
});

test('159 disconnected player flag false after remove during game', () => {
  const s=room(2); setInProgress(s); engine.removePlayer(s,'p2'); assert.equal(s.players.find(p=>p.id==='p2').connected,false);
});

test('160 hand summary reports blockedBy38 flags', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=38; s.teams.A.capturedCards=Array.from({length:20},(_,i)=>c('A',`a${i}`)); engine.finishHand(s); assert.equal(s.handSummary.blockedBy38.A,true);
});

test('161 continueToNextHand rotates currentTurn', () => {
  const s=room(2); setInProgress(s); s.status=engine.STATES.HAND_FINISHED; s.currentTurn=0; s.handNumber=1; engine.continueToNextHand(s,'p1'); assert.equal(s.currentTurn,1);
});

test('162 play after last card with no deck and no captures reaches HAND_FINISHED not IN_PROGRESS', () => {
  const s=room(2); setInProgress(s); s.deck=[]; s.currentTurn=0; s.players[0].hand=[c('A')]; s.players[1].hand=[]; engine.playCard(s,'p1',0,[]); assert.equal(s.status,engine.STATES.HAND_FINISHED);
});

test('163 all selected cards must be valid even if subset would be valid', () => {
  assert.equal(engine.isValidCapture(c('7'),[c('A'),c('6'),c('K')]), false);
});

test('164 mixed base may be equal card and run J-Q after 7', () => {
  assert.equal(engine.isValidCapture(c('7'),[c('7'),c('J'),c('Q')]), true);
});

test('165 2v2 current turn cycles through 4 players', () => {
  const s=room(4); setInProgress(s); s.currentTurn=2; s.players[0].hand=[c('K')]; s.players[1].hand=[c('K')]; s.players[2].hand=[c('A')]; s.players[3].hand=[c('K')]; s.table=[]; engine.playCard(s,'p3',0,[]); assert.equal(s.currentTurn,3);
});

test('166 public state score and capturedCount reflect teams', () => {
  const s=room(2); setInProgress(s); s.teams.A.score=12; s.teams.A.capturedCards=[c('A'),c('2')]; const v=engine.getPublicState(s,'p1'); assert.equal(v.teams.A.score,12); assert.equal(v.teams.A.capturedCount,2);
});

let passed = 0;
for (const [name, fn] of tests) if (run(name, fn)) passed++;
const failed = tests.length - passed;
console.log(`\nQA RESULT: ${passed}/${tests.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
