import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Let the browser add the multipart boundary when uploading FormData.
  // Axios will set application/json automatically for normal object payloads.
  if (config.data instanceof FormData) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mf_token');
      localStorage.removeItem('mf_user');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
