const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/root/tidestat/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
http.createServer((req, res) => {
  let f = req.url.split('?')[0];
  if (f === '/' || f === '') f = '/index.html';
  const file = ROOT + f.slice(1);
  try {
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.statusCode = 404; res.end('nf'); }
}).listen(8893, '127.0.0.1', () => console.log('up'));
