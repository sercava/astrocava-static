const spanishLongDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatArticleDate(date: Date): string {
  return spanishLongDate.format(date);
}

export function visibleEditorialUpdate(
  publishedAt: Date | undefined,
  editorialUpdatedAt: Date | undefined,
): Date | undefined {
  if (!publishedAt || !editorialUpdatedAt) return undefined;
  return utcDayNumber(editorialUpdatedAt) > utcDayNumber(publishedAt)
    ? editorialUpdatedAt
    : undefined;
}
