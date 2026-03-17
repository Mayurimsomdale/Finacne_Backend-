// src/services/authService.js
import api from './api';

const authService = {
  // Admin Registration
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', {
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'hr'
      });
      
      if (response.data.success) {
        localStorage.setItem('authToken', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  // Admin Login
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', {
        username: credentials.username,
        password: credentials.password
      });
      
      if (response.data.success) {
        localStorage.setItem('authToken', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        
        if (credentials.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
    }
  },

  // Get Current User
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user data' };
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  // Get stored user data
  getUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
};

export default authService;