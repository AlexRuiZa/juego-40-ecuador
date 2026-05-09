// QA v10 — Don Evaristo visual + tones actuales, sin TTS sintético
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('V1001 imagen Don Evaristo está incluida como asset público', () => {
  assert.ok(fs.existsSync(path.join(root, 'public', 'don-evaristo.jpg')));
});
test('V1002 HTML muestra Don Evaristo como juecito de aguas', () => {
  assert.ok(html.includes('don-evaristo.jpg'));
  assert.ok(html.includes('Don Evaristo Corral y Chancleta'));
});
test('V1003 se mantiene canelazo/licor simbólico en el juez', () => {
  assert.ok(html.includes('🃏 🥃'));
});
test('V1004 botón indica sonidos, no voz clonada', () => {
  assert.ok(html.includes('Sonidos del juecito'));
  assert.ok(!html.includes('Voz del juecito'));
});
test('V1005 app no usa SpeechSynthesisUtterance ni speechSynthesis', () => {
  assert.ok(!app.includes('SpeechSynthesisUtterance'));
  assert.ok(!app.includes('speechSynthesis'));
});
test('V1006 app usa AudioContext y playTonePattern para tones actuales', () => {
  assert.ok(app.includes('AudioContext'));
  assert.ok(app.includes('playTonePattern'));
  assert.ok(app.includes('tonePatterns'));
});
test('V1007 app conserva queue visual y prioridad de partida finalizada', () => {
  assert.ok(app.includes('processVisualQueue'));
  assert.ok(app.includes('pendingEndGameState'));
  assert.ok(app.includes('showEndGameNow'));
});
test('V1008 popups siguen usando Don Evaristo en títulos importantes', () => {
  assert.ok(app.includes('Don Evaristo, juecito de aguas'));
  assert.ok(app.includes('Don Evaristo anuncia'));
});
test('V1009 CSS conserva responsive mobile para imagen del juez', () => {
  assert.ok(css.includes('@media (max-width: 640px)'));
  assert.ok(css.includes('.judge-avatar-img'));
});
test('V1010 package incluye script production v10', () => {
  assert.ok(pkg.scripts['test:production:v10']);
});

let passed = 0;
for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  try {
    t.fn();
    passed++;
    console.log(`✅ V10-${String(i + 1).padStart(2, '0')} ${t.name}`);
  } catch (err) {
    console.error(`❌ V10-${String(i + 1).padStart(2, '0')} ${t.name}`);
    console.error(err);
  }
}
console.log(`PRODUCTION V10 RESULT: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
