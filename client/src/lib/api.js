// src/lib/api.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BASE_URL || '/';

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

export { BASE_URL };