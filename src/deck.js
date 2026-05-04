// src/deck.js
// Manejo de la baraja de 40 cartas usada en el juego "40".

const SUITS = ['corazones', 'diamantes', 'treboles', 'picas'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];

// Valor lógico de cada carta para sumar/capturar.
const VALUE_MAP = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, J: 8, Q: 9, K: 10,
};

/**
 * Construye la baraja completa de 40 cartas.
 * Cada carta tiene un id único para identificarla sin ambigüedades en el cliente.
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        value: VALUE_MAP[rank],
      });
    }
  }
  return deck;
}

/**
 * Barajado Fisher-Yates. Modifica el array in-place y lo retorna.
 */
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Reparte n cartas desde el tope del mazo.
 * Mutates the deck.
 */
function dealCards(deck, n) {
  return deck.splice(0, n);
}

module.exports = {
  createDeck,
  shuffle,
  dealCards,
  VALUE_MAP,
};
