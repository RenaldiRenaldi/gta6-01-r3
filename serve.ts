import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./game/', import.meta.url));
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const path = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(resolve(root) + sep)) throw new Error('outside root');
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'content-length': info.size, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Street not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`TWELVE DEBTS · http://localhost:${port}`));
