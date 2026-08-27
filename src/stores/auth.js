import { computed, ref } from "vue";
import { defineStore } from "pinia";
import api from "../services/api.js";
import { connectRealtime, disconnectRealtime } from "../services/socket.js";

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("mf_user"));
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref(storedUser());
  const token = ref(localStorage.getItem("mf_token"));
  const loading = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value));
  const role = computed(() => user.value?.role || null);
  const isCustomer = computed(() => role.value === "CUSTOMER");
  const isAdmin = computed(() => ["ADMIN", "SUPER_ADMIN"].includes(role.value));
  const isSuperAdmin = computed(() => role.value === "SUPER_ADMIN");

  function saveSession(data) {
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("mf_token", data.token);
    localStorage.setItem("mf_user", JSON.stringify(data.user));
    connectRealtime(data.token);
  }

  async function login(credentials) {
    loading.value = true;
    try {
      const { data } = await api.post("/auth/login", credentials);
      saveSession(data);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function registerCustomer(payload) {
    loading.value = true;
    try {
      const { data } = await api.post("/auth/register-customer", payload);
      saveSession(data);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    if (!token.value) return null;
    const { data } = await api.get("/auth/me");
    user.value = data.user;
    localStorage.setItem("mf_user", JSON.stringify(data.user));
    return data.user;
  }

  function logout() {
    disconnectRealtime();
    token.value = null;
    user.value = null;
    localStorage.removeItem("mf_token");
    localStorage.removeItem("mf_user");
  }

  return {
    user,
    token,
    loading,
    isAuthenticated,
    role,
    isCustomer,
    isAdmin,
    isSuperAdmin,
    login,
    registerCustomer,
    fetchMe,
    logout,
  };
});
