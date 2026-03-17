// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: "http://192.168.1.37:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // ✅ CRITICAL FIX: Get token from 'authToken' instead of 'token'
    const token = localStorage.getItem('authToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't override Content-Type if it's FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    console.log('🚀 API Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasToken: !!token
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      // Unauthorized - clear all auth data and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;