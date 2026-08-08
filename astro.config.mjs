import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';
import {
  checkLegalNoticeSource,
  checkPrivateValuesAbsent,
} from './scripts/check-legal-notice-source.mjs';
import { checkRights } from './scripts/check-rights.mjs';
import { LEGAL_NOTICE_SOURCE_RELATIVE_PATH } from './scripts/legal-notice-contract.mjs';
import remarkLegalNotice, {
  resolveLegalNoticeReplacements,
} from './scripts/remark-legal-notice.mjs';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_REDIRECTS = {
  '/astrofotografia/introduccion/objetivos-en-astrofotografia/':
    '/astrofotografia/adquisicion/objetivos-en-astrofotografia/',
  '/galeria/sistema-solar/el-planeta-jupiter/':
    '/observacion/el-planeta-jupiter/',
  '/galeria/sistema-solar/el-planeta-marte/':
    '/observacion/el-planeta-marte/',
  '/galeria/sistema-solar/el-planeta-saturno/':
    '/observacion/el-planeta-saturno/',
  '/observacion/transito-de-venus-en-junio-de-2004/':
    '/galeria/sistema-solar/transito-de-venus-en-junio-de-2004/',
  '/page/2/': '/',
};
const LEGAL_NOTICE_SOURCE_PATH = path.join(
  PROJECT_ROOT,
  LEGAL_NOTICE_SOURCE_RELATIVE_PATH,
);

checkLegalNoticeSource();
checkRights();

const legalEnv = loadEnv(
  // La identidad no cambia por modo: local usa .env.local y CI usa process.env.
  'production',
  PROJECT_ROOT,
  'ASTROCAVA_LEGAL_',
);

const legalBuildKind = legalEnv.ASTROCAVA_LEGAL_BUILD_KIND ?? 'production';

const legalNoticeValues = {
  ASTROCAVA_LEGAL_OWNER: legalEnv.ASTROCAVA_LEGAL_OWNER,
  ASTROCAVA_LEGAL_IDENTIFIER: legalEnv.ASTROCAVA_LEGAL_IDENTIFIER,
  ASTROCAVA_LEGAL_ADDRESS_LINE_1: legalEnv.ASTROCAVA_LEGAL_ADDRESS_LINE_1,
  ASTROCAVA_LEGAL_ADDRESS_LINE_2: legalEnv.ASTROCAVA_LEGAL_ADDRESS_LINE_2,
  ASTROCAVA_LEGAL_EMAIL: legalEnv.ASTROCAVA_LEGAL_EMAIL,
  ASTROCAVA_LEGAL_BUILD_KIND: legalBuildKind,
};

if (legalBuildKind === 'production') {
  checkPrivateValuesAbsent(legalNoticeValues, PROJECT_ROOT);
}
resolveLegalNoticeReplacements(legalNoticeValues);

export default defineConfig({
  site: 'https://www.astrocava.com',
  outDir: legalBuildKind === 'verify' ? './dist-verify' : './dist',
  trailingSlash: 'always',
  redirects: LEGACY_REDIRECTS,
  markdown: {
    gfm: true,
    remarkPlugins: [
      [
        remarkLegalNotice,
        { values: legalNoticeValues, sourcePath: LEGAL_NOTICE_SOURCE_PATH },
      ],
    ],
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/draft/') &&
        !Object.keys(LEGACY_REDIRECTS).some((route) => page.endsWith(route)),
    }),
  ],
});
