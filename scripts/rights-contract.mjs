import crypto from 'node:crypto';

export const PUBLIC_RIGHTS_MANIFEST_SCHEMA_VERSION = 1;
export const PUBLIC_RIGHTS_MANIFEST_FILENAME = 'RIGHTS_MANIFEST.json';

export const EXPECTED_FINAL_RIGHTS_TOTALS = Object.freeze({
  families: 279,
  files: 660,
});

export const PUBLIC_RIGHTS_CLASSIFICATIONS = Object.freeze([
  'OWNED_CC_BY_4_0',
  'OWNED_BRAND_ALL_RIGHTS_RESERVED',
  'THIRD_PARTY_LICENSED',
  'PUBLIC_DOMAIN',
  'PERMISSION_DOCUMENTED',
  'AI_GENERATED_MIDJOURNEY',
]);

export const BLOCKING_RIGHTS_CLASSIFICATIONS = Object.freeze([
  'NEEDS_RESEARCH',
  'AI_PROVENANCE_UNVERIFIED',
  'REPLACE',
  'REMOVE',
]);

export const OWNED_CC_BY_4_0_CONTRACT = Object.freeze({
  licenseId: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
});

export const OWNED_BRAND_CONTRACT = Object.freeze({
  licenseId: 'ALL-RIGHTS-RESERVED',
  licenseUrl: '',
});

export const MIDJOURNEY_PUBLIC_CONTRACT = Object.freeze({
  credit: 'Ilustración generada con Midjourney por Sergio Cava',
  generator: 'Midjourney',
  mediaType: 'illustration',
  licenseId: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  visibleLicenseLabel: 'CC BY 4.0 (aportaciones humanas)',
  licenseScope:
    'CC BY 4.0 alcanza únicamente los derechos y aportaciones humanas que correspondan a Sergio Cava; no afirma autoría humana exclusiva sobre el resultado íntegro.',
});

export const MIDJOURNEY_FAMILY_PATHS = Object.freeze([
  '/content/images/2024/04/asteroide-ocultando-luz-estrella-generada-ia.jpg',
  '/content/images/2024/04/mapa-estelar-universo.jpg',
  '/content/images/2024/04/noche-estrellada-invierno-generada-ia.jpg',
  '/content/images/2024/04/noche-estrellada-oto-o-generada-ia.jpg',
  '/content/images/2024/04/noche-estrellada-verano-generada-ia.jpg',
  '/content/images/2024/07/aviso-legal.png',
  '/content/images/2024/07/objetivos-para-astrofotograf-a.png',
  '/content/images/2024/07/politica-de-cookies.png',
  '/content/images/2024/09/solar-magnetic-activity_flares_coronal-ejections_ai-generated.png',
]);

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalRightsFamilyPath(publicPath) {
  return publicPath.replace(
    /^\/content\/images\/size\/[^/]+\//,
    '/content/images/',
  );
}

export function comparePublicPaths(left, right) {
  return left.localeCompare(right, 'en');
}

export function familyDigestForFiles(files) {
  const sorted = [...files].sort((left, right) =>
    comparePublicPaths(left.path, right.path),
  );
  return sha256Bytes(
    sorted
      .map((file) => `${file.path}\0${file.sha256}\0${file.bytes}`)
      .join('\n'),
  );
}

export function inventoryDigestForFamilies(families) {
  const sorted = [...families].sort((left, right) =>
    comparePublicPaths(left.canonicalPath, right.canonicalPath),
  );
  return sha256Bytes(
    sorted
      .map(
        (family) =>
          `${family.canonicalPath}\0${family.familyDigest ?? familyDigestForFiles(family.files)}`,
      )
      .join('\n'),
  );
}
