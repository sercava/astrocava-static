#!/usr/bin/env node
import { build } from 'astro';
import { checkLegalNoticeSource } from './check-legal-notice-source.mjs';
import { processBuiltExternalLinks } from './external-links.mjs';
import { copySitemap } from './postbuild-sitemap.mjs';
import { verifyLegalNoticeBuild } from './verify-legal-notice-build.mjs';

process.env.ASTROCAVA_LEGAL_BUILD_KIND = 'production';
checkLegalNoticeSource();
await build({});
const externalLinks = processBuiltExternalLinks();
console.log(
  `external-links: ok (${externalLinks.externalLinks} enlaces en ${externalLinks.changedFiles}/${externalLinks.htmlFiles} HTML)`,
);
copySitemap();
verifyLegalNoticeBuild('production');
