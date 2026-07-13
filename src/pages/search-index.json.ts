import type { APIRoute } from 'astro';
import { getSearchItems } from '../lib/search';

export const prerender = true;

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await getSearchItems()), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
