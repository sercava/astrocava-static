import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('la cabecera conserva las cinco secciones principales históricas', () => {
  const layout = source('src/layouts/BaseLayout.astro');
  const expected = [
    ["'/galeria/'", "'Galería'"],
    ["'/observacion/'", "'Observación'"],
    ["'/arqueoastronomia/'", "'Arqueoastronomía'"],
    ["'/astrofotografia/'", "'Astrofotografía'"],
    ["'/info/'", "'Info'"],
  ];

  for (const [href, label] of expected) {
    assert.match(layout, new RegExp(`href: ${href}, label: ${label}`));
  }
  assert.match(layout, /aria-label="Secciones principales"/);
  assert.match(layout, /<SearchBox variant="header" idPrefix="site-search" \/>/);
});

test('la cabecera y el pie recuperan el rojo de identidad con contraste claro', () => {
  const layout = source('src/layouts/BaseLayout.astro');
  const css = source('src/styles/global.css');

  assert.match(css, /--brand-red:\s*#[0-9a-f]{6}/i);
  assert.match(css, /\.site-header\s*{[^}]*background:\s*var\(--brand-red\)/s);
  assert.match(css, /\.site-header a\s*{[^}]*color:\s*#fff/s);
  assert.match(css, /\.site-footer\s*{[^}]*background:\s*var\(--brand-red\)/s);
  assert.match(css, /\.site-footer a\s*{[^}]*color:\s*#fff/s);
  assert.match(layout, /class="site-footer-inner"/);
});

test('la portada conserva su frase editorial histórica', () => {
  const home = source('src/pages/index.astro');
  assert.match(
    home,
    /Esto va de Astronomía: Observación visual, Astrofotografía y un poco de Arqueoastronomía/,
  );
  assert.match(home, /class="home-hero"/);
  assert.match(home, /<SearchBox variant="hero" idPrefix="home-search" \/>/);
});

test('la portada y la cabecera comparten una búsqueda local bajo demanda', () => {
  const home = source('src/pages/index.astro');
  const layout = source('src/layouts/BaseLayout.astro');
  const search = source('src/components/SearchBox.astro');
  const index = source('src/lib/search.ts');
  const endpoint = source('src/pages/search-index.json.ts');
  const css = source('src/styles/global.css');

  assert.match(css, /\.home-hero\s*{[^}]*pleyades[^}]*cover no-repeat/s);
  assert.match(search, /Buscar artículos, etiquetas y autores/);
  assert.match(search, /fetch\('\/search-index\.json'/);
  assert.match(search, /normalize\('NFD'\)/);
  assert.match(home, /variant="hero"/);
  assert.match(layout, /variant="header"/);
  assert.match(index, /kind: 'Artículo'/);
  assert.match(index, /kind: 'Etiqueta'/);
  assert.match(index, /kind: 'Autor'/);
  assert.match(endpoint, /Content-Type': 'application\/json; charset=utf-8'/);
  assert.doesNotMatch(search, /https?:\/\//);
});

test('el crédito y la licencia de la imagen principal son metadatos secundarios', () => {
  const article = source('src/components/ArticleLayout.astro');
  const css = source('src/styles/global.css');

  assert.match(article, /class="feature-image-caption"/);
  assert.match(article, /<small class="feature-image-attribution">/);
  assert.match(css, /\.feature-image-attribution\s*{[^}]*font-size:\s*0\.68rem/s);
  assert.match(css, /\.kg-bookmark-card\s*>\s*figcaption\s*{[^}]*font-size:\s*0\.68rem/s);
});

test('los listados comparten tarjetas con extracto y thumbnail', () => {
  const component = source('src/components/EntryList.astro');
  const consumers = [
    'src/components/SectionIndex.astro',
    'src/pages/index.astro',
    'src/pages/tag/[slug]/index.astro',
    'src/pages/author/[slug]/index.astro',
  ];

  assert.match(component, /entry\.data\.feature_image/);
  assert.match(component, /entry-card-thumbnail/);
  assert.match(component, /entry\.data\.excerpt \|\| entry\.data\.content_plaintext/);
  for (const consumer of consumers) {
    assert.match(source(consumer), /<EntryList entries=/);
  }
});

test('las tarjetas bookmark de Ghost tienen estilos estructurales', () => {
  const css = source('src/styles/global.css');
  for (const selector of [
    '.kg-bookmark-container',
    '.kg-bookmark-content',
    '.kg-bookmark-icon',
    '.kg-bookmark-thumbnail',
  ]) {
    assert.match(css, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(css, /\.kg-bookmark-icon\s*{[^}]*width:\s*1rem/s);
});
