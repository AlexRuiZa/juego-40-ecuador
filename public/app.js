// public/app.js
// Cliente del juego. Solo envía intenciones al servidor; nunca decide reglas.
// Mantiene una copia de la última vista pública para renderizar la UI.

(() => {
  const socket = io();

  // Estado local del cliente (solo presentación)
  const ui = {
    playerId: null,
    roomCode: null,
    myName: null,
    lastState: null,
    selectedHandIndex: null,
    selectedTableIndices: new Set(),
  };

  const SUIT_SYMBOLS = {
    corazones: '♥',
    diamantes: '♦',
    treboles: '♣',
    picas: '♠',
  };

  // ============================
  // Helpers de DOM
  // ============================
  const $ = (sel) => document.querySelector(sel);
  const showScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  };
  const showToast = (msg, ms = 2200) => {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), ms);
  };
  const showError = (msg) => {
    const el = $('#lobby-error');
    if (el) el.textContent = msg;
    showToast(msg);
  };

  const showVisualAlert = (title, message, kind = 'info', ms = 2600) => {
    const toast = $('#toast');
    toast.innerHTML = `<strong>${title}</strong><br>${message}`;
    toast.className = `toast toast-${kind}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), ms);
  };

  // ============================
  // Lobby
  // ============================
  $('#btn-create').addEventListener('click', () => {
    const name = $('#player-name').value.trim();
    if (!name) return showError('Escribe tu nombre primero');
    socket.emit('createRoom', { name }, (res) => {
      if (!res.ok) return showError(res.error);
      ui.playerId = res.playerId;
      ui.roomCode = res.roomCode;
      ui.myName = name;
      $('#waiting-room-code').textContent = res.roomCode;
      showScreen('#screen-waiting');
    });
  });

  $('#btn-join').addEventListener('click', () => {
    const name = $('#player-name').value.trim();
    const code = $('#room-code').value.trim().toUpperCase();
    if (!name) return showError('Escribe tu nombre primero');
    if (!code) return showError('Ingresa el código de sala');
    socket.emit('joinRoom', { roomCode: code, name }, (res) => {
      if (!res.ok) return showError(res.error);
      ui.playerId = res.playerId;
      ui.roomCode = res.roomCode;
      ui.myName = name;
      $('#waiting-room-code').textContent = res.roomCode;
      showScreen('#screen-waiting');
    });
  });

  // ============================
  // Sala de espera
  // ============================
  $('#btn-start').addEventListener('click', () => {
    socket.emit('startGame', { roomCode: ui.roomCode }, (res) => {
      if (!res.ok) showError(res.error);
    });
  });

  function renderWaitingRoom(state) {
    const list = $('#waiting-players-list');
    list.innerHTML = '';
    state.players.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${p.name}${p.id === ui.playerId ? ' (tú)' : ''}${p.isHost ? ' 👑' : ''}</span>
        <span class="badge team-${p.teamId.toLowerCase()}-badge">Equipo ${p.teamId}</span>
      `;
      list.appendChild(li);
    });
    const btn = $('#btn-start');
    const validCount = state.players.length === 2 || state.players.length === 4;
    const mode = state.players.length === 2 ? '1 vs 1' : state.players.length === 4 ? '2 vs 2' : 'espera';
    if (validCount && state.isHost) {
      btn.disabled = false;
      btn.textContent = `Iniciar partida (${mode})`;
      btn.style.display = '';
    } else if (validCount && !state.isHost) {
      btn.disabled = true;
      btn.textContent = 'Esperando que el creador inicie la partida';
      btn.style.display = '';
    } else {
      btn.disabled = true;
      btn.textContent = `Esperando jugadores (${state.players.length}/2 o 4)`;
      btn.style.display = '';
    }
  }

  // ============================
  // Pantalla de juego
  // ============================
  function renderGame(state) {
    // Encabezado
    $('#score-a').textContent = state.teams.A.score;
    $('#score-b').textContent = state.teams.B.score;
    $('#hand-number').textContent = state.handNumber;
    $('#deck-count').textContent = state.deckCount;
    const modeEl = $('#game-mode');
    if (modeEl) modeEl.textContent = state.gameMode || '-';

    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
    $('#current-player-name').textContent = currentPlayer ? currentPlayer.name : '-';

    // Mi info
    const me = state.players.find(p => p.id === ui.playerId);
    if (me) {
      $('#my-name').textContent = me.name;
      $('#my-team').textContent = `Equipo ${me.teamId}`;
    }

    // Oponentes (los otros 3 jugadores en orden)
    renderOpponents(state, me);

    // Mesa
    renderTable(state);

    // Mi mano
    renderMyHand(state, me);

    // Log
    renderLog(state);

    // Habilitar/deshabilitar botón de jugar
    updatePlayButton(state);
  }

  function renderOpponents(state, me) {
    const container = $('#opponents');
    container.innerHTML = '';
    if (!me) return;
    // Mostrar oponentes en orden de posición, empezando desde el siguiente al jugador
    const others = state.players.filter(p => p.id !== ui.playerId);
    others.forEach(p => {
      const div = document.createElement('div');
      div.className = 'opponent';
      if (p.id === state.currentPlayerId) div.classList.add('active-turn');
      div.innerHTML = `
        <div class="name">${p.name}</div>
        <div class="team-tag">Equipo ${p.teamId}</div>
        <div class="hand-count">🃏 ${p.handCount} cartas</div>
      `;
      container.appendChild(div);
    });
  }

  function renderTable(state) {
    const container = $('#table-cards');
    container.innerHTML = '';
    if (state.table.length === 0) {
      container.innerHTML = '<em style="color:#888;">Mesa vacía</em>';
      return;
    }
    state.table.forEach((card, i) => {
      const el = createCardElement(card);
      if (ui.selectedTableIndices.has(i)) el.classList.add('selected');
      if (state.pendingMissedCapture && state.pendingMissedCapture.cardIds.includes(card.id)) {
        el.classList.add('missed-available');
      }
      el.addEventListener('click', () => toggleTableSelection(i));
      container.appendChild(el);
    });
  }

  function renderMyHand(state, me) {
    const container = $('#my-hand');
    container.innerHTML = '';
    if (!me || !me.hand) return;
    const isMyTurn = state.status === 'IN_PROGRESS' && state.currentPlayerId === ui.playerId;
    me.hand.forEach((card, i) => {
      const el = createCardElement(card);
      if (!isMyTurn) el.classList.add('disabled');
      if (ui.selectedHandIndex === i) el.classList.add('selected');
      el.addEventListener('click', () => {
        if (!isMyTurn) return showToast('No es tu turno');
        toggleHandSelection(i);
      });
      container.appendChild(el);
    });
  }

  function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-game suit-${card.suit}`;
    el.innerHTML = `
      <span class="rank">${card.rank}</span>
      <span class="suit">${SUIT_SYMBOLS[card.suit]}</span>
    `;
    return el;
  }

  function renderLog(state) {
    const list = $('#log-list');
    list.innerHTML = '';
    state.log.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      list.appendChild(li);
    });
    list.scrollTop = list.scrollHeight;
  }

  function updatePlayButton(state) {
    const btn = $('#btn-play');
    const pending = state.pendingMissedCapture;
    if (pending) {
      btn.disabled = true;
      btn.textContent = pending.eligiblePlayerId === ui.playerId
        ? 'Recoge primero las cartas disponibles'
        : 'Esperando cartas no levantadas...';
      return;
    }
    const isMyTurn = state.status === 'IN_PROGRESS' && state.currentPlayerId === ui.playerId;
    const canPlay = isMyTurn && ui.selectedHandIndex !== null;
    btn.disabled = !canPlay;
    btn.textContent = isMyTurn ? 'Confirmar jugada' : 'Esperando turno...';
  }

  // ============================
  // Selección de cartas
  // ============================
  function toggleHandSelection(index) {
    ui.selectedHandIndex = (ui.selectedHandIndex === index) ? null : index;
    if (ui.lastState) renderGame(ui.lastState);
  }

  function toggleTableSelection(index) {
    if (ui.selectedTableIndices.has(index)) {
      ui.selectedTableIndices.delete(index);
    } else {
      ui.selectedTableIndices.add(index);
    }
    if (ui.lastState) renderGame(ui.lastState);
  }

  function clearSelection() {
    ui.selectedHandIndex = null;
    ui.selectedTableIndices.clear();
    if (ui.lastState) renderGame(ui.lastState);
  }

  $('#btn-clear').addEventListener('click', clearSelection);

  $('#btn-play').addEventListener('click', () => {
    if (ui.selectedHandIndex === null) return;
    const tableIndices = Array.from(ui.selectedTableIndices);
    socket.emit('playCard', {
      roomCode: ui.roomCode,
      handIndex: ui.selectedHandIndex,
      tableIndices,
    }, (res) => {
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      // Mostrar feedback de eventos
      const r = res.result;
      const events = [];
      if (r.caida) events.push('¡CAÍDA! +2');
      if (r.limpia) events.push('¡LIMPIA! +2');
      if (r.captured.length > 0) events.push(`Capturaste ${r.captured.length} cartas`);
      if (r.missedCapture) {
        showVisualAlert('NO!! Dejaste cartas en la mesa!', 'Tu oponente tendrá la oportunidad de recogerlas.', 'warning', 4200);
      } else if (events.length) {
        showVisualAlert('Jugada registrada', events.join(' · '), 'success');
      }
      clearSelection();
    });
  });

  // ============================
  // Modal de fin de mano
  // ============================
  $('#btn-next-hand').addEventListener('click', () => {
    socket.emit('nextHand', { roomCode: ui.roomCode }, (res) => {
      if (!res.ok) showError(res.error);
      $('#modal-end-hand').classList.add('hidden');
    });
  });

  $('#btn-claim-missed').addEventListener('click', () => {
    socket.emit('claimMissedCapture', { roomCode: ui.roomCode }, (res) => {
      if (!res.ok) return showError(res.error);
      $('#modal-missed-capture').classList.add('hidden');
      showVisualAlert('Cartas recogidas', 'No perdiste tu turno normal.', 'success');
    });
  });

  $('#btn-close-missed').addEventListener('click', () => {
    $('#modal-missed-capture').classList.add('hidden');
  });

  // ============================
  // Eventos del servidor
  // ============================
  socket.on('updateGameState', (state) => {
    ui.lastState = state;

    // Evita que un modal anterior bloquee la siguiente mano en pantallas invitadas.
    if (state.status === 'IN_PROGRESS') {
      $('#modal-end-hand').classList.add('hidden');
      $('#modal-end-game').classList.add('hidden');
    }

    if (state.status === 'WAITING_PLAYERS' || state.status === 'READY') {
      showScreen('#screen-waiting');
      renderWaitingRoom(state);
    } else if (state.status === 'IN_PROGRESS' || state.status === 'HAND_FINISHED' || state.status === 'GAME_FINISHED') {
      showScreen('#screen-game');
      renderGame(state);

      // Alerta visual de carta no levantada
      const pending = state.pendingMissedCapture;
      if (pending) {
        const isEligible = pending.eligiblePlayerId === ui.playerId;
        $('#missed-title').textContent = isEligible ? 'SI!! Quedaron cartas en la mesa para ti!' : 'NO!! Dejaste cartas en la mesa!';
        $('#missed-message').textContent = isEligible
          ? `Puedes recoger ${pending.cardLabels.join(', ')} sin perder tu turno.`
          : `${pending.eligiblePlayerName} puede recoger ${pending.cardLabels.join(', ')}.`;
        $('#btn-claim-missed').style.display = isEligible ? '' : 'none';
        $('#btn-close-missed').style.display = isEligible ? 'none' : '';
        $('#modal-missed-capture').classList.remove('hidden');
      } else {
        $('#modal-missed-capture').classList.add('hidden');
      }

      // Mostrar modales según estado
      if (state.status === 'HAND_FINISHED') {
        const hs = state.handSummary;
        const summary = hs
          ? `Cartón Equipo A: ${hs.cards.A} cartas (+${hs.carton.A}) | Equipo B: ${hs.cards.B} cartas (+${hs.carton.B}).\nMarcador actual: Equipo A ${hs.scores.A} | Equipo B ${hs.scores.B}${(hs.blockedBy38.A || hs.blockedBy38.B) ? '\nRegla 38 aplicada: el cartón no cierra partida.' : ''}`
          : `Marcador: Equipo A: ${state.teams.A.score} | Equipo B: ${state.teams.B.score}`;
        $('#end-hand-summary').textContent = summary;
        const nextBtn = $('#btn-next-hand');
        nextBtn.style.display = '';
        nextBtn.disabled = false;
        nextBtn.textContent = 'Continuar';
        $('#modal-end-hand').classList.remove('hidden');
      }
      if (state.status === 'GAME_FINISHED') {
        const winner = state.winner;
        const summary = state.winnerMessage || (winner === 'EMPATE'
          ? `Empate. A: ${state.teams.A.score} | B: ${state.teams.B.score}`
          : `Ganador: Equipo ${winner}\nA: ${state.teams.A.score} | B: ${state.teams.B.score}`);
        $('#end-game-summary').textContent = summary;
        $('#modal-end-game').classList.remove('hidden');
      }
    }
  });

  socket.on('errorMessage', ({ message }) => {
    showToast(message);
  });

  socket.on('endHand', ({ handNumber, teams }) => {
    console.log(`Mano ${handNumber} finalizada`, teams);
  });

  socket.on('endGame', ({ winner, teams }) => {
    console.log(`Partida finalizada. Ganador: ${winner}`, teams);
  });

  socket.on('disconnectPlayer', ({ playerId }) => {
    showToast('Un jugador se desconectó');
  });

  socket.on('disconnect', () => {
    showToast('Conexión perdida con el servidor');
  });
})();
