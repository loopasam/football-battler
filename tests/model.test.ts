import { describe, expect, it } from 'vitest';
import {
  AWAY_TEAM,
  BUILD_UP_TARGET,
  HOME_TEAM,
  MAX_ROUNDS,
  completePass,
  createMatch,
  getWinner,
  resolveShot,
  startAttack,
  totalDefense,
  type MatchState,
} from '../src/game/model';

function fillBuildUp(state: MatchState): MatchState {
  let next = startAttack(state);
  for (let pass = 0; pass < BUILD_UP_TARGET; pass += 1) {
    next = completePass(next);
  }
  return next;
}

function playAttack(state: MatchState, damage: number): MatchState {
  return resolveShot(fillBuildUp(state), damage);
}

describe('Football Battler match model', () => {
  it('builds each team defense from the cards', () => {
    const match = createMatch();

    expect(totalDefense(HOME_TEAM)).toBe(40);
    expect(totalDefense(AWAY_TEAM)).toBe(40);
    expect(match.home.defense).toBe(40);
    expect(match.away.defense).toBe(40);
  });

  it('turns four guaranteed passes into a shot', () => {
    let match = startAttack(createMatch());

    for (let pass = 1; pass < BUILD_UP_TARGET; pass += 1) {
      match = completePass(match);
      expect(match.phase).toBe('passing');
      expect(match.buildUp).toBe(pass);
    }

    match = completePass(match);
    expect(match.phase).toBe('shooting');
    expect(match.buildUp).toBe(BUILD_UP_TARGET);
  });

  it('carries defense damage into the next round', () => {
    let match = playAttack(createMatch(), 11);
    expect(match.away.defense).toBe(29);
    expect(match.attacking).toBe('away');

    match = playAttack(match, 7);
    expect(match.home.defense).toBe(33);
    expect(match.round).toBe(2);
    expect(match.attacking).toBe('home');
  });

  it('awards one point and resets defense when a shot breaks it', () => {
    let match = createMatch();
    match = playAttack(match, 40);

    expect(match.home.score).toBe(1);
    expect(match.away.defense).toBe(40);
    expect(match.lastShot).toMatchObject({ goal: true, defenseAfter: 0 });
  });

  it('ends after both teams have attacked in round five', () => {
    let match = createMatch();
    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      match = playAttack(match, 11);
      match = playAttack(match, 7);
    }

    expect(match.phase).toBe('finished');
    expect(match.round).toBe(MAX_ROUNDS);
    expect(match.home.score).toBe(1);
    expect(match.away.score).toBe(0);
    expect(getWinner(match)).toBe('home');
  });
});
