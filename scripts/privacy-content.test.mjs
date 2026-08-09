import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES_ROOT = path.join(ROOT, 'src', 'content', 'entries');
const GITHUB_PAGES_DATA_COLLECTION_URL =
  'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection';
const GITHUB_COOKIE_POLICY_URL =
  'https://docs.github.com/en/site-policy/privacy-policies/github-cookies';
const GITHUB_PRIVACY_URL =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';
const GITHUB_PRIVACY_CONTACT_URL =
  'https://support.github.com/contact/privacy';

function readEntry(filename) {
  return fs.readFileSync(path.join(ENTRIES_ROOT, filename), 'utf8');
}

function assertGitHubPrivacyLinks(source) {
  assert.ok(source.includes(GITHUB_PAGES_DATA_COLLECTION_URL));
  assert.ok(source.includes(GITHUB_PRIVACY_URL));
  assert.ok(source.includes(GITHUB_PRIVACY_CONTACT_URL));
}

test('cookie policy states the current cookieless configuration and GitHub boundaries', () => {
  const source = readEntry('politica-de-cookies.md');

  assert.match(source, /Astrocava no instala actualmente cookies/);
  assert.match(source, /no necesita solicitar consentimiento ni mostrar un banner/);
  assert.match(source, /registro se realiza en el servidor de alojamiento/);
  assert.ok(source.includes(GITHUB_COOKIE_POLICY_URL));
  assertGitHubPrivacyLinks(source);
  assert.ok(source.includes('mailto:privacy@github.com'));
  assert.ok(source.includes('mailto:dpo@github.com'));
  assert.doesNotMatch(source, /partes de acceso restringido/);
  assert.doesNotMatch(source, /Cookies.*de autenticación/i);
});

test('legal notice discloses GitHub Pages logging and keeps rights channels distinct', () => {
  const source = readEntry('aviso-legal.md');

  assert.match(source, /Astrocava no utiliza herramientas de analítica en el navegador/);
  assert.match(source, /GitHub registra y almacena la dirección IP/);
  assert.match(source, /Astrocava no tiene acceso a esos registros/);
  assert.match(source, /ejercer ante el titular de astrocava\.com los derechos/);
  assertGitHubPrivacyLinks(source);
  assert.ok(source.includes(`${GITHUB_PRIVACY_URL}#contact-us`));
  assert.doesNotMatch(source, /Este sitio web no recopila datos personales/);
});
