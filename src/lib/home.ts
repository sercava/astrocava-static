import type { Entry } from './entries';

type HomeSectionDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  featuredPath: string;
  secondaryPaths: readonly string[];
};

export type HomeSection = Omit<
  HomeSectionDefinition,
  'featuredPath' | 'secondaryPaths'
> & {
  featured: Entry;
  secondary: Entry[];
};

export const HOME_SECTION_DEFINITIONS = [
  {
    id: 'sistema-solar',
    label: 'Sistema Solar',
    shortLabel: 'Sistema Solar',
    description:
      'La Luna, el Sol y los planetas observados desde nuestra vecindad cósmica.',
    href: '/galeria/sistema-solar/',
    featuredPath:
      '/galeria/sistema-solar/colores-en-la-luna-pistas-de-su-composicion-quimica/',
    secondaryPaths: [
      '/galeria/sistema-solar/eclipse-parcial-de-sol-del-29-de-marzo-de-2025/',
      '/galeria/sistema-solar/actividad-solar-del-ciclo-solar-25/',
      '/observacion/el-planeta-jupiter/',
    ],
  },
  {
    id: 'cielo-profundo',
    label: 'Cielo profundo',
    shortLabel: 'Cielo profundo',
    description:
      'Nebulosas, galaxias y cúmulos: objetos lejanos fotografiados y explicados.',
    href: '/galeria/cielo-profundo/',
    featuredPath: '/galeria/cielo-profundo/m16-la-nebulosa-del-aguila/',
    secondaryPaths: [
      '/galeria/cielo-profundo/la-galaxia-de-andromeda-m31/',
      '/galeria/cielo-profundo/el-arbol-de-navidad-y-la-nebulosa-del-cono-ngc2264/',
      '/galeria/cielo-profundo/nebulosa-de-orion-m42/',
    ],
  },
  {
    id: 'astrofotografia',
    label: 'Astrofotografía',
    shortLabel: 'Astrofotografía',
    description:
      'Fundamentos, adquisición, calibración y procesado para construir una imagen astronómica.',
    href: '/astrofotografia/',
    featuredPath:
      '/astrofotografia/procesado/el-histograma-en-astrofotografia/',
    secondaryPaths: [
      '/astrofotografia/adquisicion/objetivos-en-astrofotografia/',
      '/astrofotografia/preprocesado/calibracion-de-imagenes-astronomicas/',
      '/astrofotografia/procesado/procesado-de-imagenes-astronomicas/',
    ],
  },
  {
    id: 'observacion',
    label: 'Observación',
    shortLabel: 'Observación',
    description:
      'Guías y recursos para reconocer el cielo y preparar una noche de observación.',
    href: '/observacion/',
    featuredPath: '/observacion/catalogos-de-objetos-astronomicos/',
    secondaryPaths: [
      '/observacion/el-cielo-de-invierno/',
      '/observacion/el-cielo-de-otono/',
      '/observacion/el-cielo-de-verano/',
    ],
  },
  {
    id: 'otros-horizontes',
    label: 'Otros horizontes',
    shortLabel: 'Otros horizontes',
    description:
      'Arqueoastronomía y miradas que conectan el cielo con la historia humana.',
    href: '/arqueoastronomia/',
    featuredPath: '/arqueoastronomia/astronomia-en-el-paleolitico/',
    secondaryPaths: [],
  },
] as const satisfies readonly HomeSectionDefinition[];

export const HOME_RECENT_PATHS = [
  '/galeria/sistema-solar/eclipse-parcial-de-sol-del-29-de-marzo-de-2025/',
  '/galeria/sistema-solar/actividad-solar-del-ciclo-solar-25/',
  '/galeria/cielo-profundo/cadena-de-markarian/',
] as const;

export function resolveHomeSections(entries: Entry[]): HomeSection[] {
  const entriesByPath = new Map(
    entries.map((entry) => [entry.data.pathname, entry]),
  );
  const selectedPaths = new Set<string>();

  const requireEntry = (pathname: string): Entry => {
    if (selectedPaths.has(pathname)) {
      throw new Error(`La selección editorial de portada repite ${pathname}`);
    }
    selectedPaths.add(pathname);

    const entry = entriesByPath.get(pathname);
    if (!entry) {
      throw new Error(`Falta la entrada seleccionada para portada: ${pathname}`);
    }
    return entry;
  };

  return HOME_SECTION_DEFINITIONS.map((section) => ({
    id: section.id,
    label: section.label,
    shortLabel: section.shortLabel,
    description: section.description,
    href: section.href,
    featured: requireEntry(section.featuredPath),
    secondary: section.secondaryPaths.map(requireEntry),
  }));
}

export function getRecentHomeEntries(entries: Entry[]): Entry[] {
  const entriesByPath = new Map(
    entries.map((entry) => [entry.data.pathname, entry]),
  );
  const selectedPaths = new Set<string>();

  return HOME_RECENT_PATHS.map((pathname) => {
    if (selectedPaths.has(pathname)) {
      throw new Error(`La selección de lecturas recientes repite ${pathname}`);
    }
    selectedPaths.add(pathname);

    const entry = entriesByPath.get(pathname);
    if (!entry) {
      throw new Error(`Falta la lectura reciente seleccionada para portada: ${pathname}`);
    }
    return entry;
  });
}
