// src/gameEngine.js
// Motor del juego "40 Online Ecuador".
// Servidor autoritativo: el cliente solo envía intenciones; este módulo valida reglas y muta estado.

const { createDeck, shuffle, dealCards } = require('./deck');

const STATES = {
  WAITING_PLAYERS: 'WAITING_PLAYERS',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  HAND_FINISHED: 'HAND_FINISHED',
  GAME_FINISHED: 'GAME_FINISHED',
};

const POINTS = {
  CAIDA: 2,
  LIMPIA: 2,
  RONDA: 2,
  CARTON_BASE_CARDS: 20,
  CARTON_BASE_POINTS: 6,
  CARTON_EXTRA_PER_PAIR: 2,
};

const WINNING_SCORE = 40;
const VALID_PLAYER_COUNTS = [2, 4];
const MAX_PLAYERS = 4;

function createInitialState(roomCode) {
  return {
    roomCode,
    status: STATES.WAITING_PLAYERS,
    hostId: null,
    gameMode: null, // '1v1' o '2v2'
    players: [],
    teams: {
      A: { score: 0, capturedCards: [] },
      B: { score: 0, capturedCards: [] },
    },
    deck: [],
    table: [],
    currentTurn: 0,
    lastCapturer: null,
    lastCardPlayed: null,
    lastPlayerToPlay: null,
    handNumber: 0,
    log: [],
    winner: null,
    winnerMessage: null,
    handSummary: null,
  };
}

function normalizeName(name) {
  return String(name || '').trim();
}

function addPlayer(state, playerId, name) {
  if (state.status !== STATES.WAITING_PLAYERS && state.status !== STATES.READY) {
    throw new Error('La partida ya está en curso');
  }
  if (state.players.length >= MAX_PLAYERS) throw new Error('La sala está llena');

  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Nombre inválido');
  if (state.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error('Ya existe un jugador con ese nombre');
  }

  const position = state.players.length;
  const teamId = position % 2 === 0 ? 'A' : 'B';
  if (!state.hostId) state.hostId = playerId;

  const player = {
    id: playerId,
    name: cleanName,
    teamId,
    hand: [],
    position,
    connected: true,
  };
  state.players.push(player);
  updateReadyStatus(state);
  return player;
}

function updateReadyStatus(state) {
  if (VALID_PLAYER_COUNTS.includes(state.players.length)) state.status = STATES.READY;
  else state.status = STATES.WAITING_PLAYERS;
}

function removePlayer(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;

  if (state.status === STATES.IN_PROGRESS || state.status === STATES.HAND_FINISHED) {
    player.connected = false;
    state.status = STATES.GAME_FINISHED;
    state.winner = null;
    state.winnerMessage = 'Partida finalizada por desconexión.';
    state.log.push('Un jugador se desconectó. Partida finalizada.');
    return;
  }

  state.players = state.players.filter(p => p.id !== playerId);
  if (state.hostId === playerId) state.hostId = state.players[0]?.id || null;
  state.players.forEach((p, i) => {
    p.position = i;
    p.teamId = i % 2 === 0 ? 'A' : 'B';
  });
  updateReadyStatus(state);
}

function startGame(state, requesterId) {
  if (state.status !== STATES.READY) {
    throw new Error('La partida solo puede iniciar cuando la sala está lista');
  }
  if (requesterId && requesterId !== state.hostId) {
    throw new Error('Solo el creador de la sala puede iniciar la partida');
  }
  if (!VALID_PLAYER_COUNTS.includes(state.players.length)) {
    throw new Error('La partida requiere 2 jugadores (1 vs 1) o 4 jugadores (2 vs 2)');
  }
  state.gameMode = state.players.length === 2 ? '1v1' : '2v2';
  resetScores(state);
  state.status = STATES.IN_PROGRESS;
  state.handNumber = 1;
  startNewHand(state, true);
}

function resetScores(state) {
  state.teams.A.score = 0;
  state.teams.B.score = 0;
  state.teams.A.capturedCards = [];
  state.teams.B.capturedCards = [];
  state.winner = null;
  state.winnerMessage = null;
  state.handSummary = null;
  state.log = [];
}

function startNewHand(state, chooseRandomTurn = false) {
  ensureGameNotFinished(state);
  state.deck = shuffle(createDeck());
  state.table = [];
  state.lastCapturer = null;
  state.lastCardPlayed = null;
  state.lastPlayerToPlay = null;
  state.handSummary = null;
  state.teams.A.capturedCards = [];
  state.teams.B.capturedCards = [];

  dealNextBatch(state);
  if (chooseRandomTurn) state.currentTurn = Math.floor(Math.random() * state.players.length);
  state.status = STATES.IN_PROGRESS;
}

function dealNextBatch(state) {
  for (const player of state.players) {
    player.hand = dealCards(state.deck, 5);
  }
  detectRondas(state);
  checkWinner(state, { source: 'ronda' });
}

function detectRondas(state) {
  for (const player of state.players) {
    const counts = {};
    for (const card of player.hand) counts[card.rank] = (counts[card.rank] || 0) + 1;
    for (const [rank, count] of Object.entries(counts)) {
      if (count >= 3) {
        addScore(state, player.teamId, POINTS.RONDA, 'ronda');
        state.log.push(`¡Ronda de ${rank}! +2 para ${teamLabel(state, player.teamId)} (${player.name})`);
      }
    }
  }
}

function addScore(state, teamId, points, source) {
  if (points <= 0) return 0;
  state.teams[teamId].score += points;
  return points;
}

function ensureGameNotFinished(state) {
  if (state.status === STATES.GAME_FINISHED) throw new Error('La partida ya finalizó');
}

function cardLabel(card) {
  return `${card.rank}`;
}

function teamLabel(state, teamId) {
  if (state.gameMode === '1v1') {
    const p = state.players.find(x => x.teamId === teamId);
    return p ? `${p.name} / Equipo ${teamId}` : `Equipo ${teamId}`;
  }
  return `Equipo ${teamId}`;
}

function getWinningPlayerNames(state, teamId) {
  return state.players.filter(p => p.teamId === teamId).map(p => p.name);
}

function buildWinnerMessage(state, winnerTeam) {
  if (!winnerTeam || winnerTeam === 'EMPATE') return 'Partida finalizada en empate.';
  const names = getWinningPlayerNames(state, winnerTeam);
  if (state.gameMode === '1v1') return `🏆 ¡${names[0]} gana la partida con ${state.teams[winnerTeam].score} puntos!`;
  return `🏆 ¡Gana el Equipo ${winnerTeam} (${names.join(' y ')}) con ${state.teams[winnerTeam].score} puntos!`;
}

function checkWinner(state) {
  if (state.teams.A.score >= WINNING_SCORE || state.teams.B.score >= WINNING_SCORE) {
    state.status = STATES.GAME_FINISHED;
    state.winner = state.teams.A.score > state.teams.B.score ? 'A'
      : state.teams.B.score > state.teams.A.score ? 'B'
      : 'EMPATE';
    state.winnerMessage = buildWinnerMessage(state, state.winner);
    state.log.push(state.winnerMessage);
    clearHandsAfterGame(state);
    return true;
  }
  return false;
}

function clearHandsAfterGame(state) {
  for (const p of state.players) p.hand = [];
  state.deck = [];
}

function isSequentialRunFromPlayed(playedCard, selectedCards) {
  if (!selectedCards.length) return false;
  const values = selectedCards.map(c => c.value).sort((a, b) => a - b);
  if (values[0] !== playedCard.value) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function isValidCapture(playedCard, selectedCards) {
  if (selectedCards.length === 0) return false;
  const target = playedCard.value;

  // 1) Carta(s) igual(es): el jugador levanta la carta equivalente a la que lanza.
  if (selectedCards.every(c => c.value === target)) return true;

  // 2) Suma simple: una o varias cartas suman el valor de la carta lanzada.
  if (selectedCards.reduce((s, c) => s + c.value, 0) === target) return true;

  // 3) Escalera simple: empieza en el valor de la carta lanzada y continúa hacia arriba.
  if (isSequentialRunFromPlayed(playedCard, selectedCards)) return true;

  // 4) Captura mixta tradicional: un grupo captura por igual/suma y el resto continúa
  //    la escalera hacia arriba. Ejemplo: jugar 7 y levantar A+6 (=7), J(8), Q(9).
  if (canCaptureWithBaseGroupThenRun(selectedCards, target)) return true;

  // 5) Capturas múltiples independientes: varios grupos, cada uno igual/suma/escalera.
  return canPartitionIntoValidGroups(selectedCards, target);
}

function canCaptureWithBaseGroupThenRun(cards, target) {
  if (cards.length < 2) return false;

  // Probamos cada subconjunto que pueda actuar como la captura base de la carta jugada:
  // - una carta igual al target, o
  // - varias cartas cuya suma sea target.
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const base = [];
    const rest = [];
    for (let i = 0; i < n; i++) {
      (mask & (1 << i) ? base : rest).push(cards[i]);
    }

    if (rest.length === 0) continue;
    const baseIsValid = base.length === 1
      ? base[0].value === target
      : base.reduce((sum, c) => sum + c.value, 0) === target;

    if (!baseIsValid) continue;
    if (isConsecutiveRunStartingAt(rest, target + 1)) return true;
  }
  return false;
}

function isConsecutiveRunStartingAt(cards, startValue) {
  if (!cards.length) return false;
  const values = cards.map(c => c.value).sort((a, b) => a - b);
  if (values[0] !== startValue) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function canPartitionIntoValidGroups(cards, target) {
  if (cards.length === 0) return true;
  const [first, ...rest] = cards;
  for (const combo of subsetsThatSumTo(rest, target - first.value)) {
    const used = new Set(combo);
    const group = [first, ...combo.map(i => rest[i])];
    const remaining = rest.filter((_, i) => !used.has(i));
    if ((group.reduce((s, c) => s + c.value, 0) === target || isSequentialRunValues(group, target)) &&
        canPartitionIntoValidGroups(remaining, target)) return true;
  }
  return false;
}

function isSequentialRunValues(cards, start) {
  const values = cards.map(c => c.value).sort((a, b) => a - b);
  if (values[0] !== start) return false;
  for (let i = 1; i < values.length; i++) if (values[i] !== values[i - 1] + 1) return false;
  return true;
}

function* subsetsThatSumTo(cards, target) {
  if (target < 0) return;
  if (target === 0) { yield []; return; }
  function* helper(start, remaining, acc) {
    if (remaining === 0) { yield [...acc]; return; }
    if (remaining < 0) return;
    for (let i = start; i < cards.length; i++) {
      acc.push(i);
      yield* helper(i + 1, remaining - cards[i].value, acc);
      acc.pop();
    }
  }
  yield* helper(0, target, []);
}

function getOpponentTeamForTurn(state, player) {
  const nextPlayer = state.players[(state.currentTurn + 1) % state.players.length];
  return nextPlayer?.teamId === player.teamId ? (player.teamId === 'A' ? 'B' : 'A') : nextPlayer?.teamId || (player.teamId === 'A' ? 'B' : 'A');
}

function findBestMissedCapture(playedCard, tableCards) {
  if (!tableCards.length) return [];
  const same = tableCards.filter(c => c.value === playedCard.value);
  if (same.length) {
    const run = buildRunFromPlayed(playedCard, tableCards);
    return run.length > same.length ? run : same;
  }
  const run = buildRunFromPlayed(playedCard, tableCards);
  if (run.length) return run;
  const sumCombo = findLargestSubsetSum(tableCards, playedCard.value);
  return sumCombo || [];
}

function buildRunFromPlayed(playedCard, tableCards) {
  const sorted = [...tableCards].sort((a, b) => a.value - b.value);
  const byValue = new Map();
  for (const c of sorted) if (!byValue.has(c.value)) byValue.set(c.value, c);
  if (!byValue.has(playedCard.value)) return [];
  const run = [];
  let v = playedCard.value;
  while (byValue.has(v)) {
    run.push(byValue.get(v));
    v += 1;
  }
  return run;
}

function findLargestSubsetSum(cards, target) {
  let best = null;
  function walk(index, acc, sum) {
    if (sum === target) {
      if (!best || acc.length > best.length) best = [...acc];
      return;
    }
    if (sum > target || index >= cards.length) return;
    acc.push(cards[index]);
    walk(index + 1, acc, sum + cards[index].value);
    acc.pop();
    walk(index + 1, acc, sum);
  }
  walk(0, [], 0);
  return best;
}

function playCard(state, playerId, handIndex, tableIndices = []) {
  ensureGameNotFinished(state);
  if (state.status !== STATES.IN_PROGRESS) throw new Error('La partida no está en curso');
  const player = state.players[state.currentTurn];
  if (!player || player.id !== playerId) throw new Error('No es tu turno');
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) throw new Error('Carta inválida');
  if (!Array.isArray(tableIndices)) throw new Error('Selección de mesa inválida');

  const tableSet = new Set(tableIndices);
  if (tableSet.size !== tableIndices.length) throw new Error('Selección de mesa inválida (duplicados)');
  for (const i of tableIndices) {
    if (!Number.isInteger(i) || i < 0 || i >= state.table.length) throw new Error('Índice de mesa inválido');
  }

  const playedCard = player.hand[handIndex];
  const selectedTableCards = tableIndices.map(i => state.table[i]);
  const result = {
    player: player.name,
    teamId: player.teamId,
    playedCard,
    captured: [],
    caida: false,
    limpia: false,
    missedCapture: false,
    penaltyCapturedBy: null,
    pointsEarned: 0,
  };

  if (selectedTableCards.length > 0) {
    if (!isValidCapture(playedCard, selectedTableCards)) throw new Error('Captura inválida');
    executeCapture(state, player, handIndex, tableIndices, selectedTableCards, playedCard, result);
    if (checkWinner(state)) return result;
  } else {
    const missed = findBestMissedCapture(playedCard, state.table);
    player.hand.splice(handIndex, 1);
    if (missed.length > 0) {
      const opponentTeam = getOpponentTeamForTurn(state, player);
      const missedIds = new Set(missed.map(c => c.id));
      const capturedFromTable = [];
      state.table = state.table.filter(c => {
        if (missedIds.has(c.id)) { capturedFromTable.push(c); return false; }
        return true;
      });
      state.teams[opponentTeam].capturedCards.push(playedCard, ...capturedFromTable);
      state.lastCapturer = opponentTeam;
      state.lastCardPlayed = null;
      state.lastPlayerToPlay = playerId;
      result.missedCapture = true;
      result.penaltyCapturedBy = opponentTeam;
      result.captured = [playedCard, ...capturedFromTable];
      state.log.push(`Carta no levantada: ${player.name} no capturó con ${cardLabel(playedCard)}. ${teamLabel(state, opponentTeam)} se lleva ${result.captured.length} cartas.`);
    } else {
      state.table.push(playedCard);
      state.lastCardPlayed = playedCard;
      state.lastPlayerToPlay = playerId;
    }
  }

  if (state.status !== STATES.GAME_FINISHED) finishTurnOrHand(state);
  return result;
}

function executeCapture(state, player, handIndex, tableIndices, selectedTableCards, playedCard, result) {
  const isCaida =
    state.lastCardPlayed &&
    state.lastPlayerToPlay !== player.id &&
    selectedTableCards.some(c => c.id === state.lastCardPlayed.id) &&
    playedCard.value === state.lastCardPlayed.value;

  player.hand.splice(handIndex, 1);
  [...tableIndices].sort((a, b) => b - a).forEach(i => state.table.splice(i, 1));
  const isLimpia = state.table.length === 0;
  const allCaptured = [playedCard, ...selectedTableCards];
  state.teams[player.teamId].capturedCards.push(...allCaptured);
  result.captured = allCaptured;

  if (isCaida) {
    addScore(state, player.teamId, POINTS.CAIDA, 'caida');
    result.caida = true;
    result.pointsEarned += POINTS.CAIDA;
    state.log.push(`¡Caída! +2 para ${teamLabel(state, player.teamId)} (${player.name})`);
  }
  if (isLimpia) {
    addScore(state, player.teamId, POINTS.LIMPIA, 'limpia');
    result.limpia = true;
    result.pointsEarned += POINTS.LIMPIA;
    state.log.push(`¡Limpia! +2 para ${teamLabel(state, player.teamId)} (${player.name})`);
  }

  state.lastCapturer = player.teamId;
  state.lastCardPlayed = null;
  state.lastPlayerToPlay = player.id;
}

function finishTurnOrHand(state) {
  if (state.status === STATES.GAME_FINISHED) return;
  const allHandsEmpty = state.players.every(p => p.hand.length === 0);
  if (allHandsEmpty) {
    if (state.deck.length > 0) {
      dealNextBatch(state);
      if (state.status === STATES.GAME_FINISHED) return;
    } else {
      finishHand(state);
      return;
    }
  }
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
}

function finishHand(state) {
  if (state.status === STATES.GAME_FINISHED) return;
  if (state.table.length > 0 && state.lastCapturer) {
    state.teams[state.lastCapturer].capturedCards.push(...state.table);
    state.log.push(`Cartas restantes en mesa van a ${teamLabel(state, state.lastCapturer)}`);
    state.table = [];
  }

  const beforeA = state.teams.A.score;
  const beforeB = state.teams.B.score;
  const cardsA = state.teams.A.capturedCards.length;
  const cardsB = state.teams.B.capturedCards.length;
  const cartonA = beforeA >= 38 ? 0 : calculateCarton(cardsA);
  const cartonB = beforeB >= 38 ? 0 : calculateCarton(cardsB);
  state.teams.A.score += cartonA;
  state.teams.B.score += cartonB;

  const blockedA = beforeA >= 38 && calculateCarton(cardsA) > 0;
  const blockedB = beforeB >= 38 && calculateCarton(cardsB) > 0;
  state.handSummary = {
    handNumber: state.handNumber,
    cards: { A: cardsA, B: cardsB },
    carton: { A: cartonA, B: cartonB },
    blockedBy38: { A: blockedA, B: blockedB },
    scores: { A: state.teams.A.score, B: state.teams.B.score },
  };
  let summary = `Fin de mano ${state.handNumber}. Cartón → Equipo A: ${cardsA} cartas (+${cartonA}) | Equipo B: ${cardsB} cartas (+${cartonB}). Marcador: A=${state.teams.A.score} | B=${state.teams.B.score}`;
  if (blockedA || blockedB) summary += ' Regla 38 aplicada: el cartón no cierra partida.';
  state.log.push(summary);

  if (checkWinner(state)) return;
  state.status = STATES.HAND_FINISHED;
}

function calculateCarton(cardCount) {
  if (cardCount < POINTS.CARTON_BASE_CARDS) return 0;
  const extra = cardCount - POINTS.CARTON_BASE_CARDS;
  return POINTS.CARTON_BASE_POINTS + Math.floor(extra / 2) * POINTS.CARTON_EXTRA_PER_PAIR;
}

function continueToNextHand(state, requesterId) {
  ensureGameNotFinished(state);
  if (requesterId && !state.players.some(p => p.id === requesterId)) {
    throw new Error('No perteneces a esta sala');
  }
  if (state.status !== STATES.HAND_FINISHED) throw new Error('Solo se puede continuar al terminar una mano');
  state.handNumber += 1;
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
  startNewHand(state, false);
}

function getPublicState(state, viewerId) {
  return {
    roomCode: state.roomCode,
    status: state.status,
    hostId: state.hostId,
    isHost: viewerId === state.hostId,
    gameMode: state.players.length === 2 ? '1v1' : state.players.length === 4 ? '2v2' : state.gameMode,
    handNumber: state.handNumber,
    deckCount: state.deck.length,
    table: state.table,
    currentTurn: state.currentTurn,
    currentPlayerId: state.status === STATES.GAME_FINISHED ? null : state.players[state.currentTurn]?.id || null,
    teams: {
      A: { score: state.teams.A.score, capturedCount: state.teams.A.capturedCards.length },
      B: { score: state.teams.B.score, capturedCount: state.teams.B.capturedCards.length },
    },
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      handCount: p.hand.length,
      hand: p.id === viewerId ? p.hand : null,
      position: p.position,
      connected: p.connected !== false,
      isHost: p.id === state.hostId,
    })),
    log: state.log.slice(-15),
    winner: state.winner,
    winnerMessage: state.winnerMessage,
    handSummary: state.handSummary,
    lastCardPlayed: state.lastCardPlayed,
  };
}

module.exports = {
  STATES,
  POINTS,
  WINNING_SCORE,
  createInitialState,
  addPlayer,
  removePlayer,
  startGame,
  playCard,
  continueToNextHand,
  getPublicState,
  isValidCapture,
  isSequentialRunFromPlayed,
  findBestMissedCapture,
  calculateCarton,
  finishHand,
  checkWinner,
  detectRondas,
  dealNextBatch,
};
