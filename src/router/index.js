import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { guest: true },
  },
  {
    path: "/system-recovery/setup-super-admin",
    name: "super-admin-recovery",
    component: () => import("../views/RecoverySuperAdminView.vue"),
  },
  { path: "/register", redirect: "/customer/register" },
  {
    path: "/customer/login",
    name: "customer-login",
    component: () => import("../views/customer/CustomerLoginView.vue"),
    meta: { guest: true },
  },
  {
    path: "/customer/register",
    name: "customer-register",
    component: () => import("../views/customer/CustomerRegisterView.vue"),
    meta: { guest: true },
  },
  {
    path: "/customer",
    component: () => import("../layouts/CustomerLayout.vue"),
    meta: { auth: true, roles: ["CUSTOMER"] },
    children: [
      { path: "", redirect: "/customer/home" },
      {
        path: "home",
        name: "customer-home",
        component: () => import("../views/customer/CustomerHomeView.vue"),
      },
      {
        path: "wallet",
        name: "customer-wallet",
        component: () => import("../views/customer/CustomerWalletView.vue"),
      },
      {
        path: "profile",
        name: "customer-profile",
        component: () => import("../views/customer/CustomerProfileView.vue"),
      },
    ],
  },
  {
    path: "/",
    component: () => import("../layouts/AppLayout.vue"),
    meta: { auth: true, roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
    children: [
      {
        path: "",
        name: "dashboard",
        component: () => import("../views/DashboardView.vue"),
      },
      {
        path: "customers",
        name: "customers",
        component: () => import("../views/CustomersView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "rates",
        name: "rates",
        component: () => import("../views/RatesView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "products",
        name: "products",
        component: () => import("../views/ProductsView.vue"),
      },
      {
        path: "applications",
        name: "applications",
        component: () => import("../views/ApplicationsView.vue"),
      },
      {
        path: "loans",
        name: "loans",
        component: () => import("../views/LoansView.vue"),
      },
      {
        path: "contracts",
        name: "contracts",
        component: () => import("../views/ContractView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "repayments",
        name: "repayments",
        component: () => import("../views/RepaymentsView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "reports",
        name: "reports",
        component: () => import("../views/ReportsView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "profile",
        name: "profile",
        component: () => import("../views/ProfileView.vue"),
        meta: { roles: ["USER", "ADMIN", "SUPER_ADMIN"] },
      },
      {
        path: "users",
        name: "users",
        component: () => import("../views/UsersView.vue"),
        meta: { roles: ["SUPER_ADMIN"] },
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.auth && !auth.isAuthenticated) {
    return {
      name: to.path.startsWith("/customer") ? "customer-login" : "login",
      query: { redirect: to.fullPath },
    };
  }
  if (to.meta.guest && auth.isAuthenticated) {
    return auth.isCustomer ? { name: "customer-home" } : { name: "dashboard" };
  }

  if (to.meta.auth && auth.isAuthenticated && !auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return { name: "login" };
    }
  }

  const allowedRoles = to.meta.roles;
  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return auth.isCustomer ? { name: "customer-home" } : { name: "dashboard" };
  }
  return true;
});

export default router;
