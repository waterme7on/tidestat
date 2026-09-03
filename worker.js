// TideStat Worker:collect API + live aggregation + tracker script + static assets.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

const TRACKER = `(function () {
  var s = document.currentScript;
  var origin = new URL(s.src).origin;
  var vid = localStorage.getItem("__tide_vid");
  if (!vid) {
    vid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem("__tide_vid", vid);
  }
  function send() {
    var payload = JSON.stringify({
      v: vid,
      p: location.pathname + location.hash,
      r: document.referrer || "",
      w: innerWidth,
      site: location.hostname
    });
    try {
      navigator.sendBeacon(origin + "/api/collect", new Blob([payload], { type: "application/json" }));
    } catch (e) {
      fetch(origin + "/api/collect", { method: "POST", body: payload, keepalive: true });
    }
  }
  send();
  var push = history.pushState;
  history.pushState = function () {
    push.apply(this, arguments);
    send();
  };
  window.addEventListener("popstate", send);
})();`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS }
  });
}

function deviceFromUA(ua) {
  if (/Mobile|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/t.js" && request.method === "GET") {
      return new Response(TRACKER, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          ...CORS
        }
      });
    }

    if (url.pathname === "/api/collect" && request.method === "POST") {
      try {
        const body = await request.json();
        const visitorId = String(body.v || "").slice(0, 64);
        const path = String(body.p || "/").slice(0, 512);
        if (!visitorId) return json({ ok: false }, 400);
        const cf = request.cf || {};
        const ts = Date.now();
        await env.DB.prepare(
          "INSERT INTO events (visitor_id, ts, path, city, country, lat, lng, referrer, device, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          visitorId,
          ts,
          path,
          cf.city || null,
          cf.country || null,
          cf.latitude ? Number(cf.latitude) : null,
          cf.longitude ? Number(cf.longitude) : null,
          String(body.r || "").slice(0, 256),
          deviceFromUA(request.headers.get("user-agent") || ""),
          String(body.site || url.hostname).slice(0, 128)
        ).run();
        if (Math.random() < 0.02) {
          await env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(ts - 86_400_000).run();
        }
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: "bad request" }, 400);
      }
    }

    if (url.pathname === "/api/live" && request.method === "GET") {
      const now = Date.now();
      const windowMs = 10 * 60 * 1000;
      const onlineMs = 90 * 1000;
      const { results } = await env.DB.prepare(
        `SELECT visitor_id, ts, path, city, country, lat, lng, device
         FROM events WHERE ts > ? ORDER BY ts ASC LIMIT 2000`
      ).bind(now - windowMs).all();
      const map = new Map();
      for (const row of results) {
        let v = map.get(row.visitor_id);
        if (!v) {
          v = {
            id: row.visitor_id,
            city: row.city || "未知",
            country: row.country || "",
            lat: row.lat,
            lng: row.lng,
            device: row.device || "desktop",
            firstTs: row.ts,
            lastTs: row.ts,
            paths: []
          };
          map.set(row.visitor_id, v);
        }
        v.lastTs = row.ts;
        if (row.lat != null) { v.lat = row.lat; v.lng = row.lng; }
        if (row.city) v.city = row.city;
        const prev = v.paths[v.paths.length - 1];
        if (!prev || prev.path !== row.path) v.paths.push({ path: row.path, ts: row.ts });
        if (v.paths.length > 12) v.paths.shift();
      }
      const visitors = [...map.values()].filter(v => now - v.lastTs < onlineMs);
      return new Response(JSON.stringify({ now, onlineMs, visitors }), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
