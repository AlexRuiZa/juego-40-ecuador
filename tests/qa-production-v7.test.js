const assert = require('assert');
const engine = require('../src/gameEngine');
const rm = require('../src/roomManager');

function card(rank, value, id){return {rank, value, suit:'picas', id:id||rank+Math.random()}}
function setup(n=2){const s=engine.createInitialState('TST'); for(let i=0;i<n;i++) engine.addPlayer(s,'p'+i,'P'+i); engine.startGame(s,'p0'); s.players.forEach(p=>p.hand=[]); s.table=[]; s.deck=[]; s.currentTurn=0; return s;}
const tests=[]; const t=(name,fn)=>tests.push([name,fn]);

t('V701 ronda pública no expone valor en log',()=>{const s=setup(2); s.log=[]; s.players[0].hand=[card('Q',9,'q1'),card('Q',9,'q2'),card('Q',9,'q3'),card('A',1,'a1'),card('2',2,'2')]; engine.detectRondas(s); assert.ok(s.log.some(x=>x.includes('¡Ronda!'))); assert.ok(!s.log.join(' ').includes('Ronda de Q'));});

t('V702 falsa carta no levantada: suma+escalera no obliga carta igual alternativa',()=>{const s=setup(2); s.players[0].hand=[card('5',5,'h5'), card('A',1,'extra')]; s.table=[card('5',5,'t5'),card('3',3,'t3'),card('2',2,'t2'),card('6',6,'t6'),card('7',7,'t7'),card('J',8,'tj'),card('Q',9,'tq'),card('K',10,'tk')]; engine.playCard(s,'p0',0,[1,2,3,4,5,6,7]); assert.equal(s.pendingMissedCapture,null); assert.equal(s.table.length,1); assert.equal(s.table[0].id,'t5');});

t('V703 carta no levantada por escalera parcial J deja Q,K pendientes',()=>{const s=setup(2); s.players[0].hand=[card('J',8,'hj')]; s.table=[card('J',8,'tj'),card('Q',9,'tq'),card('K',10,'tk')]; engine.playCard(s,'p0',0,[0]); assert.ok(s.pendingMissedCapture); assert.deepEqual(s.pendingMissedCapture.cardLabels,['Q','K']);});

t('V704 reemplazo de asiento desconectado conserva equipo en sala waiting 1v1',()=>{const s=engine.createInitialState('R1'); engine.addPlayer(s,'host','Host'); engine.addPlayer(s,'old','Old'); engine.removePlayer(s,'old'); const p=engine.replaceDisconnectedPlayer(s,'new','New'); assert.ok(p); assert.equal(p.teamId,'B'); assert.equal(s.players.length,2);});

t('V705 salir voluntariamente en waiting libera asiento',()=>{const s=engine.createInitialState('R2'); engine.addPlayer(s,'h','H'); engine.addPlayer(s,'g','G'); assert.equal(s.status,engine.STATES.READY); engine.leavePlayer(s,'g'); assert.equal(s.players.length,1); assert.equal(s.status,engine.STATES.WAITING_PLAYERS);});

t('V706 salir en game finished permite sala sin reingreso obligado',()=>{const s=setup(2); s.teams.A.score=40; engine.checkWinner(s); assert.equal(s.status,engine.STATES.GAME_FINISHED); engine.leavePlayer(s,'p0'); assert.ok(s.players.length<=1);});

t('V707 expiración de desconectados en sala waiting libera slot',()=>{const s=engine.createInitialState('R3'); engine.addPlayer(s,'h','H'); engine.addPlayer(s,'g','G'); engine.removePlayer(s,'g'); s.players.find(p=>p.name==='G').disconnectedAt=Date.now()-120000; const n=engine.expireDisconnectedPlayers(s,90000); assert.equal(n,1); assert.equal(s.players.length,1);});

t('V708 zapatero se anuncia máximo una vez',()=>{const s=setup(2); s.log=[]; s.teams.A.score=11; s.teams.B.score=0; engine.checkWinner(s); // no-op
// trigger via score addition using limpia
s.players[0].hand=[card('2',2,'h2')]; s.table=[card('2',2,'t2')]; s.currentTurn=0; engine.playCard(s,'p0',0,[0]); const count=s.log.filter(x=>x.includes('zapatero')).length; assert.ok(count<=1);});

t('V709 currentTurn 2v2 siempre apunta a jugador existente',()=>{const s=engine.createInitialState('R4'); ['a','b','c','d'].forEach((id,i)=>engine.addPlayer(s,id,'P'+i)); engine.startGame(s,'a'); const view=engine.getPublicState(s,'a'); assert.ok(view.players.some(p=>p.id===view.currentPlayerId));});

t('V710 nueva captura mixta válida 5 con 2+3+6+7',()=>{assert.ok(engine.isValidCapture(card('5',5,'h'),[card('2',2,'a'),card('3',3,'b'),card('6',6,'c'),card('7',7,'d')]));});

let passed=0;
for (const [name,fn] of tests){try{fn(); passed++; console.log('✅ '+name);}catch(e){console.error('❌ '+name); console.error(e);}}
console.log(`PRODUCTION V7 RESULT: ${passed}/${tests.length} passed`);
if(passed!==tests.length) process.exit(1);
