export const LEGAL_NOTICE_FILENAME = 'aviso-legal.md';
export const LEGAL_NOTICE_SOURCE_RELATIVE_PATH =
  'src/content/entries/aviso-legal.md';

export const LEGAL_NOTICE_FIELDS = Object.freeze([
  { env: 'ASTROCAVA_LEGAL_OWNER', token: '@@ASTROCAVA_LEGAL_OWNER@@' },
  {
    env: 'ASTROCAVA_LEGAL_IDENTIFIER',
    token: '@@ASTROCAVA_LEGAL_IDENTIFIER@@',
  },
  {
    env: 'ASTROCAVA_LEGAL_ADDRESS_LINE_1',
    token: '@@ASTROCAVA_LEGAL_ADDRESS_LINE_1@@',
  },
  {
    env: 'ASTROCAVA_LEGAL_ADDRESS_LINE_2',
    token: '@@ASTROCAVA_LEGAL_ADDRESS_LINE_2@@',
  },
  { env: 'ASTROCAVA_LEGAL_EMAIL', token: '@@ASTROCAVA_LEGAL_EMAIL@@' },
]);

export const LEGAL_NOTICE_BUILD_KIND = Object.freeze({
  env: 'ASTROCAVA_LEGAL_BUILD_KIND',
  token: '@@ASTROCAVA_LEGAL_BUILD_KIND@@',
});

export const LEGAL_NOTICE_ALL_FIELDS = Object.freeze([
  ...LEGAL_NOTICE_FIELDS,
  LEGAL_NOTICE_BUILD_KIND,
]);

export const LEGAL_NOTICE_TOKEN_PATTERN = /@@ASTROCAVA_LEGAL_[A-Z0-9_]+@@/g;

export const LEGAL_NOTICE_IDENTITY_HTML = [
  '<p>Ahí van:</p>',
  `<ul data-legal-identity="${LEGAL_NOTICE_BUILD_KIND.token}">`,
  `<li>Titular de la web: ${LEGAL_NOTICE_FIELDS[0].token}</li>`,
  `<li>DNI: ${LEGAL_NOTICE_FIELDS[1].token}</li>`,
  '<li>Dirección postal:<ul>',
  `<li>${LEGAL_NOTICE_FIELDS[2].token}</li>`,
  `<li>${LEGAL_NOTICE_FIELDS[3].token}</li>`,
  '<li>España</li>',
  '</ul></li>',
  `<li>correo electrónico: ${LEGAL_NOTICE_FIELDS[4].token}</li>`,
  '</ul>',
].join('');

export const LEGAL_NOTICE_VERIFY_VALUES = Object.freeze({
  ASTROCAVA_LEGAL_OWNER: 'VERIFY_ONLY — NOT FOR DEPLOYMENT',
  ASTROCAVA_LEGAL_IDENTIFIER: 'VERIFY_ONLY',
  ASTROCAVA_LEGAL_ADDRESS_LINE_1: 'VERIFY_ONLY address line 1',
  ASTROCAVA_LEGAL_ADDRESS_LINE_2: 'VERIFY_ONLY address line 2',
  ASTROCAVA_LEGAL_EMAIL: 'verify-only@example.invalid',
  ASTROCAVA_LEGAL_BUILD_KIND: 'verify',
});
