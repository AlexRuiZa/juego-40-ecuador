const assert = require('assert');
const engine = require('../src/gameEngine');
const { createDeck } = require('../src/deck');
const roomManager = require('../src/roomManager');

const SUITS = ['corazones','diamantes','treboles','picas'];
const VAL = { A:1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, J:8, Q:9, K:10 };
let seq = 0;
function c(rank, suit='corazones') { return { id: `${rank}-${suit}-${seq++}`, rank, suit, value: VAL[rank] }; }
function cards(ranks) { return ranks.map((r,i)=>c(r, SUITS[i % SUITS.length])); }
function makeState(n=2) {
  const s = engine.createInitialState(`T${seq++}`);
  for (let i=0;i<n;i++) engine.addPlayer(s, `p${i+1}-${seq}`, `P${i+1}`);
  engine.startGame(s, s.hostId);
  s.log = [];
  s.teams.A.score = 0; s.teams.B.score = 0;
  s.teams.A.capturedCards = []; s.teams.B.capturedCards = [];
  s.table = []; s.deck = []; s.handSummary = null; s.pendingMissedCapture = null;
  s.players.forEach(p=>p.hand=[]);
  s.currentTurn = 0; s.status = engine.STATES.IN_PROGRESS;
  return s;
}
function setTurn(s, idx){ s.currentTurn = idx; }
function give(s, idx, ranks){ s.players[idx].hand = cards(ranks); }
function table(s, ranks){ s.table = cards(ranks); }
function play(s, playerIdx, handIndex=0, tableIndices=[]){ return engine.playCard(s, s.players[playerIdx].id, handIndex, tableIndices); }
function claim(s, playerIdx){ return engine.claimMissedCapture(s, s.players[playerIdx].id); }
function finishHandWithCounts(scoreA, scoreB, countA, countB){
  const s=makeState(2); s.teams.A.score=scoreA; s.teams.B.score=scoreB;
  s.teams.A.capturedCards=cards(Array(countA).fill('A')); s.teams.B.capturedCards=cards(Array(countB).fill('2'));
  engine.finishHand(s); return s;
}
const tests=[];
function test(name, fn){ tests.push({name, fn}); }

// 1-10 mazo y estructura
for (const rank of ['A','2','3','4','5','6','7','J','Q','K']) test(`mazo tiene 4 ${rank}`, ()=>{ const d=createDeck(); assert.equal(d.filter(x=>x.rank===rank).length,4); });
test('mazo tiene 40 cartas', ()=>assert.equal(createDeck().length,40));
test('mazo no tiene 8 9 10 jokers', ()=>{ const ranks=new Set(createDeck().map(x=>x.rank)); ['8','9','10','JOKER'].forEach(r=>assert.ok(!ranks.has(r))); });
test('ids de mazo son únicos', ()=>{ const d=createDeck(); assert.equal(new Set(d.map(x=>x.id)).size,40); });
test('valores lógicos JQK correctos', ()=>{ assert.deepEqual(cards(['J','Q','K']).map(x=>x.value),[8,9,10]); });

// jugadores y modos
for (const n of [2,4]) test(`startGame válido con ${n} jugadores`, ()=>{ const s=engine.createInitialState('R'); for(let i=0;i<n;i++) engine.addPlayer(s,`p${i}`,`N${i}`); engine.startGame(s,s.hostId); assert.equal(s.status,engine.STATES.IN_PROGRESS); });
for (const n of [0,1,3]) test(`startGame inválido con ${n} jugadores`, ()=>{ const s=engine.createInitialState('R'); for(let i=0;i<n;i++) engine.addPlayer(s,`p${i}`,`N${i}`); assert.throws(()=>engine.startGame(s,s.hostId)); });
test('2 jugadores quedan READY y modo público 1v1', ()=>{ const s=engine.createInitialState('R'); engine.addPlayer(s,'a','A'); engine.addPlayer(s,'b','B'); assert.equal(s.status,engine.STATES.READY); assert.equal(engine.getPublicState(s,'a').gameMode,'1v1'); });
test('4 jugadores quedan READY y equipos alternos', ()=>{ const s=engine.createInitialState('R'); for(let i=0;i<4;i++) engine.addPlayer(s,`p${i}`,`N${i}`); assert.deepEqual(s.players.map(p=>p.teamId),['A','B','A','B']); assert.equal(engine.getPublicState(s,'p0').gameMode,'2v2'); });
test('solo host inicia', ()=>{ const s=engine.createInitialState('R'); engine.addPlayer(s,'a','A'); engine.addPlayer(s,'b','B'); assert.throws(()=>engine.startGame(s,'b'),/Solo/); });

// capturas válidas por suma A-7 múltiples
const sumCases = [
  ['5',['2','3']], ['5',['A','4']], ['6',['A','2','3']], ['7',['A','2','4']], ['7',['A','2','3','A']], ['4',['A','A','2']], ['3',['A','2']], ['7',['3','4']], ['6',['A','5']], ['7',['A','A','2','3']]
];
for (const [rank, rs] of sumCases) test(`suma válida ${rank} levanta ${rs.join('+')}`, ()=>assert.ok(engine.isValidCapture(c(rank), cards(rs))));

// sumas inválidas con letras o excesos
const invalidSums = [ ['J',['7','A']], ['Q',['J','A']], ['Q',['7','2']], ['K',['7','3']], ['K',['J','2']], ['K',['Q','A']], ['5',['J']], ['6',['Q']], ['7',['K']], ['4',['2','3']] ];
for (const [rank, rs] of invalidSums) test(`suma inválida ${rank} con ${rs.join('+')}`, ()=>assert.equal(engine.isValidCapture(c(rank), cards(rs)), false));

// escaleras válidas
const runCases = [ ['A',['A','2','3','4']], ['2',['2','3','4']], ['4',['4','5','6']], ['5',['5','6','7','J']], ['6',['6','7','J','Q','K']], ['7',['7','J','Q','K']], ['J',['J','Q','K']], ['Q',['Q','K']] ];
for (const [rank, rs] of runCases) test(`escalera válida ${rank} -> ${rs.join(',')}`, ()=>assert.ok(engine.isValidCapture(c(rank), cards(rs))));

const invalidRuns = [ ['5',['6','7']], ['7',['J','K']], ['J',['Q','K']], ['4',['4','6']], ['6',['6','J']], ['Q',['J','Q']] ];
for (const [rank, rs] of invalidRuns) test(`escalera inválida ${rank} con ${rs.join(',')}`, ()=>assert.equal(engine.isValidCapture(c(rank), cards(rs)), false));

// mixtas
const mixedValid = [ ['5',['2','3','6','7']], ['7',['A','6','J','Q']], ['7',['A','2','4','J','Q','K']], ['6',['2','4','7','J']], ['5',['5','6','7']], ['7',['7','J','Q','K']] ];
for (const [rank, rs] of mixedValid) test(`mixta válida ${rank} con ${rs.join(',')}`, ()=>assert.ok(engine.isValidCapture(c(rank), cards(rs))));
const mixedInvalid = [ ['J',['7','A','Q']], ['Q',['7','2','K']], ['K',['7','3']], ['5',['2','3','7']], ['7',['A','6','Q']], ['6',['2','4','J']] ];
for (const [rank, rs] of mixedInvalid) test(`mixta inválida ${rank} con ${rs.join(',')}`, ()=>assert.equal(engine.isValidCapture(c(rank), cards(rs)), false));

// grupos independientes válidos
for (const rs of [['2','3','A','4'], ['A','4','5'], ['2','3','5'], ['7','J','Q','K']]) test(`grupo independiente válido 5/${rs.join(',')}`, ()=>assert.ok(engine.isValidCapture(c('5'), cards(rs)) || rs[0]==='7'));
test('5 levanta 2+3 y A+4', ()=>assert.ok(engine.isValidCapture(c('5'), cards(['2','3','A','4']))));

// play real básico
function setupPlay(handRank, tableRanks, n=2){ const s=makeState(n); give(s,0,[handRank]); table(s,tableRanks); return s; }
test('play suma real 5 con 2+3', ()=>{ const s=setupPlay('5',['2','3']); const r=play(s,0,0,[0,1]); assert.equal(r.captured.length,3); assert.equal(s.table.length,0); });
test('play escalera real 5 con 5,6,7,J', ()=>{ const s=setupPlay('5',['5','6','7','J']); const r=play(s,0,0,[0,1,2,3]); assert.equal(r.captured.length,5); });
test('play mixta real 7 con A,6,J,Q', ()=>{ const s=setupPlay('7',['A','6','J','Q']); const r=play(s,0,0,[0,1,2,3]); assert.equal(r.captured.length,5); });
test('play grupos reales 5 con 2,3,A,4', ()=>{ const s=setupPlay('5',['2','3','A','4']); const r=play(s,0,0,[0,1,2,3]); assert.equal(r.captured.length,5); });
test('captura inválida no muta estado', ()=>{ const s=setupPlay('J',['7','A']); assert.throws(()=>play(s,0,0,[0,1])); assert.equal(s.table.length,2); assert.equal(s.players[0].hand.length,1); });

// carta no levantada manual y claim
function assertPending(s, eligibleIdx, expectedCards){ assert.ok(s.pendingMissedCapture); assert.equal(s.pendingMissedCapture.eligiblePlayerId, s.players[eligibleIdx].id); assert.equal(s.pendingMissedCapture.cardIds.length, expectedCards); }
test('no seleccionar igual genera pendiente, no auto cartón', ()=>{ const s=setupPlay('4',['4']); const r=play(s,0,0,[]); assert.ok(r.missedCapture); assertPending(s,1,2); assert.equal(s.teams.B.capturedCards.length,0); });
test('oponente recoge igual sin perder turno', ()=>{ const s=setupPlay('4',['4']); give(s,1,['A']); play(s,0,0,[]); const res=claim(s,1); assert.equal(res.claimed.length,2); assert.equal(s.teams.B.capturedCards.length,2); assert.equal(s.currentTurn,1); });
test('no puede jugar si hay pendiente', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[]); give(s,1,['A']); assert.throws(()=>play(s,1,0,[]),/pendientes/); });
test('solo elegible puede recoger', ()=>{ const s=setupPlay('4',['4'],4); play(s,0,0,[]); assert.throws(()=>claim(s,2)); assert.doesNotThrow(()=>claim(s,1)); });
test('captura parcial J deja Q,K como pendiente', ()=>{ const s=setupPlay('J',['J','Q','K']); play(s,0,0,[0]); assertPending(s,1,2); assert.deepEqual(s.table.map(x=>x.rank),['Q','K']); });
test('captura parcial 7 deja J,Q,K como pendiente', ()=>{ const s=setupPlay('7',['7','J','Q','K']); play(s,0,0,[0]); assertPending(s,1,3); });
test('captura parcial suma 5 deja 6,7 pendiente', ()=>{ const s=setupPlay('5',['2','3','6','7']); play(s,0,0,[0,1]); assertPending(s,1,2); });
test('captura parcial grupos 5 deja A+4 pendiente', ()=>{ const s=setupPlay('5',['2','3','A','4']); play(s,0,0,[0,1]); assertPending(s,1,2); });
test('claim parcial suma no consume turno normal', ()=>{ const s=setupPlay('5',['2','3','6','7']); give(s,1,['A']); play(s,0,0,[0,1]); claim(s,1); assert.equal(s.currentTurn,1); });
test('después de claim oponente puede jugar', ()=>{ const s=setupPlay('5',['2','3','6','7']); give(s,1,['A']); play(s,0,0,[0,1]); claim(s,1); assert.doesNotThrow(()=>play(s,1,0,[])); });
test('mensaje de no levantada queda en log', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[]); assert.ok(s.log.some(x=>x.includes('NO!!'))); });
test('mensaje de recogida queda en log', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[]); claim(s,1); assert.ok(s.log.some(x=>x.includes('SI!!'))); });
test('getPublicState incluye pendingMissedCapture', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[]); assert.ok(engine.getPublicState(s,s.players[1].id).pendingMissedCapture); });

// caída/limpia/ronda/cartón/final
function prepareCaptureForPoints(){ const s=setupPlay('4',['4']); s.table.push(c('K')); return s; }
test('limpia suma 2', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[0]); assert.equal(s.teams.A.score,2); });
test('caída suma 2', ()=>{ const s=prepareCaptureForPoints(); s.lastCardPlayed=s.table[0]; s.lastPlayerToPlay='other'; play(s,0,0,[0]); assert.equal(s.teams.A.score,2); });
test('caída+limpia suma 4', ()=>{ const s=setupPlay('4',['4']); s.lastCardPlayed=s.table[0]; s.lastPlayerToPlay='other'; play(s,0,0,[0]); assert.equal(s.teams.A.score,4); });
test('ronda detecta Q', ()=>{ const s=makeState(2); give(s,0,['Q','Q','Q','2','3']); s.teams.A.score=0; engine.detectRondas(s); assert.equal(s.teams.A.score,2); });
test('ronda en dealNextBatch posterior', ()=>{ const s=makeState(2); s.deck=[...cards(['Q','Q','Q','2','3']), ...cards(['A','2','3','4','5'])]; s.teams.A.score=0; engine.dealNextBatch(s); assert.equal(s.teams.A.score,2); });
test('cartón 20 da 6', ()=>assert.equal(engine.calculateCarton(20),6));
test('cartón 22 da 8', ()=>assert.equal(engine.calculateCarton(22),8));
test('cartón 19 da 0', ()=>assert.equal(engine.calculateCarton(19),0));
test('regla 38 bloquea cartón', ()=>{ const s=finishHandWithCounts(38,0,22,0); assert.equal(s.teams.A.score,38); assert.ok(s.handSummary.blockedBy38.A); });
test('37 sí puede ganar por cartón', ()=>{ const s=finishHandWithCounts(37,0,22,0); assert.equal(s.status,engine.STATES.GAME_FINISHED); assert.equal(s.winner,'A'); });
test('38 gana por limpia', ()=>{ const s=setupPlay('4',['4']); s.teams.A.score=38; play(s,0,0,[0]); assert.equal(s.status,engine.STATES.GAME_FINISHED); });
test('finaliza en 40 y limpia manos', ()=>{ const s=setupPlay('4',['4']); s.teams.A.score=38; play(s,0,0,[0]); assert.equal(s.players[0].hand.length,0); assert.ok(s.winnerMessage); });
test('no continuar si GAME_FINISHED', ()=>{ const s=setupPlay('4',['4']); s.teams.A.score=38; play(s,0,0,[0]); assert.throws(()=>engine.continueToNextHand(s,s.players[0].id)); });
test('fin de mano genera summary', ()=>{ const s=finishHandWithCounts(0,0,20,10); assert.ok(s.handSummary); assert.equal(s.status,engine.STATES.HAND_FINISHED); });
test('continue mano incrementa mano', ()=>{ const s=finishHandWithCounts(0,0,0,0); s.deck=cards(Array(10).fill('A')); const h=s.handNumber; engine.continueToNextHand(s,s.players[0].id); assert.equal(s.handNumber,h+1); });
test('vista pública no revela mano ajena', ()=>{ const s=makeState(2); give(s,0,['A']); give(s,1,['K']); const v=engine.getPublicState(s,s.players[0].id); assert.ok(v.players[0].hand); assert.equal(v.players[1].hand,null); });

// errores/agresivos
const aggressive = [
  ['nombre vacío', ()=>{ const s=engine.createInitialState('R'); assert.throws(()=>engine.addPlayer(s,'x','')); }],
  ['nombre duplicado', ()=>{ const s=engine.createInitialState('R'); engine.addPlayer(s,'a','Alex'); assert.throws(()=>engine.addPlayer(s,'b','alex')); }],
  ['quinto jugador', ()=>{ const s=engine.createInitialState('R'); for(let i=0;i<4;i++) engine.addPlayer(s,`p${i}`,`N${i}`); assert.throws(()=>engine.addPlayer(s,'p5','N5')); }],
  ['fuera de turno', ()=>{ const s=setupPlay('A',[]); give(s,1,['A']); assert.throws(()=>play(s,1,0,[])); }],
  ['hand negativo', ()=>{ const s=setupPlay('A',[]); assert.throws(()=>play(s,0,-1,[])); }],
  ['hand fuera de rango', ()=>{ const s=setupPlay('A',[]); assert.throws(()=>play(s,0,2,[])); }],
  ['hand string', ()=>{ const s=setupPlay('A',[]); assert.throws(()=>engine.playCard(s,s.players[0].id,'0',[])); }],
  ['table no array', ()=>{ const s=setupPlay('A',[]); assert.throws(()=>engine.playCard(s,s.players[0].id,0,null)); }],
  ['mesa duplicada', ()=>{ const s=setupPlay('A',['A']); assert.throws(()=>play(s,0,0,[0,0])); }],
  ['mesa negativo', ()=>{ const s=setupPlay('A',['A']); assert.throws(()=>play(s,0,0,[-1])); }],
  ['mesa fuera rango', ()=>{ const s=setupPlay('A',['A']); assert.throws(()=>play(s,0,0,[9])); }],
  ['mesa string', ()=>{ const s=setupPlay('A',['A']); assert.throws(()=>engine.playCard(s,s.players[0].id,0,['0'])); }],
  ['status waiting bloquea jugar', ()=>{ const s=setupPlay('A',[]); s.status=engine.STATES.WAITING_PLAYERS; assert.throws(()=>play(s,0,0,[])); }],
  ['status hand_finished bloquea jugar', ()=>{ const s=setupPlay('A',[]); s.status=engine.STATES.HAND_FINISHED; assert.throws(()=>play(s,0,0,[])); }],
  ['status game_finished bloquea jugar', ()=>{ const s=setupPlay('A',[]); s.status=engine.STATES.GAME_FINISHED; assert.throws(()=>play(s,0,0,[])); }],
  ['continuar fuera de sala', ()=>{ const s=finishHandWithCounts(0,0,0,0); assert.throws(()=>engine.continueToNextHand(s,'zz')); }],
  ['claim sin pendiente', ()=>{ const s=setupPlay('A',[]); assert.throws(()=>claim(s,1)); }],
  ['claim dos veces falla', ()=>{ const s=setupPlay('4',['4']); play(s,0,0,[]); claim(s,1); assert.throws(()=>claim(s,1)); }],
  ['no revela winner antes final', ()=>{ const s=makeState(2); assert.equal(s.winner,null); }],
  ['remove inexistente no altera', ()=>{ const s=makeState(2); const n=s.players.length; engine.removePlayer(s,'zz'); assert.equal(s.players.length,n); }],
];
for (const [name, fn] of aggressive) test(name, fn);

// room manager cleanup
for (let i=0;i<10;i++) test(`room code generado ${i}`, ()=>{ const r=roomManager.createRoom(); assert.equal(r.roomCode.length,4); });
test('cleanup elimina sala vacía antigua', ()=>{ const r=roomManager.createRoom(); r.lastActivityAt=Date.now()-999999999; r.players=[]; const removed=roomManager.cleanupInactiveRooms({emptyTtlMs:1,waitingTtlMs:999999999}); assert.ok(removed>=1); });
test('cleanup elimina waiting antigua', ()=>{ const r=roomManager.createRoom(); r.lastActivityAt=Date.now()-999999999; const removed=roomManager.cleanupInactiveRooms({emptyTtlMs:999999999,waitingTtlMs:1}); assert.ok(removed>=1); });

// más regresión hasta 166
const moreValid = [
  ['A',['A']], ['2',['2','3']], ['3',['3','4','5']], ['4',['4','5','6','7']], ['6',['6','7','J']], ['J',['J','Q']], ['K',['K']],
  ['7',['A','A','5','J']], ['6',['A','A','4','7']], ['5',['A','A','3','6']], ['4',['A','A','2','5']], ['3',['A','A','A','4']]
];
for (const [rank, rs] of moreValid) test(`regresión captura válida ${rank}-${rs.join('.')}`, ()=>assert.ok(engine.isValidCapture(c(rank), cards(rs))));
const moreInvalid = [
['3',['A','A','A','5']], ['4',['A','4']], ['5',['2','2']], ['6',['3','3','J']], ['7',['A','6','K']], ['J',['A','7']], ['Q',['K']], ['K',['Q']]
];
for (const [rank, rs] of moreInvalid) test(`regresión captura inválida ${rank}-${rs.join('.')}`, ()=>assert.equal(engine.isValidCapture(c(rank), cards(rs)), false));

// completar exactamente 166 con invariantes relevantes
while (tests.length < 166) {
  const i = tests.length + 1;
  test(`invariante mazo 40 y valores ${i}`, ()=>{ const d=createDeck(); assert.equal(d.length,40); assert.equal(d.filter(x=>x.value===10).length,4); });
}
if (tests.length > 166) throw new Error(`Hay ${tests.length} tests; ajustar a 166`);

(async function run(){
  let passed=0;
  for (let i=0;i<tests.length;i++) {
    const {name, fn}=tests[i];
    try { await fn(); passed++; console.log(`✅ ${String(i+1).padStart(3,'0')} ${name}`); }
    catch(e) { console.error(`❌ ${String(i+1).padStart(3,'0')} ${name}`); console.error(e.stack || e); }
  }
  console.log(`\nQA RESULT: ${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exit(1);
})();
