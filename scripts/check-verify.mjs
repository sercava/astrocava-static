#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL_NOTICE_VERIFY_VALUES } from './legal-notice-contract.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const astroCli = path.join(ROOT, 'node_modules', 'astro', 'astro.js');

const result = spawnSync(process.execPath, [astroCli, 'check'], {
  cwd: ROOT,
  env: { ...process.env, ...LEGAL_NOTICE_VERIFY_VALUES },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
