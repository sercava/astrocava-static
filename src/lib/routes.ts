/** primary_tag → prefijo de URL de colección (sin slug). */
export const COLLECTION_PREFIX_BY_TAG: Record<string, string> = {
  'cielo-profundo': '/galeria/cielo-profundo',
  'sistema-solar': '/galeria/sistema-solar',
  'ingenios-humanos': '/galeria/ingenios-humanos',
  'introduccion-astrofoto': '/astrofotografia/introduccion',
  'adquisicion-astrofoto': '/astrofotografia/adquisicion',
  'preprocesado-astrofoto': '/astrofotografia/preprocesado',
  'procesado-astrofoto': '/astrofotografia/procesado',
  observacion: '/observacion',
  arqueoastronomia: '/arqueoastronomia',
};

/** Índices de sección (sitemap-pages). */
export const SECTION_INDEXES = [
  { path: '/', title: 'Astrocava' },
  { path: '/galeria/', title: 'Galería' },
  { path: '/galeria/cielo-profundo/', title: 'Cielo profundo' },
  { path: '/galeria/sistema-solar/', title: 'Sistema solar' },
  { path: '/galeria/ingenios-humanos/', title: 'Ingenios humanos' },
  { path: '/astrofotografia/', title: 'Astrofotografía' },
  { path: '/astrofotografia/introduccion/', title: 'Introducción' },
  { path: '/astrofotografia/adquisicion/', title: 'Adquisición' },
  { path: '/astrofotografia/preprocesado/', title: 'Preprocesado' },
  { path: '/astrofotografia/procesado/', title: 'Procesado' },
  { path: '/observacion/', title: 'Observación' },
  { path: '/arqueoastronomia/', title: 'Arqueoastronomía' },
] as const;

export const SITE = 'https://www.astrocava.com';
