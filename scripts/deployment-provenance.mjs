#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVENANCE_FILENAME = 'deployment-provenance.json';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function walkPayloadFiles(root, current = root) {
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`El artefacto no puede contener symlinks: ${entryPath}`);
    }
    if (entry.isDirectory()) files.push(...walkPayloadFiles(root, entryPath));
    if (entry.isFile() && entry.name !== PROVENANCE_FILENAME) {
      files.push(entryPath);
    }
  }
  return files;
}

export function calculatePayload(root) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`No existe el directorio del artefacto: ${resolvedRoot}`);
  }

  const records = walkPayloadFiles(resolvedRoot)
    .map((filePath) => {
      const bytes = fs.readFileSync(filePath);
      return {
        path: path.relative(resolvedRoot, filePath).split(path.sep).join('/'),
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const digestInput = records
    .map((record) => `${record.sha256}  ${record.bytes}  ${record.path}\n`)
    .join('');

  return {
    algorithm: 'sha256',
    digest: sha256(digestInput),
    files: records.length,
    bytes: records.reduce((total, record) => total + record.bytes, 0),
  };
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Falta ${label} para registrar la procedencia`);
  }
  return value.trim();
}

export function writeProvenance(root, metadata) {
  const resolvedRoot = path.resolve(root);
  const manifest = {
    schemaVersion: 1,
    repository: requiredString(metadata.repository, 'repository'),
    commit: requiredString(metadata.commit, 'commit'),
    workflowRun: {
      id: requiredString(metadata.runId, 'run-id'),
      attempt: requiredString(metadata.runAttempt, 'run-attempt'),
    },
    payload: calculatePayload(resolvedRoot),
  };
  fs.writeFileSync(
    path.join(resolvedRoot, PROVENANCE_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

export function verifyProvenance(root, expectedCommit) {
  const resolvedRoot = path.resolve(root);
  const manifestPath = path.join(resolvedRoot, PROVENANCE_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Falta ${PROVENANCE_FILENAME} en el artefacto`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('Schema de procedencia desconocido');
  if (expectedCommit && manifest.commit !== expectedCommit) {
    throw new Error(`El commit del artefacto no coincide: ${manifest.commit}`);
  }
  const actual = calculatePayload(resolvedRoot);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.payload)) {
    throw new Error('El digest o inventario del payload no coincide con la procedencia');
  }
  return manifest;
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(`Argumentos de procedencia inválidos cerca de ${flag ?? '(fin)'}`);
    }
    values[flag.slice(2)] = value;
  }
  return { command, values };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const { command, values } = parseArguments(process.argv.slice(2));
  const artifactRoot = path.resolve(ROOT, values.root ?? 'dist');
  if (command === 'write') {
    const manifest = writeProvenance(artifactRoot, {
      repository: values.repository,
      commit: values.commit,
      runId: values['run-id'],
      runAttempt: values['run-attempt'],
    });
    console.log(
      `deployment-provenance: ${manifest.commit} ${manifest.payload.digest} ` +
        `${manifest.payload.files} files`,
    );
  } else if (command === 'verify') {
    const manifest = verifyProvenance(artifactRoot, values.commit);
    console.log(
      `deployment-provenance: verified ${manifest.commit} ${manifest.payload.digest}`,
    );
  } else {
    throw new Error('Uso: deployment-provenance.mjs <write|verify> [opciones]');
  }
}
