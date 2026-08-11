import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const entries = defineCollection({
  loader: glob({ base: './src/content/entries', pattern: '**/*.md' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    type: z.enum(['post', 'page']),
    status: z.string(),
    primary_tag_slug: z.string().optional(),
    pathname: z.string(),
    url: z.string(),
    canonical_url: z.string(),
    published_at: z.coerce.date().optional(),
    updated_at: z.coerce.date().optional(),
    editorial_updated_at: z.coerce.date().optional(),
    excerpt: z.string().optional(),
    content_plaintext: z.string().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    feature_image: z.string().optional(),
    feature_image_alt: z.string().optional(),
    feature_image_srcset: z.string().optional(),
    feature_image_sizes: z.string().optional(),
    feature_image_caption: z.string().optional(),
    feature_image_credit: z.string().optional(),
    feature_image_credit_url: z.string().url().optional(),
    feature_image_license: z.string().optional(),
    feature_image_license_url: z.string().url().optional(),
    og_title: z.string().optional(),
    og_description: z.string().optional(),
    og_image: z.string().optional(),
    twitter_title: z.string().optional(),
    twitter_description: z.string().optional(),
    twitter_image: z.string().optional(),
  }),
});

export const collections = { entries };
