import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const useStagingRuntime = process.env.MATH_SURVIVAL_STAGING_CONFIG === '1';
const stagingSupabaseUrl = String(process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const stagingPublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY ?? '');

if (useStagingRuntime) {
  if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(stagingSupabaseUrl)) {
    throw new Error('SUPABASE_URL must be a hosted project URL when staging runtime is enabled');
  }
  if (!stagingPublishableKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY must be a modern publishable key when staging runtime is enabled');
  }
}

function stagingRuntimeSource() {
  return `globalThis.MathSurvivalCloudRuntime = Object.freeze(${JSON.stringify({
    provider: 'supabase',
    supabaseUrl: stagingSupabaseUrl,
    supabasePublishableKey: stagingPublishableKey,
    fallbackReadsToGas: false
  })});\n`;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.md': 'text/markdown; charset=utf-8'
};

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (useStagingRuntime && pathname === '/js/cloud-runtime-config.js') {
    const source = stagingRuntimeSource();
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(request.method === 'HEAD' ? undefined : source);
    return;
  }

  let path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(path).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(path).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Math Survival test server listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
