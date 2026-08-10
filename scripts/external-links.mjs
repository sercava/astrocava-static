import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_ORIGIN = 'https://www.astrocava.com';
export const INTERNAL_HOSTS = Object.freeze(['www.astrocava.com', 'astrocava.com']);
export const NEW_TAB_NOTE_CLASS = 'external-link-new-tab-note';
export const NEW_TAB_NOTE_TEXT = 'abre en una pestaña nueva';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIST_ROOT = path.join(PROJECT_ROOT, 'dist');
const NEW_TAB_NOTE_PATTERN = /\babre en una pestaña nueva\b/i;

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

function encodeHtmlAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attributePattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(\\s${escaped}\\s*=\\s*)(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i',
  );
}

export function readHtmlAttribute(openingTag, name) {
  const match = openingTag.match(attributePattern(name));
  return match ? decodeHtml(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

function setHtmlAttribute(openingTag, name, value) {
  const encoded = encodeHtmlAttribute(value);
  const pattern = attributePattern(name);
  if (pattern.test(openingTag)) {
    return openingTag.replace(pattern, (_match, prefix) => `${prefix}"${encoded}"`);
  }
  return `${openingTag.slice(0, -1)} ${name}="${encoded}">`;
}

function findOpeningTagEnd(html, start) {
  let quote = null;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
}

export function collectAnchorElements(html) {
  const anchors = [];
  const openingPattern = /<a(?=[\s>])/gi;
  const closingPattern = /<\/a\s*>/gi;
  let openingMatch;

  while ((openingMatch = openingPattern.exec(html))) {
    const openingEnd = findOpeningTagEnd(html, openingMatch.index + openingMatch[0].length);
    if (openingEnd === -1) break;
    closingPattern.lastIndex = openingEnd + 1;
    const closingMatch = closingPattern.exec(html);
    if (!closingMatch) break;
    anchors.push({
      start: openingMatch.index,
      end: closingMatch.index + closingMatch[0].length,
      openingTag: html.slice(openingMatch.index, openingEnd + 1),
      innerHtml: html.slice(openingEnd + 1, closingMatch.index),
      closingTag: closingMatch[0],
    });
    openingPattern.lastIndex = closingMatch.index + closingMatch[0].length;
  }

  return anchors;
}

export function isExternalHttpHref(
  href,
  { baseOrigin = CANONICAL_ORIGIN, internalHosts = INTERNAL_HOSTS } = {},
) {
  let parsed;
  try {
    parsed = new URL(href, baseOrigin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const normalizeHostname = (hostname) => hostname.toLowerCase().replace(/\.$/, '');
  const allowed = new Set(internalHosts.map(normalizeHostname));
  return !allowed.has(normalizeHostname(parsed.hostname));
}

export function hasAccessibleNewTabNotice(openingTag, innerHtml) {
  const ariaLabel = readHtmlAttribute(openingTag, 'aria-label');
  if (ariaLabel && NEW_TAB_NOTE_PATTERN.test(ariaLabel)) return true;
  return new RegExp(`\\b${NEW_TAB_NOTE_CLASS}\\b`, 'i').test(innerHtml);
}

function ensureRelSecurity(openingTag) {
  const existing = (readHtmlAttribute(openingTag, 'rel') ?? '').trim().split(/\s+/).filter(Boolean);
  const tokens = [...existing];
  const normalized = new Set(tokens.map((token) => token.toLowerCase()));
  for (const required of ['noopener', 'noreferrer']) {
    if (!normalized.has(required)) tokens.push(required);
  }
  return setHtmlAttribute(openingTag, 'rel', tokens.join(' '));
}

function ensureAccessibleNotice(openingTag, innerHtml) {
  if (hasAccessibleNewTabNotice(openingTag, innerHtml)) return { openingTag, innerHtml };
  const ariaLabel = readHtmlAttribute(openingTag, 'aria-label');
  if (ariaLabel !== null) {
    const separator = ariaLabel.trim() ? ' ' : '';
    return {
      openingTag: setHtmlAttribute(
        openingTag,
        'aria-label',
        `${ariaLabel.trimEnd()}${separator}(${NEW_TAB_NOTE_TEXT})`,
      ),
      innerHtml,
    };
  }
  return {
    openingTag,
    innerHtml: `${innerHtml}<span class="visually-hidden ${NEW_TAB_NOTE_CLASS}"> (${NEW_TAB_NOTE_TEXT})</span>`,
  };
}

export function transformExternalLinksInHtml(html, options = {}) {
  const anchors = collectAnchorElements(html);
  let cursor = 0;
  let externalLinks = 0;
  let output = '';

  for (const anchor of anchors) {
    output += html.slice(cursor, anchor.start);
    const href = readHtmlAttribute(anchor.openingTag, 'href');
    if (href === null || !isExternalHttpHref(href, options)) {
      output += html.slice(anchor.start, anchor.end);
      cursor = anchor.end;
      continue;
    }

    externalLinks += 1;
    let openingTag = setHtmlAttribute(anchor.openingTag, 'target', '_blank');
    openingTag = ensureRelSecurity(openingTag);
    const accessible = ensureAccessibleNotice(openingTag, anchor.innerHtml);
    output += `${accessible.openingTag}${accessible.innerHtml}${anchor.closingTag}`;
    cursor = anchor.end;
  }

  output += html.slice(cursor);
  return { html: output, externalLinks };
}

function collectHtmlFiles(root) {
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`El build contiene un enlace simbólico no permitido: ${target}`);
    }
    if (entry.isDirectory()) result.push(...collectHtmlFiles(target));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) result.push(target);
  }
  return result;
}

export function processBuiltExternalLinks(distRoot = DEFAULT_DIST_ROOT) {
  const resolvedRoot = path.resolve(distRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.lstatSync(resolvedRoot).isDirectory()) {
    throw new Error(`No existe el directorio de build para enlaces externos: ${resolvedRoot}`);
  }

  const files = collectHtmlFiles(resolvedRoot);
  let changedFiles = 0;
  let externalLinks = 0;
  for (const filePath of files) {
    const before = fs.readFileSync(filePath, 'utf8');
    const transformed = transformExternalLinksInHtml(before);
    externalLinks += transformed.externalLinks;
    if (transformed.html !== before) {
      fs.writeFileSync(filePath, transformed.html);
      changedFiles += 1;
    }
  }

  return { htmlFiles: files.length, changedFiles, externalLinks };
}
