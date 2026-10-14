const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');

export const API_BASE_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;
