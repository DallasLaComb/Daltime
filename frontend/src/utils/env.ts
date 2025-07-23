/**
 * Get the API URL - simple function that works in all environments
 */
export const getApiUrl = (): string => {
  // Return the local development URL
  // Production builds will use environment variables set by GitHub Actions
  return 'http://127.0.0.1:3000';
};
