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
    pendingMissedCapture: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
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
  state.pendingMissedCapture = null;
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

function isNumericCaptureCard(card) {
  return card.value >= 1 && card.value <= 7;
}

function areNumericCards(cards) {
  return cards.every(isNumericCaptureCard);
}

function sortedValues(cards) {
  return cards.map(c => c.value).sort((a, b) => a - b);
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

function isSequentialValues(values, startValue) {
  if (!values.length) return false;
  if (values[0] !== startValue) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function isSequentialRunFromPlayed(playedCard, selectedCards) {
  const values = sortedValues(selectedCards);
  if (hasDuplicates(values)) return false;
  return isSequentialValues(values, playedCard.value);
}

function isValidSumGroup(playedCard, cards) {
  if (!cards.length) return false;
  if (!isNumericCaptureCard(playedCard)) return false;
  if (!areNumericCards(cards)) return false;
  return cards.reduce((sum, c) => sum + c.value, 0) === playedCard.value;
}

function isValidBaseGroup(playedCard, cards) {
  if (!cards.length) return false;
  if (cards.length === 1 && cards[0].value === playedCard.value) return true;
  return isValidSumGroup(playedCard, cards);
}

function isConsecutiveRunStartingAt(cards, startValue) {
  if (!cards.length) return false;
  const values = sortedValues(cards);
  if (hasDuplicates(values)) return false;
  return isSequentialValues(values, startValue);
}

function canCaptureWithBaseGroupThenRun(playedCard, cards) {
  if (cards.length < 2) return false;
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const base = [];
    const rest = [];
    for (let i = 0; i < n; i++) {
      (mask & (1 << i) ? base : rest).push(cards[i]);
    }
    if (!rest.length) continue;
    if (!isValidBaseGroup(playedCard, base)) continue;
    if (isConsecutiveRunStartingAt(rest, playedCard.value + 1)) return true;
  }
  return false;
}

function isValidIndependentGroup(playedCard, cards) {
  if (!cards.length) return false;
  if (cards.every(c => c.value === playedCard.value)) return true;
  if (isValidSumGroup(playedCard, cards)) return true;
  if (isSequentialRunFromPlayed(playedCard, cards)) return true;
  return false;
}

function canPartitionIntoValidGroups(playedCard, cards) {
  if (!cards.length) return true;

  // Tomamos la primera carta restante y probamos todos los grupos que la incluyen.
  const first = cards[0];
  const rest = cards.slice(1);
  const n = rest.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    const group = [first];
    const remaining = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) group.push(rest[i]);
      else remaining.push(rest[i]);
    }
    if (isValidIndependentGroup(playedCard, group) && canPartitionIntoValidGroups(playedCard, remaining)) {
      return true;
    }
  }
  return false;
}

function isValidCapture(playedCard, selectedCards) {
  if (selectedCards.length === 0) return false;

  // 1) Carta(s) igual(es). Se permite más de una si existen duplicados en mesa.
  if (selectedCards.every(c => c.value === playedCard.value)) return true;

  // 2) Suma: solo aplica si la carta lanzada es A-7 y todos los sumandos son A-7.
  //    Puede tener 2, 3, 4 o más cartas.
  if (isValidSumGroup(playedCard, selectedCards)) return true;

  // 3) Escalera simple: numérica, de letras o combinada, continua desde la carta lanzada.
  if (isSequentialRunFromPlayed(playedCard, selectedCards)) return true;

  // 4) Captura mixta: base por igual o suma, seguida por escalera continua posterior.
  if (canCaptureWithBaseGroupThenRun(playedCard, selectedCards)) return true;

  // 5) Varias capturas independientes válidas en una sola jugada.
  //    Ejemplo: jugar 5 y levantar 2+3 y A+4.
  if (canPartitionIntoValidGroups(playedCard, selectedCards)) return true;

  return false;
}

function findAllSubsets(cards) {
  const subsets = [];
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(cards[i]);
    subsets.push(subset);
  }
  return subsets;
}

function compareCaptureCandidates(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  const sumA = a.reduce((s, c) => s + c.value, 0);
  const sumB = b.reduce((s, c) => s + c.value, 0);
  return sumA - sumB;
}

function findBestMissedCapture(playedCard, tableCards) {
  let best = [];
  for (const subset of findAllSubsets(tableCards)) {
    if (isValidCapture(playedCard, subset) && compareCaptureCandidates(subset, best) > 0) {
      best = subset;
    }
  }
  return best;
}

function getOmittedCaptureCards(playedCard, originalTableCards, selectedTableCards) {
  const best = findBestMissedCapture(playedCard, originalTableCards);
  if (!best.length) return [];
  const selectedIds = new Set(selectedTableCards.map(c => c.id));
  return best.filter(c => !selectedIds.has(c.id));
}

function getOpponentTeamId(player) {
  return player.teamId === 'A' ? 'B' : 'A';
}

function getEligibleOpponentPlayer(state, player) {
  const opponentTeam = getOpponentTeamId(player);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const candidate = state.players[(state.currentTurn + offset) % state.players.length];
    if (candidate && candidate.teamId === opponentTeam) return candidate;
  }
  return null;
}

function setPendingMissedCapture(state, player, playedCard, cards, reason) {
  if (!cards.length) return;
  const eligible = getEligibleOpponentPlayer(state, player);
  if (!eligible) return;
  state.pendingMissedCapture = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    fromPlayerId: player.id,
    fromPlayerName: player.name,
    failedTeamId: player.teamId,
    eligiblePlayerId: eligible.id,
    eligiblePlayerName: eligible.name,
    eligibleTeamId: eligible.teamId,
    cardIds: cards.map(c => c.id),
    cardLabels: cards.map(cardLabel),
    reason,
  };
  state.log.push(`NO!! ${player.name} dejó cartas en la mesa. ${eligible.name} / Equipo ${eligible.teamId} puede recogerlas sin perder su turno.`);
}

function claimMissedCapture(state, playerId) {
  ensureGameNotFinished(state);
  if (state.status !== STATES.IN_PROGRESS) throw new Error('La partida no está en curso');
  const pending = state.pendingMissedCapture;
  if (!pending) throw new Error('No hay cartas pendientes por recoger');
  if (pending.eligiblePlayerId !== playerId) throw new Error('No estás habilitado para recoger estas cartas');

  const ids = new Set(pending.cardIds);
  const claimed = [];
  state.table = state.table.filter(card => {
    if (ids.has(card.id)) {
      claimed.push(card);
      return false;
    }
    return true;
  });
  if (!claimed.length) {
    state.pendingMissedCapture = null;
    throw new Error('Las cartas pendientes ya no están disponibles');
  }

  state.teams[pending.eligibleTeamId].capturedCards.push(...claimed);
  state.lastCapturer = pending.eligibleTeamId;
  state.log.push(`SI!! ${pending.eligiblePlayerName} recogió ${claimed.length} carta(s) que quedaron en la mesa.`);
  state.pendingMissedCapture = null;
  if (state.status !== STATES.GAME_FINISHED) finishTurnOrHand(state);
  return { claimed, teamId: pending.eligibleTeamId };
}

function playCard(state, playerId, handIndex, tableIndices = []) {
  ensureGameNotFinished(state);
  if (state.pendingMissedCapture) {
    const pending = state.pendingMissedCapture;
    throw new Error(`Hay cartas no levantadas pendientes. ${pending.eligiblePlayerName} debe recogerlas o descartarlas antes de continuar.`);
  }
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

  const originalTable = [...state.table];
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
    pendingMissedCapture: null,
    penaltyCapturedBy: null,
    pointsEarned: 0,
  };

  if (selectedTableCards.length > 0) {
    if (!isValidCapture(playedCard, selectedTableCards)) throw new Error('Captura inválida');
    const omitted = getOmittedCaptureCards(playedCard, originalTable, selectedTableCards);
    executeCapture(state, player, handIndex, tableIndices, selectedTableCards, playedCard, result);
    if (omitted.length) {
      setPendingMissedCapture(state, player, playedCard, omitted, 'partial_capture');
      result.missedCapture = true;
      result.pendingMissedCapture = state.pendingMissedCapture;
    }
    if (checkWinner(state)) return result;
  } else {
    const missed = findBestMissedCapture(playedCard, originalTable);
    player.hand.splice(handIndex, 1);
    state.table.push(playedCard);
    state.lastCardPlayed = playedCard;
    state.lastPlayerToPlay = playerId;
    if (missed.length > 0) {
      setPendingMissedCapture(state, player, playedCard, [playedCard, ...missed], 'no_capture');
      result.missedCapture = true;
      result.pendingMissedCapture = state.pendingMissedCapture;
    }
  }

  if (state.status !== STATES.GAME_FINISHED && !state.pendingMissedCapture) finishTurnOrHand(state);
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
    pendingMissedCapture: state.pendingMissedCapture,
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
  claimMissedCapture,
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
