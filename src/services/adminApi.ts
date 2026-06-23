import axios from 'axios';
import mondaySdk from 'monday-sdk-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const monday = mondaySdk();

const adminApi = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Before every admin request, fetch a fresh sessionToken from Monday
adminApi.interceptors.request.use(async (config) => {
  try {
    const tokenRes = await monday.get('sessionToken');
    const sessionToken = tokenRes.data;
    if (sessionToken) {
      config.headers.Authorization = `Bearer ${sessionToken}`;
    }
  } catch (err) {
    const localAdminToken = import.meta.env.VITE_LOCAL_ADMIN_TOKEN;
    if (localAdminToken) {
      config.headers.Authorization = `Bearer ${localAdminToken}`;
    } else {
      console.error('Failed to get Monday session token:', err);
    }
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401 || status === 403) {
        console.error('Admin authentication failed. Is the app running inside Monday.com?');
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
