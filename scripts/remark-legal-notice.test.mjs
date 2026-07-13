import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  checkLegalNoticeSource,
  checkPrivateValuesAbsent,
} from './check-legal-notice-source.mjs';
import {
  LEGAL_NOTICE_IDENTITY_HTML,
  LEGAL_NOTICE_VERIFY_VALUES,
} from './legal-notice-contract.mjs';
import { PUBLIC_AUTHOR_NAME } from './licensing-contract.mjs';
import remarkLegalNotice from './remark-legal-notice.mjs';
import { verifyLegalNoticeBuild } from './verify-legal-notice-build.mjs';

const TEST_SOURCE_PATH = path.join(os.tmpdir(), 'aviso-legal.md');

function legalTree(html = LEGAL_NOTICE_IDENTITY_HTML) {
  return { type: 'root', children: [{ type: 'html', value: html }] };
}

function legalPlugin(values) {
  return remarkLegalNotice({ values, sourcePath: TEST_SOURCE_PATH });
}

test('injects escaped production values into the legal notice only', () => {
  const values = {
    ASTROCAVA_LEGAL_OWNER: 'Nombre <privado> & compañía',
    ASTROCAVA_LEGAL_IDENTIFIER: 'ID-"privado"',
    ASTROCAVA_LEGAL_ADDRESS_LINE_1: "Calle 'privada' 1",
    ASTROCAVA_LEGAL_ADDRESS_LINE_2: '00000 Localidad',
    ASTROCAVA_LEGAL_EMAIL: 'legal@example.invalid',
    ASTROCAVA_LEGAL_BUILD_KIND: 'production',
  };
  const tree = legalTree();

  legalPlugin(values)(tree, { path: TEST_SOURCE_PATH });

  const html = tree.children[0].value;
  assert.match(html, /Nombre &lt;privado&gt; &amp; compañía/);
  assert.match(html, /ID-&quot;privado&quot;/);
  assert.match(html, /Calle &#39;privada&#39; 1/);
  assert.match(html, /data-legal-identity="production"/);
  assert.doesNotMatch(html, /@@ASTROCAVA_LEGAL_/);
});

test('fails closed when a private value is missing', () => {
  const values = { ...LEGAL_NOTICE_VERIFY_VALUES };
  delete values.ASTROCAVA_LEGAL_IDENTIFIER;
  assert.throws(
    () => legalPlugin(values),
    /ASTROCAVA_LEGAL_IDENTIFIER/,
  );
});

test('rejects legal tokens outside the legal notice', () => {
  const tree = legalTree();
  assert.throws(
    () =>
      legalPlugin(LEGAL_NOTICE_VERIFY_VALUES)(tree, {
        path: path.join(os.tmpdir(), 'otro-articulo.md'),
      }),
    /fuera de aviso-legal\.md/,
  );
});

test('rejects legal tokens in non-HTML Markdown nodes', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: '@@ASTROCAVA_LEGAL_OWNER@@' }],
      },
    ],
  };
  assert.throws(
    () =>
      legalPlugin(LEGAL_NOTICE_VERIFY_VALUES)(tree, {
        path: path.join(os.tmpdir(), 'otro-articulo.md'),
      }),
    /fuera de aviso-legal\.md/,
  );
});

test('does not identify the legal notice by basename alone', () => {
  const tree = legalTree();
  assert.throws(
    () =>
      legalPlugin(LEGAL_NOTICE_VERIFY_VALUES)(tree, {
        path: path.join(os.tmpdir(), 'otra-ruta', 'aviso-legal.md'),
      }),
    /fuera de aviso-legal\.md/,
  );
});

test('source check rejects legal tokens in another content file', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-legal-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const legalPath = path.join(directory, 'aviso-legal.md');
  fs.writeFileSync(legalPath, LEGAL_NOTICE_IDENTITY_HTML);
  fs.writeFileSync(
    path.join(directory, 'otro.md'),
    '---\ntitle: @@ASTROCAVA_LEGAL_OWNER@@\n---\n',
  );

  assert.throws(
    () => checkLegalNoticeSource(legalPath, directory),
    /fuera de aviso-legal\.md/,
  );
});

test('production source scan rejects a private value in the public tree', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-pii-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(
    path.join(directory, '.env.local'),
    'ASTROCAVA_LEGAL_OWNER="PRIVATE OWNER"\n',
  );
  fs.writeFileSync(path.join(directory, 'src', 'leak.md'), 'PRIVATE OWNER');

  assert.throws(
    () =>
      checkPrivateValuesAbsent(
        { ASTROCAVA_LEGAL_OWNER: 'PRIVATE OWNER' },
        directory,
      ),
    /ASTROCAVA_LEGAL_OWNER/,
  );
});

test('production source scan permits only the explicitly public author name', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-author-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(
    path.join(directory, 'src', 'license.md'),
    `${PUBLIC_AUTHOR_NAME}\n`,
  );

  assert.doesNotThrow(() =>
    checkPrivateValuesAbsent(
      { ASTROCAVA_LEGAL_OWNER: PUBLIC_AUTHOR_NAME },
      directory,
    ),
  );
  fs.writeFileSync(
    path.join(directory, 'src', 'license.md'),
    `${PUBLIC_AUTHOR_NAME} PRIVATE\n`,
  );
  assert.throws(
    () =>
      checkPrivateValuesAbsent(
        { ASTROCAVA_LEGAL_OWNER: `${PUBLIC_AUTHOR_NAME} PRIVATE` },
        directory,
      ),
    /ASTROCAVA_LEGAL_OWNER/,
  );
});

test('public author exception never applies to other legal fields', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-field-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'src', 'leak.md'), PUBLIC_AUTHOR_NAME);

  assert.throws(
    () =>
      checkPrivateValuesAbsent(
        { ASTROCAVA_LEGAL_ADDRESS_LINE_1: PUBLIC_AUTHOR_NAME },
        directory,
      ),
    /ASTROCAVA_LEGAL_ADDRESS_LINE_1/,
  );
});

test('requires each legal token exactly once', () => {
  const tree = legalTree(
    `${LEGAL_NOTICE_IDENTITY_HTML}@@ASTROCAVA_LEGAL_OWNER@@`,
  );
  assert.throws(
    () =>
      legalPlugin(LEGAL_NOTICE_VERIFY_VALUES)(tree, {
        path: TEST_SOURCE_PATH,
      }),
    /debe aparecer exactamente una vez/,
  );
});

test('rejects private values that contain a reserved legal token', () => {
  const values = {
    ASTROCAVA_LEGAL_OWNER: '@@ASTROCAVA_LEGAL_IDENTIFIER@@',
    ASTROCAVA_LEGAL_IDENTIFIER: 'PRIVATE-ID',
    ASTROCAVA_LEGAL_ADDRESS_LINE_1: 'PRIVATE ADDRESS 1',
    ASTROCAVA_LEGAL_ADDRESS_LINE_2: 'PRIVATE ADDRESS 2',
    ASTROCAVA_LEGAL_EMAIL: 'private@example.invalid',
    ASTROCAVA_LEGAL_BUILD_KIND: 'production',
  };
  assert.throws(() => legalPlugin(values), /token reservado/);
});

test('accepts only deterministic values in verification mode', () => {
  const values = {
    ...LEGAL_NOTICE_VERIFY_VALUES,
    ASTROCAVA_LEGAL_OWNER: 'otro valor',
  };
  assert.throws(
    () => legalPlugin(values),
    /valor sintético de ASTROCAVA_LEGAL_OWNER/,
  );
});

test('build verification rejects legal tokens anywhere in the artifact', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocava-dist-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const legalDirectory = path.join(directory, 'aviso-legal');
  fs.mkdirSync(legalDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(legalDirectory, 'index.html'),
    '<div data-legal-identity="production">Identidad</div>',
  );
  fs.writeFileSync(
    path.join(directory, 'otro.html'),
    '@@ASTROCAVA_LEGAL_OWNER@@',
  );

  assert.throws(
    () => verifyLegalNoticeBuild('production', directory),
    /contiene tokens legales/,
  );
});
