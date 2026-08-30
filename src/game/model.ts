export const MAX_ROUNDS = 5;
export const BUILD_UP_TARGET = 4;

export type Side = 'home' | 'away';
export type MatchPhase = 'ready' | 'passing' | 'shooting' | 'finished';

export interface PlayerCard {
  id: string;
  name: string;
  role: string;
  attack: number;
  defense: number;
}

export interface TeamDefinition {
  name: string;
  cards: PlayerCard[];
}

export interface TeamState {
  score: number;
  defense: number;
  maxDefense: number;
}

export interface LastShot {
  attacker: Side;
  damage: number;
  defenseBefore: number;
  defenseAfter: number;
  goal: boolean;
}

export interface MatchState {
  round: number;
  attacking: Side;
  phase: MatchPhase;
  buildUp: number;
  home: TeamState;
  away: TeamState;
  lastShot?: LastShot;
}

export const HOME_TEAM: TeamDefinition = {
  name: 'Home',
  cards: [
    { id: 'home-gk', name: 'H. Keeper', role: 'GK', attack: 2, defense: 12 },
    { id: 'home-cb', name: 'H. Anchor', role: 'DEF', attack: 4, defense: 10 },
    { id: 'home-m1', name: 'H. Link', role: 'MID', attack: 6, defense: 7 },
    { id: 'home-m2', name: 'H. Pivot', role: 'MID', attack: 5, defense: 6 },
    { id: 'home-st', name: 'H. Finisher', role: 'FWD', attack: 11, defense: 5 },
  ],
};

export const AWAY_TEAM: TeamDefinition = {
  name: 'Away',
  cards: [
    { id: 'away-gk', name: 'A. Keeper', role: 'GK', attack: 2, defense: 12 },
    { id: 'away-cb', name: 'A. Anchor', role: 'DEF', attack: 4, defense: 10 },
    { id: 'away-m1', name: 'A. Link', role: 'MID', attack: 5, defense: 7 },
    { id: 'away-m2', name: 'A. Pivot', role: 'MID', attack: 6, defense: 6 },
    { id: 'away-st', name: 'A. Finisher', role: 'FWD', attack: 7, defense: 5 },
  ],
};

export function totalDefense(team: TeamDefinition): number {
  return team.cards.reduce((total, card) => total + card.defense, 0);
}

export function createMatch(): MatchState {
  const homeDefense = totalDefense(HOME_TEAM);
  const awayDefense = totalDefense(AWAY_TEAM);

  return {
    round: 1,
    attacking: 'home',
    phase: 'ready',
    buildUp: 0,
    home: { score: 0, defense: homeDefense, maxDefense: homeDefense },
    away: { score: 0, defense: awayDefense, maxDefense: awayDefense },
  };
}

export function startAttack(state: MatchState): MatchState {
  if (state.phase !== 'ready') {
    throw new Error('An attack can only start from the ready phase.');
  }

  return {
    ...state,
    phase: 'passing',
    buildUp: 0,
    lastShot: undefined,
  };
}

export function completePass(state: MatchState): MatchState {
  if (state.phase !== 'passing') {
    throw new Error('A pass can only complete during the passing phase.');
  }

  const buildUp = Math.min(BUILD_UP_TARGET, state.buildUp + 1);
  return {
    ...state,
    buildUp,
    phase: buildUp === BUILD_UP_TARGET ? 'shooting' : 'passing',
  };
}

export function resolveShot(state: MatchState, damage: number): MatchState {
  if (state.phase !== 'shooting') {
    throw new Error('A shot can only resolve when Build-Up is full.');
  }
  if (!Number.isFinite(damage) || damage <= 0) {
    throw new Error('Shot damage must be a positive number.');
  }

  const defendingSide: Side = state.attacking === 'home' ? 'away' : 'home';
  const defender = state[defendingSide];
  const defenseBefore = defender.defense;
  const defenseAfter = Math.max(0, defenseBefore - damage);
  const goal = defenseAfter === 0;

  const updatedDefender: TeamState = {
    ...defender,
    score: defender.score,
    defense: defenseAfter,
  };
  const updatedAttacker: TeamState = {
    ...state[state.attacking],
    score: state[state.attacking].score + (goal ? 1 : 0),
  };

  const completedMatch = state.attacking === 'away' && state.round === MAX_ROUNDS;
  const nextAttacker: Side = state.attacking === 'home' ? 'away' : 'home';
  const nextRound = state.attacking === 'away' ? state.round + 1 : state.round;

  return {
    ...state,
    [state.attacking]: updatedAttacker,
    [defendingSide]: updatedDefender,
    round: completedMatch ? state.round : nextRound,
    attacking: completedMatch ? state.attacking : nextAttacker,
    phase: completedMatch ? 'finished' : 'ready',
    buildUp: 0,
    lastShot: {
      attacker: state.attacking,
      damage,
      defenseBefore,
      defenseAfter,
      goal,
    },
  };
}

export function getWinner(state: MatchState): Side | 'draw' | undefined {
  if (state.phase !== 'finished') return undefined;
  if (state.home.score === state.away.score) return 'draw';
  return state.home.score > state.away.score ? 'home' : 'away';
}
