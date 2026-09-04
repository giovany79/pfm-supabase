export function currentYearDateRange(
  now = new Date(),
  timeZone = 'America/Bogota',
) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const to = `${parts.year}-${parts.month}-${parts.day}`;
  return { from: `${parts.year}-01-01`, to };
}
