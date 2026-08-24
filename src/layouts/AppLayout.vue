<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import Avatar from "primevue/avatar";
import Button from "primevue/button";
import Tag from "primevue/tag";
import { useAuthStore } from "../stores/auth.js";

const auth = useAuthStore();
const router = useRouter();
const sidebarOpen = ref(false);

const roleLabel = computed(() => {
  const labels = {
    USER: "Support Admin",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super Admin",
  };
  return labels[auth.role] || auth.role || "Staff";
});

const menuItems = computed(() => {
  const role = auth.role;
  return [
    { label: "Dashboard", icon: "pi pi-home", to: "/", roles: null },
    {
      label: "Customers",
      icon: "pi pi-users",
      to: "/customers",
      roles: ["USER", "ADMIN", "SUPER_ADMIN"],
    },
    {
      label: "Rates",
      icon: "pi pi-percentage",
      to: "/rates",
      roles: ["USER", "ADMIN", "SUPER_ADMIN"],
    },
    {
      label: "Products",
      icon: "pi pi-briefcase",
      to: "/products",
      roles: null,
    },
    {
      label: "Applications",
      icon: "pi pi-file-edit",
      to: "/applications",
      roles: null,
    },
    { label: "Loans", icon: "pi pi-wallet", to: "/loans", roles: null },
    {
      label: "Contract",
      icon: "pi pi-file",
      to: "/contracts",
      roles: ["USER", "ADMIN", "SUPER_ADMIN"],
    },
    {
      label: "Repayments",
      icon: "pi pi-receipt",
      to: "/repayments",
      roles: ["USER", "ADMIN", "SUPER_ADMIN"],
    },
    {
      label: "Reports",
      icon: "pi pi-chart-bar",
      to: "/reports",
      roles: ["USER", "ADMIN", "SUPER_ADMIN"],
    },
    {
      label: "Users",
      icon: "pi pi-user-edit",
      to: "/users",
      roles: ["SUPER_ADMIN"],
    },
  ].filter((item) => !item.roles || item.roles.includes(role));
});

function closeSidebar() {
  sidebarOpen.value = false;
}

function logout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="app-shell">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebar" />
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="brand">
        <div class="brand__mark overflow-hidden bg-white">
          <img
            src="https://res.cloudinary.com/dvljcimlz/image/upload/v1787582112/photo_2026-08-24_21-33-46_wupszz.jpg"
            alt="Loan Filipinas Service logo"
            class="h-full w-full object-cover"
          />
        </div>
        <div>
          <strong>Microfinance</strong>
          <span>Management System</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          active-class="nav-link--active"
          :exact-active-class="item.to === '/' ? 'nav-link--active' : ''"
          @click="closeSidebar"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <Avatar
            :label="auth.user?.displayName?.charAt(0) || 'U'"
            shape="circle"
          />
          <div>
            <strong>{{ auth.user?.displayName }}</strong>
            <Tag :value="roleLabel" severity="secondary" />
          </div>
        </div>
        <Button
          label="Sign out"
          icon="pi pi-sign-out"
          severity="secondary"
          text
          fluid
          @click="logout"
        />
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <Button
          icon="pi pi-bars"
          severity="secondary"
          text
          rounded
          class="mobile-menu"
          @click="sidebarOpen = true"
        />
        <div>
          <span class="topbar__eyebrow">Loan Filipinas Service</span>
          <strong>Welcome, {{ auth.user?.displayName }}</strong>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <RouterLink
            to="/profile"
            class="group flex min-w-0 items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-2.5 py-1.5 transition hover:border-teal-300 hover:bg-emerald-50 hover:shadow-[0_6px_18px_rgba(15,118,110,0.08)] aria-[current=page]:border-teal-300 aria-[current=page]:bg-emerald-50 max-[700px]:rounded-full max-[700px]:border-0 max-[700px]:bg-transparent max-[700px]:p-1"
            aria-label="Open my profile"
          >
            <Avatar
              v-if="auth.user?.profileImage"
              :image="auth.user.profileImage"
              shape="circle"
              class="shrink-0 bg-emerald-200 font-extrabold text-emerald-900"
            />
            <Avatar
              v-else
              :label="auth.user?.displayName?.charAt(0)?.toUpperCase() || 'U'"
              shape="circle"
              class="shrink-0 bg-emerald-200 font-extrabold text-emerald-900"
            />
            <div class="min-w-0 max-[700px]:hidden">
              <strong
                class="block max-w-40 truncate text-[0.82rem] text-slate-800"
              >
                {{ auth.user?.displayName || "System user" }}
              </strong>
              <span class="mt-0.5 block text-[0.68rem] text-slate-500">
                {{ roleLabel }}
              </span>
            </div>
            <i
              class="pi pi-chevron-right text-[0.72rem] text-slate-400 max-[700px]:hidden"
            />
          </RouterLink>
        </div>
      </header>
      <main class="page-container">
        <RouterView />
      </main>
    </div>
  </div>
</template>
