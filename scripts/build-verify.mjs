#!/usr/bin/env node
import { build } from 'astro';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLegalNoticeSource } from './check-legal-notice-source.mjs';
import { LEGAL_NOTICE_VERIFY_VALUES } from './legal-notice-contract.mjs';
import { copySitemap } from './postbuild-sitemap.mjs';
import { verifyLegalNoticeBuild } from './verify-legal-notice-build.mjs';

const VERIFY_DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist-verify',
);

Object.assign(process.env, LEGAL_NOTICE_VERIFY_VALUES);
checkLegalNoticeSource();
await build({});
copySitemap(VERIFY_DIST);
verifyLegalNoticeBuild('verify', VERIFY_DIST);
