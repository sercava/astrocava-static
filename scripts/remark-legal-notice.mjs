import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGAL_NOTICE_ALL_FIELDS,
  LEGAL_NOTICE_BUILD_KIND,
  LEGAL_NOTICE_FIELDS,
  LEGAL_NOTICE_SOURCE_RELATIVE_PATH,
  LEGAL_NOTICE_TOKEN_PATTERN,
  LEGAL_NOTICE_VERIFY_VALUES,
} from './legal-notice-contract.mjs';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizedValue(values, envName) {
  const value = values[envName];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Falta la variable privada ${envName}`);
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`La variable privada ${envName} contiene caracteres de control`);
  }
  const normalized = value.trim();
  if ((normalized.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? []).length) {
    throw new Error(`La variable privada ${envName} contiene un token reservado`);
  }
  return normalized;
}

export function resolveLegalNoticeReplacements(values = {}) {
  const buildKind = normalizedValue(values, LEGAL_NOTICE_BUILD_KIND.env);
  if (!['production', 'verify'].includes(buildKind)) {
    throw new Error(
      `${LEGAL_NOTICE_BUILD_KIND.env} debe ser "production" o "verify"`,
    );
  }

  const replacements = new Map([
    [LEGAL_NOTICE_BUILD_KIND.token, buildKind],
  ]);

  for (const field of LEGAL_NOTICE_FIELDS) {
    const value = normalizedValue(values, field.env);
    if (buildKind === 'production' && /^(?:REPLACE_ME|VERIFY_ONLY)/i.test(value)) {
      throw new Error(`La variable privada ${field.env} conserva un valor de ejemplo`);
    }
    if (buildKind === 'verify' && value !== LEGAL_NOTICE_VERIFY_VALUES[field.env]) {
      throw new Error(`El build de verificación exige el valor sintético de ${field.env}`);
    }
    if (
      field.env === 'ASTROCAVA_LEGAL_EMAIL' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      throw new Error(`La variable privada ${field.env} no parece un correo válido`);
    }
    replacements.set(field.token, escapeHtml(value));
  }

  return replacements;
}

function walk(node, visit) {
  visit(node);
  if (!Array.isArray(node?.children)) return;
  for (const child of node.children) walk(child, visit);
}

function normalizedPath(candidate) {
  const value = String(candidate);
  return path.resolve(value.startsWith('file:') ? fileURLToPath(value) : value);
}

function isLegalNoticeFile(file, sourcePath) {
  const candidates = [file?.path, ...(file?.history ?? [])].filter(Boolean);
  return candidates.some((candidate) => normalizedPath(candidate) === sourcePath);
}

function occurrenceCount(value, token) {
  return value.split(token).length - 1;
}

export default function remarkLegalNotice({
  values = {},
  sourcePath = path.resolve(LEGAL_NOTICE_SOURCE_RELATIVE_PATH),
} = {}) {
  const replacements = resolveLegalNoticeReplacements(values);
  const resolvedSourcePath = normalizedPath(sourcePath);

  return (tree, file) => {
    const valueNodes = [];
    const htmlNodes = [];
    walk(tree, (node) => {
      if (typeof node?.value === 'string') {
        valueNodes.push(node);
        if (node.type === 'html') htmlNodes.push(node);
      }
    });

    const joinedValues = valueNodes.map((node) => node.value).join('\n');
    const presentTokens = joinedValues.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? [];
    if (!isLegalNoticeFile(file, resolvedSourcePath)) {
      if (presentTokens.length) {
        throw new Error('Se encontraron tokens legales fuera de aviso-legal.md');
      }
      return;
    }

    for (const field of LEGAL_NOTICE_ALL_FIELDS) {
      const count = occurrenceCount(joinedValues, field.token);
      if (count !== 1) {
        throw new Error(
          `${field.token} debe aparecer exactamente una vez en aviso-legal.md; aparece ${count}`,
        );
      }
    }

    for (const node of htmlNodes) {
      for (const [token, value] of replacements) {
        node.value = node.value.split(token).join(value);
      }
    }

    const remaining = valueNodes.flatMap(
      (node) => node.value.match(LEGAL_NOTICE_TOKEN_PATTERN) ?? [],
    );
    if (remaining.length) {
      throw new Error('Quedaron tokens legales sin resolver en aviso-legal.md');
    }
  };
}
