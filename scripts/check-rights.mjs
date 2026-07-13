#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_FINAL_RIGHTS_TOTALS,
  MIDJOURNEY_FAMILY_PATHS,
  MIDJOURNEY_PUBLIC_CONTRACT,
  OWNED_BRAND_CONTRACT,
  OWNED_CC_BY_4_0_CONTRACT,
  PUBLIC_RIGHTS_CLASSIFICATIONS,
  PUBLIC_RIGHTS_MANIFEST_FILENAME,
  PUBLIC_RIGHTS_MANIFEST_SCHEMA_VERSION,
  canonicalRightsFamilyPath,
  comparePublicPaths,
  familyDigestForFiles,
  inventoryDigestForFamilies,
  sha256Bytes,
} from './rights-contract.mjs';

const PROJECT_ROOT = path.join(dirnameFromImportMeta(), '..');
const DEFAULT_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  PUBLIC_RIGHTS_MANIFEST_FILENAME,
);
const DEFAULT_PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const DEFAULT_ENTRIES_ROOT = path.join(PROJECT_ROOT, 'src/content/entries');

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'inventoryDigest',
  'verifiedOn',
  'totals',
  'families',
]);
const TOTAL_KEYS = new Set(['families', 'files']);
const FAMILY_KEYS = new Set([
  'canonicalPath',
  'classification',
  'holder',
  'licenseId',
  'licenseUrl',
  'credit',
  'sourceUrls',
  'modifications',
  'verifiedOn',
  'familyDigest',
  'files',
  'mediaType',
  'generator',
  'licenseScope',
]);
const FILE_KEYS = new Set(['path', 'bytes', 'sha256']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_PATTERN = /\p{Cc}/u;

function dirnameFromImportMeta() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto`);
  }
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contiene el campo no permitido ${key}`);
  }
}

function assertString(value, label, { required = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${label} debe ser texto`);
  if (CONTROL_PATTERN.test(value)) throw new Error(`${label} contiene caracteres de control`);
  if (required && !value.trim()) throw new Error(`${label} es obligatorio`);
}

function assertUrl(value, label, { required = false } = {}) {
  assertString(value, label, { required });
  if (!value) return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} no es una URL válida`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`${label} debe usar http o https`);
  }
}

function assertPublicPath(value, label) {
  assertString(value, label, { required: true });
  if (
    value.includes('\\') ||
    /%(?:2e|2f|5c)/i.test(value) ||
    value.includes('?') ||
    value.includes('#') ||
    path.posix.normalize(value) !== value ||
    value.includes('//')
  ) {
    throw new Error(`${label} no es una ruta pública canónica`);
  }
  if (value !== '/favicon.ico' && !value.startsWith('/content/images/')) {
    throw new Error(`${label} queda fuera del alcance de imágenes públicas`);
  }
}

function assertSortedUnique(values, label) {
  const sorted = [...values].sort(comparePublicPaths);
  if (new Set(values).size !== values.length) throw new Error(`${label} contiene duplicados`);
  if (JSON.stringify(values) !== JSON.stringify(sorted)) {
    throw new Error(`${label} debe estar ordenado de forma canónica`);
  }
}

function assertDate(value, label) {
  assertString(value, label, { required: true });
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} debe usar YYYY-MM-DD`);
  }
}

function validateFamilyMetadata(family, index) {
  const label = `families[${index}]`;
  assertPlainObject(family, label);
  assertExactKeys(family, FAMILY_KEYS, label);
  assertPublicPath(family.canonicalPath, `${label}.canonicalPath`);
  if (canonicalRightsFamilyPath(family.canonicalPath) !== family.canonicalPath) {
    throw new Error(`${label}.canonicalPath no puede ser una variante de tamaño`);
  }
  if (!PUBLIC_RIGHTS_CLASSIFICATIONS.includes(family.classification)) {
    throw new Error(`${label}.classification no es publicable: ${family.classification}`);
  }
  for (const field of ['holder', 'licenseId', 'credit', 'modifications']) {
    assertString(family[field], `${label}.${field}`);
  }
  assertUrl(family.licenseUrl, `${label}.licenseUrl`);
  assertDate(family.verifiedOn, `${label}.verifiedOn`);
  if (!SHA256_PATTERN.test(family.familyDigest ?? '')) {
    throw new Error(`${label}.familyDigest no es SHA-256`);
  }
  if (!Array.isArray(family.sourceUrls)) throw new Error(`${label}.sourceUrls debe ser una lista`);
  if (new Set(family.sourceUrls).size !== family.sourceUrls.length) {
    throw new Error(`${label}.sourceUrls contiene duplicados`);
  }
  family.sourceUrls.forEach((url, sourceIndex) =>
    assertUrl(url, `${label}.sourceUrls[${sourceIndex}]`, { required: true }),
  );

  if (!Array.isArray(family.files) || family.files.length === 0) {
    throw new Error(`${label}.files debe contener al menos una ruta`);
  }
  const filePaths = [];
  family.files.forEach((file, fileIndex) => {
    const fileLabel = `${label}.files[${fileIndex}]`;
    assertPlainObject(file, fileLabel);
    assertExactKeys(file, FILE_KEYS, fileLabel);
    assertPublicPath(file.path, `${fileLabel}.path`);
    if (canonicalRightsFamilyPath(file.path) !== family.canonicalPath) {
      throw new Error(`${fileLabel}.path no pertenece a ${family.canonicalPath}`);
    }
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new Error(`${fileLabel}.bytes debe ser un entero no negativo`);
    }
    if (!SHA256_PATTERN.test(file.sha256 ?? '')) {
      throw new Error(`${fileLabel}.sha256 no es SHA-256`);
    }
    filePaths.push(file.path);
  });
  assertSortedUnique(filePaths, `${label}.files`);
  if (familyDigestForFiles(family.files) !== family.familyDigest) {
    throw new Error(`${label}.familyDigest no coincide con sus archivos`);
  }

  const requires = (...fields) => {
    for (const field of fields) {
      const value = family[field];
      if (Array.isArray(value) ? value.length === 0 : !value) {
        throw new Error(`${label}.${field} es obligatorio para ${family.classification}`);
      }
    }
  };

  if (family.classification === 'OWNED_CC_BY_4_0') {
    requires('holder', 'licenseId', 'licenseUrl', 'credit');
    if (
      family.licenseId !== OWNED_CC_BY_4_0_CONTRACT.licenseId ||
      family.licenseUrl !== OWNED_CC_BY_4_0_CONTRACT.licenseUrl
    ) {
      throw new Error(`${label} no conserva el contrato CC BY 4.0 de obra propia`);
    }
  }
  if (family.classification === 'OWNED_BRAND_ALL_RIGHTS_RESERVED') {
    requires('holder', 'licenseId');
    if (
      family.licenseId !== OWNED_BRAND_CONTRACT.licenseId ||
      family.licenseUrl !== OWNED_BRAND_CONTRACT.licenseUrl
    ) {
      throw new Error(`${label} no conserva el contrato de identidad visual reservada`);
    }
  }
  if (family.classification === 'THIRD_PARTY_LICENSED') {
    requires('holder', 'licenseId', 'licenseUrl', 'credit', 'sourceUrls');
  }
  if (family.classification === 'PUBLIC_DOMAIN') {
    requires('licenseId', 'credit', 'sourceUrls');
  }
  if (family.classification === 'PERMISSION_DOCUMENTED') {
    requires('holder', 'credit', 'sourceUrls');
  }

  const aiFields = ['mediaType', 'generator', 'licenseScope'];
  if (family.classification === 'AI_GENERATED_MIDJOURNEY') {
    requires(
      'holder',
      'licenseId',
      'licenseUrl',
      'credit',
      'sourceUrls',
      ...aiFields,
    );
    if (
      family.mediaType !== MIDJOURNEY_PUBLIC_CONTRACT.mediaType ||
      family.generator !== MIDJOURNEY_PUBLIC_CONTRACT.generator ||
      family.credit !== MIDJOURNEY_PUBLIC_CONTRACT.credit ||
      family.licenseId !== MIDJOURNEY_PUBLIC_CONTRACT.licenseId ||
      family.licenseUrl !== MIDJOURNEY_PUBLIC_CONTRACT.licenseUrl ||
      family.licenseScope !== MIDJOURNEY_PUBLIC_CONTRACT.licenseScope
    ) {
      throw new Error(`${label} no conserva el contrato público de Midjourney`);
    }
  } else {
    for (const field of aiFields) {
      if (Object.hasOwn(family, field)) {
        throw new Error(`${label}.${field} solo se admite para Midjourney`);
      }
    }
  }
}

export function validateRightsManifestShape(
  manifest,
  {
    expectedTotals = EXPECTED_FINAL_RIGHTS_TOTALS,
    expectedMidjourneyPaths = MIDJOURNEY_FAMILY_PATHS,
  } = {},
) {
  assertPlainObject(manifest, 'El manifiesto');
  assertExactKeys(manifest, TOP_LEVEL_KEYS, 'El manifiesto');
  if (manifest.schemaVersion !== PUBLIC_RIGHTS_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Schema público no soportado: ${manifest.schemaVersion}`);
  }
  if (!SHA256_PATTERN.test(manifest.inventoryDigest ?? '')) {
    throw new Error('inventoryDigest no es SHA-256');
  }
  assertDate(manifest.verifiedOn, 'verifiedOn');
  assertPlainObject(manifest.totals, 'totals');
  assertExactKeys(manifest.totals, TOTAL_KEYS, 'totals');
  for (const field of ['families', 'files']) {
    if (!Number.isSafeInteger(manifest.totals[field]) || manifest.totals[field] < 0) {
      throw new Error(`totals.${field} debe ser un entero no negativo`);
    }
    if (expectedTotals && manifest.totals[field] !== expectedTotals[field]) {
      throw new Error(
        `totals.${field}=${manifest.totals[field]}; se esperaban ${expectedTotals[field]}`,
      );
    }
  }
  if (!Array.isArray(manifest.families)) throw new Error('families debe ser una lista');
  manifest.families.forEach(validateFamilyMetadata);
  const canonicalPaths = manifest.families.map((family) => family.canonicalPath);
  assertSortedUnique(canonicalPaths, 'families');
  const allFiles = manifest.families.flatMap((family) => family.files.map((file) => file.path));
  if (new Set(allFiles).size !== allFiles.length) {
    throw new Error('Una ruta aparece en más de una familia');
  }
  if (
    manifest.totals.families !== manifest.families.length ||
    manifest.totals.files !== allFiles.length
  ) {
    throw new Error('Los totales no coinciden con las familias y archivos declarados');
  }
  if (inventoryDigestForFamilies(manifest.families) !== manifest.inventoryDigest) {
    throw new Error('inventoryDigest no coincide con las familias declaradas');
  }
  const aiPaths = manifest.families
    .filter((family) => family.classification === 'AI_GENERATED_MIDJOURNEY')
    .map((family) => family.canonicalPath)
    .sort(comparePublicPaths);
  const expectedAiPaths = [...expectedMidjourneyPaths].sort(comparePublicPaths);
  if (JSON.stringify(aiPaths) !== JSON.stringify(expectedAiPaths)) {
    throw new Error('Las familias Midjourney no coinciden con el contrato público exacto');
  }
  return manifest;
}

function filesRecursively(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`No se admiten enlaces simbólicos: ${entryPath}`);
    }
    if (entry.isDirectory()) files.push(...filesRecursively(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function publicPathForFile(filePath, publicRoot) {
  const relative = path.relative(publicRoot, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Archivo fuera de public/: ${filePath}`);
  }
  return `/${relative.split(path.sep).join('/')}`;
}

export function collectPublicRightsInventory(publicRoot = DEFAULT_PUBLIC_ROOT) {
  const imagesRoot = path.join(publicRoot, 'content/images');
  if (!fs.existsSync(imagesRoot) || !fs.lstatSync(imagesRoot).isDirectory()) {
    throw new Error('Falta public/content/images/');
  }
  const favicon = path.join(publicRoot, 'favicon.ico');
  if (!fs.existsSync(favicon)) throw new Error('Falta public/favicon.ico');
  const faviconStat = fs.lstatSync(favicon);
  if (faviconStat.isSymbolicLink() || !faviconStat.isFile()) {
    throw new Error('public/favicon.ico debe ser un archivo regular');
  }
  const paths = [...filesRecursively(imagesRoot), favicon].sort((left, right) =>
    comparePublicPaths(publicPathForFile(left, publicRoot), publicPathForFile(right, publicRoot)),
  );
  const groups = new Map();
  for (const filePath of paths) {
    const publicPath = publicPathForFile(filePath, publicRoot);
    assertPublicPath(publicPath, `ruta ${publicPath}`);
    const bytes = fs.readFileSync(filePath);
    const canonicalPath = canonicalRightsFamilyPath(publicPath);
    const files = groups.get(canonicalPath) ?? [];
    files.push({ path: publicPath, bytes: bytes.length, sha256: sha256Bytes(bytes) });
    groups.set(canonicalPath, files);
  }
  const families = [...groups.entries()]
    .sort(([left], [right]) => comparePublicPaths(left, right))
    .map(([canonicalPath, files]) => ({
      canonicalPath,
      files: files.sort((left, right) => comparePublicPaths(left.path, right.path)),
      familyDigest: familyDigestForFiles(files),
    }));
  return {
    inventoryDigest: inventoryDigestForFamilies(families),
    totals: {
      families: families.length,
      files: families.reduce((sum, family) => sum + family.files.length, 0),
    },
    families,
  };
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match
    ? { frontmatter: match[1], body: markdown.slice(match[0].length) }
    : { frontmatter: '', body: markdown };
}

function frontmatterValue(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!match) return '';
  const raw = match[1].trim();
  if (raw === "''" || raw === '""') return '';
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match?.[1] ?? match?.[2] ?? '';
}

function imagePathsFromTag(tag) {
  const output = [];
  const src = htmlAttribute(tag, 'src');
  if (src) output.push(src);
  for (const item of htmlAttribute(tag, 'srcset').split(',')) {
    const candidate = item.trim().split(/\s+/)[0];
    if (candidate) output.push(candidate);
  }
  return [...new Set(output)];
}

export function validateMidjourneyPresentation(
  entriesRoot = DEFAULT_ENTRIES_ROOT,
  expectedMidjourneyPaths = MIDJOURNEY_FAMILY_PATHS,
) {
  if (!fs.existsSync(entriesRoot) || !fs.lstatSync(entriesRoot).isDirectory()) {
    throw new Error('Falta src/content/entries/ para validar la rotulación Midjourney');
  }
  const expected = new Set(expectedMidjourneyPaths);
  const used = new Set();
  for (const entryPath of filesRecursively(entriesRoot).filter((file) => /\.mdx?$/i.test(file))) {
    const markdown = fs.readFileSync(entryPath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(markdown);
    const featureImage = canonicalRightsFamilyPath(frontmatterValue(frontmatter, 'feature_image'));
    const socialImages = ['og_image', 'twitter_image']
      .map((field) => frontmatterValue(frontmatter, field))
      .filter(Boolean)
      .map(canonicalRightsFamilyPath);
    for (const socialImage of socialImages) {
      if (expected.has(socialImage) && featureImage !== socialImage) {
        throw new Error(
          `${path.basename(entryPath)} usa una Midjourney social sin la misma portada rotulada`,
        );
      }
    }
    if (expected.has(featureImage)) {
      used.add(featureImage);
      const alt = frontmatterValue(frontmatter, 'feature_image_alt');
      const caption = frontmatterValue(frontmatter, 'feature_image_caption');
      const credit = frontmatterValue(frontmatter, 'feature_image_credit');
      const license = frontmatterValue(frontmatter, 'feature_image_license');
      const licenseUrl = frontmatterValue(frontmatter, 'feature_image_license_url');
      if (!/\bilustraci[oó]n\b/i.test(alt) || !/\bilustraci[oó]n\b/i.test(caption)) {
        throw new Error(`${path.basename(entryPath)} no rotula la portada Midjourney como ilustración`);
      }
      if (credit !== MIDJOURNEY_PUBLIC_CONTRACT.credit) {
        throw new Error(`${path.basename(entryPath)} no conserva el crédito Midjourney exacto`);
      }
      if (
        license !== MIDJOURNEY_PUBLIC_CONTRACT.visibleLicenseLabel ||
        licenseUrl !== MIDJOURNEY_PUBLIC_CONTRACT.licenseUrl
      ) {
        throw new Error(`${path.basename(entryPath)} no muestra el alcance de licencia Midjourney`);
      }
    }

    const figures = [...body.matchAll(/<figure\b[\s\S]*?<\/figure>/gi)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      html: match[0],
    }));
    const accreditedAiFigures = new Set();
    for (const imageMatch of body.matchAll(/<img\b[^>]*>/gi)) {
      const aiPaths = imagePathsFromTag(imageMatch[0])
        .map(canonicalRightsFamilyPath)
        .filter((candidate) => expected.has(candidate));
      if (aiPaths.length === 0) continue;
      aiPaths.forEach((candidate) => used.add(candidate));
      const figure = figures.find(
        (candidate) => imageMatch.index >= candidate.start && imageMatch.index < candidate.end,
      );
      const caption = figure?.html.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '';
      if (
        !figure ||
        !/\bilustraci[oó]n\b/i.test(caption) ||
        !caption.includes(MIDJOURNEY_PUBLIC_CONTRACT.credit)
      ) {
        throw new Error(`${path.basename(entryPath)} contiene una Midjourney sin pie de ilustración`);
      }
      accreditedAiFigures.add(figure);
    }

    for (const markdownImage of body.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
      const candidate = canonicalRightsFamilyPath(markdownImage[1]);
      if (expected.has(candidate)) {
        throw new Error(
          `${path.basename(entryPath)} usa una Midjourney con sintaxis Markdown sin pie visible acreditado`,
        );
      }
    }

    for (const expectedPath of expected) {
      let offset = body.indexOf(expectedPath);
      while (offset !== -1) {
        const accreditedFigure = figures.find(
          (figure) =>
            accreditedAiFigures.has(figure) &&
            offset >= figure.start &&
            offset < figure.end,
        );
        if (!accreditedFigure) {
          throw new Error(
            `${path.basename(entryPath)} referencia una Midjourney fuera de una portada o figura acreditada`,
          );
        }
        offset = body.indexOf(expectedPath, offset + expectedPath.length);
      }
    }
  }
  const missing = [...expected].filter((candidate) => !used.has(candidate));
  if (missing.length) {
    throw new Error(`Familias Midjourney sin uso rotulado: ${missing.join(', ')}`);
  }
}

function compareManifestToInventory(manifest, inventory) {
  if (
    manifest.inventoryDigest !== inventory.inventoryDigest ||
    manifest.totals.families !== inventory.totals.families ||
    manifest.totals.files !== inventory.totals.files
  ) {
    throw new Error('El manifiesto no coincide con el inventario público actual');
  }
  const declaredFiles = new Map(
    manifest.families.flatMap((family) => family.files.map((file) => [file.path, file])),
  );
  const actualFiles = new Map(
    inventory.families.flatMap((family) => family.files.map((file) => [file.path, file])),
  );
  const missing = [...declaredFiles.keys()].filter((filePath) => !actualFiles.has(filePath));
  const extra = [...actualFiles.keys()].filter((filePath) => !declaredFiles.has(filePath));
  if (missing.length || extra.length) {
    throw new Error(`Rutas discordantes; faltan ${missing.join(', ') || '(ninguna)'}; sobran ${extra.join(', ') || '(ninguna)'}`);
  }
  for (const [filePath, declared] of declaredFiles) {
    const actual = actualFiles.get(filePath);
    if (declared.bytes !== actual.bytes || declared.sha256 !== actual.sha256) {
      throw new Error(`Los bytes públicos cambiaron sin revisión: ${filePath}`);
    }
  }
}

export function checkRights({
  manifestPath = DEFAULT_MANIFEST_PATH,
  publicRoot = DEFAULT_PUBLIC_ROOT,
  entriesRoot = DEFAULT_ENTRIES_ROOT,
  expectedTotals = EXPECTED_FINAL_RIGHTS_TOTALS,
  expectedMidjourneyPaths = MIDJOURNEY_FAMILY_PATHS,
} = {}) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${manifestPath}: ${error.message}`);
  }
  validateRightsManifestShape(manifest, { expectedTotals, expectedMidjourneyPaths });
  const inventory = collectPublicRightsInventory(publicRoot);
  if (
    inventory.totals.families !== expectedTotals.families ||
    inventory.totals.files !== expectedTotals.files
  ) {
    throw new Error(
      `El árbol público contiene ${inventory.totals.families} familias/${inventory.totals.files} archivos; se esperaban ${expectedTotals.families}/${expectedTotals.files}`,
    );
  }
  compareManifestToInventory(manifest, inventory);
  validateMidjourneyPresentation(entriesRoot, expectedMidjourneyPaths);
  return { manifest, inventory };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const { inventory } = checkRights();
  console.log(
    `check:rights: ok (${inventory.totals.families} familias/${inventory.totals.files} archivos)`,
  );
}
