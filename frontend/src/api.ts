// import axios from 'axios';

// const api = axios.create({
//   baseURL: 'http://127.0.0.1:8000', // Адреса нашого FastAPI
// });

// // Автоматично додаємо токен авторизації
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://guard-crm-backend-1.onrender.com', // Посилання на твій живий бекенд
});

// Автоматично додаємо токен авторизації[cite: 1]
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;