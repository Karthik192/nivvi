export const routeValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() || undefined : undefined;
