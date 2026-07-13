import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;

export async function getPublishedEntries(): Promise<Entry[]> {
  return getCollection('entries', ({ data }) => data.status === 'published');
}

export async function getPostsInSection(sectionPath: string): Promise<Entry[]> {
  const prefix = sectionPath.endsWith('/') ? sectionPath : `${sectionPath}/`;
  const all = await getPublishedEntries();
  return all
    .filter(
      (e) =>
        e.data.type === 'post' &&
        e.data.pathname.startsWith(prefix) &&
        e.data.pathname !== prefix,
    )
    .sort(
      (a, b) =>
        (b.data.published_at?.getTime() ?? 0) -
        (a.data.published_at?.getTime() ?? 0),
    );
}

export async function getPageBySlug(slug: string): Promise<Entry | undefined> {
  const all = await getPublishedEntries();
  return all.find((e) => e.data.type === 'page' && e.data.slug === slug);
}

export async function getPostByPathname(pathname: string): Promise<Entry | undefined> {
  const all = await getPublishedEntries();
  return all.find((e) => e.data.pathname === pathname);
}

export function entriesForTag(entries: Entry[], tagSlug: string): Entry[] {
  return entries
    .filter((e) => e.data.tags.includes(tagSlug))
    .sort(
      (a, b) =>
        (b.data.published_at?.getTime() ?? 0) -
        (a.data.published_at?.getTime() ?? 0),
    );
}
