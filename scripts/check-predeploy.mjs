#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectAnchorElements,
  hasAccessibleNewTabNotice,
  isExternalHttpHref,
} from './external-links.mjs';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONTRACT_PATH = path.join(PROJECT_ROOT, 'PREDEPLOY_CONTRACT.json');
const DEFAULT_RIGHTS_MANIFEST_PATH = path.join(PROJECT_ROOT, 'RIGHTS_MANIFEST.json');
const ALL_SCOPES = Object.freeze(['urls', 'links', 'images', 'seo', 'sitemap']);
const CONTRACT_KEYS = new Set([
  'schemaVersion',
  'canonicalOrigin',
  'baseline',
  'legacyUrlCount',
  'approvedNewUrlCount',
  'expectedHtmlCount',
  'expectedImageFiles',
  'urls',
  'protectedUrls',
  'redirects',
]);

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label}: no se pudo leer ${filePath}: ${error.message}`);
  }
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function validatePublicPagePath(value, label) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error(`${label} debe ser una ruta pública absoluta`);
  }
  if (
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('//') ||
    /%(?:2e|2f|5c)/i.test(value) ||
    path.posix.normalize(value) !== value ||
    (value !== '/' && !value.endsWith('/'))
  ) {
    throw new Error(`${label} no es una ruta pública canónica con barra final`);
  }
}

export function validatePredeployContract(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error('El contrato predeploy debe ser un objeto');
  }
  for (const key of Object.keys(contract)) {
    if (!CONTRACT_KEYS.has(key)) throw new Error(`Campo no permitido en contrato: ${key}`);
  }
  if (contract.schemaVersion !== 3) throw new Error('Schema predeploy no soportado');
  if (contract.canonicalOrigin !== 'https://www.astrocava.com') {
    throw new Error('El origen canónico debe ser https://www.astrocava.com');
  }
  if (typeof contract.baseline !== 'string' || !contract.baseline.trim()) {
    throw new Error('baseline es obligatorio');
  }
  for (const field of [
    'legacyUrlCount',
    'approvedNewUrlCount',
    'expectedHtmlCount',
    'expectedImageFiles',
  ]) {
    if (!Number.isSafeInteger(contract[field]) || contract[field] < 0) {
      throw new Error(`${field} debe ser un entero no negativo`);
    }
  }
  if (
    !Array.isArray(contract.urls) ||
    !Array.isArray(contract.protectedUrls) ||
    !Array.isArray(contract.redirects)
  ) {
    throw new Error('urls, protectedUrls y redirects deben ser listas');
  }
  contract.urls.forEach((value, index) => validatePublicPagePath(value, `urls[${index}]`));
  contract.protectedUrls.forEach((value, index) =>
    validatePublicPagePath(value, `protectedUrls[${index}]`),
  );
  contract.redirects.forEach((redirect, index) => {
    if (!redirect || typeof redirect !== 'object' || Array.isArray(redirect)) {
      throw new Error(`redirects[${index}] debe ser un objeto`);
    }
    if (
      JSON.stringify(Object.keys(redirect).sort()) !==
      JSON.stringify(['from', 'to'])
    ) {
      throw new Error(`redirects[${index}] solo admite from y to`);
    }
    validatePublicPagePath(redirect.from, `redirects[${index}].from`);
    validatePublicPagePath(redirect.to, `redirects[${index}].to`);
    if (redirect.from === redirect.to) {
      throw new Error(`redirects[${index}] no puede redirigir a sí mismo`);
    }
  });
  if (new Set(contract.urls).size !== contract.urls.length) {
    throw new Error('urls contiene duplicados');
  }
  if (new Set(contract.protectedUrls).size !== contract.protectedUrls.length) {
    throw new Error('protectedUrls contiene duplicados');
  }
  const redirectSources = contract.redirects.map((redirect) => redirect.from);
  if (new Set(redirectSources).size !== redirectSources.length) {
    throw new Error('redirects contiene orígenes duplicados');
  }
  if (JSON.stringify(contract.urls) !== JSON.stringify(sortedUnique(contract.urls))) {
    throw new Error('urls debe estar ordenada de forma canónica');
  }
  if (
    JSON.stringify(contract.protectedUrls) !== JSON.stringify(sortedUnique(contract.protectedUrls))
  ) {
    throw new Error('protectedUrls debe estar ordenada de forma canónica');
  }
  if (JSON.stringify(redirectSources) !== JSON.stringify(sortedUnique(redirectSources))) {
    throw new Error('redirects debe estar ordenada por from');
  }
  if (contract.urls.length + contract.redirects.length !== contract.expectedHtmlCount) {
    throw new Error('expectedHtmlCount no coincide con urls y redirects');
  }
  if (
    contract.legacyUrlCount + contract.approvedNewUrlCount + 1 !==
    contract.urls.length
  ) {
    throw new Error(
      'El contrato debe contener las URLs legacy, las nuevas aprobadas y /licencias/',
    );
  }
  if (!contract.urls.includes('/licencias/')) {
    throw new Error('Falta la ruta aprobada /licencias/');
  }
  for (const protectedUrl of contract.protectedUrls) {
    if (!contract.urls.includes(protectedUrl)) {
      throw new Error(`URL SEO protegida fuera del contrato: ${protectedUrl}`);
    }
  }
  for (const redirect of contract.redirects) {
    if (contract.urls.includes(redirect.from)) {
      throw new Error(`Redirect declarado también como URL de contenido: ${redirect.from}`);
    }
    if (!contract.urls.includes(redirect.to)) {
      throw new Error(`Destino de redirect fuera del contrato: ${redirect.to}`);
    }
  }
  return contract;
}

function walkFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`No se admiten symlinks: ${entryPath}`);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function htmlRouteForFile(filePath, distRoot) {
  const relative = path.relative(distRoot, filePath).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

function collectHtmlPages(distRoot) {
  const pages = new Map();
  for (const filePath of walkFiles(distRoot).filter((candidate) => candidate.endsWith('.html'))) {
    const route = htmlRouteForFile(filePath, distRoot);
    if (pages.has(route)) throw new Error(`Ruta HTML duplicada: ${route}`);
    pages.set(route, { filePath, html: fs.readFileSync(filePath, 'utf8') });
  }
  return pages;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'),
  );
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function pairedText(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi'))].map(
    (match) => decodeHtml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
  );
}

function tagsWithAttribute(html, tagName, attrName, attrValue) {
  return tags(html, tagName).filter((tag) => {
    const value = attribute(tag, attrName);
    return value?.toLowerCase().split(/\s+/).includes(attrValue.toLowerCase());
  });
}

function addIssue(issues, scope, message) {
  issues.push(`[${scope}] ${message}`);
}

function resolvedHref(value, base) {
  try {
    return value ? new URL(value, base).href : null;
  } catch {
    return null;
  }
}

function compareSets(actual, expected, issues, scope, label) {
  for (const value of expected) {
    if (!actual.has(value)) addIssue(issues, scope, `${label} faltante: ${value}`);
  }
  for (const value of actual) {
    if (!expected.has(value)) addIssue(issues, scope, `${label} extra: ${value}`);
  }
}

function checkStaticRedirect(page, redirect, contract, issues) {
  const robotsTags = tags(page.html, 'meta').filter(
    (tag) => attribute(tag, 'name')?.toLowerCase() === 'robots',
  );
  const robotsTokens = robotsTags.flatMap((tag) =>
    (attribute(tag, 'content') ?? '')
      .toLowerCase()
      .split(',')
      .map((token) => token.trim()),
  );
  if (!robotsTokens.includes('noindex')) {
    addIssue(issues, 'urls', `${redirect.from} debe declarar noindex`);
  }

  const refreshTags = tags(page.html, 'meta').filter(
    (tag) => attribute(tag, 'http-equiv')?.toLowerCase() === 'refresh',
  );
  const content = refreshTags.length === 1 ? attribute(refreshTags[0], 'content') : null;
  const match = content?.match(/^\s*0\s*;\s*url\s*=\s*(.+?)\s*$/i);
  if (refreshTags.length !== 1 || !match) {
    addIssue(
      issues,
      'urls',
      `${redirect.from} debe contener un único meta refresh inmediato`,
    );
  } else {
    let actual;
    try {
      actual = new URL(match[1].replace(/^(['"])(.*)\1$/, '$2'), contract.canonicalOrigin);
    } catch {
      addIssue(issues, 'urls', `${redirect.from} tiene un destino de refresh inválido`);
    }
    const expected = new URL(redirect.to, contract.canonicalOrigin);
    if (actual && actual.href !== expected.href) {
      addIssue(
        issues,
        'urls',
        `${redirect.from} redirige a ${actual.href}, no a ${expected.href}`,
      );
    }
  }

  const expectedCanonical = new URL(redirect.to, contract.canonicalOrigin).href;
  const canonicals = tagsWithAttribute(page.html, 'link', 'rel', 'canonical');
  const canonicalHref =
    canonicals.length === 1 ? attribute(canonicals[0], 'href') : null;
  if (resolvedHref(canonicalHref, contract.canonicalOrigin) !== expectedCanonical) {
    addIssue(
      issues,
      'urls',
      `${redirect.from} debe declarar canonical al destino ${expectedCanonical}`,
    );
  }
}

function checkUrls({ pages, contract, issues }) {
  const expectedRoutes = new Set([
    ...contract.urls,
    ...contract.redirects.map((redirect) => redirect.from),
  ]);
  compareSets(new Set(pages.keys()), expectedRoutes, issues, 'urls', 'URL');
  for (const protectedUrl of contract.protectedUrls) {
    if (!pages.has(protectedUrl)) addIssue(issues, 'urls', `URL SEO protegida ausente: ${protectedUrl}`);
  }
  for (const redirect of contract.redirects) {
    const page = pages.get(redirect.from);
    if (page) checkStaticRedirect(page, redirect, contract, issues);
  }
  return {
    html: pages.size,
    content: contract.urls.length,
    redirects: contract.redirects.length,
    protected: contract.protectedUrls.length,
  };
}

function publicFileForPath(distRoot, publicPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(publicPath);
  } catch {
    return null;
  }
  if (
    !decoded.startsWith('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    path.posix.normalize(decoded) !== decoded
  ) {
    return null;
  }
  const target = path.resolve(distRoot, `.${decoded}`);
  const relative = path.relative(distRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

function pageFileForUrl(distRoot, pathname) {
  const exact = publicFileForPath(distRoot, pathname);
  if (!exact) return null;
  if (pathname.endsWith('/')) return path.join(exact, 'index.html');
  if (fs.existsSync(exact) && fs.lstatSync(exact).isFile()) return exact;
  const directoryIndex = path.join(exact, 'index.html');
  return fs.existsSync(directoryIndex) ? directoryIndex : exact;
}

function idsInHtml(html) {
  return new Set(
    [...html.matchAll(/<[^>]+\sid=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))[^>]*>/gi)].map((match) =>
      decodeHtml(match[1] ?? match[2] ?? match[3] ?? ''),
    ),
  );
}

function resolveInternalReference(raw, pageUrl, canonicalOrigin, issues, scope, label) {
  if (!raw || raw.startsWith('data:')) return null;
  if (/^(?:mailto|tel):/i.test(raw)) return null;
  if (/^(?:javascript|vbscript):/i.test(raw)) {
    addIssue(issues, scope, `${label} usa un esquema inseguro: ${raw}`);
    return null;
  }
  let parsed;
  try {
    parsed = new URL(raw, pageUrl);
  } catch {
    addIssue(issues, scope, `${label} no es resoluble: ${raw}`);
    return null;
  }
  const canonical = new URL(canonicalOrigin);
  if (parsed.hostname === canonical.hostname && parsed.origin !== canonical.origin) {
    addIssue(issues, scope, `${label} usa origen interno no canónico: ${raw}`);
  }
  if (parsed.hostname === 'astrocava.com' && parsed.hostname !== canonical.hostname) {
    addIssue(issues, scope, `${label} usa el apex en vez de www: ${raw}`);
  }
  if (parsed.origin !== canonical.origin) return null;
  return parsed;
}

function checkLinks({ pages, contract, distRoot, issues }) {
  let internalLinks = 0;
  let externalLinks = 0;
  for (const [route, page] of pages) {
    const pageUrl = `${contract.canonicalOrigin}${route}`;
    if (/astrocava\.ghost\.io/i.test(page.html)) {
      addIssue(issues, 'links', `${route} conserva una referencia al host de Ghost`);
    }
    const anchors = collectAnchorElements(page.html);
    const openingAnchorCount = tags(page.html, 'a').length;
    if (anchors.length !== openingAnchorCount) {
      addIssue(
        issues,
        'links',
        `${route} contiene enlaces <a> sin cierre o anidados de forma inválida`,
      );
    }
    for (const anchor of anchors) {
      const tag = anchor.openingTag;
      const href = attribute(tag, 'href');
      // <a id="…"> también es un destino de fragmento válido, no un enlace.
      if (href === null || href === '') continue;
      const target = attribute(tag, 'target')?.toLowerCase() ?? null;
      if (isExternalHttpHref(href, { baseOrigin: pageUrl })) {
        externalLinks += 1;
        if (target !== '_blank') {
          addIssue(issues, 'links', `${route} → ${href} debe abrir en una pestaña nueva`);
        }
        const rel = new Set(
          (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean),
        );
        if (!rel.has('noopener') || !rel.has('noreferrer')) {
          addIssue(
            issues,
            'links',
            `${route} → ${href} debe declarar rel="noopener noreferrer"`,
          );
        }
        if (!hasAccessibleNewTabNotice(tag, anchor.innerHtml)) {
          addIssue(
            issues,
            'links',
            `${route} → ${href} debe avisar de forma accesible que abre una pestaña nueva`,
          );
        }
        continue;
      }
      if (target === '_blank') {
        addIssue(
          issues,
          'links',
          `${route} → ${href} no es externo y debe conservar la misma pestaña`,
        );
      }
      const targetUrl = resolveInternalReference(
        href,
        pageUrl,
        contract.canonicalOrigin,
        issues,
        'links',
        `${route} → ${href}`,
      );
      if (!targetUrl) continue;
      internalLinks += 1;
      const targetFile = pageFileForUrl(distRoot, targetUrl.pathname);
      if (!targetFile || !fs.existsSync(targetFile) || !fs.lstatSync(targetFile).isFile()) {
        addIssue(issues, 'links', `${route} enlaza a una ruta interna inexistente: ${href}`);
        continue;
      }
      if (targetUrl.hash && targetFile.endsWith('.html')) {
        const fragment = decodeURIComponent(targetUrl.hash.slice(1));
        const targetHtml = fs.readFileSync(targetFile, 'utf8');
        if (fragment && !idsInHtml(targetHtml).has(fragment)) {
          addIssue(issues, 'links', `${route} enlaza a un fragmento inexistente: ${href}`);
        }
      }
    }
  }
  return { internalLinks, externalLinks };
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function expectedImagesFromManifest(manifest, contract, issues) {
  const expected = new Map();
  if (!manifest || !Array.isArray(manifest.families)) {
    addIssue(issues, 'images', 'RIGHTS_MANIFEST.json no contiene families');
    return expected;
  }
  for (const family of manifest.families) {
    if (!Array.isArray(family.files)) {
      addIssue(issues, 'images', 'Una familia del manifiesto no contiene files');
      continue;
    }
    for (const file of family.files) {
      if (
        typeof file.path !== 'string' ||
        !Number.isSafeInteger(file.bytes) ||
        !/^[a-f0-9]{64}$/.test(file.sha256 ?? '')
      ) {
        addIssue(issues, 'images', `Entrada de imagen inválida: ${JSON.stringify(file)}`);
        continue;
      }
      if (expected.has(file.path)) addIssue(issues, 'images', `Imagen duplicada: ${file.path}`);
      expected.set(file.path, file);
    }
  }
  if (expected.size !== contract.expectedImageFiles) {
    addIssue(
      issues,
      'images',
      `El manifiesto declara ${expected.size} imágenes; se esperaban ${contract.expectedImageFiles}`,
    );
  }
  if (manifest.totals?.files !== expected.size) {
    addIssue(issues, 'images', 'totals.files no coincide con las imágenes del manifiesto');
  }
  return expected;
}

function actualBuiltImages(distRoot) {
  const imageExtension = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;
  const files = walkFiles(distRoot).filter((filePath) => imageExtension.test(filePath));
  return new Map(
    files.map((filePath) => {
      const publicPath = `/${path.relative(distRoot, filePath).split(path.sep).join('/')}`;
      const bytes = fs.readFileSync(filePath);
      return [publicPath, { path: publicPath, bytes: bytes.length, sha256: sha256Bytes(bytes) }];
    }),
  );
}

function imageReferences(html) {
  const references = [];
  for (const tagName of ['img', 'source', 'video']) {
    for (const tag of tags(html, tagName)) {
      for (const name of ['src', 'poster']) {
        const value = attribute(tag, name);
        if (value) references.push(value);
      }
      const srcset = attribute(tag, 'srcset');
      if (srcset) {
        for (const candidate of srcset.split(',')) {
          const value = candidate.trim().split(/\s+/)[0];
          if (value) references.push(value);
        }
      }
    }
  }
  for (const tag of tags(html, 'meta')) {
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    if (['og:image', 'twitter:image'].includes(key?.toLowerCase())) {
      const value = attribute(tag, 'content');
      if (value) references.push(value);
    }
  }
  return references;
}

function checkImages({ pages, contract, distRoot, rightsManifest, issues }) {
  const expected = expectedImagesFromManifest(rightsManifest, contract, issues);
  const actual = actualBuiltImages(distRoot);
  compareSets(new Set(actual.keys()), new Set(expected.keys()), issues, 'images', 'Imagen construida');
  for (const [publicPath, declared] of expected) {
    const built = actual.get(publicPath);
    if (built && (built.bytes !== declared.bytes || built.sha256 !== declared.sha256)) {
      addIssue(issues, 'images', `Bytes distintos al manifiesto: ${publicPath}`);
    }
  }
  let references = 0;
  for (const [route, page] of pages) {
    const pageUrl = `${contract.canonicalOrigin}${route}`;
    for (const raw of imageReferences(page.html)) {
      const target = resolveInternalReference(
        raw,
        pageUrl,
        contract.canonicalOrigin,
        issues,
        'images',
        `${route} → ${raw}`,
      );
      if (!target) continue;
      references += 1;
      if (!expected.has(target.pathname)) {
        addIssue(issues, 'images', `${route} referencia una imagen fuera del manifiesto: ${raw}`);
      } else if (!actual.has(target.pathname)) {
        addIssue(issues, 'images', `${route} referencia una imagen ausente del build: ${raw}`);
      }
    }
  }
  return { imageFiles: actual.size, imageReferences: references };
}

function checkSeo({ pages, contract, issues }) {
  const titles = new Map();
  for (const [route, page] of pages) {
    const pageUrl = `${contract.canonicalOrigin}${route}`;
    const htmlTags = tags(page.html, 'html');
    if (htmlTags.length !== 1 || attribute(htmlTags[0], 'lang') !== 'es') {
      addIssue(issues, 'seo', `${route} debe declarar exactamente <html lang="es">`);
    }

    const headBlocks = [
      ...page.html.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head>/gi),
    ].map((match) => match[1]);
    const pageTitles = headBlocks.length === 1 ? pairedText(headBlocks[0], 'title') : [];
    if (pageTitles.length !== 1 || !pageTitles[0]) {
      addIssue(issues, 'seo', `${route} debe tener un title no vacío y único`);
    } else {
      const routes = titles.get(pageTitles[0]) ?? [];
      routes.push(route);
      titles.set(pageTitles[0], routes);
    }

    const descriptionTags = tags(page.html, 'meta').filter(
      (tag) => attribute(tag, 'name')?.toLowerCase() === 'description',
    );
    const description = descriptionTags.length === 1 ? attribute(descriptionTags[0], 'content') : '';
    if (descriptionTags.length !== 1 || !description?.trim()) {
      addIssue(issues, 'seo', `${route} debe tener una meta description no vacía y única`);
    } else {
      if (description.length > 160) {
        addIssue(issues, 'seo', `${route} supera 160 caracteres de meta description`);
      }
    }

    const h1 = pairedText(page.html, 'h1');
    if (h1.length !== 1 || !h1[0]) addIssue(issues, 'seo', `${route} debe tener un H1 no vacío y único`);

    const canonicals = tagsWithAttribute(page.html, 'link', 'rel', 'canonical');
    if (canonicals.length !== 1 || attribute(canonicals[0], 'href') !== pageUrl) {
      addIssue(issues, 'seo', `${route} debe tener canonical exacto ${pageUrl}`);
    }
    const ogUrls = tags(page.html, 'meta').filter(
      (tag) => attribute(tag, 'property')?.toLowerCase() === 'og:url',
    );
    if (ogUrls.length !== 1 || attribute(ogUrls[0], 'content') !== pageUrl) {
      addIssue(issues, 'seo', `${route} debe tener og:url exacto ${pageUrl}`);
    }
    const robots = tags(page.html, 'meta').filter(
      (tag) => attribute(tag, 'name')?.toLowerCase() === 'robots',
    );
    if (robots.some((tag) => /\bnoindex\b/i.test(attribute(tag, 'content') ?? ''))) {
      addIssue(issues, 'seo', `${route} no puede declarar noindex`);
    }
  }
  for (const [title, routes] of titles) {
    if (routes.length > 1) addIssue(issues, 'seo', `Title duplicado en ${routes.join(', ')}: ${title}`);
  }
  return { pagesWithSeo: pages.size };
}

function xmlLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeHtml(match[1].trim()));
}

function checkSitemap({ contract, distRoot, issues }) {
  const indexPath = path.join(distRoot, 'sitemap-index.xml');
  const aliasPath = path.join(distRoot, 'sitemap.xml');
  const robotsPath = path.join(distRoot, 'robots.txt');
  for (const required of [indexPath, aliasPath, robotsPath]) {
    if (!fs.existsSync(required)) addIssue(issues, 'sitemap', `Falta ${path.basename(required)}`);
  }
  if (![indexPath, aliasPath, robotsPath].every((candidate) => fs.existsSync(candidate))) {
    return { sitemapUrls: 0 };
  }
  const indexBytes = fs.readFileSync(indexPath);
  const aliasBytes = fs.readFileSync(aliasPath);
  if (!indexBytes.equals(aliasBytes)) {
    addIssue(issues, 'sitemap', 'sitemap.xml debe ser copia exacta de sitemap-index.xml');
  }
  const indexLocations = xmlLocations(indexBytes.toString('utf8'));
  if (indexLocations.length === 0 || new Set(indexLocations).size !== indexLocations.length) {
    addIssue(issues, 'sitemap', 'El índice debe listar sitemaps únicos');
  }
  const sitemapUrls = [];
  for (const location of indexLocations) {
    let parsed;
    try {
      parsed = new URL(location);
    } catch {
      addIssue(issues, 'sitemap', `Loc de índice inválido: ${location}`);
      continue;
    }
    if (parsed.origin !== contract.canonicalOrigin || !/^\/sitemap-[^/]+\.xml$/.test(parsed.pathname)) {
      addIssue(issues, 'sitemap', `Sitemap hijo no canónico: ${location}`);
      continue;
    }
    const childPath = publicFileForPath(distRoot, parsed.pathname);
    if (!childPath || !fs.existsSync(childPath)) {
      addIssue(issues, 'sitemap', `Falta sitemap hijo: ${parsed.pathname}`);
      continue;
    }
    sitemapUrls.push(...xmlLocations(fs.readFileSync(childPath, 'utf8')));
  }
  if (new Set(sitemapUrls).size !== sitemapUrls.length) {
    addIssue(issues, 'sitemap', 'Los sitemaps contienen URLs duplicadas');
  }
  const actualPaths = new Set();
  for (const location of sitemapUrls) {
    let parsed;
    try {
      parsed = new URL(location);
    } catch {
      addIssue(issues, 'sitemap', `URL de sitemap inválida: ${location}`);
      continue;
    }
    if (parsed.origin !== contract.canonicalOrigin || parsed.search || parsed.hash) {
      addIssue(issues, 'sitemap', `URL de sitemap no canónica: ${location}`);
      continue;
    }
    try {
      validatePublicPagePath(parsed.pathname, `sitemap ${location}`);
      actualPaths.add(parsed.pathname);
    } catch (error) {
      addIssue(issues, 'sitemap', error.message);
    }
  }
  compareSets(actualPaths, new Set(contract.urls), issues, 'sitemap', 'URL de sitemap');

  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!/^User-agent:\s*\*\s*$/im.test(robots) || !/^Allow:\s*\/\s*$/im.test(robots)) {
    addIssue(issues, 'sitemap', 'robots.txt debe permitir el rastreo general');
  }
  if (/^Disallow:/im.test(robots)) addIssue(issues, 'sitemap', 'robots.txt no debe bloquear rutas');
  const expectedSitemap = `${contract.canonicalOrigin}/sitemap-index.xml`;
  const sitemapDirectives = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
  if (sitemapDirectives.length !== 1 || sitemapDirectives[0] !== expectedSitemap) {
    addIssue(issues, 'sitemap', `robots.txt debe declarar exactamente ${expectedSitemap}`);
  }
  return { sitemapUrls: actualPaths.size, childSitemaps: indexLocations.length };
}

export function runPredeployChecks({
  distRoot,
  contract,
  rightsManifest,
  scopes = ALL_SCOPES,
} = {}) {
  if (!distRoot || !fs.existsSync(distRoot) || !fs.lstatSync(distRoot).isDirectory()) {
    throw new Error(`No existe el directorio de build: ${distRoot ?? '(sin ruta)'}`);
  }
  validatePredeployContract(contract);
  const selected = new Set(scopes);
  if (selected.size === 0) throw new Error('Debe seleccionarse al menos un scope predeploy');
  for (const scope of selected) {
    if (!ALL_SCOPES.includes(scope)) throw new Error(`Scope desconocido: ${scope}`);
  }
  const pages = collectHtmlPages(distRoot);
  const contentPages = new Map(
    [...pages].filter(([route]) => contract.urls.includes(route)),
  );
  const issues = [];
  const summary = {};
  if (selected.has('urls')) summary.urls = checkUrls({ pages, contract, issues });
  if (selected.has('links')) {
    summary.links = checkLinks({ pages: contentPages, contract, distRoot, issues });
  }
  if (selected.has('images')) {
    summary.images = checkImages({
      pages: contentPages,
      contract,
      distRoot,
      rightsManifest,
      issues,
    });
  }
  if (selected.has('seo')) {
    summary.seo = checkSeo({ pages: contentPages, contract, issues });
  }
  if (selected.has('sitemap')) summary.sitemap = checkSitemap({ contract, distRoot, issues });
  if (issues.length) {
    throw new Error(`check:predeploy detectó ${issues.length} problema(s):\n- ${issues.join('\n- ')}`);
  }
  return { scopes: [...selected], summary };
}

function parseCliArgs(argv) {
  const result = { root: 'dist', scopes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') result.root = argv[++index];
    else if (arg === '--scope') result.scopes.push(argv[++index]);
    else throw new Error(`Argumento desconocido: ${arg}`);
  }
  if (!result.root) throw new Error('--root requiere un valor');
  if (result.scopes.some((scope) => !scope)) throw new Error('--scope requiere un valor');
  return result;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const distRoot = path.resolve(PROJECT_ROOT, args.root);
    const contract = readJson(DEFAULT_CONTRACT_PATH, 'Contrato predeploy');
    const rightsManifest = readJson(DEFAULT_RIGHTS_MANIFEST_PATH, 'Manifiesto de derechos');
    const result = runPredeployChecks({
      distRoot,
      contract,
      rightsManifest,
      scopes: args.scopes.length ? args.scopes : ALL_SCOPES,
    });
    console.log(
      `check:predeploy: ok (${path.basename(distRoot)}; ${result.scopes.join(', ')})`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
