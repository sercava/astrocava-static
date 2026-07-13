import activeTags from '../data/active-tags.json';
import { getPublishedEntries } from './entries';

export interface SearchItem {
  kind: 'Artículo' | 'Etiqueta' | 'Autor';
  title: string;
  pathname: string;
  description?: string;
  searchText: string;
}

function summarize(value: string | undefined): string {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > 150 ? `${text.slice(0, 147).trimEnd()}…` : text;
}

export async function getSearchItems(): Promise<SearchItem[]> {
  const entries = await getPublishedEntries();
  const posts = entries
    .filter((entry) => entry.data.type === 'post')
    .sort(
      (left, right) =>
        (right.data.published_at?.getTime() ?? 0) -
        (left.data.published_at?.getTime() ?? 0),
    );
  const tagNames = new Map(activeTags.map((tag) => [tag.slug, tag.name]));

  return [
    ...posts.map((post) => ({
      kind: 'Artículo' as const,
      title: post.data.title,
      pathname: post.data.pathname,
      description: summarize(post.data.excerpt || post.data.content_plaintext),
      searchText: [
        post.data.title,
        post.data.excerpt,
        post.data.content_plaintext,
        ...post.data.tags.map((tag) => tagNames.get(tag) || tag),
        post.data.author === 'sergio' ? 'Sergio Cava' : post.data.author,
      ]
        .filter(Boolean)
        .join(' '),
    })),
    ...activeTags.map((tag) => ({
      kind: 'Etiqueta' as const,
      title: tag.name,
      pathname: tag.pathname,
      description: 'Ver publicaciones con esta etiqueta',
      searchText: `${tag.name} ${tag.slug}`,
    })),
    {
      kind: 'Autor' as const,
      title: 'Sergio Cava',
      pathname: '/author/sergio/',
      description: 'Ver publicaciones del autor',
      searchText: 'Sergio Cava autor Astrocava',
    },
  ];
}
