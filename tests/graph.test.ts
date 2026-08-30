import { describe, expect, it } from 'vitest';
import {
  createTeamGraph,
  edgeKey,
  hasEdge,
  planPassingRoute,
} from '../src/game/graph';
import { BUILD_UP_TARGET, HOME_TEAM } from '../src/game/model';

describe('Layered passing graph', () => {
  it('connects neighbours within layers and compatible lanes across layers', () => {
    const graph = createTeamGraph(HOME_TEAM);
    const connections = graph.edges.map((edge) => edgeKey(edge.from, edge.to));

    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(6);
    expect(connections).toEqual(expect.arrayContaining([
      edgeKey('home-gk', 'home-cb'),
      edgeKey('home-m2', 'home-m1'),
      edgeKey('home-gk', 'home-m2'),
      edgeKey('home-cb', 'home-m1'),
      edgeKey('home-m2', 'home-st'),
      edgeKey('home-m1', 'home-st'),
    ]));
    expect(hasEdge(graph, 'home-gk', 'home-m1')).toBe(false);
  });

  it('plans a four-pass route over real graph edges and ends at the front', () => {
    const graph = createTeamGraph(HOME_TEAM);
    const route = planPassingRoute(graph, BUILD_UP_TARGET);

    expect(route).toEqual([
      'home-gk',
      'home-cb',
      'home-m1',
      'home-m2',
      'home-st',
    ]);
    expect(new Set(route)).toHaveLength(route.length);
    route.slice(1).forEach((playerId, index) => {
      expect(hasEdge(graph, route[index], playerId)).toBe(true);
    });
  });
});
