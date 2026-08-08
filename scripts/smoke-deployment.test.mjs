import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import { smokeDeployment } from './smoke-deployment.mjs';

const COMMIT = 'abc123';
const DIGEST = 'a'.repeat(64);
const REDIRECTS = JSON.parse(
  fs.readFileSync(new URL('../PREDEPLOY_CONTRACT.json', import.meta.url), 'utf8'),
).redirects;
const HTML = `<!doctype html><html><head>
  <link rel="canonical" href="https://www.astrocava.com/">
</head><body><img src="/content/images/test.jpg"></body></html>`;
const LEGAL_HTML = HTML.replace(
  '</body>',
  '<div data-legal-identity="production">Identidad</div></body>',
);
function redirectHtml(to) {
  return `<!doctype html><html><head>
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0;url=${to}">
  <link rel="canonical" href="${new URL(to, 'https://www.astrocava.com')}">
</head></html>`;
}

const REDIRECT_HTML = redirectHtml('/');

async function serverFixture(context, overrides = {}) {
  const seenHosts = [];
  let provenanceRequests = 0;
  const server = http.createServer((request, response) => {
    seenHosts.push(request.headers.host);
    const route = request.url;
    if (route === '/deployment-provenance.json') {
      const commits = overrides.commits ?? [overrides.commit ?? COMMIT];
      const commit = commits[Math.min(provenanceRequests, commits.length - 1)];
      provenanceRequests += 1;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          commit,
          payload: { digest: DIGEST },
        }),
      );
      return;
    }
    if (route === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end('<urlset/>');
      return;
    }
    if (route === '/robots.txt') {
      response.setHeader('content-type', 'text/plain');
      response.end('User-agent: *');
      return;
    }
    if (route === '/content/images/test.jpg') {
      response.setHeader('content-type', 'image/jpeg');
      response.end('image');
      return;
    }
    if (route === '/aviso-legal/') {
      response.setHeader('content-type', 'text/html');
      response.end(overrides.legalHtml ?? LEGAL_HTML);
      return;
    }
    const redirect = REDIRECTS.find(({ from }) => from === route);
    if (redirect) {
      response.setHeader('content-type', 'text/html');
      response.end(
        overrides.redirectHtmlByRoute?.[route] ??
          (route === '/page/2/' ? overrides.redirectHtml : undefined) ??
          redirectHtml(redirect.to),
      );
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  return {
    backend: `http://127.0.0.1:${port}`,
    seenHosts,
    provenanceRequests: () => provenanceRequests,
  };
}

test('smoke valida procedencia, rutas, imagen y Host del backend pre-DNS', async (context) => {
  const { backend, seenHosts } = await serverFixture(context);
  const provenance = await smokeDeployment({
    origin: 'https://www.astrocava.com',
    backend,
    hostHeader: 'www.astrocava.com',
    expectedCommit: COMMIT,
  });

  assert.equal(provenance.commit, COMMIT);
  assert.equal(seenHosts.length, 12 + REDIRECTS.length);
  assert.deepEqual(new Set(seenHosts), new Set(['www.astrocava.com']));
});

test('smoke espera a que producción sirva el commit recién desplegado', async (context) => {
  const fixture = await serverFixture(context, {
    commits: ['anterior', COMMIT],
  });
  const provenance = await smokeDeployment({
    origin: 'https://www.astrocava.com',
    backend: fixture.backend,
    expectedCommit: COMMIT,
    attempts: 2,
    retryDelayMs: 0,
  });

  assert.equal(provenance.commit, COMMIT);
  assert.equal(fixture.provenanceRequests(), 2);
});

test('smoke rechaza commit distinto e identidad sintética', async (context) => {
  const wrongCommit = await serverFixture(context, { commit: 'otro' });
  await assert.rejects(
    smokeDeployment({
      origin: 'https://www.astrocava.com',
      backend: wrongCommit.backend,
      expectedCommit: COMMIT,
    }),
    /El despliegue sirve otro/,
  );

  const verifyIdentity = await serverFixture(context, {
    legalHtml: LEGAL_HTML.replace('production', 'verify'),
  });
  await assert.rejects(
    smokeDeployment({
      origin: 'https://www.astrocava.com',
      backend: verifyIdentity.backend,
      expectedCommit: COMMIT,
    }),
    /identidad sintética/,
  );
});

test('smoke rechaza una compatibilidad estática con destino incorrecto', async (context) => {
  const wrongRedirect = await serverFixture(context, {
    redirectHtml: REDIRECT_HTML.replaceAll(
      'https://www.astrocava.com/',
      'https://www.astrocava.com/licencias/',
    ).replace('content="0;url=/"', 'content="0;url=/licencias/"'),
  });
  await assert.rejects(
    smokeDeployment({
      origin: 'https://www.astrocava.com',
      backend: wrongRedirect.backend,
      expectedCommit: COMMIT,
    }),
    /page\/2\/: redirige a .*licencias.* no a/,
  );

  const invalidCanonical = await serverFixture(context, {
    redirectHtml: REDIRECT_HTML.replace(
      'href="https://www.astrocava.com/"',
      'href="http://["',
    ),
  });
  await assert.rejects(
    smokeDeployment({
      origin: 'https://www.astrocava.com',
      backend: invalidCanonical.backend,
      expectedCommit: COMMIT,
    }),
    /page\/2\/: canonical distinto del destino/,
  );

  const missingNoindex = await serverFixture(context, {
    redirectHtml: REDIRECT_HTML.replace(
      '  <meta name="robots" content="noindex">\n',
      '',
    ),
  });
  await assert.rejects(
    smokeDeployment({
      origin: 'https://www.astrocava.com',
      backend: missingNoindex.backend,
      expectedCommit: COMMIT,
    }),
    /page\/2\/: falta noindex/,
  );
});
