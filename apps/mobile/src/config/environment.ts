export type AppEnvironment = 'development' | 'production';

export function readEnvironment(input: {
  APP_VARIANT?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
}) {
  const environment = input.APP_VARIANT ?? 'development';
  if (environment !== 'development' && environment !== 'production') {
    throw new Error('APP_VARIANT must be development or production.');
  }
  const apiBaseUrl = input.EXPO_PUBLIC_API_BASE_URL?.trim() || null;
  if (apiBaseUrl) {
    const url = new URL(apiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('API URL must be HTTP(S) without embedded credentials.');
    }
    if (environment === 'production' && url.protocol !== 'https:') {
      throw new Error('Production API URL must use HTTPS.');
    }
  }
  const normalizedApiBaseUrl = apiBaseUrl?.replace(/\/$/, '').replace(/\/api\/v1$/i, '') ?? null;
  return { environment: environment as AppEnvironment, apiBaseUrl: normalizedApiBaseUrl };
}
