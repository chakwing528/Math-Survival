import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'playwright-report', 'test-results']);
const failures = [];

function filesUnder(directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const result = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(relative(root, path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

function fail(message) {
  failures.push(message);
}

const javascriptFiles = [
  ...filesUnder('js'),
  ...filesUnder('scripts'),
  ...filesUnder('tests'),
  join(root, 'playwright.config.js')
].filter(path => existsSync(path) && ['.js', '.mjs', '.cjs'].includes(extname(path)));

for (const path of javascriptFiles) {
  const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (check.status !== 0) fail(`${relative(root, path)}: JavaScript syntax check failed\n${check.stderr.trim()}`);
}

const jsonFiles = [join(root, 'package.json'), join(root, 'package-lock.json'), join(root, '.claude/launch.json')]
  .filter(existsSync);
for (const path of jsonFiles) {
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${relative(root, path)}: invalid JSON (${error.message})`);
  }
}

const markdownFiles = [join(root, 'README.md'), join(root, 'AGENTS.md'), join(root, 'HANDOFF.md'), ...filesUnder('docs')]
  .filter(path => extname(path) === '.md');
const markdownLinkPattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;
for (const path of markdownFiles) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(markdownLinkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.replace(/\s+["'][^"']*["']$/, '');
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = decodeURIComponent(target.split('#', 1)[0]);
    if (!target) continue;
    const resolved = isAbsolute(target) ? target : resolve(dirname(path), target);
    if (!existsSync(resolved)) fail(`${relative(root, path)}: broken local link "${match[1]}"`);
  }
}

const versionSources = [join(root, 'index.html'), ...filesUnder('js')]
  .filter(path => existsSync(path) && ['.html', '.js'].includes(extname(path)));
const cacheVersions = new Set();
for (const path of versionSources) {
  for (const match of readFileSync(path, 'utf8').matchAll(/\?v=(\d+)/g)) cacheVersions.add(match[1]);
}
if (cacheVersions.size !== 1) {
  fail(`cache query versions must be identical; found: ${[...cacheVersions].join(', ') || 'none'}`);
} else {
  const index = readFileSync(join(root, 'index.html'), 'utf8');
  const screenVersion = index.match(/Math Survival FPS V(\d+)\.(\d+)/);
  const cacheVersion = [...cacheVersions][0];
  if (!screenVersion) fail('index.html: screen version tag not found');
  else if (`${screenVersion[1]}${screenVersion[2]}` !== cacheVersion) {
    fail(`screen version V${screenVersion[1]}.${screenVersion[2]} does not match cache version ${cacheVersion}`);
  }
}

const modelReferences = new Set();
for (const match of readFileSync(join(root, 'js/assets.js'), 'utf8').matchAll(/['"]([^/'"]+\.glb)['"]/g)) {
  modelReferences.add(`assets/models/${match[1]}`);
}
for (const model of modelReferences) {
  const path = join(root, model);
  if (!existsSync(path) || !statSync(path).isFile()) fail(`missing model asset: ${model}`);
}

if (failures.length) {
  console.error(`Static validation failed with ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Static validation passed: ${javascriptFiles.length} JavaScript files, ${jsonFiles.length} JSON files, ${markdownFiles.length} Markdown files, ${modelReferences.size} model references, cache v${[...cacheVersions][0]}.`);
