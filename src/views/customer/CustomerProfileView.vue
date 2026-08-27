<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Password from 'primevue/password';
import api from '../../services/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { useRealtimeRefresh } from '../../composables/useRealtimeRefresh.js';
import { apiError, currency, date, fullName } from '../../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const customer = ref(null);
const dashboard = ref({});
const loading = ref(true);
const bankDetails = ref(null);
const bankDialogVisible = ref(false);
const verifyingBankDetails = ref(false);
const bankPasswordForm = reactive({ password: '' });
let bankDetailsTimer = null;

const initials = computed(() => {
  const words = fullName(customer.value)
    .split(/\s+/)
    .filter((word) => word && word !== '—');
  const firstInitial = words[0]?.[0] || '';
  const lastInitial = words.length > 1 ? words.at(-1)?.[0] || '' : '';

  return `${firstInitial}${lastInitial}`.toUpperCase() || 'C';
});

const formattedAddress = computed(() => {
  const address = customer.value?.address;

  if (!address) return 'No address provided';

  return [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.postalCode
  ].filter(Boolean).join(', ') || 'No address provided';
});

async function load() {
  loading.value = true;

  try {
    const [customerResponse, dashboardResponse] = await Promise.all([
      api.get('/customers/me'),
      api.get('/dashboard')
    ]);

    customer.value = customerResponse.data.item;
    dashboard.value = dashboardResponse.data.data;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load profile',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    loading.value = false;
  }
}

function openBankDetailsDialog() {
  bankPasswordForm.password = '';
  bankDialogVisible.value = true;
}

function closeBankDetailsDialog() {
  if (verifyingBankDetails.value) return;

  bankDialogVisible.value = false;
  bankPasswordForm.password = '';
}

function hideBankDetails() {
  bankDetails.value = null;

  if (bankDetailsTimer) {
    window.clearTimeout(bankDetailsTimer);
    bankDetailsTimer = null;
  }
}

async function revealBankDetails() {
  if (!bankPasswordForm.password) return;

  verifyingBankDetails.value = true;

  try {
    const { data } = await api.post('/customers/me/bank-details', {
      password: bankPasswordForm.password
    });

    hideBankDetails();
    bankDetails.value = data.item;
    bankDialogVisible.value = false;
    bankPasswordForm.password = '';

    bankDetailsTimer = window.setTimeout(() => {
      bankDetails.value = null;
      bankDetailsTimer = null;
    }, 60_000);

    toast.add({
      severity: 'success',
      summary: 'Bank details unlocked',
      detail: 'They will be hidden automatically after 60 seconds.',
      life: 3000
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Verification failed',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    verifyingBankDetails.value = false;
  }
}

function logout() {
  hideBankDetails();
  auth.logout();
  router.push('/customer/login');
}

useRealtimeRefresh(['profile', 'customers'], load);
onMounted(load);
onBeforeUnmount(hideBankDetails);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
    <header>
      <span class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
        My account
      </span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">Profile</h1>
      <p class="mt-1 text-sm text-slate-500">
        View your personal and account information.
      </p>
    </header>

    <template v-if="loading">
      <div class="h-40 animate-pulse rounded-2xl bg-emerald-100" />

      <div class="grid grid-cols-2 gap-3">
        <div class="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div class="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>

      <div class="h-72 animate-pulse rounded-2xl bg-slate-100" />
    </template>

    <template v-else-if="customer">
      <!-- Customer identity -->
      <section class="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
        <div class="relative z-10 flex items-center gap-4">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-xl font-bold">
            {{ initials }}
          </div>

          <div class="min-w-0 flex-1">
            <h2 class="truncate text-xl font-bold">
              {{ fullName(customer) }}
            </h2>
            <p class="mt-0.5 text-sm text-emerald-50">
              {{ customer.customerCode }}
            </p>

            <span class="mt-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              {{ customer.status }}
            </span>
          </div>
        </div>

        <div class="absolute -bottom-12 -right-8 h-32 w-32 rounded-full bg-white/10" />
        <div class="absolute -right-4 -top-12 h-24 w-24 rounded-full bg-white/10" />
      </section>

      <!-- Account summary -->
      <section class="grid grid-cols-2 gap-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-file-edit" />
          </div>
          <strong class="mt-3 block text-2xl text-slate-900">
            {{ dashboard.applicationCount || 0 }}
          </strong>
          <span class="mt-0.5 block text-xs text-slate-500">Applications</span>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-wallet" />
          </div>
          <strong class="mt-3 block text-2xl text-slate-900">
            {{ dashboard.activeLoanCount || 0 }}
          </strong>
          <span class="mt-0.5 block text-xs text-slate-500">Active loans</span>
        </article>
      </section>

      <!-- Personal information -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-user" />
          </div>
          <h3 class="font-bold text-slate-900">Personal information</h3>
        </header>

        <div class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Full name</span>
            <strong class="text-right text-sm text-slate-800">
              {{ fullName(customer) }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Phone</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.phone || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Email</span>
            <strong class="min-w-0 break-all text-right text-sm text-slate-800">
              {{ customer.email || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Occupation</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.occupation || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Monthly income</span>
            <strong class="text-right text-sm text-slate-800">
              {{ currency(customer.monthlyIncome) }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Date of birth</span>
            <strong class="text-right text-sm text-slate-800">
              {{ date(customer.dateOfBirth) }}
            </strong>
          </div>
        </div>
      </section>

      <!-- Address -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-map-marker" />
          </div>
          <h3 class="font-bold text-slate-900">Address</h3>
        </header>

        <div class="flex items-start gap-3 p-4">
          <i class="pi pi-map-marker mt-0.5 text-sm text-slate-400" />
          <p class="text-sm leading-6 text-slate-600">
            {{ formattedAddress }}
          </p>
        </div>
      </section>

      <!-- Protected bank information -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <i class="pi pi-credit-card" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Bank information</h3>
              <p class="mt-0.5 text-xs text-slate-500">Password protected</p>
            </div>
          </div>

          <i
            class="pi text-sm text-slate-400"
            :class="bankDetails ? 'pi-lock-open' : 'pi-lock'"
          />
        </header>

        <div v-if="bankDetails" class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Account holder</span>
            <strong class="text-right text-sm text-slate-800">
              {{ bankDetails.accountHolderName || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank name</span>
            <strong class="text-right text-sm text-slate-800">
              {{ bankDetails.bankName || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank account number</span>
            <strong class="break-all text-right text-sm text-slate-800">
              {{ bankDetails.bankAccountNumber || '—' }}
            </strong>
          </div>

          <div class="py-4">
            <Button
              type="button"
              label="Hide bank details"
              icon="pi pi-lock"
              severity="secondary"
              outlined
              fluid
              @click="hideBankDetails"
            />
            <p class="mt-2 text-center text-xs text-slate-500">
              These details will be hidden automatically after 60 seconds.
            </p>
          </div>
        </div>

        <div v-else class="p-4">
          <div class="space-y-3 rounded-xl bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-slate-500">Bank name</span>
              <strong class="tracking-widest text-slate-400">••••••••</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-slate-500">Account number</span>
              <strong class="tracking-widest text-slate-400">•••• ••••</strong>
            </div>
          </div>

          <p class="mt-3 text-sm leading-5 text-slate-500">
            Verify your account password before viewing sensitive bank details.
          </p>

          <Button
            type="button"
            class="mt-4"
            label="Verify password to view"
            icon="pi pi-lock-open"
            fluid
            @click="openBankDetailsDialog"
          />
        </div>
      </section>

      <!-- Account security -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-shield" />
          </div>
          <h3 class="font-bold text-slate-900">Account security</h3>
        </header>

        <div class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Username</span>
            <strong class="text-right text-sm text-slate-800">
              {{ auth.user?.username || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Role</span>
            <strong class="text-right text-sm text-slate-800">Customer</strong>
          </div>
        </div>
      </section>

      <Button
        label="Sign out"
        icon="pi pi-sign-out"
        severity="danger"
        outlined
        fluid
        @click="logout"
      />
    </template>

    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
    >
      <i class="pi pi-user text-2xl text-slate-400" />
      <strong class="mt-3 block text-slate-800">Profile unavailable</strong>
      <span class="mt-1 block text-sm text-slate-500">
        Your customer profile could not be loaded.
      </span>
    </div>

    <Dialog
      v-model:visible="bankDialogVisible"
      modal
      header="Verify your password"
      :style="{ width: '460px', maxWidth: '95vw' }"
      :closable="!verifyingBankDetails"
      :close-on-escape="!verifyingBankDetails"
      @hide="closeBankDetailsDialog"
    >
      <form @submit.prevent="revealBankDetails">
        <div class="mb-5 flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <i class="pi pi-shield" />
          </div>

          <p class="text-sm leading-6 text-slate-600">
            Enter your customer account password to view your bank information.
          </p>
        </div>

        <div class="form-field">
          <label for="bankDetailsPassword">Current password *</label>
          <Password
            input-id="bankDetailsPassword"
            v-model="bankPasswordForm.password"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="current-password"
            required
          />
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            :disabled="verifyingBankDetails"
            @click="closeBankDetailsDialog"
          />
          <Button
            type="submit"
            label="Verify and view"
            icon="pi pi-lock-open"
            :loading="verifyingBankDetails"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>
