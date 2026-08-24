<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Drawer from 'primevue/drawer';
import Tag from 'primevue/tag';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { dateTime } from '../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const notificationOpen = ref(false);
const notifications = ref([]);
const unreadCount = ref(0);

const firstName = computed(() => auth.user?.displayName?.split(' ')[0] || 'Customer');
const navigation = [
  { label: 'Home', icon: 'pi pi-home', to: '/customer/home' },
  { label: 'Wallet', icon: 'pi pi-wallet', to: '/customer/wallet' },
  { label: 'Profile', icon: 'pi pi-user', to: '/customer/profile' }
];

async function loadNotifications() {
  try {
    const { data } = await api.get('/notifications');
    notifications.value = data.items;
    unreadCount.value = data.unreadCount;
  } catch {
    notifications.value = [];
  }
}

async function openNotifications() {
  notificationOpen.value = true;
  await loadNotifications();
}

async function markAllRead() {
  await api.patch('/notifications/read-all');
  notifications.value = notifications.value.map((item) => ({ ...item, isRead: true }));
  unreadCount.value = 0;
}

function logout() {
  auth.logout();
  router.push('/customer/login');
}

onMounted(loadNotifications);
</script>

<template>
  <div class="customer-app">
    <header class="customer-header">
      <div class="customer-header__welcome">
        <span>Welcome back</span>
        <strong>{{ firstName }}</strong>
      </div>
      <div class="customer-header__actions">
        <div class="notification-button">
          <Button icon="pi pi-bell" rounded text severity="secondary" aria-label="Notifications" @click="openNotifications" />
          <Badge v-if="unreadCount" :value="unreadCount" severity="danger" />
        </div>
        <Button icon="pi pi-sign-out" rounded text severity="secondary" aria-label="Logout" @click="logout" />
      </div>
    </header>

    <main class="customer-main">
      <RouterView />
    </main>

    <nav class="customer-bottom-nav" aria-label="Customer navigation">
      <RouterLink v-for="item in navigation" :key="item.to" :to="item.to" class="customer-nav-item" active-class="customer-nav-item--active">
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <Drawer v-model:visible="notificationOpen" header="Notifications" position="right" class="customer-notification-drawer">
      <div class="notification-drawer__toolbar">
        <span>{{ unreadCount }} unread</span>
        <Button v-if="unreadCount" label="Mark all read" size="small" text @click="markAllRead" />
      </div>
      <div v-if="notifications.length" class="notification-list">
        <article v-for="item in notifications" :key="item._id" class="notification-item" :class="{ 'notification-item--unread': !item.isRead }">
          <div class="notification-item__icon"><i :class="item.type === 'PAYMENT' ? 'pi pi-receipt' : 'pi pi-bell'" /></div>
          <div>
            <div class="notification-item__title"><strong>{{ item.title }}</strong><Tag v-if="!item.isRead" value="New" severity="info" /></div>
            <p>{{ item.message }}</p>
            <small>{{ dateTime(item.createdAt) }}</small>
          </div>
        </article>
      </div>
      <div v-else class="customer-empty"><i class="pi pi-bell-slash" /><strong>No notifications</strong><span>Your loan updates will appear here.</span></div>
    </Drawer>
  </div>
</template>
