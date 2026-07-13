import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEGAL_NOTICE_FIELDS } from './legal-notice-contract.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const DEPLOY = fs.readFileSync(
  path.join(ROOT, '.github/workflows/deploy-pages.yml'),
  'utf8',
);

test('CI usa exclusivamente el build sintético y permisos de lectura', () => {
  assert.match(CI, /pull_request:/);
  assert.match(CI, /permissions:\s*\n\s+contents: read/);
  assert.match(CI, /npm run build:verify/);
  assert.match(CI, /npm run check:predeploy:verify/);
  assert.match(CI, /npm run check:verify/);
  assert.doesNotMatch(CI, /secrets\./);
  assert.doesNotMatch(CI, /npm run build(?:\s|$)/m);
});

test('CI y despliegue fijan exactamente Node y npm', () => {
  for (const workflow of [CI, DEPLOY]) {
    assert.match(
      workflow,
      /actions\/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6\.0\.3/,
    );
    assert.match(
      workflow,
      /actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6\.4\.0/,
    );
    assert.match(workflow, /node-version: 24\.16\.0/);
    assert.match(workflow, /npm --version\)" = "11\.13\.0"/);
    assert.match(workflow, /package-manager-cache: false/);
    assert.match(workflow, /npm ci/);
  }
});

test('despliegue es manual, limitado a main y usa el entorno Pages', () => {
  assert.match(DEPLOY, /workflow_dispatch:/);
  assert.doesNotMatch(DEPLOY, /\n\s+push:/);
  assert.match(DEPLOY, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(DEPLOY, /name: github-pages/);
  assert.match(DEPLOY, /pages: write/);
  assert.match(DEPLOY, /id-token: write/);
});

test('solo el despliegue consume los cinco secretos y construye producción', () => {
  for (const field of LEGAL_NOTICE_FIELDS) {
    assert.match(DEPLOY, new RegExp(`secrets\\.${field.env}`));
  }
  assert.match(DEPLOY, /npm run build\n/);
  assert.match(DEPLOY, /npm run check:predeploy\n/);
  assert.match(DEPLOY, /npm run check:verify/);
  assert.doesNotMatch(DEPLOY, /npm run build:verify/);
  assert.match(DEPLOY, /deployment-provenance\.mjs write/);
  assert.match(DEPLOY, /deployment-provenance\.mjs verify/);
});

test('despliegue usa el flujo oficial actual de GitHub Pages y smoke pre-DNS', () => {
  assert.match(DEPLOY, /actions\/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b/);
  assert.match(DEPLOY, /actions\/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b/);
  assert.match(DEPLOY, /actions\/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/);
  assert.match(DEPLOY, /--backend http:\/\/sercava\.github\.io/);
  assert.match(DEPLOY, /--host-header www\.astrocava\.com/);
});
