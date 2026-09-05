// Pure view models. The existing simulator and /api/live remain the source of truth.
export function currentNode(visitor, site) {
  const id = visitor.state === 'walking' ? visitor.target : visitor.node;
  return site.nodes.some(n => n.id === id) ? id : null;
}
export function snapshot(data, site) {
  const visitors = [...(data.visitors || new Map())].filter(([, v]) => v.state !== 'leaving');
  const occupants = new Map(site.nodes.map(n => [n.id, []]));
  for (const entry of visitors) occupants.get(currentNode(entry[1], site))?.push(entry);
  for (const entries of occupants.values()) entries.sort((a, b) => a[0].localeCompare(b[0]));
  return {
    visitors, occupants,
    activeNodes: [...occupants.values()].filter(a => a.length).length,
    moving: visitors.filter(([, v]) => v.state === 'walking').length,
    unavailable: !data.demo && (data.status === 'loading' || (data.status === 'error' && !data.updatedAt)),
    fresh: Boolean(data.demo || data.status === 'ready'),
  };
}
export function steps(visitor, site) {
  const valid = new Set(site.nodes.map(n => n.id));
  return (visitor?.visited || []).filter(s => valid.has(s.node));
}
export function journey(visitor, site) {
  const history = steps(visitor, site), result = [];
  for (let i = 1; i < history.length; i++) {
    if (history[i - 1].node !== history[i].node) result.push([history[i - 1].node, history[i].node]);
  }
  // A navigation in progress can already be recorded by the live API. Don't append it twice.
  if (visitor?.state === 'walking' && visitor.node !== visitor.target &&
      site.nodes.some(n => n.id === visitor.node) && site.nodes.some(n => n.id === visitor.target)) {
    const last = result.at(-1);
    if (!last || last[0] !== visitor.node || last[1] !== visitor.target) result.push([visitor.node, visitor.target]);
  }
  return result;
}
export function edgeKey(a, b) { return JSON.stringify([a, b].sort()); }
export function pageName(visitor, site) {
  return visitor.currentPath || site.nodes.find(n => n.id === currentNode(visitor, site))?.label || '未分类页面';
}
