<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Avatar from 'primevue/avatar';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import PageHeader from '../components/PageHeader.vue';
import { useAuthStore } from '../stores/auth.js';
import { apiError, dateTime, statusSeverity } from '../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');

const roleDetails = {
  USER: {
    label: 'Support Admin',
    description: 'Supports customer records, applications, loans and repayments.'
  },
  ADMIN: {
    label: 'Admin',
    description: 'Manages daily lending operations and reviews loan activity.'
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Has full access to system configuration and staff management.'
  }
};

const currentRole = computed(() => {
  return roleDetails[auth.role] || {
    label: auth.role || 'Unknown role',
    description: 'System account'
  };
});

const initials = computed(() => {
  const name = auth.user?.displayName || auth.user?.username || 'User';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
});

const permissions = computed(() => auth.user?.permissions || []);

async function loadProfile() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await auth.fetchMe();
  } catch (error) {
    errorMessage.value = apiError(error);
  } finally {
    loading.value = false;
  }
}

function logout() {
  auth.logout();
  router.push('/login');
}

onMounted(loadProfile);
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="My profile"
      subtitle="View your staff identity, role and account information."
    >
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        :loading="loading"
        @click="loadProfile"
      />
    </PageHeader>

    <Message v-if="errorMessage" severity="error" :closable="false">
      {{ errorMessage }}
    </Message>

    <div
      v-if="loading"
      class="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"
    >
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="h-20 animate-pulse bg-slate-200" />
        <div class="space-y-4 p-5">
          <div class="-mt-12 h-16 w-16 animate-pulse rounded-full border-4 border-white bg-slate-300" />
          <div class="h-5 w-36 animate-pulse rounded bg-slate-200" />
          <div class="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div class="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div class="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-6 h-6 w-44 animate-pulse rounded bg-slate-200" />
        <div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div
            v-for="index in 6"
            :key="index"
            class="space-y-2 border-b border-slate-100 pb-4"
          >
            <div class="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div class="h-5 w-36 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"
    >
      <aside class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="h-20 bg-emerald-800" />

        <div class="-mt-10 p-5 pt-0">
          <Avatar
            v-if="auth.user?.profileImage"
            :image="auth.user.profileImage"
            shape="circle"
            size="xlarge"
            class="border-4 border-white bg-emerald-100 text-xl font-bold text-emerald-900 shadow-sm"
          />

          <Avatar
            v-else
            :label="initials"
            shape="circle"
            size="xlarge"
            class="border-4 border-white bg-emerald-100 text-xl font-bold text-emerald-900 shadow-sm"
          />

          <div class="mt-4">
            <h2 class="text-lg font-bold text-slate-900">
              {{ auth.user?.displayName || 'System user' }}
            </h2>
            <p class="mt-0.5 text-sm text-slate-500">@{{ auth.user?.username }}</p>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <Tag :value="currentRole.label" severity="info" />
            <Tag
              :value="auth.user?.status"
              :severity="statusSeverity(auth.user?.status)"
            />
          </div>

          <div class="mt-5 flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <i class="pi pi-shield mt-0.5 text-emerald-700" />
            <div>
              <strong class="block text-sm text-slate-900">{{ currentRole.label }}</strong>
              <span class="mt-1 block text-sm leading-5 text-slate-600">
                {{ currentRole.description }}
              </span>
            </div>
          </div>

          <Button
            label="Sign out"
            icon="pi pi-sign-out"
            severity="danger"
            outlined
            fluid
            class="mt-5"
            @click="logout"
          />
        </div>
      </aside>

      <div class="space-y-5">
        <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 class="font-semibold text-slate-900">Account information</h2>
              <p class="mt-0.5 text-sm text-slate-500">Your staff account details.</p>
            </div>
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <i class="pi pi-user" />
            </div>
          </header>

          <div class="grid px-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Display name
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ auth.user?.displayName || '—' }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Username
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ auth.user?.username || '—' }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Email
              </span>
              <strong class="mt-1.5 block break-all text-sm font-semibold text-slate-900">
                {{ auth.user?.email || '—' }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Phone
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ auth.user?.phone || '—' }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4 sm:border-b-0">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                System role
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ currentRole.label }}
              </strong>
            </div>

            <div class="py-4">
              <span class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Account status
              </span>
              <Tag
                :value="auth.user?.status"
                :severity="statusSeverity(auth.user?.status)"
              />
            </div>
          </div>
        </section>

        <section
          v-if="auth.isSuperAdmin"
          class="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 class="font-semibold text-slate-900">Security activity</h2>
              <p class="mt-0.5 text-sm text-slate-500">Important account dates and identifiers.</p>
            </div>
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <i class="pi pi-lock" />
            </div>
          </header>

          <div class="grid px-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Last login
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ dateTime(auth.user?.lastLoginAt) }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Password changed
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ dateTime(auth.user?.passwordChangedAt) }}
              </strong>
            </div>

            <div class="border-b border-slate-100 py-4 sm:border-b-0">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Account created
              </span>
              <strong class="mt-1.5 block text-sm font-semibold text-slate-900">
                {{ dateTime(auth.user?.createdAt) }}
              </strong>
            </div>

            <div class="py-4">
              <span class="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Account ID
              </span>
              <strong class="mt-1.5 block break-all font-mono text-xs font-semibold text-slate-900">
                {{ auth.user?.id || '—' }}
              </strong>
            </div>
          </div>
        </section>

        <section
          v-if="auth.isSuperAdmin"
          class="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 class="font-semibold text-slate-900">Assigned permissions</h2>
              <p class="mt-0.5 text-sm text-slate-500">Permissions included with this account.</p>
            </div>
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {{ permissions.length }}
            </span>
          </header>

          <div class="p-5 sm:p-6">
            <div v-if="permissions.length" class="flex flex-wrap gap-2">
              <Tag
                v-for="permission in permissions"
                :key="permission"
                :value="permission.replaceAll('_', ' ')"
                severity="secondary"
                class="capitalize"
              />
            </div>

            <div
              v-else
              class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
            >
              <i class="pi pi-info-circle" />
              No individual permissions are assigned to this role.
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
