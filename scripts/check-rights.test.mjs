import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  checkRights,
  collectPublicRightsInventory,
} from './check-rights.mjs';
import {
  EXPECTED_FINAL_RIGHTS_TOTALS,
  MIDJOURNEY_FAMILY_PATHS,
  MIDJOURNEY_PUBLIC_CONTRACT,
  OWNED_BRAND_CONTRACT,
} from './rights-contract.mjs';

const AI_PATH = '/content/images/2024/04/test-midjourney.jpg';
const EXPECTED_TOTALS = { families: 2, files: 2 };

async function createFixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'astrocava-check-rights-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const publicRoot = path.join(root, 'public');
  const entriesRoot = path.join(root, 'entries');
  const aiFile = path.join(publicRoot, 'content/images/2024/04/test-midjourney.jpg');
  const faviconFile = path.join(publicRoot, 'favicon.ico');
  await fs.promises.mkdir(path.dirname(aiFile), { recursive: true });
  await fs.promises.mkdir(entriesRoot, { recursive: true });
  await fs.promises.writeFile(aiFile, 'ai-image');
  await fs.promises.writeFile(faviconFile, 'favicon');
  const entryPath = path.join(entriesRoot, 'entrada.md');
  await fs.promises.writeFile(
    entryPath,
    `---
slug: entrada
feature_image: ${AI_PATH}
feature_image_alt: Ilustración de prueba generada mediante IA
feature_image_caption: Ilustración conceptual de prueba; no es una observación científica.
feature_image_credit: ${MIDJOURNEY_PUBLIC_CONTRACT.credit}
feature_image_license: ${MIDJOURNEY_PUBLIC_CONTRACT.visibleLicenseLabel}
feature_image_license_url: "${MIDJOURNEY_PUBLIC_CONTRACT.licenseUrl}"
og_image: ${AI_PATH}
twitter_image: ${AI_PATH}
---
<p>Contenido.</p>
`,
  );

  const inventory = collectPublicRightsInventory(publicRoot);
  const families = inventory.families.map((family) => {
    const ai = family.canonicalPath === AI_PATH;
    return {
      canonicalPath: family.canonicalPath,
      classification: ai ? 'AI_GENERATED_MIDJOURNEY' : 'OWNED_CC_BY_4_0',
      holder: 'Sergio Cava',
      licenseId: 'CC-BY-4.0',
      licenseUrl: MIDJOURNEY_PUBLIC_CONTRACT.licenseUrl,
      credit: ai ? MIDJOURNEY_PUBLIC_CONTRACT.credit : 'Sergio Cava / Astrocava',
      sourceUrls: ai
        ? ['https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service']
        : ['https://www.astrocava.com/'],
      modifications: '',
      verifiedOn: '2026-07-12',
      familyDigest: family.familyDigest,
      files: family.files,
      ...(ai
        ? {
            mediaType: MIDJOURNEY_PUBLIC_CONTRACT.mediaType,
            generator: MIDJOURNEY_PUBLIC_CONTRACT.generator,
            licenseScope: MIDJOURNEY_PUBLIC_CONTRACT.licenseScope,
          }
        : {}),
    };
  });
  const manifest = {
    schemaVersion: 1,
    inventoryDigest: inventory.inventoryDigest,
    verifiedOn: '2026-07-12',
    totals: { ...EXPECTED_TOTALS },
    families,
  };
  const manifestPath = path.join(root, 'RIGHTS_MANIFEST.json');
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { root, publicRoot, entriesRoot, entryPath, manifestPath, manifest, aiFile };
}

function runFixture(fixture) {
  return checkRights({
    manifestPath: fixture.manifestPath,
    publicRoot: fixture.publicRoot,
    entriesRoot: fixture.entriesRoot,
    expectedTotals: EXPECTED_TOTALS,
    expectedMidjourneyPaths: [AI_PATH],
  });
}

async function writeManifest(fixture) {
  await fs.promises.writeFile(
    fixture.manifestPath,
    JSON.stringify(fixture.manifest, null, 2),
  );
}

test('el contrato fija el árbol final y las nueve familias Midjourney', () => {
  assert.deepEqual(EXPECTED_FINAL_RIGHTS_TOTALS, { families: 282, files: 670 });
  assert.equal(MIDJOURNEY_FAMILY_PATHS.length, 9);
  assert.equal(new Set(MIDJOURNEY_FAMILY_PATHS).size, 9);
});

test('check:rights acepta el árbol, hashes y rotulación exactos', async (t) => {
  const fixture = await createFixture(t);
  const result = runFixture(fixture);
  assert.deepEqual(result.inventory.totals, EXPECTED_TOTALS);
});

test('check:rights rechaza bytes cambiados bajo una ruta conocida', async (t) => {
  const fixture = await createFixture(t);
  await fs.promises.writeFile(fixture.aiFile, 'changed-image');
  assert.throws(() => runFixture(fixture), /no coincide con el inventario|bytes públicos cambiaron/);
});

test('check:rights rechaza archivos públicos extra', async (t) => {
  const fixture = await createFixture(t);
  await fs.promises.writeFile(
    path.join(fixture.publicRoot, 'content/images/2024/04/extra.jpg'),
    'extra',
  );
  assert.throws(() => runFixture(fixture), /contiene 3 familias\/3 archivos/);
});

test('check:rights rechaza archivos públicos faltantes', async (t) => {
  const fixture = await createFixture(t);
  await fs.promises.rm(fixture.aiFile);
  assert.throws(() => runFixture(fixture), /contiene 1 familias\/1 archivos/);
});

test('check:rights rechaza estados bloqueantes aunque los hashes coincidan', async (t) => {
  const fixture = await createFixture(t);
  const ai = fixture.manifest.families.find((family) => family.canonicalPath === AI_PATH);
  ai.classification = 'AI_PROVENANCE_UNVERIFIED';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /classification no es publicable/);
});

test('check:rights rechaza campos privados o desconocidos', async (t) => {
  const fixture = await createFixture(t);
  fixture.manifest.families[0].privateNote = 'secreto';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /campo no permitido privateNote/);
});

test('check:rights rechaza rutas con traversal', async (t) => {
  const fixture = await createFixture(t);
  const ai = fixture.manifest.families.find((family) => family.canonicalPath === AI_PATH);
  ai.files[0].path = '/content/images/../private.txt';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /ruta pública canónica/);
});

test('check:rights exige que las Midjourney se clasifiquen como ilustraciones', async (t) => {
  const fixture = await createFixture(t);
  const ai = fixture.manifest.families.find((family) => family.canonicalPath === AI_PATH);
  ai.mediaType = 'photograph';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /contrato público de Midjourney/);
});

test('check:rights exige crédito y rotulación visible en las entradas', async (t) => {
  const fixture = await createFixture(t);
  const markdown = await fs.promises.readFile(fixture.entryPath, 'utf8');
  await fs.promises.writeFile(
    fixture.entryPath,
    markdown.replace('feature_image_caption: Ilustración', 'feature_image_caption: Imagen'),
  );
  assert.throws(() => runFixture(fixture), /no rotula la portada Midjourney como ilustración/);
});

test('check:rights no admite una Midjourney usada solo como imagen social', async (t) => {
  const fixture = await createFixture(t);
  const markdown = await fs.promises.readFile(fixture.entryPath, 'utf8');
  await fs.promises.writeFile(
    fixture.entryPath,
    markdown.replace(`feature_image: ${AI_PATH}`, 'feature_image: /favicon.ico'),
  );
  assert.throws(() => runFixture(fixture), /Midjourney social sin la misma portada rotulada/);
});

test('check:rights rechaza una licencia propia que contradice CC BY 4.0', async (t) => {
  const fixture = await createFixture(t);
  const owned = fixture.manifest.families.find((family) => family.canonicalPath === '/favicon.ico');
  owned.licenseId = 'CC-BY-SA-4.0';
  owned.licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /contrato CC BY 4.0 de obra propia/);
});

test('check:rights acepta el favicon reservado y rechaza que se relicencie', async (t) => {
  const fixture = await createFixture(t);
  const favicon = fixture.manifest.families.find((family) => family.canonicalPath === '/favicon.ico');
  favicon.classification = 'OWNED_BRAND_ALL_RIGHTS_RESERVED';
  favicon.licenseId = OWNED_BRAND_CONTRACT.licenseId;
  favicon.licenseUrl = OWNED_BRAND_CONTRACT.licenseUrl;
  await writeManifest(fixture);
  assert.doesNotThrow(() => runFixture(fixture));

  favicon.licenseId = 'CC-BY-4.0';
  favicon.licenseUrl = 'https://creativecommons.org/licenses/by/4.0/';
  await writeManifest(fixture);
  assert.throws(() => runFixture(fixture), /identidad visual reservada/);
});

test('check:rights rechaza Midjourney incrustada mediante Markdown', async (t) => {
  const fixture = await createFixture(t);
  await fs.promises.appendFile(
    fixture.entryPath,
    `\n![Fotografía científica](${AI_PATH})\n`,
  );
  assert.throws(() => runFixture(fixture), /sintaxis Markdown sin pie visible acreditado/);
});

test('check:rights inspecciona también entradas MDX', async (t) => {
  const fixture = await createFixture(t);
  const mdxPath = path.join(fixture.entriesRoot, 'entrada-adicional.mdx');
  await fs.promises.writeFile(
    mdxPath,
    `---\nslug: entrada-adicional\n---\n![Imagen](${AI_PATH})\n`,
  );
  assert.throws(() => runFixture(fixture), /sintaxis Markdown sin pie visible acreditado/);
});

test('check:rights rechaza referencias y componentes MDX sin figura acreditada', async (t) => {
  const fixture = await createFixture(t);
  const mdxPath = path.join(fixture.entriesRoot, 'componente.mdx');
  await fs.promises.writeFile(
    mdxPath,
    `---\nslug: componente\n---\n<Image src={"${AI_PATH}"} alt="Imagen" />\n`,
  );
  assert.throws(() => runFixture(fixture), /fuera de una portada o figura acreditada/);
});
