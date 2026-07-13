#!/usr/bin/env node
/** Duplica sitemap-index.xml → sitemap.xml (compatibilidad Ghost/SEO). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist',
);

export function copySitemap(distRoot = DEFAULT_DIST) {
  const index = path.join(distRoot, 'sitemap-index.xml');
  const target = path.join(distRoot, 'sitemap.xml');

  if (!fs.existsSync(index)) {
    throw new Error('postbuild-sitemap: no existe sitemap-index.xml');
  }
  fs.copyFileSync(index, target);
  console.log(
    `postbuild-sitemap: ${path.basename(distRoot)}/sitemap.xml ← sitemap-index.xml`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) copySitemap();
