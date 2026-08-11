import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatArticleDate,
  visibleEditorialUpdate,
} from '../src/lib/article-dates.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('la actualización editorial exige una fecha civil posterior y se formatea en UTC', () => {
  const published = new Date('2026-08-11T08:00:00.000Z');
  const sameDay = new Date('2026-08-11T23:00:00.000Z');
  const nextDay = new Date('2026-08-12T00:00:00.000Z');

  assert.equal(visibleEditorialUpdate(published, undefined), undefined);
  assert.equal(visibleEditorialUpdate(published, sameDay), undefined);
  assert.equal(visibleEditorialUpdate(published, nextDay), nextDay);
  assert.equal(formatArticleDate(new Date('2026-04-02T00:00:00.000Z')), '2 de abril de 2026');
});

test('las entradas separan publicación y actualización editorial en UI y metadatos', () => {
  const article = source('src/components/ArticleLayout.astro');
  const base = source('src/layouts/BaseLayout.astro');
  const schema = source('src/content.config.ts');

  assert.match(schema, /editorial_updated_at: z\.coerce\.date\(\)\.optional\(\)/);
  assert.match(article, /visibleEditorialUpdate\(/);
  assert.match(article, /Publicado:/);
  assert.match(article, /Actualizado:/);
  assert.match(article, /datePublished:/);
  assert.match(article, /dateModified:/);
  assert.match(base, /property="article:published_time"/);
  assert.match(base, /property="article:modified_time"/);
  assert.match(base, /type="application\/ld\+json"/);
});

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

test('la portada A organiza cinco áreas con la selección editorial acordada', () => {
  const home = source('src/pages/index.astro');
  const homeData = source('src/lib/home.ts');
  const showcases = source('src/components/HomeShowcases.astro');
  const css = source('src/styles/global.css');
  const selectedPaths = [
    '/galeria/sistema-solar/colores-en-la-luna-pistas-de-su-composicion-quimica/',
    '/galeria/sistema-solar/eclipse-parcial-de-sol-del-29-de-marzo-de-2025/',
    '/galeria/sistema-solar/actividad-solar-del-ciclo-solar-25/',
    '/observacion/el-planeta-jupiter/',
    '/galeria/cielo-profundo/m16-la-nebulosa-del-aguila/',
    '/galeria/cielo-profundo/la-galaxia-de-andromeda-m31/',
    '/galeria/cielo-profundo/el-arbol-de-navidad-y-la-nebulosa-del-cono-ngc2264/',
    '/galeria/cielo-profundo/nebulosa-de-orion-m42/',
    '/astrofotografia/procesado/el-histograma-en-astrofotografia/',
    '/astrofotografia/adquisicion/objetivos-en-astrofotografia/',
    '/astrofotografia/preprocesado/calibracion-de-imagenes-astronomicas/',
    '/astrofotografia/procesado/procesado-de-imagenes-astronomicas/',
    '/observacion/catalogos-de-objetos-astronomicos/',
    '/observacion/el-cielo-de-invierno/',
    '/observacion/el-cielo-de-otono/',
    '/observacion/el-cielo-de-verano/',
    '/arqueoastronomia/astronomia-en-el-paleolitico/',
  ];

  for (const pathname of selectedPaths) {
    assert.equal(
      homeData.split(pathname).length - 1,
      1,
      `${pathname} debe aparecer una sola vez en la selección`,
    );
  }
  assert.equal(
    (homeData.match(/^\s+featuredPath:\s*(?:\n\s*)?'\/[^']+'/gm) || []).length,
    5,
  );
  assert.match(home, /<HomeShowcases sections={sections} \/>/);
  assert.match(showcases, /home-section-grid--a/);
  assert.match(showcases, /role="featured" eyebrow="Protagonista"/);
  assert.match(showcases, /section\.secondary\.map/);
  assert.doesNotMatch(showcases, /Escaparate temático|home-section-number|number\(index\)/);
  assert.doesNotMatch(css, /\.home-section-number/);
  assert.match(
    css,
    /\.home-section-grid--a\s*{[^}]*grid-template-columns:\s*minmax\(0, 1\.45fr\) minmax\(18rem, 0\.85fr\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 50rem\)[\s\S]*?\.home-section-grid--a\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 38rem\)[\s\S]*?\.home-section--a \.home-story--supporting \.home-story-link\s*{[^}]*grid-template-columns:\s*6\.8rem minmax\(0, 1fr\)/,
  );
  assert.doesNotMatch(home, /homeVariant|prototype/i);
  assert.doesNotMatch(showcases, /variant ===|home-section--b|home-portal/);
  assert.doesNotMatch(css, /home-prototype|home-section--b|home-portal/);
  assert.doesNotMatch(homeData, /href: '\/sistema-solar\/'/);
  assert.doesNotMatch(homeData, /href: '\/cielo-profundo\/'/);
});

test('M16 conserva la propuesta SEO y editorial aprobada', () => {
  const article = source(
    'src/content/entries/m16-la-nebulosa-del-aguila.md',
  );

  assert.match(
    article,
    /meta_title: "Nebulosa del Águila: M16 \(Messier 16\)"/,
  );
  assert.match(
    article,
    /meta_description: La Nebulosa del Águila \(M16 o Messier 16\).*astrofotografías propias\./,
  );
  assert.match(article, /nebulosa de emisión IC 4703/);
  assert.match(article, /cúmulo abierto NGC 6611/);
  assert.match(article, /cierta contaminación lumínica/);
  assert.match(article, /apariencia grisácea/);
  assert.match(
    article,
    /href="\/observacion\/los-colores-en-la-observacion-visual\/"/,
  );
  assert.doesNotMatch(article, /La «Nebulosa del Águila» es el número 16/);
  assert.doesNotMatch(article, /no se van a poder apreciar los colores/);
});

test('la guía de observación solar conserva el contexto aprobado del Trío Ibérico de Eclipses', () => {
  const article = source(
    'src/content/entries/recomendaciones-para-la-observacion-solar-a-traves-de-telescopios.md',
  );

  assert.match(
    article,
    /^title: Recomendaciones para la Observación Solar a través de telescopios$/m,
  );
  assert.match(
    article,
    /^pathname: \/observacion\/recomendaciones-para-la-observacion-solar-a-traves-de-telescopios\/$/m,
  );
  assert.match(article, /^meta_title: ''$/m);
  assert.match(article, /^meta_description: ''$/m);
  assert.match(
    article,
    /Trío Ibérico de Eclipses.*12 de agosto de 2026.*2 de agosto de 2027.*26 de enero de 2028/,
  );
  assert.match(
    article,
    /Para disfrutarlos a través de un telescopio.*filtro solar frontal adecuado y bien fijado.*protección debe mantenerse en todo momento\./,
  );
  assert.match(
    article,
    /href="https:\/\/eclipses\.ign\.es\/" rel="noreferrer">portal oficial de eclipses del Instituto Geográfico Nacional<\/a>/,
  );
});

test('El cielo de otoño conserva la propuesta SEO y editorial aprobada', () => {
  const article = source('src/content/entries/el-cielo-de-otono.md');
  const expectedIntro =
    'El cielo de otoño, observado desde latitudes medias del hemisferio norte, combina las últimas constelaciones de verano con las grandes figuras de Andrómeda, Pegaso, Casiopea y Perseo. Esta guía reúne las constelaciones y los objetos más interesantes para planificar una noche de observación durante esta estación.';
  const originalIntro =
    '<p>El otoño es cambio, transición, las noches se alargan, el frío reaparece... y en el cielo que podemos observar también nos encontramos a medio camino. </p>';

  assert.match(article, /^title: El cielo de otoño$/m);
  assert.match(article, /^pathname: \/observacion\/el-cielo-de-otono\/$/m);
  assert.match(
    article,
    /^canonical_url: "https:\/\/www\.astrocava\.com\/observacion\/el-cielo-de-otono\/"$/m,
  );
  assert.match(
    article,
    /^meta_title: "Cielo de otoño: constelaciones y qué observar"$/m,
  );
  assert.match(
    article,
    /^meta_description: "Guía del cielo de otoño desde España: constelaciones, galaxias, nebulosas y otros objetos recomendados para observar durante las noches de esta estación\."$/m,
  );
  assert.match(
    article,
    /^content_plaintext: "El cielo de otoño, observado .* durante esta estación\."$/m,
  );
  assert.ok(article.includes(`<p>${expectedIntro}</p>${originalIntro}`));
  assert.match(
    article,
    /^feature_image: \/content\/images\/2024\/04\/noche-estrellada-oto-o-generada-ia\.jpg$/m,
  );
  assert.match(article, /<!--kg-card-begin: html-->\n<table>/);
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

test('las imágenes del artículo se amplían sin alterar los enlaces', () => {
  const article = source('src/components/ArticleLayout.astro');
  const lightbox = source('src/components/ImageLightbox.astro');
  const css = source('src/styles/global.css');

  assert.match(article, /import ImageLightbox from '\.\/ImageLightbox\.astro'/);
  assert.match(article, /<ImageLightbox \/>/);
  assert.match(lightbox, /<dialog[\s\S]*data-image-lightbox/);
  assert.match(lightbox, /\.feature-image img/);
  assert.match(lightbox, /\.prose figure\.kg-image-card img/);
  assert.match(lightbox, /\.prose figure\.kg-gallery-card img/);
  assert.match(lightbox, /if \(image\.closest\('a'\)\) continue/);
  assert.match(lightbox, /image\.getAttribute\('src'\) \|\| image\.currentSrc/);
  assert.match(lightbox, /dialog\.showModal\(\)/);
  assert.match(lightbox, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(css, /\.prose img\[data-lightbox-trigger\]\s*{[^}]*cursor:\s*zoom-in/s);
  assert.match(css, /\.image-lightbox-image\s*{[^}]*object-fit:\s*contain/s);
});
