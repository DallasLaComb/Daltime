// Configuration utility for environment variables
export const config = {
  apiBaseUrl: (() => {
    // In test environment, provide a mock URL
    if (typeof jest !== 'undefined') {
      return 'http://localhost:3000';
    }
    // In browser environment, use Vite's import.meta.env
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (
        import.meta.env.VITE_API_URL ||
        'https://your-api-gateway-url.amazonaws.com'
      );
    }
    // Fallback
    return 'https://your-api-gateway-url.amazonaws.com';
  })(),
};
