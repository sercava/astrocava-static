import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  BRITISH_MUSEUM_ALGOL,
  CODE_COPYRIGHT_NOTICE,
  HEVELIUS_VENUS_TRANSIT,
  HUBBLE_DEEP_FIELD,
  JAMIESON_LASCAUX_COMPOSITION,
  MIDJOURNEY_ATTRIBUTION,
  OWN_CONTENT_LICENSE,
  PELICAN_NEBULA_COMPARISON,
  PUBLIC_AUTHOR_NAME,
  PUBLIC_CONTENT_ATTRIBUTION,
  RAINBOW_DENALI,
  UNIFIED_GEOLOGIC_MAP_MOON,
} from './licensing-contract.mjs';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (...segments) =>
  readFile(join(PROJECT_ROOT, ...segments), 'utf8');

test('el contrato de licencias fija la identidad y las licencias acordadas', () => {
  assert.equal(PUBLIC_AUTHOR_NAME, 'Sergio Cava');
  assert.equal(PUBLIC_CONTENT_ATTRIBUTION, 'Sergio Cava / Astrocava');
  assert.equal(CODE_COPYRIGHT_NOTICE, 'Copyright (c) 2026 Sergio Cava');
  assert.equal(OWN_CONTENT_LICENSE.shortName, 'CC BY 4.0');
  assert.equal(
    OWN_CONTENT_LICENSE.url,
    'https://creativecommons.org/licenses/by/4.0/',
  );
});

test('los manifests remiten a la licencia de alcance mixto', async () => {
  const manifest = JSON.parse(await readProjectFile('package.json'));
  const lock = JSON.parse(await readProjectFile('package-lock.json'));

  assert.equal(manifest.license, 'SEE LICENSE IN LICENSE.md');
  assert.equal(lock.packages[''].license, 'SEE LICENSE IN LICENSE.md');
  assert.equal(
    manifest.scripts['test:licensing'],
    'node --test --test-isolation=none scripts/licensing.test.mjs',
  );
});

test('LICENSE separa MIT, texto editorial e imágenes opt-in', async () => {
  const license = await readProjectFile('LICENSE.md');

  assert.ok(license.includes(CODE_COPYRIGHT_NOTICE));
  assert.ok(license.includes('Permission is hereby granted, free of charge'));
  assert.ok(license.includes(OWN_CONTENT_LICENSE.url));
  assert.ok(license.includes(PUBLIC_CONTENT_ATTRIBUTION));
  assert.match(license, /imagen queda bajo CC BY 4\.0 únicamente/i);
  assert.match(license, /`RIGHTS_MANIFEST\.json`[^\n]+`OWNED_CC_BY_4_0`/i);
  assert.match(
    license,
    /(?:no|tampoco) incluye el aviso legal ni la política de cookies/i,
  );
});

test('NOTICE y ATTRIBUTIONS conservan el contrato del British Museum', async () => {
  const [notice, attributions] = await Promise.all([
    readProjectFile('NOTICE.md'),
    readProjectFile('ATTRIBUTIONS.md'),
  ]);

  for (const document of [notice, attributions]) {
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.originalPath));
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.variantPath));
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.credit));
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.sourceUrl));
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.license));
    assert.ok(document.includes(BRITISH_MUSEUM_ALGOL.licenseUrl));
    assert.match(document, /no comercial/i);
  }
});

test('ATTRIBUTIONS documenta el rediseño asistido de la infografía de Marte', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  assert.match(attributions, /marte-mejores-oposiciones\.jpg/);
  assert.match(attributions, /OpenAI ImageGen/);
  assert.match(attributions, /revisión editorial de la geometría orbital/);
  assert.match(attributions, /rotulación estacional boreal/);
  assert.match(attributions, /variantes `size\/w600`, `size\/w1000`/);
});

test('ATTRIBUTIONS no declara variantes inexistentes de Lascaux', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  assert.ok(
    attributions.includes(
      '/content/images/2024/04/astronomia-paleolitico-pintura-rupestre-lascaux.jpg',
    ),
  );
  assert.match(
    attributions,
    /pintura-rupestre-lascaux\.jpg` y variante `size\/w1200`/,
  );
  assert.doesNotMatch(
    attributions,
    /pintura-rupestre-lascaux\.jpg`[^\n]*`size\/w600`/,
  );
});

test('ATTRIBUTIONS documenta la composición Jamieson/Lascaux bajo ShareAlike', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  for (const path of [
    JAMIESON_LASCAUX_COMPOSITION.originalPath,
    ...JAMIESON_LASCAUX_COMPOSITION.variantPaths,
  ]) {
    const abbreviated = path.replace('/content/images/size/', 'size/').replace(
      '/2024/04/astronomia-paleolitico-celestial-atlas-alexander-jamieson-1822-toro-lascaux.jpg',
      '',
    );
    if (path === JAMIESON_LASCAUX_COMPOSITION.originalPath) {
      assert.ok(attributions.includes(path));
    } else {
      assert.ok(attributions.includes(`\`${abbreviated}\``));
    }
  }
  for (const value of [
    JAMIESON_LASCAUX_COMPOSITION.photoHolder,
    JAMIESON_LASCAUX_COMPOSITION.photoSourceUrl,
    JAMIESON_LASCAUX_COMPOSITION.jamiesonSourceUrl,
    JAMIESON_LASCAUX_COMPOSITION.license,
    JAMIESON_LASCAUX_COMPOSITION.licenseUrl,
  ]) {
    assert.ok(attributions.includes(value));
  }
  assert.match(attributions, /recorte de ambas fuentes, composición, redimensionado y recodificación JPEG/i);
  assert.match(attributions, /la lámina de Jamieson permanece en dominio público/i);
});

test('ATTRIBUTIONS documenta el Campo Profundo del Hubble bajo las condiciones de NASA', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  for (const value of [
    HUBBLE_DEEP_FIELD.originalPath,
    HUBBLE_DEEP_FIELD.credit,
    HUBBLE_DEEP_FIELD.sourceUrl,
    HUBBLE_DEEP_FIELD.jplSourceUrl,
    HUBBLE_DEEP_FIELD.license,
    HUBBLE_DEEP_FIELD.licenseUrl,
    HUBBLE_DEEP_FIELD.modifications,
  ]) {
    assert.ok(attributions.includes(value));
  }
  assert.match(attributions, /`THIRD-PARTY`/);
});

test('ATTRIBUTIONS documenta el mapa lunar y sus dos variantes bajo CC0', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  for (const value of [
    UNIFIED_GEOLOGIC_MAP_MOON.originalPath,
    UNIFIED_GEOLOGIC_MAP_MOON.credit,
    UNIFIED_GEOLOGIC_MAP_MOON.sourceUrl,
    UNIFIED_GEOLOGIC_MAP_MOON.license,
    UNIFIED_GEOLOGIC_MAP_MOON.licenseUrl,
    UNIFIED_GEOLOGIC_MAP_MOON.modifications,
  ]) {
    assert.ok(attributions.includes(value));
  }
  assert.match(
    attributions,
    /luna-llena-en-color-mapa-geologia\.jpg` y variantes `size\/w600`, `size\/w1000`/,
  );
});

test('ATTRIBUTIONS documenta la copia ETH del tránsito como dominio público', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');

  for (const value of [
    HEVELIUS_VENUS_TRANSIT.originalPath,
    HEVELIUS_VENUS_TRANSIT.credit,
    HEVELIUS_VENUS_TRANSIT.sourceUrl,
    HEVELIUS_VENUS_TRANSIT.doiUrl,
    HEVELIUS_VENUS_TRANSIT.license,
    HEVELIUS_VENUS_TRANSIT.licenseUrl,
    HEVELIUS_VENUS_TRANSIT.modifications,
  ]) {
    assert.ok(attributions.includes(value));
  }
  assert.match(attributions, /ETH-Bibliothek Zürich/);
});

test('los avisos y documentos remiten al inventario público exacto', async () => {
  const [notice, attributions, readme, manifestText] = await Promise.all([
    readProjectFile('NOTICE.md'),
    readProjectFile('ATTRIBUTIONS.md'),
    readProjectFile('README.md'),
    readProjectFile('RIGHTS_MANIFEST.json'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.deepEqual(manifest.totals, { families: 272, files: 634 });
  assert.equal(
    manifest.inventoryDigest,
    'e408d2230baffbf031aa7e1cc7506ee5b300ffd367b208e7036c1d22f27d62e8',
  );
  for (const document of [notice, attributions, readme]) {
    assert.ok(document.includes('RIGHTS_MANIFEST.json'));
    assert.match(document, /272 familias[^\n]+634/i);
    assert.doesNotMatch(document, /inventario[^\n]+(?:incompleto|parcial)/i);
  }
});

test('ATTRIBUTIONS documenta arcoíris, pelícano y alcance Midjourney', async () => {
  const attributions = await readProjectFile('ATTRIBUTIONS.md');
  for (const value of [
    RAINBOW_DENALI.originalPath,
    RAINBOW_DENALI.sourceUrl,
    RAINBOW_DENALI.license,
    PELICAN_NEBULA_COMPARISON.originalPath,
    PELICAN_NEBULA_COMPARISON.sourceUrl,
    MIDJOURNEY_ATTRIBUTION.credit,
  ]) {
    assert.ok(attributions.includes(value), value);
  }
  assert.match(attributions, /PD-USGov-FWS/);
  assert.match(attributions, /Christoph Strässler[^\n]+Wikimedia Commons/i);
  assert.match(attributions, /aportaciones humanas[^\n]+no afirma autoría humana exclusiva/i);
  assert.match(attributions, /nunca como fotografías, mapas u observaciones científicas/i);
});

test('la página pública usa el contrato y tiene canonical estable', async () => {
  const [page, layout] = await Promise.all([
    readProjectFile('src', 'pages', 'licencias', 'index.astro'),
    readProjectFile('src', 'layouts', 'BaseLayout.astro'),
  ]);

  assert.ok(page.includes("const canonicalUrl = 'https://www.astrocava.com/licencias/'"));
  assert.ok(page.includes('CODE_COPYRIGHT_NOTICE'));
  assert.ok(page.includes('PUBLIC_CONTENT_ATTRIBUTION'));
  assert.ok(page.includes('OWN_CONTENT_LICENSE'));
  assert.ok(page.includes('BRITISH_MUSEUM_ALGOL'));
  assert.ok(page.includes('MIDJOURNEY_ATTRIBUTION'));
  assert.ok(page.includes('RIGHTS_MANIFEST.json'));

  for (const href of [
    '/info/',
    '/aviso-legal/',
    '/politica-de-cookies/',
    '/licencias/',
  ]) {
    assert.ok(layout.includes(`href="${href}"`));
  }
});
