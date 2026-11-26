import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import OpenCC from 'opencc-js';

const site = new URL('https://posewear.pages.dev/');
const convertToTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const traditional = value => value ? convertToTraditional(value) : undefined;
const collections = {
  pose: 'poses',
  depth: 'depths',
  costume: 'costumes',
  anime: 'anime',
  dyn: 'dynasties',
  expr: 'expressions',
  hair: 'hair',
};

async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

const html = await read(site);
const scriptPath = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/app\.[a-f0-9]+\.js)["']/)?.[1];
if (!scriptPath) throw new Error('PoseWear gallery script not found');
const script = await read(new URL(scriptPath, site));
const assetHost = new URL(script.match(/\bconst AH=['"]([^'"]*)['"]/)?.[1] || site, site);
const files = new Map(
  Array.from(script.matchAll(/["'](\/assets\/([a-z]+)\.([a-f0-9]+)\.json)["']/g),
    ([, path, name, hash]) => [name, { path, hash }]),
);

function mediaUrl(path, base) {
  const url = new URL(path, base);
  if (url.protocol !== 'https:') throw new Error(`Unexpected media URL: ${url}`);
  return url.href;
}

function normalizeView(image, isVariant) {
  const display = isVariant ? image.i || image.m : image.m || image.i;
  const path = display || image.o || image.t;
  if (!path) throw new Error('Missing reference image');
  const imageUrl = mediaUrl(path, display ? site : assetHost);
  return {
    label: isVariant ? traditional(image.zh) || image.en : undefined,
    description: isVariant ? image.en : undefined,
    imageUrl,
    thumbnailUrl: image.t ? mediaUrl(image.t, assetHost) : imageUrl,
  };
}

async function loadCollection(collection, filename) {
  const file = files.get(filename);
  if (!file) throw new Error(`Missing PoseWear catalog: ${filename}`);
  const raw = await read(new URL(file.path, site));
  const digest = createHash('sha256').update(raw).digest('hex');
  if (!digest.startsWith(file.hash)) throw new Error(`Invalid catalog fingerprint: ${filename}`);
  const payload = JSON.parse(raw);
  const records = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(records) || records.length === 0) throw new Error(`Empty catalog: ${filename}`);
  const ids = new Set();
  const items = records.map(item => {
    if (!item.id || ids.has(item.id)) throw new Error(`Invalid ID in ${filename}: ${item.id}`);
    ids.add(item.id);
    const sourceText = [item.ti, item.cat, item.zh, ...(item.angles?.map(view => view.zh) ?? [])]
      .filter(value => value && traditional(value) !== value);
    return {
      id: item.id,
      collection,
      title: traditional(item.ti || item.zh) || item.id,
      category: traditional(item.cat),
      description: traditional(item.zh),
      prompt: [item.en || item.zh, item.lineEn].filter(Boolean).join(', '),
      keywords: item.kw,
      sourceText: sourceText.length ? [...new Set(sourceText)].join(' ') : undefined,
      adult: item.a ? true : undefined,
      views: item.angles?.length
        ? item.angles.map(view => normalizeView(view, true))
        : [normalizeView(item, false)],
    };
  });
  console.log(`${collection}: ${items.length}`);
  return items;
}

const catalogs = await Promise.all(Object.entries(collections).map(([collection, filename]) =>
  loadCollection(collection, filename),
));
const directory = new URL('../public/data/', import.meta.url);
await mkdir(directory, { recursive: true });
const lines = catalogs.flat().map(item => JSON.stringify(item));
await writeFile(new URL('posewear.json', directory), `[\n${lines.join(',\n')}\n]\n`);
