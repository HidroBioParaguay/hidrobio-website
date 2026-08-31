/**
 * HidroBio Public Website
 *
 * Serves hidrobio.com.py — the company's public-facing website.
 *
 * @author HidroBio S.A.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3006;
const VERSION = '1.1.0';
const START_TIME = Date.now();

// Contador de visitas a páginas (en memoria; se reinicia con cada despliegue).
// Sirve para medir, por ejemplo, cuántos escanearon el QR del póster del LivingTech.
// No guarda IP ni datos personales: sólo la ruta pedida.
const pageHits = Object.create(null);

function countPageView(pathname) {
  pageHits[pathname] = (pageHits[pathname] || 0) + 1;
  console.log(`[hit] ${pathname} — ${pageHits[pathname]}`);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// Cache static assets for 1 day, HTML for 1 hour
const CACHE_DURATION = {
  '.html': 'public, max-age=3600',
  '.jpg': 'public, max-age=86400',
  '.jpeg': 'public, max-age=86400',
  '.png': 'public, max-age=86400',
  '.webp': 'public, max-age=86400',
  '.svg': 'public, max-age=86400',
  '.ico': 'public, max-age=86400',
  '.woff2': 'public, max-age=604800',
  '.woff': 'public, max-age=604800',
  '.mp4': 'public, max-age=86400',
  '.webm': 'public, max-age=86400'
};

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'hidrobio-website',
      version: VERSION,
      uptime: `${uptimeSeconds}s`,
      pageViews: pageHits
    }));
    return;
  }

  // Branded short link → Zoho Forms visit request
  if (pathname === '/visita' || pathname === '/visita/') {
    res.writeHead(302, {
      Location: 'https://forms.hidrobio.com.py/hidrobio/form/SolicituddeVisita/formperma/Nyt6RiL7YKqwl9dGXbPIMvTrrQuEaUkvykEM-0naprU'
    });
    res.end();
    return;
  }

  // Cuenta sólo vistas de página (rutas sin extensión de archivo), no assets
  if (!path.extname(pathname)) {
    countPageView(pathname);
  }

  // Directory index: serve index.html for paths ending in /
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  let filePath = path.join(__dirname, 'public', pathname);
  let ext = path.extname(filePath);

  // Bare-path directory (e.g. /privacidad): if it points to a directory with
  // index.html, serve that instead of falling through to the SPA fallback.
  if (!ext) {
    try {
      if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        ext = '.html';
      }
    } catch {}
  }

  // Video: responder por rangos. Sin esto, Safari en iOS no reproduce.
  if (ext === '.mp4' || ext === '.webm') {
    try {
      const { size } = fs.statSync(filePath);
      const range = req.headers.range;
      const baseHeaders = {
        'Content-Type': MIME_TYPES[ext],
        'Accept-Ranges': 'bytes',
        'Cache-Control': CACHE_DURATION[ext]
      };

      if (range) {
        const [rawStart, rawEnd] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(rawStart, 10) || 0;
        const end = rawEnd ? Math.min(parseInt(rawEnd, 10), size - 1) : size - 1;

        if (start >= size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          res.end();
          return;
        }

        res.writeHead(206, {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': end - start + 1
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, { ...baseHeaders, 'Content-Length': size });
      fs.createReadStream(filePath).pipe(res);
      return;
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
  }

  try {
    const content = fs.readFileSync(filePath);
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    };
    if (CACHE_DURATION[ext]) {
      headers['Cache-Control'] = CACHE_DURATION[ext];
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    // 404 → serve index.html (SPA fallback)
    try {
      const indexContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexContent);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[HidroBio Website] Running on port ${PORT}`);
  console.log(`[HidroBio Website] Open http://localhost:${PORT}`);
});
