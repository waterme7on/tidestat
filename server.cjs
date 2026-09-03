const http = require('http'), fs = require('fs');
http.createServer((req, res) => {
  const f = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
  try {
    res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(fs.readFileSync(f));
  } catch { res.statusCode = 404; res.end('nf'); }
}).listen(8893, '127.0.0.1', () => console.log('up'));
