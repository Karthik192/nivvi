import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') {
      response.writeHead(302, { Location: '/preview/index.html' }).end();
      return;
    }
    const relative = pathname.slice(1);
    const target = resolve(root, relative);
    if (!target.startsWith(`${resolve(root)}${sep}`) || !mime[extname(target)]) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(target);
    response.writeHead(200, {
      'Content-Type': mime[extname(target)],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(4173, '127.0.0.1', () => { console.log('Nivvi design preview: http://127.0.0.1:4173'); });
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
