const assert = require('assert');
const fs = require('fs');
const engine = require('../src/gameEngine');

function card(rank, value, id){return {rank, value, suit:'picas', id:id||rank+Math.random()};}
function setup(n=2){const s=engine.createInitialState('V8T'); for(let i=0;i<n;i++) engine.addPlayer(s,'p'+i,'P'+i); engine.startGame(s,'p0'); s.players.forEach(p=>p.hand=[]); s.table=[]; s.deck=[]; s.currentTurn=0; s.log=[]; return s;}
const tests=[]; const t=(name,fn)=>tests.push([name,fn]);

t('V801 suma 4 con A+3 no obliga capturar 4 igual alternativo',()=>{const s=setup(2); s.players[0].hand=[card('4',4,'h4')]; s.players[1].hand=[card('A',1,'opp')]; s.table=[card('A',1,'ta'),card('3',3,'t3'),card('4',4,'t4'),card('6',6,'t6'),card('Q',9,'tq'),card('K',10,'tk')]; const r=engine.playCard(s,'p0',0,[0,1]); assert.equal(r.missedCapture,false); assert.equal(s.pendingMissedCapture,null); assert.deepEqual(s.table.map(c=>c.id),['t4','t6','tq','tk']);});

t('V802 suma 5 con 2+3 y escalera no obliga 5 igual alternativo',()=>{const s=setup(2); s.players[0].hand=[card('5',5,'h5')]; s.players[1].hand=[card('A',1,'opp')]; s.table=[card('5',5,'t5'),card('2',2,'t2'),card('3',3,'t3'),card('6',6,'t6'),card('7',7,'t7'),card('J',8,'tj'),card('Q',9,'tq'),card('K',10,'tk')]; const r=engine.playCard(s,'p0',0,[1,2,3,4,5,6,7]); assert.equal(r.missedCapture,false); assert.equal(s.pendingMissedCapture,null); assert.deepEqual(s.table.map(c=>c.id),['t5']);});

t('V803 captura parcial por igual J sí deja Q,K pendientes',()=>{const s=setup(2); s.players[0].hand=[card('J',8,'hj')]; s.table=[card('J',8,'tj'),card('Q',9,'tq'),card('K',10,'tk')]; engine.playCard(s,'p0',0,[0]); assert.ok(s.pendingMissedCapture); assert.deepEqual(s.pendingMissedCapture.cardLabels,['Q','K']);});

t('V804 no hay sumas con una sola carta: 4 en mesa no es suma para 4',()=>{assert.equal(engine.isValidCapture(card('4',4,'h'),[card('4',4,'t')]),true); const s=setup(2); s.players[0].hand=[card('4',4,'h4')]; s.table=[card('4',4,'t4')]; engine.playCard(s,'p0',0,[]); assert.ok(s.pendingMissedCapture);});

t('V805 gameEngine no expone valor de ronda en log público',()=>{const s=setup(2); s.players[0].hand=[card('Q',9,'q1'),card('Q',9,'q2'),card('Q',9,'q3'),card('A',1,'a'),card('2',2,'2')]; s.log=[]; engine.detectRondas(s); assert.ok(s.log.join(' ').includes('¡Ronda!')); assert.ok(!s.log.join(' ').includes('Q'));});

t('V806 frontend tiene cola visual para evitar superposición de popups',()=>{const app=fs.readFileSync('public/app.js','utf8'); assert.ok(app.includes('processVisualQueue')); assert.ok(app.includes('pendingEndGameState')); assert.ok(app.includes('showEndGameNow'));});

t('V807 frontend difiere final de partida hasta terminar cola visual',()=>{const app=fs.readFileSync('public/app.js','utf8'); assert.ok(app.includes('ui.pendingEndGameState = state')); assert.ok(app.includes('if (!ui.visualBusy && ui.visualQueue.length === 0) showEndGameNow(state)'));});

t('V808 pop-up de victoria tiene audio/tone sin superposición',()=>{const app=fs.readFileSync('public/app.js','utf8'); assert.ok(app.includes('Partida finalizada. Felicitaciones al ganador.')); assert.ok(app.includes('playTonePattern'));});

t('V809 botones de nueva partida y salir al inicio existen',()=>{const html=fs.readFileSync('public/index.html','utf8'); assert.ok(html.includes('btn-new-game')); assert.ok(html.includes('btn-exit-game'));});

t('V810 servidor mantiene healthcheck para Railway',()=>{const server=fs.readFileSync('src/server.js','utf8'); assert.ok(server.includes('/health'));});

let passed=0;
for (const [name,fn] of tests){try{fn(); passed++; console.log('✅ '+name);}catch(e){console.error('❌ '+name); console.error(e);}}
console.log(`PRODUCTION V8 RESULT: ${passed}/${tests.length} passed`);
if(passed!==tests.length) process.exit(1);
