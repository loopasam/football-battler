import type {
  PlayerDefinition,
  PlayerLane,
  PlayerLayer,
  TeamDefinition,
} from './model';

export type PassEdgeKind = 'forward' | 'lateral';

export interface PlayerNode {
  player: PlayerDefinition;
  layerIndex: number;
  laneIndex: number;
}

export interface PassEdge {
  from: string;
  to: string;
  kind: PassEdgeKind;
}

export interface TeamGraph {
  nodes: PlayerNode[];
  edges: PassEdge[];
}

const LAYER_INDEX: Record<PlayerLayer, number> = {
  back: 0,
  middle: 1,
  front: 2,
};

const LANE_INDEX: Record<PlayerLane, number> = {
  left: -1,
  center: 0,
  right: 1,
};

export function createTeamGraph(team: TeamDefinition): TeamGraph {
  const nodes = team.players.map((player) => ({
    player,
    layerIndex: LAYER_INDEX[player.layer],
    laneIndex: LANE_INDEX[player.lane],
  }));
  const edges: PassEdge[] = [];

  for (let layerIndex = 0; layerIndex <= 2; layerIndex += 1) {
    const layerNodes = nodes
      .filter((node) => node.layerIndex === layerIndex)
      .sort((left, right) => left.laneIndex - right.laneIndex);

    for (let index = 0; index < layerNodes.length - 1; index += 1) {
      edges.push({
        from: layerNodes[index].player.id,
        to: layerNodes[index + 1].player.id,
        kind: 'lateral',
      });
    }
  }

  for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
    const lowerNodes = nodes.filter((node) => node.layerIndex === layerIndex);
    const upperNodes = nodes.filter((node) => node.layerIndex === layerIndex + 1);

    lowerNodes.forEach((lowerNode) => {
      const compatible = upperNodes.filter(
        (upperNode) => Math.abs(lowerNode.laneIndex - upperNode.laneIndex) <= 1,
      );
      const targets = compatible.length > 0
        ? compatible
        : [...upperNodes].sort(
          (left, right) => Math.abs(lowerNode.laneIndex - left.laneIndex)
            - Math.abs(lowerNode.laneIndex - right.laneIndex),
        ).slice(0, 1);

      targets.forEach((upperNode) => {
        edges.push({
          from: lowerNode.player.id,
          to: upperNode.player.id,
          kind: 'forward',
        });
      });
    });
  }

  return { nodes, edges };
}

export function edgeKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join('::');
}

export function hasEdge(graph: TeamGraph, firstId: string, secondId: string): boolean {
  const targetKey = edgeKey(firstId, secondId);
  return graph.edges.some((edge) => edgeKey(edge.from, edge.to) === targetKey);
}

export function connectedPlayerIds(graph: TeamGraph, playerId: string): string[] {
  return graph.edges.flatMap((edge) => {
    if (edge.from === playerId) return [edge.to];
    if (edge.to === playerId) return [edge.from];
    return [];
  });
}

export function planPassingRoute(graph: TeamGraph, passCount: number): string[] {
  if (!Number.isInteger(passCount) || passCount < 1) {
    throw new Error('A passing route needs at least one pass.');
  }

  const startingNodes = graph.nodes
    .filter((node) => node.layerIndex === Math.min(...graph.nodes.map((candidate) => candidate.layerIndex)))
    .sort((left, right) => left.laneIndex - right.laneIndex || left.player.id.localeCompare(right.player.id));
  const start = startingNodes[0];
  if (!start) throw new Error('A passing route needs at least one player node.');

  const routes: string[][] = [];
  const search = (route: string[], allowRevisit: boolean): void => {
    if (route.length === passCount + 1) {
      routes.push(route);
      return;
    }

    const currentId = route[route.length - 1];
    connectedPlayerIds(graph, currentId)
      .filter((nextId) => allowRevisit || !route.includes(nextId))
      .sort()
      .forEach((nextId) => search([...route, nextId], allowRevisit));
  };

  search([start.player.id], false);
  if (routes.length === 0) search([start.player.id], true);
  if (routes.length === 0) throw new Error(`The graph cannot support ${passCount} passes.`);

  const nodeById = new Map(graph.nodes.map((node) => [node.player.id, node]));
  const score = (route: string[]): number => {
    const finalNode = nodeById.get(route[route.length - 1]);
    if (!finalNode) return Number.NEGATIVE_INFINITY;
    const uniquePlayers = new Set(route).size;
    return uniquePlayers * 1000 + finalNode.layerIndex * 100 + finalNode.player.attack;
  };

  return routes.sort((left, right) => score(right) - score(left) || left.join().localeCompare(right.join()))[0];
}
