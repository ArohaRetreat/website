// Route over the same drawn paths, never a straight line across the pond/buildings.
export function makeGuideNetwork(paths) {
  const nodes = [],
    edges = [];
  const trunkCount = paths[0]?.length || 0;
  for (const points of paths) {
    const ids = points.map((point) => {
      const id = nodes.length;
      nodes.push(point);
      edges.push([]);
      return id;
    });
    for (let i = 1; i < ids.length; i++) connect(ids[i - 1], ids[i]);
    if (ids[0] > 0) {
      let nearest = 0;
      for (let i = 1; i < trunkCount; i++)
        if (
          distance(nodes[i], nodes[ids[0]]) <
          distance(nodes[nearest], nodes[ids[0]])
        )
          nearest = i;
      connect(nearest, ids[0]);
    }
  }
  function connect(a, b) {
    const length = distance(nodes[a], nodes[b]);
    edges[a].push([b, length]);
    edges[b].push([a, length]);
  }
  return { nodes, edges };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function guideRoute(network, from, to) {
  const { nodes, edges } = network;
  const nearest = (p) =>
    nodes.reduce(
      (best, n, i) => (distance(n, p) < distance(nodes[best], p) ? i : best),
      0,
    );
  const start = nearest(from),
    end = nearest(to),
    cost = nodes.map(() => Infinity),
    previous = [],
    visited = new Set();
  cost[start] = 0;
  while (visited.size < nodes.length) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (u < 0 || cost[i] < cost[u])) u = i;
    if (u < 0 || !Number.isFinite(cost[u])) break;
    if (u === end) break;
    visited.add(u);
    for (const [v, d] of edges[u])
      if (cost[u] + d < cost[v]) {
        cost[v] = cost[u] + d;
        previous[v] = u;
      }
  }
  const route = [];
  let id = end;
  while (id !== undefined) {
    route.unshift(nodes[id]);
    if (id === start) break;
    id = previous[id];
  }
  return [from, ...route];
}
