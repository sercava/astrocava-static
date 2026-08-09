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

test('despliegue usa el flujo oficial actual de GitHub Pages y smoke de producción', () => {
  assert.match(
    DEPLOY,
    /actions\/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6\.0\.0/,
  );
  assert.match(
    DEPLOY,
    /actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5\.0\.0/,
  );
  assert.match(
    DEPLOY,
    /actions\/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5\.0\.0/,
  );
  assert.doesNotMatch(DEPLOY, /actions\/configure-pages@.*# v5(?:\s|$)/m);
  assert.doesNotMatch(DEPLOY, /actions\/deploy-pages@.*# v4(?:\s|$)/m);
  assert.doesNotMatch(DEPLOY, /actions\/upload-pages-artifact@.*# v4(?:\s|$)/m);
  assert.match(DEPLOY, /--origin https:\/\/www\.astrocava\.com/);
  assert.match(DEPLOY, /--expected-commit "\$\{\{ github\.sha \}\}"/);
  assert.match(DEPLOY, /--attempts 12/);
  assert.match(DEPLOY, /--retry-delay-ms 5000/);
  assert.doesNotMatch(DEPLOY, /--backend http:\/\/sercava\.github\.io/);
  assert.doesNotMatch(DEPLOY, /--host-header www\.astrocava\.com/);
});
