const Rx = require('rxjs/Rx');

// const sanityCheck = {};

function runGame(updater, validator) {
  // This function transforms a stream of incoming turns into a stream of updates,
  // validating the turns and updating the state of the game.

  // The updater can in general be non-deterministic (make random calls),
  // so every scan must be evaluated EXACTLY once, regardless of the
  // subscriptions. (Hence the shareReplay.)
  return incoming$ => incoming$
    .scan(({ state: oldState }, { from: player, data: turn }) => {
      let valid = false;
      let state = oldState;
      try {
        valid = validator(oldState, player, turn);
      } catch (e) {
        console.error(e);
      }
      if (valid) {
        state = updater(oldState, player, turn);
      }
      // Stop the updater from being called with the same values multiple
      // times.
      // if (!sanityCheck[player]) sanityCheck[player] = {};
      // if (sanityCheck[player][turn]) throw new Error('failed sanityCheck');
      // sanityCheck[player][turn] = true;

      return { player, turn, valid, state };
    })
    .shareReplay();
}

function addLastTurn() {
  return update$ => update$
    .takeWhile(({ state: { complete } }) => !complete)
    .concat(update$.skipWhile(({ state: { complete } }) => !complete).take(1));
}

function tagUpdates(players) {
  // Puts valid turns into the expected outgoing form, and sends updates to
  // the expected players.
  return update$ => Rx.Observable.from(players)
    .flatMap(playerId => update$
      .filter(({ player, turn, valid }) => (
        !turn || valid || player === playerId
      ))
      .map(data => ({ to: playerId, data }))
    )
}

function game({ players, updater, validator, initialState }) {
  return incoming$ => {
    const outgoing$ = incoming$
      .filter(({ data: { type, game_id } }) => type === 'turn' && game_id === 'asdf')
      .startWith({ state: initialState, turn: null, valid: null })
      .let(runGame(updater, validator))
      .let(addLastTurn())
      .let(tagUpdates(players))
      .publishReplay()

    outgoing$.connect();

    return outgoing$;
  }
}

module.exports = game;