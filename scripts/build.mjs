import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadCatalog, root } from './catalog.mjs';
import { renderSite } from './render.mjs';
import { basePath } from '../site.config.mjs';

const catalog = await loadCatalog();
const pages = renderSite(catalog, basePath());
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
for (const [filename, content] of pages) {
  const destination = path.join(output, filename);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}
console.log(`Built ${catalog.length} real plugin listing(s) and ${pages.size} documents in dist/`);
