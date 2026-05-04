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
        <span>${p.name}${p.id === ui.playerId ? ' (tú)' : ''}</span>
        <span class="badge team-${p.teamId.toLowerCase()}-badge">Equipo ${p.teamId}</span>
      `;
      list.appendChild(li);
    });
    const btn = $('#btn-start');
    if (state.players.length === 4) {
      btn.disabled = false;
      btn.textContent = 'Iniciar partida';
    } else {
      btn.disabled = true;
      btn.textContent = `Esperando jugadores (${state.players.length}/4)`;
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
      el.addEventListener('click', () => toggleTableSelection(i));
      container.appendChild(el);
    });
  }

  function renderMyHand(state, me) {
    const container = $('#my-hand');
    container.innerHTML = '';
    if (!me || !me.hand) return;
    const isMyTurn = state.currentPlayerId === ui.playerId;
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
    const isMyTurn = state.currentPlayerId === ui.playerId;
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
      if (events.length) showToast(events.join(' · '));
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

  // ============================
  // Eventos del servidor
  // ============================
  socket.on('updateGameState', (state) => {
    ui.lastState = state;

    if (state.status === 'WAITING_PLAYERS' || state.status === 'READY') {
      showScreen('#screen-waiting');
      renderWaitingRoom(state);
    } else if (state.status === 'IN_PROGRESS' || state.status === 'HAND_FINISHED' || state.status === 'GAME_FINISHED') {
      showScreen('#screen-game');
      renderGame(state);

      // Mostrar modales según estado
      if (state.status === 'HAND_FINISHED') {
        const summary = `Marcador: Equipo A: ${state.teams.A.score} | Equipo B: ${state.teams.B.score}`;
        $('#end-hand-summary').textContent = summary;
        $('#modal-end-hand').classList.remove('hidden');
      }
      if (state.status === 'GAME_FINISHED') {
        const winner = state.winner;
        const summary = winner === 'EMPATE'
          ? `Empate. A: ${state.teams.A.score} | B: ${state.teams.B.score}`
          : `Ganador: Equipo ${winner}\nA: ${state.teams.A.score} | B: ${state.teams.B.score}`;
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
