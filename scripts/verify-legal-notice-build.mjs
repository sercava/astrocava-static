#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL_NOTICE_TOKEN_PATTERN } from './legal-notice-contract.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILT_TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.xml',
]);

function builtTextFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...builtTextFiles(entryPath));
    if (
      entry.isFile() &&
      BUILT_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(entryPath);
    }
  }
  return files;
}

export function verifyLegalNoticeBuild(expectedKind, distRoot = path.join(ROOT, 'dist')) {
  if (!['production', 'verify'].includes(expectedKind)) {
    throw new Error('Modo de validación legal desconocido');
  }

  const htmlPath = path.join(distRoot, 'aviso-legal/index.html');
  if (!fs.existsSync(htmlPath)) {
    throw new Error('El build no contiene /aviso-legal/');
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const builtPath of builtTextFiles(distRoot)) {
    const builtText = fs.readFileSync(builtPath, 'utf8');
    if ((builtText.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? []).length) {
      throw new Error(
        `El artefacto construido contiene tokens legales en ${path.relative(distRoot, builtPath)}`,
      );
    }
    if (
      expectedKind === 'production' &&
      (builtText.includes('VERIFY_ONLY') ||
        builtText.includes('data-legal-identity="verify"'))
    ) {
      throw new Error('El build de producción contiene identidad sintética');
    }
  }

  const marker = `data-legal-identity="${expectedKind}"`;
  if (html.split(marker).length - 1 !== 1) {
    throw new Error(`El HTML no contiene exactamente un marcador legal ${expectedKind}`);
  }
  console.log(`verify-legal-notice-build: ${expectedKind} ok`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  verifyLegalNoticeBuild(process.argv[2] ?? 'production');
}
