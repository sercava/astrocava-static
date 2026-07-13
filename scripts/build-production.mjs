#!/usr/bin/env node
import { build } from 'astro';
import { checkLegalNoticeSource } from './check-legal-notice-source.mjs';
import { copySitemap } from './postbuild-sitemap.mjs';
import { verifyLegalNoticeBuild } from './verify-legal-notice-build.mjs';

process.env.ASTROCAVA_LEGAL_BUILD_KIND = 'production';
checkLegalNoticeSource();
await build({});
copySitemap();
verifyLegalNoticeBuild('production');
