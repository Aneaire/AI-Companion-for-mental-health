// API configuration that works in both development and production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// For development, Vite proxy handles /api -> localhost:4000
// For production, /api goes directly to Vercel serverless functions
export const getApiUrl = (path: string) => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In development with proxy, use /api prefix
  // In production, use /api prefix (handled by Vercel)
  if (API_BASE_URL === '/api') {
    return `/api/${cleanPath}`;
  }
  
  // If VITE_API_BASE_URL is set to full URL, use it directly
  return `${API_BASE_URL}/${cleanPath}`;
};

// Helper for fetch requests
export const apiFetch = (path: string, options?: RequestInit) => {
  return fetch(getApiUrl(path), options);
};
