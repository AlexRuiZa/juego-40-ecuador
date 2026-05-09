// QA v9 — Don Evaristo Corral y Chancleta integration
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('V901 incluye imagen pública de Don Evaristo', () => {
  assert.ok(fs.existsSync(path.join(root, 'public', 'don-evaristo.jpg')));
});
test('V902 HTML referencia imagen de Don Evaristo', () => {
  assert.ok(html.includes('don-evaristo.jpg'));
  assert.ok(html.includes('Don Evaristo Corral y Chancleta'));
});
test('V903 juez overlay usa clase de imagen real', () => {
  assert.ok(html.includes('judge-avatar-img'));
  assert.ok(css.includes('.judge-avatar-img'));
});
test('V904 existe botón para activar/desactivar sonidos del juecito', () => {
  assert.ok(html.includes('btn-audio-toggle'));
  assert.ok(app.includes('cuarentaAudioEnabled'));
  assert.ok(html.includes('Sonidos del juecito'));
});
test('V905 sistema de audio usa tones actuales, no TTS sintético', () => {
  assert.ok(app.includes('playTonePattern'));
  assert.ok(app.includes('AudioContext'));
  assert.ok(!app.includes('SpeechSynthesisUtterance'));
});
test('V906 app deja arquitectura preparada para mp3 reales futuros', () => {
  assert.ok(app.includes('mp3 reales autorizados'));
});
test('V907 popups de juez usan Don Evaristo en títulos importantes', () => {
  assert.ok(app.includes('Don Evaristo, juecito de aguas'));
  assert.ok(app.includes('Don Evaristo anuncia'));
});
test('V908 mantiene tone de victoria esperado por regresión v8', () => {
  assert.ok(app.includes('Partida finalizada. Felicitaciones al ganador.'));
});
test('V909 props visuales incluyen cartas y canelazo/licor simbólico', () => {
  assert.ok(html.includes('judge-props'));
  assert.ok(html.includes('🃏 🥃'));
});
test('V910 CSS mantiene responsive mobile para el juez', () => {
  assert.ok(css.includes('@media (max-width: 640px)'));
  assert.ok(css.includes('.judge-avatar-img'));
});

let passed = 0;
for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  try {
    t.fn();
    passed++;
    console.log(`✅ V9-${String(i + 1).padStart(2, '0')} ${t.name}`);
  } catch (err) {
    console.error(`❌ V9-${String(i + 1).padStart(2, '0')} ${t.name}`);
    console.error(err);
  }
}
console.log(`PRODUCTION V9 RESULT: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
