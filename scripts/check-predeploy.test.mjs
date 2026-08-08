import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runPredeployChecks, validatePredeployContract } from './check-predeploy.mjs';

const ORIGIN = 'https://www.astrocava.com';
const ACTUAL_CONTRACT = JSON.parse(
  fs.readFileSync(new URL('../PREDEPLOY_CONTRACT.json', import.meta.url), 'utf8'),
);
const PROTECTED_URLS = [
  '/arqueoastronomia/astronomia-en-el-paleolitico/',
  '/astrofotografia/procesado/el-histograma-en-astrofotografia/',
  '/observacion/catalogos-de-objetos-astronomicos/',
  '/observacion/el-cielo-de-invierno/',
  '/observacion/el-cielo-de-verano/',
];
const EXPECTED_REDIRECTS = [
  {
    from: '/astrofotografia/introduccion/objetivos-en-astrofotografia/',
    to: '/astrofotografia/adquisicion/objetivos-en-astrofotografia/',
  },
  {
    from: '/galeria/sistema-solar/el-planeta-jupiter/',
    to: '/observacion/el-planeta-jupiter/',
  },
  {
    from: '/galeria/sistema-solar/el-planeta-marte/',
    to: '/observacion/el-planeta-marte/',
  },
  {
    from: '/galeria/sistema-solar/el-planeta-saturno/',
    to: '/observacion/el-planeta-saturno/',
  },
  {
    from: '/observacion/transito-de-venus-en-junio-de-2004/',
    to: '/galeria/sistema-solar/transito-de-venus-en-junio-de-2004/',
  },
  { from: '/page/2/', to: '/' },
];

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function page({ route, body = '', description = 'Descripción técnica de prueba.' }) {
  const url = `${ORIGIN}${route}`;
  return `<!doctype html><html lang="es"><head><title>${route} | Astrocava</title><meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:url" content="${url}"></head><body><h1>Página ${route}</h1>${body}</body></html>`;
}

function redirectPage({ to = '/' } = {}) {
  return `<!doctype html><html><head><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${to}"><link rel="canonical" href="${new URL(to, ORIGIN)}"></head></html>`;
}

function write(root, publicPath, value) {
  const filePath = path.join(root, ...publicPath.split('/').filter(Boolean));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
  return filePath;
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-predeploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const image = Buffer.from('imagen-publica');
  const favicon = Buffer.from('favicon-publico');
  write(root, 'index.html', page({
    route: '/',
    body: '<a href="/licencias/#legal">Licencias</a><img src="/content/images/test.jpg" alt="Prueba">',
  }));
  write(root, 'licencias/index.html', page({ route: '/licencias/', body: '<a id="legal"></a><a href="/">Inicio</a>' }));
  write(root, 'page/2/index.html', redirectPage());
  write(root, 'content/images/test.jpg', image);
  write(root, 'favicon.ico', favicon);

  const sitemapIndex = `<?xml version="1.0"?><sitemapindex><sitemap><loc>${ORIGIN}/sitemap-0.xml</loc></sitemap></sitemapindex>`;
  write(root, 'sitemap-index.xml', sitemapIndex);
  write(root, 'sitemap.xml', sitemapIndex);
  write(root, 'sitemap-0.xml', `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/licencias/</loc></url></urlset>`);
  write(root, 'robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap-index.xml\n`);

  const contract = {
    schemaVersion: 2,
    canonicalOrigin: ORIGIN,
    baseline: 'Fixture pública mínima',
    legacyUrlCount: 1,
    expectedHtmlCount: 3,
    expectedImageFiles: 2,
    urls: ['/', '/licencias/'],
    protectedUrls: ['/'],
    redirects: [{ from: '/page/2/', to: '/' }],
  };
  const rightsManifest = {
    totals: { files: 2 },
    families: [
      { files: [{ path: '/content/images/test.jpg', bytes: image.length, sha256: digest(image) }] },
      { files: [{ path: '/favicon.ico', bytes: favicon.length, sha256: digest(favicon) }] },
    ],
  };
  return { root, contract, rightsManifest };
}

function run(fixture, scopes) {
  return runPredeployChecks({
    distRoot: fixture.root,
    contract: fixture.contract,
    rightsManifest: fixture.rightsManifest,
    scopes,
  });
}

test('acepta el build que satisface todo el contrato predeploy', (t) => {
  const fixture = createFixture(t);
  const result = run(fixture);
  assert.deepEqual(result.scopes, ['urls', 'links', 'images', 'seo', 'sitemap']);
  assert.equal(result.summary.urls.html, 3);
  assert.equal(result.summary.urls.content, 2);
  assert.equal(result.summary.urls.redirects, 1);
  assert.equal(result.summary.images.imageFiles, 2);
  assert.equal(result.summary.sitemap.sitemapUrls, 2);
});

test('fija los totales, las cinco URLs SEO y las compatibilidades del contrato público real', () => {
  assert.doesNotThrow(() => validatePredeployContract(ACTUAL_CONTRACT));
  assert.equal(ACTUAL_CONTRACT.legacyUrlCount, 161);
  assert.equal(ACTUAL_CONTRACT.expectedHtmlCount, 168);
  assert.equal(ACTUAL_CONTRACT.expectedImageFiles, 634);
  assert.deepEqual(ACTUAL_CONTRACT.protectedUrls, PROTECTED_URLS);
  assert.deepEqual(ACTUAL_CONTRACT.redirects, EXPECTED_REDIRECTS);
});

test('rechaza contratos con URLs no canónicas, desordenadas o no declaradas', () => {
  const base = {
    schemaVersion: 2,
    canonicalOrigin: ORIGIN,
    baseline: 'Prueba',
    legacyUrlCount: 1,
    expectedHtmlCount: 3,
    expectedImageFiles: 0,
    urls: ['/', '/licencias/'],
    protectedUrls: ['/'],
    redirects: [{ from: '/page/2/', to: '/' }],
  };
  assert.throws(() => validatePredeployContract({ ...base, urls: ['/licencias/', '/'] }), /ordenada/);
  assert.throws(() => validatePredeployContract({ ...base, urls: ['/', '/licencias'] }), /barra final/);
  assert.throws(() => validatePredeployContract({ ...base, protectedUrls: ['/', '/'] }), /duplicados/);
  assert.throws(() => validatePredeployContract({ ...base, privatePath: 'backup.sql' }), /Campo no permitido/);
});

test('rechaza redirects ausentes, incorrectos o incluidos en el sitemap', (t) => {
  const fixture = createFixture(t);
  write(fixture.root, 'page/2/index.html', redirectPage({ to: '/licencias/' }));
  assert.throws(() => run(fixture, ['urls']), /page\/2\/ redirige a .*licencias.* no a/);

  write(
    fixture.root,
    'page/2/index.html',
    redirectPage().replace('href="https://www.astrocava.com/"', 'href="http://["'),
  );
  assert.throws(() => run(fixture, ['urls']), /page\/2\/ debe declarar canonical/);

  write(
    fixture.root,
    'page/2/index.html',
    redirectPage().replace('<meta name="robots" content="noindex">', ''),
  );
  assert.throws(() => run(fixture, ['urls']), /page\/2\/ debe declarar noindex/);

  write(fixture.root, 'page/2/index.html', redirectPage());
  fs.writeFileSync(
    path.join(fixture.root, 'sitemap-0.xml'),
    `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/licencias/</loc></url><url><loc>${ORIGIN}/page/2/</loc></url></urlset>`,
  );
  assert.throws(() => run(fixture, ['sitemap']), /URL de sitemap extra: \/page\/2\//);
});

test('rechaza páginas HTML faltantes y extra', (t) => {
  const fixture = createFixture(t);
  fs.rmSync(path.join(fixture.root, 'licencias'), { recursive: true });
  write(fixture.root, 'extra/index.html', page({ route: '/extra/' }));
  assert.throws(() => run(fixture, ['urls']), /URL faltante: \/licencias\/[\s\S]*URL extra: \/extra\//);
});

test('rechaza enlaces internos y fragmentos rotos', (t) => {
  const fixture = createFixture(t);
  write(fixture.root, 'index.html', page({
    route: '/',
    body: '<a href="/ausente/">Ausente</a><a href="/licencias/#ausente">Fragmento</a>',
  }));
  assert.throws(() => run(fixture, ['links']), /ruta interna inexistente[\s\S]*fragmento inexistente/);
});

test('rechaza imágenes faltantes, extra, modificadas o no inventariadas', (t) => {
  const fixture = createFixture(t);
  fs.writeFileSync(path.join(fixture.root, 'content/images/test.jpg'), 'bytes-cambiados');
  write(fixture.root, 'assets/extra.jpg', 'extra');
  write(fixture.root, 'index.html', page({ route: '/', body: '<img src="/otra.jpg" alt="Otra">' }));
  assert.throws(() => run(fixture, ['images']), /Imagen construida extra[\s\S]*Bytes distintos[\s\S]*fuera del manifiesto/);
});

test('rechaza SEO básico incompleto y origen canónico incorrecto', (t) => {
  const fixture = createFixture(t);
  write(fixture.root, 'index.html', '<!doctype html><html><head><title></title><link rel="canonical" href="https://astrocava.com/"></head><body><h1></h1></body></html>');
  assert.throws(() => run(fixture, ['seo']), /lang="es"[\s\S]*meta description[\s\S]*canonical exacto/);
});

test('rechaza sitemap incompleto, alias distinto y robots bloqueante', (t) => {
  const fixture = createFixture(t);
  fs.writeFileSync(path.join(fixture.root, 'sitemap.xml'), 'distinto');
  fs.writeFileSync(path.join(fixture.root, 'sitemap-0.xml'), `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url></urlset>`);
  fs.writeFileSync(path.join(fixture.root, 'robots.txt'), `User-agent: *\nDisallow: /privado/\n`);
  assert.throws(() => run(fixture, ['sitemap']), /copia exacta[\s\S]*URL de sitemap faltante[\s\S]*no debe bloquear/);
});
