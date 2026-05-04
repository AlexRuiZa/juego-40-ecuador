// src/gameEngine.js
// Motor del juego "40". Lógica pura: recibe estado, lo valida y lo muta.
// No conoce sockets ni HTTP. Eso permite testearlo y mantenerlo simple.

const { createDeck, shuffle, dealCards } = require('./deck');

const STATES = {
  WAITING_PLAYERS: 'WAITING_PLAYERS',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  HAND_FINISHED: 'HAND_FINISHED',
  GAME_FINISHED: 'GAME_FINISHED',
};

// Puntos por evento
const POINTS = {
  CAIDA: 2,
  LIMPIA: 2,
  RONDA: 2,
  CARTON_BASE_CARDS: 20,    // 20 cartas = 6 puntos
  CARTON_BASE_POINTS: 6,
  CARTON_EXTRA_PER_PAIR: 2, // cada 2 cartas adicionales = +2 puntos
};

const WINNING_SCORE = 40;

/**
 * Crea un nuevo estado de partida vacío.
 * Se invoca al crear la sala.
 */
function createInitialState(roomCode) {
  return {
    roomCode,
    status: STATES.WAITING_PLAYERS,
    players: [],          // [{ id, name, teamId, hand: [] }]
    teams: {
      A: { score: 0, capturedCards: [] },
      B: { score: 0, capturedCards: [] },
    },
    deck: [],
    table: [],            // cartas en la mesa
    currentTurn: 0,       // índice del jugador en turno
    lastCapturer: null,   // teamId del último equipo en capturar (para asignar mesa al final)
    lastCardPlayed: null, // última carta dejada en mesa (para detectar caída)
    lastPlayerToPlay: null, // playerId del que jugó la última carta (no puede caerse a sí mismo)
    handNumber: 0,
    log: [],              // mensajes recientes (caída, limpia, etc.)
    winner: null,
  };
}

/**
 * Agrega jugador a la sala. Asigna equipo automáticamente.
 * Reglas: máximo 4 jugadores, sin nombres duplicados.
 */
function addPlayer(state, playerId, name) {
  if (state.players.length >= 4) {
    throw new Error('La sala está llena');
  }
  if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Ya existe un jugador con ese nombre');
  }
  if (!name || !name.trim()) {
    throw new Error('Nombre inválido');
  }

  // Asignación automática: pos 0,2 → A; pos 1,3 → B
  const position = state.players.length;
  const teamId = position % 2 === 0 ? 'A' : 'B';

  state.players.push({
    id: playerId,
    name: name.trim(),
    teamId,
    hand: [],
    position,
  });

  if (state.players.length === 4) {
    state.status = STATES.READY;
  }
  return state.players[state.players.length - 1];
}

/**
 * Quita un jugador (desconexión). Si la partida ya empezó, se finaliza.
 */
function removePlayer(state, playerId) {
  const idx = state.players.findIndex(p => p.id === playerId);
  if (idx === -1) return;
  state.players.splice(idx, 1);

  if (state.status === STATES.IN_PROGRESS || state.status === STATES.HAND_FINISHED) {
    state.status = STATES.GAME_FINISHED;
    state.log.push('Un jugador se desconectó. Partida finalizada.');
  } else if (state.players.length < 4) {
    state.status = STATES.WAITING_PLAYERS;
  }
}

/**
 * Inicia la partida: baraja, reparte 5 a cada uno, escoge turno aleatorio.
 * Detecta rondas (3 cartas iguales en la mano).
 */
function startGame(state) {
  if (state.players.length !== 4) {
    throw new Error('Se necesitan 4 jugadores para iniciar');
  }

  state.status = STATES.IN_PROGRESS;
  state.handNumber = 1;
  startNewHand(state, /*chooseRandomTurn*/ true);
}

/**
 * Inicia una nueva mano (puede haber varias por partida hasta llegar a 40 puntos).
 * Si chooseRandomTurn=false, conserva el turno actual (sigue el mismo orden).
 */
function startNewHand(state, chooseRandomTurn = false) {
  state.deck = shuffle(createDeck());
  state.table = [];
  state.lastCapturer = null;
  state.lastCardPlayed = null;
  state.lastPlayerToPlay = null;

  for (const player of state.players) {
    player.hand = dealCards(state.deck, 5);
  }

  if (chooseRandomTurn) {
    state.currentTurn = Math.floor(Math.random() * 4);
  }

  // Detectar rondas (3 cartas iguales en una mano recién repartida)
  detectRondas(state);

  state.status = STATES.IN_PROGRESS;
}

/**
 * Detecta si algún jugador recibió 3 cartas del mismo rank.
 * Otorga 2 puntos al equipo correspondiente.
 */
function detectRondas(state) {
  for (const player of state.players) {
    const counts = {};
    for (const card of player.hand) {
      counts[card.rank] = (counts[card.rank] || 0) + 1;
    }
    for (const [rank, count] of Object.entries(counts)) {
      if (count >= 3) {
        state.teams[player.teamId].score += POINTS.RONDA;
        state.log.push(`¡Ronda de ${rank}! +2 para equipo ${player.teamId} (${player.name})`);
      }
    }
  }
}

/**
 * Valida que un conjunto de cartas de mesa pueda capturarse con una carta jugada.
 * Reglas:
 *  - Si todas las cartas seleccionadas tienen el mismo valor que la jugada → captura por igualdad.
 *  - Si suman exactamente el valor de la jugada → captura por suma.
 *  - Combinada: el conjunto puede particionarse en grupos donde cada grupo
 *    o es una carta del mismo valor, o es un grupo que suma el valor.
 *
 * Implementación: usamos backtracking sobre las cartas seleccionadas para verificar
 * si se pueden particionar en subgrupos válidos.
 *
 * @returns {boolean} true si la captura es válida.
 */
function isValidCapture(playedCard, selectedCards) {
  if (selectedCards.length === 0) return false;
  const target = playedCard.value;

  // Caso simple: todas iguales al valor jugado
  if (selectedCards.every(c => c.value === target)) return true;

  // Caso simple: suman exacto
  const total = selectedCards.reduce((s, c) => s + c.value, 0);
  if (total === target) return true;

  // Caso combinado: particionar en subgrupos donde cada grupo es válido
  // (un grupo válido es: una sola carta de valor target, o un conjunto que suma target)
  return canPartitionIntoValidGroups(selectedCards, target);
}

/**
 * Backtracking: ¿se pueden agrupar todas las cartas en subgrupos
 * donde cada subgrupo suma `target`?
 * (Una carta sola que valga target es un subgrupo de tamaño 1 que suma target.)
 */
function canPartitionIntoValidGroups(cards, target) {
  if (cards.length === 0) return true;

  // Tomamos la primera carta y probamos todos los subconjuntos que la incluyen y suman target
  const [first, ...rest] = cards;
  const indices = rest.map((_, i) => i);

  // Probar combinaciones de `rest` que junto a `first` sumen target
  for (const combo of subsetsThatSumTo(rest, target - first.value)) {
    const used = new Set(combo);
    const remaining = rest.filter((_, i) => !used.has(i));
    if (canPartitionIntoValidGroups(remaining, target)) return true;
  }
  return false;
}

/**
 * Genera todos los subconjuntos de `cards` (representados por índices)
 * cuya suma de valores sea exactamente `target`. `target` puede ser 0 (subconjunto vacío).
 */
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

/**
 * Procesa una jugada: el jugador `playerId` juega la carta en `handIndex`
 * intentando capturar las cartas en `tableIndices`.
 *
 * @returns {object} resumen de la jugada (eventos: caida, limpia, etc.)
 */
function playCard(state, playerId, handIndex, tableIndices = []) {
  // Validaciones de turno y existencia
  if (state.status !== STATES.IN_PROGRESS) {
    throw new Error('La partida no está en curso');
  }
  const player = state.players[state.currentTurn];
  if (!player || player.id !== playerId) {
    throw new Error('No es tu turno');
  }
  if (handIndex < 0 || handIndex >= player.hand.length) {
    throw new Error('Carta inválida');
  }

  // Validar índices de mesa
  const tableSet = new Set(tableIndices);
  if (tableSet.size !== tableIndices.length) {
    throw new Error('Selección de mesa inválida (duplicados)');
  }
  for (const i of tableIndices) {
    if (i < 0 || i >= state.table.length) throw new Error('Índice de mesa inválido');
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
    pointsEarned: 0,
  };

  if (selectedTableCards.length > 0) {
    // Intento de captura: validar
    if (!isValidCapture(playedCard, selectedTableCards)) {
      throw new Error('Captura inválida');
    }

    // Detectar caída: el jugador captura la última carta jugada por el rival
    // (debe ser una carta del mismo valor y debe estar entre las capturadas)
    const isCaida =
      state.lastCardPlayed &&
      state.lastPlayerToPlay !== playerId &&
      selectedTableCards.some(c => c.id === state.lastCardPlayed.id) &&
      playedCard.value === state.lastCardPlayed.value;

    // Quitar carta de la mano
    player.hand.splice(handIndex, 1);

    // Quitar cartas capturadas de la mesa (en orden descendente para no invalidar índices)
    const sortedIndices = [...tableIndices].sort((a, b) => b - a);
    for (const i of sortedIndices) state.table.splice(i, 1);

    // Detectar limpia: la mesa quedó vacía DESPUÉS de la captura
    const isLimpia = state.table.length === 0;

    // La carta jugada también va al equipo (forma parte de la captura)
    const allCaptured = [playedCard, ...selectedTableCards];
    state.teams[player.teamId].capturedCards.push(...allCaptured);
    result.captured = allCaptured;

    // Aplicar puntos por caída/limpia
    if (isCaida) {
      state.teams[player.teamId].score += POINTS.CAIDA;
      result.caida = true;
      result.pointsEarned += POINTS.CAIDA;
      state.log.push(`¡Caída! +2 para equipo ${player.teamId} (${player.name})`);
    }
    if (isLimpia) {
      state.teams[player.teamId].score += POINTS.LIMPIA;
      result.limpia = true;
      result.pointsEarned += POINTS.LIMPIA;
      state.log.push(`¡Limpia! +2 para equipo ${player.teamId} (${player.name})`);
    }

    state.lastCapturer = player.teamId;
    // Tras una captura, la "última carta jugada" deja de existir (se la llevó alguien)
    state.lastCardPlayed = null;
    state.lastPlayerToPlay = playerId;
  } else {
    // Sin captura: la carta jugada queda en la mesa
    player.hand.splice(handIndex, 1);
    state.table.push(playedCard);
    state.lastCardPlayed = playedCard;
    state.lastPlayerToPlay = playerId;
  }

  // Verificar si la mano terminó (todos sin cartas y mazo vacío)
  const allHandsEmpty = state.players.every(p => p.hand.length === 0);
  if (allHandsEmpty) {
    if (state.deck.length > 0) {
      // Repartir nueva tanda de 5 cartas a cada uno (sin barajar)
      for (const p of state.players) {
        p.hand = dealCards(state.deck, 5);
      }
      // No detectamos rondas aquí (ronda solo aplica al reparto inicial de la mano)
    } else {
      // Fin de mano
      finishHand(state);
      return result;
    }
  }

  // Avanzar turno
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
  return result;
}

/**
 * Cierra la mano: asigna mesa al último capturador, calcula cartón,
 * verifica fin de partida o reinicia mano.
 */
function finishHand(state) {
  // 1) Mesa restante va al último equipo que capturó
  if (state.table.length > 0 && state.lastCapturer) {
    state.teams[state.lastCapturer].capturedCards.push(...state.table);
    state.log.push(`Cartas restantes en mesa van al equipo ${state.lastCapturer}`);
    state.table = [];
  }

  // 2) Calcular cartón
  const cartonA = calculateCarton(state.teams.A.capturedCards.length);
  const cartonB = calculateCarton(state.teams.B.capturedCards.length);
  state.teams.A.score += cartonA;
  state.teams.B.score += cartonB;
  state.log.push(
    `Cartón → Equipo A: ${state.teams.A.capturedCards.length} cartas (+${cartonA}) | ` +
    `Equipo B: ${state.teams.B.capturedCards.length} cartas (+${cartonB})`
  );

  // 3) Verificar fin de partida
  if (state.teams.A.score >= WINNING_SCORE || state.teams.B.score >= WINNING_SCORE) {
    state.status = STATES.GAME_FINISHED;
    state.winner =
      state.teams.A.score > state.teams.B.score ? 'A' :
      state.teams.B.score > state.teams.A.score ? 'B' : 'EMPATE';
    state.log.push(`¡Partida finalizada! Ganador: equipo ${state.winner}`);
  } else {
    state.status = STATES.HAND_FINISHED;
    state.log.push(`Fin de mano ${state.handNumber}. Marcador: A=${state.teams.A.score} | B=${state.teams.B.score}`);
  }
}

/**
 * Calcula el cartón según las reglas del MVP:
 *  - 20 cartas → 6 puntos
 *  - cada 2 cartas adicionales → +2 puntos
 * Por debajo de 20, no suma.
 */
function calculateCarton(cardCount) {
  if (cardCount < POINTS.CARTON_BASE_CARDS) return 0;
  const extra = cardCount - POINTS.CARTON_BASE_CARDS;
  const extraPairs = Math.floor(extra / 2);
  return POINTS.CARTON_BASE_POINTS + extraPairs * POINTS.CARTON_EXTRA_PER_PAIR;
}

/**
 * Inicia la siguiente mano cuando una está terminada (sin reset de puntajes).
 * Limpia capturedCards de cada equipo (las cartas vuelven al mazo virtualmente).
 */
function continueToNextHand(state) {
  if (state.status !== STATES.HAND_FINISHED) {
    throw new Error('Solo se puede continuar al terminar una mano');
  }
  state.handNumber += 1;
  state.teams.A.capturedCards = [];
  state.teams.B.capturedCards = [];
  // Rotar turno: empieza el siguiente al que empezó la mano anterior
  state.currentTurn = (state.currentTurn + 1) % state.players.length;
  startNewHand(state, /*chooseRandomTurn*/ false);
}

/**
 * Genera la "vista pública" del estado (sin manos ajenas).
 * Cada cliente recibe su propia mano completa pero solo el conteo de las demás.
 */
function getPublicState(state, viewerId) {
  return {
    roomCode: state.roomCode,
    status: state.status,
    handNumber: state.handNumber,
    deckCount: state.deck.length,
    table: state.table,
    currentTurn: state.currentTurn,
    currentPlayerId: state.players[state.currentTurn]?.id || null,
    teams: {
      A: { score: state.teams.A.score, capturedCount: state.teams.A.capturedCards.length },
      B: { score: state.teams.B.score, capturedCount: state.teams.B.capturedCards.length },
    },
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      handCount: p.hand.length,
      hand: p.id === viewerId ? p.hand : null, // solo el viewer ve su mano
      position: p.position,
    })),
    log: state.log.slice(-10), // últimos 10 mensajes
    winner: state.winner,
    lastCardPlayed: state.lastCardPlayed,
  };
}

module.exports = {
  STATES,
  createInitialState,
  addPlayer,
  removePlayer,
  startGame,
  playCard,
  continueToNextHand,
  getPublicState,
  isValidCapture,
  calculateCarton,
};
