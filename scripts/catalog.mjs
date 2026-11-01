import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import { marked } from 'marked';
import { site } from '../site.config.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['schema', 'id', 'name', 'version', 'description', 'icon', 'host', 'window', 'styles', 'blocks', 'lenses']);
const platforms = new Set(['macOS', 'Linux', 'Windows', 'iOS']);
const fail = (message) => { throw new Error(message); };
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const list = (v, field, allowEmpty = false) => {
  if (!Array.isArray(v) || (!allowEmpty && !v.length) || v.some(x => !nonempty(x))) fail(`${field} must be an array of nonempty strings`);
};

export async function packageFile(dir, relative) {
  if (!nonempty(relative) || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative) || relative.split('/').some(p => p === '..' || p === '') || /^[a-z]:/i.test(relative)) fail(`Unsafe package path: ${relative}`);
  const base = await realpath(dir);
  const file = await realpath(path.resolve(dir, relative));
  if (!file.startsWith(`${base}${path.sep}`) || !(await stat(file)).isFile()) fail(`Package path escapes directory or is not a file: ${relative}`);
  return file;
}

export async function readPackage(dir, folder = path.basename(dir)) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(folder)) fail(`Invalid package folder: ${folder}`);
  const manifestText = await readFile(await packageFile(dir, 'plugin.toml'), 'utf8');
  if (Buffer.byteLength(manifestText) > 65536) fail(`${folder}: manifest exceeds 64 KiB`);
  const manifest = parse(manifestText);
  for (const key of Object.keys(manifest)) if (!allowed.has(key)) fail(`${folder}: unknown manifest key ${key}`);
  if (manifest.schema !== 1) fail(`${folder}: schema must be 1`);
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(manifest.id) || manifest.id !== folder) fail(`${folder}: manifest id must match its install folder`);
  if (!nonempty(manifest.name) || [...manifest.name].length > 64) fail(`${folder}: invalid name`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) fail(`${folder}: use a semantic version`);
  if (!nonempty(manifest.description) || /[\r\n]/.test(manifest.description)) fail(`${folder}: description must be one line`);
  if (!manifest.host && !manifest.window) fail(`${folder}: missing host or window entry`);
  for (const half of ['host', 'window']) {
    if (manifest[half] !== undefined) {
      if (typeof manifest[half] !== 'string' || !/\.lua(u)?$/.test(manifest[half])) fail(`${folder}: ${half} must name a Luau entry`);
      const file = await packageFile(dir, manifest[half]);
      if (!(await readFile(file, 'utf8')).trim()) fail(`${folder}: empty ${half} entry`);
    }
  }
  list(manifest.styles ?? [], `${folder}: styles`, true);
  let styleBytes = 0;
  for (const file of manifest.styles ?? []) styleBytes += (await readFile(await packageFile(dir, file))).length + 1;
  if (styleBytes > 262144) fail(`${folder}: styles exceed 256 KiB`);
  for (const kind of ['blocks', 'lenses']) {
    const declarations = manifest[kind] ?? [];
    if (!Array.isArray(declarations)) fail(`${folder}: ${kind} must be an array`);
    if (declarations.length && !manifest.host) fail(`${folder}: ${kind} needs a host entry`);
    const ids = new Set();
    for (const declaration of declarations) {
      const keys = kind === 'blocks' ? ['id', 'title', 'icon', 'files', 'palette'] : ['id', 'match'];
      if (Object.keys(declaration).some(k => !keys.includes(k))) fail(`${folder}: unknown ${kind} declaration key`);
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(declaration.id) || ids.has(declaration.id)) fail(`${folder}: invalid or duplicate ${kind} id`);
      ids.add(declaration.id);
      if (kind === 'blocks') {
        if (!nonempty(declaration.title)) fail(`${folder}: block needs a title`);
        if (declaration.files !== undefined) list(declaration.files, 'block files', true);
        if (declaration.palette !== undefined && typeof declaration.palette !== 'boolean') fail(`${folder}: palette must be boolean`);
      } else list(declaration.match, 'lens match');
    }
  }
  const readme = await readFile(await packageFile(dir, 'README.md'), 'utf8');
  const metadata = readme.match(/^<!-- bazaar\r?\n([\s\S]*?)\r?\n-->\r?\n/);
  if (!metadata) fail(`${folder}: README needs a bazaar metadata comment`);
  const catalog = parse(metadata[1]);
  const catalogKeys = ['category', 'platforms', 'dependencies', 'permissions', 'api'];
  if (Object.keys(catalog).some(k => !catalogKeys.includes(k))) fail(`${folder}: unknown catalog metadata key`);
  if (!nonempty(catalog.category)) fail(`${folder}: missing category`);
  for (const field of ['platforms', 'dependencies', 'permissions']) list(catalog[field], `${folder}: ${field}`);
  if (catalog.platforms.some(p => !platforms.has(p))) fail(`${folder}: unknown platform`);
  if (typeof catalog.api !== 'string' || !catalog.api.startsWith('https://docs.stencil.so/tern/')) fail(`${folder}: link the Tern API documentation`);
  await packageFile(dir, 'LICENSE');
  const source = `${site.installSource}/plugins/${manifest.id}`;
  const install = `tern plugin install ${source}`;
  if (!readme.includes(install)) fail(`${folder}: README must contain the exact install command`);
  const body = readme.slice(metadata[0].length);
  const localLinks = [];
  marked.walkTokens(marked.lexer(body), token => {
    if (!['link', 'image'].includes(token.type)) return;
    const href = token.href;
    if (href.startsWith('#')) return;
    if (/^https:\/\//.test(href)) { new URL(href); return; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) fail(`${folder}: unsupported documentation URL ${href}`);
    localLinks.push(href.split('#')[0]);
  });
  await Promise.all(localLinks.map(file => packageFile(dir, decodeURIComponent(file))));
  return { ...manifest, ...catalog, body, folder, install, source: `${site.repository}/tree/main/plugins/${folder}`, docs: `${site.repository}/blob/main/plugins/${folder}/README.md` };
}

export async function loadCatalog(directory = root) {
  const packages = path.join(directory, 'plugins');
  const entries = await readdir(packages, { withFileTypes: true });
  const plugins = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) fail(`plugins/${entry.name} must be a package directory`);
    plugins.push(await readPackage(path.join(packages, entry.name), entry.name));
  }
  if (!plugins.length) fail('The directory must contain at least one installable plugin');
  const ids = new Set(), names = new Set();
  for (const plugin of plugins) {
    const name = plugin.name.normalize('NFKC').toLowerCase();
    if (ids.has(plugin.id) || names.has(name)) fail(`Conflicting plugin identity: ${plugin.id}`);
    ids.add(plugin.id); names.add(name);
  }
  return plugins;
}
