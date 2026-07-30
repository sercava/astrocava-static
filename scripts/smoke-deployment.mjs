#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREDEPLOY_CONTRACT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'PREDEPLOY_CONTRACT.json'), 'utf8'),
);
const PROTECTED_ROUTES = [
  '',
  'aviso-legal/',
  ...PREDEPLOY_CONTRACT.protectedUrls.map((route) => route.replace(/^\//, '')),
];

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(`Argumentos de smoke inválidos cerca de ${flag ?? '(fin)'}`);
    }
    values[flag.slice(2)] = value;
  }
  return values;
}

function requiredUrl(value, label) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
  } catch {
    throw new Error(`${label} no es una URL HTTP válida`);
  }
}

function integerOption(value, label, minimum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} debe ser un entero mayor o igual que ${minimum}`);
  }
  return parsed;
}

function rawRequest(url, headers) {
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, { headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode,
          headers: response.headers,
          text: async () => body.toString('utf8'),
          json: async () => JSON.parse(body.toString('utf8')),
        });
      });
    });
    request.on('error', reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`Timeout consultando ${url}`));
    });
    request.end();
  });
}

export async function smokeDeployment(options) {
  const origin = requiredUrl(options.origin, 'origin');
  const backend = requiredUrl(options.backend ?? options.origin, 'backend');
  const expectedCommit = options.expectedCommit;
  if (!expectedCommit) throw new Error('Falta expectedCommit para el smoke');
  const attempts = integerOption(options.attempts ?? 1, 'attempts', 1);
  const retryDelayMs = integerOption(options.retryDelayMs ?? 0, 'retryDelayMs', 0);

  async function request(relativePath, expectedType) {
    const logicalUrl = new URL(relativePath, origin);
    const requestUrl = new URL(`${logicalUrl.pathname}${logicalUrl.search}`, backend);
    const headers = options.hostHeader ? { host: options.hostHeader } : {};
    const response = await rawRequest(requestUrl, headers);
    if (response.status !== 200) {
      throw new Error(`${logicalUrl.pathname}: HTTP ${response.status}`);
    }
    const contentType = response.headers['content-type'] ?? '';
    if (expectedType && !contentType.includes(expectedType)) {
      throw new Error(`${logicalUrl.pathname}: content-type inesperado ${contentType}`);
    }
    return response;
  }

  let provenance;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      provenance = await (
        await request('deployment-provenance.json', 'application/json')
      ).json();
      if (provenance.commit !== expectedCommit) {
        throw new Error(
          `El despliegue sirve ${provenance.commit}, no ${expectedCommit}`,
        );
      }
      if (!/^[a-f0-9]{64}$/.test(provenance.payload?.digest ?? '')) {
        throw new Error('El despliegue no expone un digest de payload válido');
      }
      break;
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(retryDelayMs);
    }
  }

  for (const route of PROTECTED_ROUTES) {
    const html = await (await request(route, 'text/html')).text();
    if (!html.includes('https://www.astrocava.com')) {
      throw new Error(`${route || '/'}: falta host canónico`);
    }
    if (/noindex/i.test(html)) throw new Error(`${route || '/'}: contiene noindex`);
    if (html.includes('VERIFY_ONLY') || html.includes('data-legal-identity="verify"')) {
      throw new Error(`${route || '/'}: contiene identidad sintética`);
    }
    if (route === 'aviso-legal/' && !html.includes('data-legal-identity="production"')) {
      throw new Error('El aviso legal desplegado no tiene marcador de producción');
    }
  }

  await request('sitemap.xml', 'xml');
  await request('robots.txt', 'text/plain');

  const home = await (await request('', 'text/html')).text();
  const publicImage = home.match(/(?:src|href)="(\/content\/images\/[^"]+)"/i)?.[1];
  if (!publicImage) throw new Error('La portada no expone una imagen pública comprobable');
  await request(publicImage.slice(1), 'image/');

  return provenance;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const values = parseArguments(process.argv.slice(2));
  const provenance = await smokeDeployment({
    origin: values.origin,
    backend: values.backend,
    hostHeader: values['host-header'],
    expectedCommit: values['expected-commit'],
    attempts: values.attempts,
    retryDelayMs: values['retry-delay-ms'],
  });
  console.log(
    `smoke-deployment: ${provenance.commit} ${provenance.payload.digest} ok`,
  );
}
