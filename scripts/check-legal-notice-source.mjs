#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGAL_NOTICE_ALL_FIELDS,
  LEGAL_NOTICE_FIELDS,
  LEGAL_NOTICE_IDENTITY_HTML,
  LEGAL_NOTICE_SOURCE_RELATIVE_PATH,
  LEGAL_NOTICE_TOKEN_PATTERN,
} from './legal-notice-contract.mjs';
import { PUBLIC_AUTHOR_NAME } from './licensing-contract.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = path.join(ROOT, LEGAL_NOTICE_SOURCE_RELATIVE_PATH);
const DEFAULT_SCAN_ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'public')];
const EXCLUDED_DIRECTORIES = new Set([
  '.astro',
  '.git',
  'coverage',
  'dist',
  'dist-verify',
  'node_modules',
]);
const TEXT_EXTENSIONS = new Set([
  '.astro',
  '.cjs',
  '.css',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

function occurrenceCount(value, token) {
  return value.split(token).length - 1;
}

function isPrivateEnvironmentFile(name) {
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example');
}

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    if (entry.isFile() && isPrivateEnvironmentFile(entry.name)) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function textFilesUnder(root) {
  return filesUnder(root).filter((filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    return TEXT_EXTENSIONS.has(extension) || path.basename(filePath) === 'CNAME';
  });
}

export function checkLegalNoticeSource(
  sourcePath = DEFAULT_SOURCE,
  scanRoots = DEFAULT_SCAN_ROOTS,
) {
  const source = fs.readFileSync(sourcePath, 'utf8');

  if (occurrenceCount(source, LEGAL_NOTICE_IDENTITY_HTML) !== 1) {
    throw new Error('El bloque tokenizado del aviso legal no coincide con el contrato');
  }
  for (const field of LEGAL_NOTICE_ALL_FIELDS) {
    const count = occurrenceCount(source, field.token);
    if (count !== 1) {
      throw new Error(`${field.token} debe aparecer exactamente una vez; aparece ${count}`);
    }
  }

  const knownTokens = new Set(LEGAL_NOTICE_ALL_FIELDS.map((field) => field.token));
  const unknownTokens = (source.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? []).filter(
    (token) => !knownTokens.has(token),
  );
  if (unknownTokens.length) {
    throw new Error('El aviso legal contiene tokens privados desconocidos');
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source)) {
    throw new Error('El aviso legal versionable todavía contiene un correo electrónico');
  }
  if (/\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/i.test(source)) {
    throw new Error('El aviso legal versionable todavía contiene un DNI/NIE');
  }

  const resolvedSource = path.resolve(sourcePath);
  const roots = Array.isArray(scanRoots) ? scanRoots : [scanRoots];
  for (const scanRoot of roots) {
    for (const contentPath of textFilesUnder(scanRoot)) {
      if (path.resolve(contentPath) === resolvedSource) continue;
      const content = fs.readFileSync(contentPath, 'utf8');
      if ((content.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? []).length) {
        throw new Error('Se encontraron tokens legales fuera de aviso-legal.md');
      }
    }
  }
}

export function checkPrivateValuesAbsent(values, repositoryRoot = ROOT) {
  const privateValues = LEGAL_NOTICE_FIELDS.flatMap((field) => {
    const value = values?.[field.env];
    if (typeof value !== 'string' || !value.trim()) return [];
    const normalized = value.trim();
    if (
      field.env === 'ASTROCAVA_LEGAL_OWNER' &&
      normalized === PUBLIC_AUTHOR_NAME
    ) {
      return [];
    }
    return [{ env: field.env, bytes: Buffer.from(normalized, 'utf8') }];
  });
  if (!privateValues.length) return;

  for (const candidatePath of filesUnder(repositoryRoot)) {
    const candidate = fs.readFileSync(candidatePath);
    for (const privateValue of privateValues) {
      if (candidate.indexOf(privateValue.bytes) !== -1) {
        const relativePath = path.relative(repositoryRoot, candidatePath);
        throw new Error(
          `El árbol versionable contiene directamente ${privateValue.env} en ${relativePath}`,
        );
      }
    }
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  checkLegalNoticeSource();
  console.log('check-legal-notice-source: ok');
}
