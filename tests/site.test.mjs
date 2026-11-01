import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parse } from 'parse5';
import { loadCatalog, readPackage, packageFile, root } from '../scripts/catalog.mjs';
import { renderSite } from '../scripts/render.mjs';
import { basePath, site } from '../site.config.mjs';

function elements(node, found = []) {
  if (node.tagName) found.push(node);
  for (const child of node.childNodes ?? []) elements(child, found);
  return found;
}
const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tern-bazaar-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const plugins = path.join(directory, 'plugins');
  const plugin = path.join(plugins, 'sidecar');
  await mkdir(plugin, { recursive: true });
  for (const file of ['plugin.toml', 'window.luau', 'README.md', 'LICENSE']) await writeFile(path.join(plugin, file), await readFile(path.join(root, 'plugins/sidecar', file)));
  return { directory, plugin };
}

async function change(file, before, after) {
  const source = await readFile(file, 'utf8');
  assert.ok(source.includes(before), 'fixture mutation must match');
  await writeFile(file, source.replace(before, after));
}


test('missing entry is rejected before rendering', async t => {
  const { plugin } = await fixture(t);
  await rm(path.join(plugin, 'window.luau'));
  await assert.rejects(readPackage(plugin), /ENOENT/);
});

test('unknown manifest fields cannot masquerade as runtime metadata', async t => {
  const { plugin } = await fixture(t);
  await writeFile(path.join(plugin, 'plugin.toml'), `${await readFile(path.join(plugin, 'plugin.toml'), 'utf8')}permissions = ["sandboxed"]\n`);
  await assert.rejects(readPackage(plugin), /unknown manifest key permissions/);
});

test('entry paths cannot escape through traversal or symlinks', async t => {
  const { directory, plugin } = await fixture(t);
  await writeFile(path.join(directory, 'outside.luau'), 'return {}');
  await assert.rejects(packageFile(plugin, '../../outside.luau'), /Unsafe package path/);
  await symlink(path.join(directory, 'outside.luau'), path.join(plugin, 'escaped.luau'));
  await assert.rejects(packageFile(plugin, 'escaped.luau'), /escapes/);
  await assert.rejects(packageFile(plugin, '/tmp/a.luau'), /Unsafe package path/);
  await assert.rejects(packageFile(plugin, 'C:\\a.luau'), /Unsafe package path/);
});

test('invalid versions and missing README are rejected', async t => {
  const { plugin } = await fixture(t);
  const manifest = path.join(plugin, 'plugin.toml');
  const version = (await readPackage(plugin)).version;
  await change(manifest, `version = "${version}"`, 'version = "latest"');
  await assert.rejects(readPackage(plugin), /semantic version/);
  await change(manifest, 'version = "latest"', `version = "${version}"`);
  const readme = path.join(plugin, 'README.md');
  await rm(readme);
  await assert.rejects(readPackage(plugin), /ENOENT/);
});

test('package license must ship with the installable folder', async t => {
  const { plugin } = await fixture(t);
  await rm(path.join(plugin, 'LICENSE'));
  await assert.rejects(readPackage(plugin), /ENOENT/);
});

test('conflicting display names and directory identities are rejected', async t => {
  const { directory, plugin } = await fixture(t);
  const second = path.join(directory, 'plugins/another');
  await mkdir(second);
  for (const file of ['plugin.toml', 'window.luau', 'README.md', 'LICENSE']) await writeFile(path.join(second, file), await readFile(path.join(plugin, file)));
  await change(path.join(second, 'plugin.toml'), 'id = "sidecar"', 'id = "another"');
  const readme = path.join(second, 'README.md');
  await writeFile(readme, (await readFile(readme, 'utf8')).replaceAll('tern-bazaar/plugins/sidecar', 'tern-bazaar/plugins/another'));
  await assert.rejects(loadCatalog(directory), /Conflicting plugin identity/);
  await change(path.join(second, 'plugin.toml'), 'id = "another"', 'id = "wrong"');
  await assert.rejects(loadCatalog(directory), /must match/);
});

test('unsafe README URLs and missing local documentation resources are rejected', async t => {
  const { plugin } = await fixture(t);
  const readme = path.join(plugin, 'README.md');
  const source = await readFile(readme, 'utf8');
  await writeFile(readme, `${source}\n[bad link](javascript:alert)\n`);
  await assert.rejects(readPackage(plugin), /unsupported documentation URL/);
  await writeFile(readme, `${source}\n[missing file](missing.txt)\n`);
  await assert.rejects(readPackage(plugin), /ENOENT/);
});

test('BASE_PATH accepts root and project deployment paths, rejects unsafe paths', () => {
  assert.equal(basePath(''), '');
  assert.equal(basePath('/'), '');
  assert.equal(basePath('/tern-bazaar/'), '/tern-bazaar');
  for (const value of ['https://evil.example', '/../bad', '/x?y', '//bad', '/a\\b']) assert.throws(() => basePath(value));
});

for (const base of ['', '/tern-bazaar/']) {
  test(`rendered documents have resolved links, assets, and accessible controls at ${base || 'root'}`, async () => {
    const plugins = await loadCatalog();
    const pages = renderSite(plugins, base);
    const prefix = basePath(base);
    const docs = new Map([...pages].filter(([file]) => file.endsWith('.html')).map(([file, html]) => [file, elements(parse(html))]));
    for (const [file, nodes] of docs) {
      assert.equal(nodes.filter(n => n.tagName === 'main').length, 1, file);
      assert.equal(nodes.filter(n => n.tagName === 'h1').length, 1, file);
      const ids = nodes.map(n => attr(n, 'id')).filter(Boolean);
      assert.equal(ids.length, new Set(ids).size, `${file}: duplicate ids`);
      const canonical = nodes.find(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical');
      assert.ok(attr(canonical, 'href').startsWith(`https://${site.domain}${prefix}/`));
      for (const node of nodes) {
        if (node.tagName === 'button') assert.ok(text(node).trim(), `${file}: button needs a name`);
        if (['input', 'select'].includes(node.tagName)) assert.ok(nodes.some(label => label.tagName === 'label' && attr(label, 'for') === attr(node, 'id')), `${file}: label missing`);
        for (const attribute of ['href', 'src']) {
          const href = attr(node, attribute);
          if (!href || /^https:\/\//.test(href)) continue;
          const current = new URL(`${prefix}/${file}`, 'https://local.invalid');
          const target = new URL(href, current);
          assert.equal(target.origin, current.origin, `${file}: unsupported URL ${href}`);
          assert.ok(target.pathname.startsWith(`${prefix}/`), `${file}: loses BASE_PATH ${href}`);
          let relative = decodeURIComponent(target.pathname.slice(prefix.length + 1));
          if (relative === '' || relative.endsWith('/')) relative += 'index.html';
          if (pages.has(relative)) {
            if (target.hash) assert.ok(docs.get(relative)?.some(n => attr(n, 'id') === target.hash.slice(1)), `${file}: missing anchor ${href}`);
          } else await access(path.join(root, 'public', relative));
        }
      }
    }
  });
}

test('README HTML is escaped in generated detail pages', async () => {
  const [plugin] = await loadCatalog();
  const pages = renderSite([{ ...plugin, body: `${plugin.body}\n<script>alert("no")</script>\n` }]);
  const nodes = elements(parse(pages.get(`plugins/${plugin.id}/index.html`)));
  const scripts = nodes.filter(n => n.tagName === 'script');
  assert.ok(!scripts.some(n => text(n).includes('alert')));
});
