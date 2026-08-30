import { describe, expect, it } from 'vitest';
import {
  createTeamGraph,
  edgeKey,
  hasEdge,
  planPassingRoute,
} from '../src/game/graph';
import { AWAY_TEAM, BUILD_UP_TARGET, HOME_TEAM } from '../src/game/model';

describe('Layered passing graph', () => {
  it('connects neighbours within layers and compatible lanes across layers', () => {
    const graph = createTeamGraph(HOME_TEAM);

    expect(graph.nodes).toHaveLength(11);
    expect(graph.edges).toHaveLength(20);
    expect(hasEdge(graph, 'home-gk', 'home-lb')).toBe(true);
    expect(hasEdge(graph, 'home-gk', 'home-rb')).toBe(true);
    expect(hasEdge(graph, 'home-lb', 'home-lcb')).toBe(true);
    expect(hasEdge(graph, 'home-lcb', 'home-cm')).toBe(true);
    expect(hasEdge(graph, 'home-cm', 'home-st')).toBe(true);
    expect(hasEdge(graph, 'home-gk', 'home-cm')).toBe(false);
  });

  it('creates visibly different graphs for the two formations', () => {
    const homeGraph = createTeamGraph(HOME_TEAM);
    const awayGraph = createTeamGraph(AWAY_TEAM);

    expect(awayGraph.nodes).toHaveLength(11);
    expect(awayGraph.edges).toHaveLength(23);
    expect(homeGraph.edges.map((edge) => edgeKey(edge.from, edge.to)))
      .not.toEqual(awayGraph.edges.map((edge) => edgeKey(edge.from, edge.to)));
  });

  it.each([
    ['Home', HOME_TEAM],
    ['Away', AWAY_TEAM],
  ])('plans a four-pass %s route over real edges and into attack', (_name, team) => {
    const graph = createTeamGraph(team);
    const route = planPassingRoute(graph, BUILD_UP_TARGET);
    const finalPlayer = team.players.find((player) => player.id === route[route.length - 1]);

    expect(route).toHaveLength(BUILD_UP_TARGET + 1);
    expect(new Set(route)).toHaveLength(route.length);
    expect(finalPlayer?.layer).toBe('attack');
    route.slice(1).forEach((playerId, index) => {
      expect(hasEdge(graph, route[index], playerId)).toBe(true);
    });
  });
});
