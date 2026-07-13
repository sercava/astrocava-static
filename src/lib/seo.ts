/** Longitud orientativa para meta description. */
const MAX_DESC = 160;

export type DescriptionFields = {
  meta_description?: string | null;
  excerpt?: string | null;
  og_description?: string | null;
  content_plaintext?: string | null;
};

/**
 * meta_description → excerpt → og_description → recorte de plaintext Ghost (sin tocar HTML).
 */
export function resolveMetaDescription(fields: DescriptionFields): string {
  const meta = trim(fields.meta_description);
  if (meta) return truncate(meta);

  const excerpt = trim(fields.excerpt);
  if (excerpt) return truncate(excerpt);

  const plain = trim(fields.content_plaintext);
  if (plain) return truncate(plain);

  return '';
}

function trim(s?: string | null): string {
  return (s ?? '').trim();
}

function truncate(s: string): string {
  const one = s.replace(/\s+/g, ' ').trim();
  if (one.length <= MAX_DESC) return one;
  const cut = one.slice(0, MAX_DESC - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
