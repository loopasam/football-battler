export const MAX_ROUNDS = 5;
export const BUILD_UP_TARGET = 4;

export type Side = 'home' | 'away';
export type MatchPhase = 'ready' | 'passing' | 'shooting' | 'finished';
export type PlayerLayer = 'goalkeeper' | 'defense' | 'midfield' | 'attack';
export type PlayerLane =
  | 'far-left'
  | 'left'
  | 'inside-left'
  | 'center'
  | 'inside-right'
  | 'right'
  | 'far-right';

export interface PlayerDefinition {
  id: string;
  name: string;
  attack: number;
  defense: number;
  layer: PlayerLayer;
  lane: PlayerLane;
}

export interface TeamDefinition {
  name: string;
  players: PlayerDefinition[];
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
  players: [
    { id: 'home-gk', name: 'H. Keeper', attack: 1, defense: 6, layer: 'goalkeeper', lane: 'center' },
    { id: 'home-lb', name: 'H. Left Back', attack: 2, defense: 4, layer: 'defense', lane: 'far-left' },
    { id: 'home-lcb', name: 'H. Left Center Back', attack: 2, defense: 5, layer: 'defense', lane: 'inside-left' },
    { id: 'home-rcb', name: 'H. Right Center Back', attack: 3, defense: 5, layer: 'defense', lane: 'inside-right' },
    { id: 'home-rb', name: 'H. Right Back', attack: 3, defense: 4, layer: 'defense', lane: 'far-right' },
    { id: 'home-lm', name: 'H. Left Midfield', attack: 5, defense: 3, layer: 'midfield', lane: 'left' },
    { id: 'home-cm', name: 'H. Center Midfield', attack: 6, defense: 4, layer: 'midfield', lane: 'center' },
    { id: 'home-rm', name: 'H. Right Midfield', attack: 5, defense: 3, layer: 'midfield', lane: 'right' },
    { id: 'home-lw', name: 'H. Left Wing', attack: 8, defense: 2, layer: 'attack', lane: 'left' },
    { id: 'home-st', name: 'H. Striker', attack: 11, defense: 3, layer: 'attack', lane: 'center' },
    { id: 'home-rw', name: 'H. Right Wing', attack: 9, defense: 1, layer: 'attack', lane: 'right' },
  ],
};

export const AWAY_TEAM: TeamDefinition = {
  name: 'Away',
  players: [
    { id: 'away-gk', name: 'A. Keeper', attack: 1, defense: 6, layer: 'goalkeeper', lane: 'center' },
    { id: 'away-ld', name: 'A. Left Defense', attack: 2, defense: 6, layer: 'defense', lane: 'left' },
    { id: 'away-cd', name: 'A. Center Defense', attack: 2, defense: 6, layer: 'defense', lane: 'center' },
    { id: 'away-rd', name: 'A. Right Defense', attack: 3, defense: 6, layer: 'defense', lane: 'right' },
    { id: 'away-lw', name: 'A. Left Wide', attack: 4, defense: 2, layer: 'midfield', lane: 'far-left' },
    { id: 'away-lm', name: 'A. Left Midfield', attack: 5, defense: 3, layer: 'midfield', lane: 'inside-left' },
    { id: 'away-cm', name: 'A. Center Midfield', attack: 6, defense: 3, layer: 'midfield', lane: 'center' },
    { id: 'away-rm', name: 'A. Right Midfield', attack: 5, defense: 3, layer: 'midfield', lane: 'inside-right' },
    { id: 'away-rw', name: 'A. Right Wide', attack: 4, defense: 2, layer: 'midfield', lane: 'far-right' },
    { id: 'away-lf', name: 'A. Left Forward', attack: 7, defense: 2, layer: 'attack', lane: 'inside-left' },
    { id: 'away-rf', name: 'A. Right Forward', attack: 6, defense: 1, layer: 'attack', lane: 'inside-right' },
  ],
};

export function totalDefense(team: TeamDefinition): number {
  return team.players.reduce((total, player) => total + player.defense, 0);
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
