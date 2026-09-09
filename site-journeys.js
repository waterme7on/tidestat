// A bounded view of observed pages, never a guessed sitemap. Input is one authorized /api/live response.
export function pagePath(path) {
  return typeof path === 'string' && path.startsWith('/') ? path.split(/[?#]/)[0] : null;
}
export function siteJourneys(visitors, limit = 36) {
  const pages = new Map(), transitions = new Map();
  for (const visitor of visitors) {
    let previous = null;
    for (const step of visitor.paths || []) {
      const path = pagePath(step.path);
      if (!path) { previous = null; continue; }
      pages.set(path, Math.max(pages.get(path) || 0, Number(step.ts) || 0));
      // Missing session IDs cannot establish that two observations are one journey.
      if (previous && step.sessionId && previous.sessionId === step.sessionId && previous.path !== path) {
        const key = JSON.stringify([previous.path, path]);
        transitions.set(key, (transitions.get(key) || 0) + 1);
      }
      previous = {...step, path};
    }
  }
  const ids = [...pages].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([path])=>path).sort();
  const included = new Set(ids), columns = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / columns);
  const nodes = ids.map((id,i)=>({id,label:id,kind:id==='/'?'core':'house',x:columns===1?.5:.08+(i%columns)*.84/(columns-1),y:rows===1?.48:.08+Math.floor(i/columns)*.8/(rows-1)}));
  const edges = [...transitions].map(([key,count])=>[...JSON.parse(key),count]).filter(([a,b])=>included.has(a)&&included.has(b));
  return {observed:true,nodes,edges,entry:null,totalPages:pages.size,omittedPages:Math.max(0,pages.size-nodes.length)};
}
