import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PROVENANCE_FILENAME,
  calculatePayload,
  verifyProvenance,
  writeProvenance,
} from './deployment-provenance.mjs';

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-provenance-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>Astrocava</h1>');
  fs.writeFileSync(path.join(root, 'nested', 'asset.txt'), 'asset');
  return root;
}

test('procedencia registra y verifica el payload sin incluirse a sí misma', (context) => {
  const root = fixture(context);
  const before = calculatePayload(root);
  const manifest = writeProvenance(root, {
    repository: 'sercava/astrocava-static',
    commit: 'abc123',
    runId: '42',
    runAttempt: '1',
  });

  assert.deepEqual(manifest.payload, before);
  assert.equal(fs.existsSync(path.join(root, PROVENANCE_FILENAME)), true);
  assert.deepEqual(verifyProvenance(root, 'abc123'), manifest);
  assert.deepEqual(calculatePayload(root), before);
});

test('procedencia falla si cambia un byte o el commit esperado', (context) => {
  const root = fixture(context);
  writeProvenance(root, {
    repository: 'sercava/astrocava-static',
    commit: 'abc123',
    runId: '42',
    runAttempt: '1',
  });

  assert.throws(() => verifyProvenance(root, 'otro'), /commit del artefacto no coincide/);
  fs.appendFileSync(path.join(root, 'index.html'), '!');
  assert.throws(() => verifyProvenance(root, 'abc123'), /payload no coincide/);
});

test('procedencia exige metadata completa', (context) => {
  const root = fixture(context);
  assert.throws(
    () =>
      writeProvenance(root, {
        repository: 'sercava/astrocava-static',
        commit: '',
        runId: '42',
        runAttempt: '1',
      }),
    /Falta commit/,
  );
});
