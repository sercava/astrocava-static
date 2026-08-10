import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectAnchorElements,
  hasAccessibleNewTabNotice,
  processBuiltExternalLinks,
  readHtmlAttribute,
  transformExternalLinksInHtml,
} from './external-links.mjs';

function relTokens(openingTag) {
  return new Set((readHtmlAttribute(openingTag, 'rel') ?? '').toLowerCase().split(/\s+/));
}

test('transforma un enlace externo de forma segura, accesible e idempotente', () => {
  const source = '<p><a href="https://example.org/fuente" target="_self" rel="nofollow">Fuente</a></p>';
  const first = transformExternalLinksInHtml(source);
  const anchor = collectAnchorElements(first.html)[0];

  assert.equal(first.externalLinks, 1);
  assert.equal(readHtmlAttribute(anchor.openingTag, 'target'), '_blank');
  assert.deepEqual(relTokens(anchor.openingTag), new Set(['nofollow', 'noopener', 'noreferrer']));
  assert.match(anchor.innerHtml, /visually-hidden external-link-new-tab-note/);
  assert.equal(hasAccessibleNewTabNotice(anchor.openingTag, anchor.innerHtml), true);
  assert.deepEqual(transformExternalLinksInHtml(first.html), {
    html: first.html,
    externalLinks: 1,
  });
});

test('amplía aria-label sin añadir texto oculto duplicado ni interpretar dólares', () => {
  const source = '<a title="Resultado > fuente" href="//example.net/" aria-label="Abrir fuente $1">Ficha</a>';
  const transformed = transformExternalLinksInHtml(source);
  const anchor = collectAnchorElements(transformed.html)[0];

  assert.equal(
    readHtmlAttribute(anchor.openingTag, 'aria-label'),
    'Abrir fuente $1 (abre en una pestaña nueva)',
  );
  assert.doesNotMatch(anchor.innerHtml, /external-link-new-tab-note/);
  assert.equal(hasAccessibleNewTabNotice(anchor.openingTag, anchor.innerHtml), true);
});

test('conserva sin cambios enlaces internos, fragmentos, correo y teléfono', () => {
  const source = [
    '<a href="/observacion/">Interno</a>',
    '<a href="https://www.astrocava.com/licencias/">Canónico</a>',
    '<a href="http://astrocava.com/">Apex</a>',
    '<a href="https://www.astrocava.com./info/">Canónico con punto final</a>',
    '<a href="#detalle">Fragmento</a>',
    '<a href="mailto:info@example.org">Correo</a>',
    '<a href="tel:+34000000000">Teléfono</a>',
  ].join('');

  assert.deepEqual(transformExternalLinksInHtml(source), { html: source, externalLinks: 0 });
});

test('procesa únicamente HTML del build y no vuelve a escribirlo en una segunda pasada', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-external-links-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'entrada'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<a href="https://example.org/">Uno</a>');
  fs.writeFileSync(path.join(root, 'entrada', 'index.HTML'), '<a href="https://example.net/">Dos</a>');
  fs.writeFileSync(path.join(root, 'entrada', 'fuente.txt'), '<a href="https://example.com/">Texto</a>');

  assert.deepEqual(processBuiltExternalLinks(root), {
    htmlFiles: 2,
    changedFiles: 2,
    externalLinks: 2,
  });
  assert.deepEqual(processBuiltExternalLinks(root), {
    htmlFiles: 2,
    changedFiles: 0,
    externalLinks: 2,
  });
  assert.equal(
    fs.readFileSync(path.join(root, 'entrada', 'fuente.txt'), 'utf8'),
    '<a href="https://example.com/">Texto</a>',
  );
});

test('rechaza un destino de build inexistente', () => {
  assert.throws(
    () => processBuiltExternalLinks(path.join(os.tmpdir(), 'astrocava-no-existe')),
    /No existe el directorio de build/,
  );
});
