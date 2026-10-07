<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import api from '../../services/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { useRealtimeRefresh } from '../../composables/useRealtimeRefresh.js';
import { creditLevelDetails } from '../../utils/credit.js';
import {
  apiError,
  currency,
  date,
  fullName,
  numberValue,
  statusSeverity
} from '../../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const customer = ref(null);
const dashboard = ref({});
const loading = ref(true);
const informationLoading = ref(false);
const informationDialogVisible = ref(false);
const activeInformationSection = ref('identity');
const customerInformation = ref(null);
const customerContract = ref(null);
const loans = ref([]);
const selectedRepaymentLoanId = ref(null);
const repaymentLoanDetail = ref(null);
const repaymentInstallments = ref([]);

const credit = computed(() => creditLevelDetails(customer.value?.creditScore));

const informationSections = computed(() => {
  const completion = customerInformation.value?.completion || {};

  return [
    {
      key: 'identity',
      label: 'Identity',
      icon: 'pi pi-id-card',
      completed: Boolean(completion.identity)
    },
    {
      key: 'information',
      label: 'Information',
      icon: 'pi pi-user',
      completed: Boolean(completion.information)
    },
    {
      key: 'bankAccount',
      label: 'Bank Account',
      icon: 'pi pi-building-columns',
      completed: Boolean(completion.bankAccount)
    },
    {
      key: 'signature',
      label: 'Signature',
      icon: 'pi pi-pencil',
      completed: Boolean(completion.signature)
    },
    {
      key: 'repaymentPeriod',
      label: 'Repayment Period',
      icon: 'pi pi-calendar',
      completed: Boolean(loans.value.length)
    },
    {
      key: 'contract',
      label: 'Contract',
      icon: 'pi pi-file-edit',
      completed: Boolean(customerContract.value)
    }
  ];
});

const selectedRepaymentLoan = computed(() => {
  return loans.value.find((loan) => {
    return loan._id === selectedRepaymentLoanId.value;
  }) || repaymentLoanDetail.value;
});

const repaymentInstallmentAmount = computed(() => {
  return repaymentInstallments.value[0]?.totalDue || 0;
});

const activeInformationTitle = computed(() => {
  return informationSections.value.find(
    (section) => section.key === activeInformationSection.value
  )?.label || 'Customer information';
});

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
    const [
      customerResponse,
      dashboardResponse,
      informationResponse,
      contractResponse,
      loanResponse
    ] = await Promise.all([
      api.get('/customers/me'),
      api.get('/dashboard'),
      api.get('/customers/me/information'),
      api.get('/contracts/me'),
      api.get('/loans', { params: { limit: 100 } })
    ]);

    customer.value = customerResponse.data.item;
    dashboard.value = dashboardResponse.data.data;
    customerInformation.value = informationResponse.data.item;
    customerContract.value = contractResponse.data.item || null;
    loans.value = loanResponse.data.items || [];

    const preferredLoan = loans.value.find((loan) => {
      return loan._id === selectedRepaymentLoanId.value;
    }) || loans.value.find((loan) => {
      return ['ACTIVE', 'OVERDUE', 'APPROVED'].includes(loan.status);
    }) || loans.value[0];

    selectedRepaymentLoanId.value = preferredLoan?._id || null;

    if (
      informationDialogVisible.value &&
      activeInformationSection.value === 'repaymentPeriod'
    ) {
      await loadRepaymentPeriod(selectedRepaymentLoanId.value);
    }
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

async function loadRepaymentPeriod(loanId = selectedRepaymentLoanId.value) {
  if (!loanId) {
    repaymentLoanDetail.value = null;
    repaymentInstallments.value = [];
    return;
  }

  const { data } = await api.get(`/loans/${loanId}`);
  repaymentLoanDetail.value = data.item;
  repaymentInstallments.value = data.installments || [];
}

async function changeRepaymentLoan() {
  informationLoading.value = true;

  try {
    await loadRepaymentPeriod();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load repayment period',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    informationLoading.value = false;
  }
}

function loanOptionLabel(loan) {
  if (!loan) return 'Select loan';
  return `${loan.loanNumber} · ${loan.productSnapshot?.name || 'Loan'}`;
}

function repaymentTermLabel(loan) {
  if (!loan?.term) return '—';

  const unit = String(loan.termUnit || 'MONTH').toLowerCase();
  return `${loan.term} ${unit}${Number(loan.term) === 1 ? '' : 's'}`;
}

function repaymentFrequencyLabel(value) {
  return String(value || '—').replaceAll('_', ' ').toLowerCase();
}

async function openInformationSection(section) {
  activeInformationSection.value = section;
  informationDialogVisible.value = true;
  informationLoading.value = true;

  try {
    if (section === 'contract') {
      const { data } = await api.get('/contracts/me');
      customerContract.value = data.item || null;
    } else if (section === 'repaymentPeriod') {
      await loadRepaymentPeriod();
    } else {
      const { data } = await api.get('/customers/me/information');
      customerInformation.value = data.item;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load information',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    informationLoading.value = false;
  }
}

function identitySeverity(status) {
  return {
    VERIFIED: 'success',
    PENDING: 'warn',
    REJECTED: 'danger',
    NOT_SUBMITTED: 'secondary'
  }[status] || 'secondary';
}

function logout() {
  auth.logout();
  router.push('/customer/login');
}

useRealtimeRefresh(
  ['profile', 'customers', 'applications', 'loans', 'repayments', 'contracts'],
  load
);
onMounted(load);
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
      <!-- Customer credit -->
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center text-center">
          <span class="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Customer credit
          </span>

          <div
            class="credit-gauge"
            :style="{ '--credit-angle': `${credit.progress * 3.6}deg` }"
          >
            <div class="credit-gauge__ticks" />
            <div class="credit-gauge__center">
              <strong>{{ credit.score }}</strong>
              <span>{{ credit.label }} Credit</span>
            </div>
          </div>

          <small class="mt-3 text-slate-500">
            <template v-if="credit.nextScore">
              Next level: {{ credit.nextLabel }} at {{ credit.nextScore }} points
            </template>
            <template v-else>Highest credit level reached</template>
          </small>
        </div>
      </section>

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

      <!-- Information and documents -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="border-b border-slate-100 px-4 py-4">
          <span class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
            Customer documents
          </span>
          <h3 class="mt-1 font-bold text-slate-900">Information</h3>
          <p class="mt-1 text-xs text-slate-500">
            View your saved personal, bank, identity, signature and contract details.
          </p>
        </header>

        <div class="divide-y divide-slate-100">
          <button
            v-for="section in informationSections"
            :key="section.key"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
            @click="openInformationSection(section.key)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <i :class="section.icon" />
            </div>

            <strong class="min-w-0 flex-1 text-sm text-slate-900">
              {{ section.label }}
            </strong>

            <span
              class="text-xs font-semibold"
              :class="section.completed ? 'text-emerald-600' : 'text-slate-400'"
            >
              {{ section.completed ? 'Completed' : 'Not completed' }}
            </span>

            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              :title="`View ${section.label}`"
              aria-hidden="true"
            >
              <i class="pi pi-eye text-sm" />
            </span>
          </button>
        </div>
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
        <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <i class="pi pi-user" />
            </div>
            <h3 class="font-bold text-slate-900">Personal information</h3>
          </div>

          <Button
            type="button"
            icon="pi pi-eye"
            severity="secondary"
            text
            rounded
            aria-label="View full personal information"
            title="View full personal information"
            @click="openInformationSection('information')"
          />
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

      <!-- Masked bank information -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <i class="pi pi-credit-card" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Bank information</h3>
              <p class="mt-0.5 text-xs text-slate-500">Sensitive details are masked</p>
            </div>
          </div>

          <Button
            type="button"
            icon="pi pi-eye"
            severity="secondary"
            text
            rounded
            aria-label="View full bank information"
            title="View full bank information"
            @click="openInformationSection('bankAccount')"
          />
        </header>

        <div class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank name</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.maskedBankDetails?.bankName || '—' }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank account number</span>
            <strong class="break-all text-right text-sm text-slate-800">
              {{ customer.maskedBankDetails?.bankAccountNumber || '—' }}
            </strong>
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
      v-model:visible="informationDialogVisible"
      modal
      :header="activeInformationTitle"
      :style="{
        width: ['contract', 'repaymentPeriod'].includes(activeInformationSection)
          ? '820px'
          : '620px',
        maxWidth: '95vw'
      }"
    >
      <div v-if="informationLoading" class="space-y-3 py-2">
        <div class="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <template v-else-if="customerInformation || customerContract">
        <!-- Identity -->
        <section v-if="activeInformationSection === 'identity'">
          <div class="mb-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <div>
              <span class="block text-xs text-slate-500">Verification status</span>
              <strong class="mt-1 block text-sm text-slate-900">
                Customer identity
              </strong>
            </div>
            <Tag
              :value="customerInformation.identity.verificationStatus?.replaceAll('_', ' ')"
              :severity="identitySeverity(customerInformation.identity.verificationStatus)"
            />
          </div>

          <p
            v-if="customerInformation.identity.verificationNote"
            class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"
          >
            {{ customerInformation.identity.verificationNote }}
          </p>

          <div class="grid gap-4 sm:grid-cols-2">
            <article>
              <span class="mb-2 block text-sm font-semibold text-slate-700">
                ID card front
              </span>
              <a
                v-if="customerInformation.identity.images.frontIdCard"
                :href="customerInformation.identity.images.frontIdCard"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  :src="customerInformation.identity.images.frontIdCard"
                  alt="Front of identity card"
                  class="aspect-[4/3] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                />
              </a>
              <div
                v-else
                class="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400"
              >
                Not uploaded
              </div>
            </article>

            <article>
              <span class="mb-2 block text-sm font-semibold text-slate-700">
                ID card back
              </span>
              <a
                v-if="customerInformation.identity.images.backIdCard"
                :href="customerInformation.identity.images.backIdCard"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  :src="customerInformation.identity.images.backIdCard"
                  alt="Back of identity card"
                  class="aspect-[4/3] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                />
              </a>
              <div
                v-else
                class="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400"
              >
                Not uploaded
              </div>
            </article>

            <article class="sm:col-span-2">
              <span class="mb-2 block text-sm font-semibold text-slate-700">
                Selfie with ID card
              </span>
              <a
                v-if="customerInformation.identity.images.selfieWithId"
                :href="customerInformation.identity.images.selfieWithId"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  :src="customerInformation.identity.images.selfieWithId"
                  alt="Customer selfie with identity card"
                  class="mx-auto aspect-[4/3] w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 object-contain"
                />
              </a>
              <div
                v-else
                class="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400"
              >
                Not uploaded
              </div>
            </article>
          </div>

          <p class="mt-4 text-center text-xs text-slate-500">
            For your security, document links expire automatically.
          </p>
        </section>

        <!-- Personal information -->
        <section
          v-else-if="activeInformationSection === 'information'"
          class="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4"
        >
          <div class="detail-row">
            <span>Full name</span>
            <strong>{{ customerInformation.information.name || '—' }}</strong>
          </div>
          <div class="detail-row">
            <span>Phone</span>
            <strong>{{ customerInformation.information.phone || '—' }}</strong>
          </div>
          <div class="detail-row">
            <span>Email</span>
            <strong class="break-all">{{ customerInformation.information.email || '—' }}</strong>
          </div>
          <div class="detail-row">
            <span>ID card number</span>
            <strong class="break-all">{{ customerInformation.information.nationalId || '—' }}</strong>
          </div>
          <div class="detail-row">
            <span>Occupation</span>
            <strong>{{ customerInformation.information.occupation || '—' }}</strong>
          </div>
          <div class="detail-row">
            <span>Monthly income</span>
            <strong>{{ currency(customerInformation.information.monthlyIncome) }}</strong>
          </div>
          <div class="detail-row">
            <span>Date of birth</span>
            <strong>{{ date(customerInformation.information.dateOfBirth) }}</strong>
          </div>
          <div class="detail-row">
            <span>Address</span>
            <strong>{{ customerInformation.information.address || '—' }}</strong>
          </div>
        </section>

        <!-- Bank account -->
        <section
          v-else-if="activeInformationSection === 'bankAccount'"
          class="overflow-hidden rounded-xl border border-slate-200"
        >
          <div class="bg-emerald-700 p-5 text-white">
            <span class="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Saved destination account
            </span>
            <strong class="mt-2 block break-all text-2xl">
              {{ customerInformation.bankAccount.bankAccountNumber || '—' }}
            </strong>
          </div>
          <div class="divide-y divide-slate-100 px-4">
            <div class="detail-row">
              <span>Account holder</span>
              <strong>{{ customerInformation.bankAccount.accountHolderName || '—' }}</strong>
            </div>
            <div class="detail-row">
              <span>Bank name</span>
              <strong>{{ customerInformation.bankAccount.bankName || '—' }}</strong>
            </div>
            <div class="detail-row">
              <span>Account number</span>
              <strong class="break-all">{{ customerInformation.bankAccount.bankAccountNumber || '—' }}</strong>
            </div>
          </div>
        </section>

        <!-- Signature -->
        <section v-else-if="activeInformationSection === 'signature'">
          <template v-if="customerInformation.signature">
            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <img
                :src="customerInformation.signature.url"
                alt="Customer loan application signature"
                class="h-48 w-full rounded-lg bg-white object-contain"
              />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Application</span>
                <strong class="mt-1 block text-slate-900">
                  {{ customerInformation.signature.applicationNumber }}
                </strong>
              </div>
              <div class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Submitted</span>
                <strong class="mt-1 block text-slate-900">
                  {{ date(customerInformation.signature.submittedAt) }}
                </strong>
              </div>
            </div>
          </template>

          <div
            v-else
            class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"
          >
            <i class="pi pi-pencil text-2xl text-slate-400" />
            <strong class="mt-3 block text-slate-800">No signature submitted</strong>
            <span class="mt-1 block text-sm text-slate-500">
              Your signature will appear after you submit a loan application.
            </span>
          </div>
        </section>

        <!-- Repayment period -->
        <section v-else-if="activeInformationSection === 'repaymentPeriod'">
          <template v-if="selectedRepaymentLoan">
            <div v-if="loans.length > 1" class="mb-4">
              <label class="mb-2 block text-sm font-semibold text-slate-700">
                Select loan
              </label>
              <Select
                v-model="selectedRepaymentLoanId"
                :options="loans"
                option-value="_id"
                fluid
                @change="changeRepaymentLoan"
              >
                <template #option="{ option }">
                  <div>
                    <strong class="block text-sm text-slate-800">
                      {{ option.loanNumber }}
                    </strong>
                    <span class="text-xs text-slate-500">
                      {{ option.productSnapshot?.name || 'Loan' }} ·
                      {{ repaymentTermLabel(option) }}
                    </span>
                  </div>
                </template>
                <template #value="{ value }">
                  {{ loanOptionLabel(loans.find((loan) => loan._id === value)) }}
                </template>
              </Select>
            </div>

            <header class="rounded-2xl bg-emerald-700 p-5 text-white">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span class="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Repayment period
                  </span>
                  <strong class="mt-1 block text-2xl">
                    {{ repaymentTermLabel(selectedRepaymentLoan) }}
                  </strong>
                  <span class="mt-1 block text-sm text-emerald-100">
                    {{ selectedRepaymentLoan.loanNumber }} ·
                    {{ selectedRepaymentLoan.productSnapshot?.name || 'Loan' }}
                  </span>
                </div>
                <Tag
                  :value="selectedRepaymentLoan.status"
                  :severity="statusSeverity(selectedRepaymentLoan.status)"
                />
              </div>
            </header>

            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Installment payment</span>
                <strong class="mt-1 block text-sm text-slate-900">
                  {{ currency(repaymentInstallmentAmount) }}
                </strong>
              </article>
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Payment frequency</span>
                <strong class="mt-1 block capitalize text-sm text-slate-900">
                  {{ repaymentFrequencyLabel(selectedRepaymentLoan.repaymentFrequency) }}
                </strong>
              </article>
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Interest rate</span>
                <strong class="mt-1 block text-sm text-slate-900">
                  {{ numberValue(selectedRepaymentLoan.rateSnapshot?.ratePercent) }}%
                </strong>
              </article>
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Principal</span>
                <strong class="mt-1 block text-sm text-slate-900">
                  {{ currency(selectedRepaymentLoan.principalAmount) }}
                </strong>
              </article>
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Start date</span>
                <strong class="mt-1 block text-sm text-slate-900">
                  {{ date(selectedRepaymentLoan.startDate) }}
                </strong>
              </article>
              <article class="rounded-xl bg-slate-50 p-3">
                <span class="block text-xs text-slate-500">Maturity date</span>
                <strong class="mt-1 block text-sm text-slate-900">
                  {{ date(selectedRepaymentLoan.maturityDate) }}
                </strong>
              </article>
            </div>

            <div class="mt-5">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 class="font-bold text-slate-900">Payment schedule</h3>
                <span class="text-xs font-semibold text-slate-500">
                  {{ repaymentInstallments.length }} installments
                </span>
              </div>

              <div
                v-if="repaymentInstallments.length"
                class="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200"
              >
                <article
                  v-for="installment in repaymentInstallments"
                  :key="installment._id"
                  class="border-b border-slate-100 p-4 last:border-b-0"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <strong class="block text-sm text-slate-900">
                        Period {{ installment.installmentNumber }}
                      </strong>
                      <span class="mt-1 block text-xs text-slate-500">
                        Due {{ date(installment.dueDate) }}
                      </span>
                    </div>
                    <Tag
                      :value="installment.status?.replaceAll('_', ' ')"
                      :severity="statusSeverity(installment.status)"
                    />
                  </div>

                  <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span class="block text-xs text-slate-500">Amount due</span>
                      <strong class="mt-1 block text-slate-800">
                        {{ currency(installment.totalDue) }}
                      </strong>
                    </div>
                    <div class="text-right">
                      <span class="block text-xs text-slate-500">Remaining</span>
                      <strong class="mt-1 block text-slate-800">
                        {{ currency(installment.remainingDue) }}
                      </strong>
                    </div>
                  </div>
                </article>
              </div>

              <div
                v-else
                class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
              >
                <i class="pi pi-calendar text-2xl text-slate-400" />
                <strong class="mt-3 block text-sm text-slate-800">
                  No repayment schedule
                </strong>
              </div>
            </div>
          </template>

          <div
            v-else
            class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"
          >
            <i class="pi pi-calendar text-2xl text-slate-400" />
            <strong class="mt-3 block text-slate-800">No repayment period available</strong>
            <span class="mt-1 block text-sm text-slate-500">
              Your repayment period will appear after a loan is approved.
            </span>
          </div>
        </section>

        <!-- Loan contract -->
        <section v-else-if="activeInformationSection === 'contract'">
          <template v-if="customerContract">
            <header class="rounded-2xl bg-emerald-700 p-5 text-white">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
                    Loan Filipinas Service
                  </span>
                  <h2 class="mt-1 text-xl font-bold">
                    {{ customerContract.template.title || 'Loan Contract' }}
                  </h2>
                  <p class="mt-1 text-sm text-emerald-100">
                    Loan No. {{ customerContract.loan.loanNumber }}
                  </p>
                </div>
                <Tag
                  :value="customerContract.loan.status"
                  :severity="statusSeverity(customerContract.loan.status)"
                />
              </div>
            </header>

            <div class="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div class="contract-row">
                <span>Name of the borrower</span>
                <strong>{{ customerContract.borrower.name || '—' }}</strong>
              </div>
              <div class="contract-row">
                <span>ID Number</span>
                <strong class="break-all">
                  {{ customerContract.borrower.idNumber || '—' }}
                </strong>
              </div>
              <div class="contract-row">
                <span>Mobile Number</span>
                <strong>{{ customerContract.borrower.mobileNumber || '—' }}</strong>
              </div>
              <div class="contract-row">
                <span>Installment Payment</span>
                <strong>
                  {{ currency(customerContract.loan.installmentPayment) }}
                </strong>
              </div>
              <div class="contract-row">
                <span>Credit</span>
                <strong>{{ customerContract.loan.creditTerm || '—' }}</strong>
              </div>
              <div class="contract-row">
                <span>Beneficiary Bank Name</span>
                <strong>
                  {{ customerContract.template.beneficiaryBankName || '—' }}
                </strong>
              </div>
            </div>

            <article class="contract-body mt-5">
              {{ customerContract.template.body }}
            </article>

            <div class="mt-8 ml-auto max-w-sm text-center">
              <div class="flex h-28 items-end justify-center">
                <img
                  v-if="customerContract.borrower.signatureUrl"
                  :src="customerContract.borrower.signatureUrl"
                  alt="Borrower signature"
                  class="max-h-24 max-w-full object-contain"
                />
                <span v-else class="pb-4 text-xs italic text-slate-400">
                  No application signature available
                </span>
              </div>
              <div class="border-t border-slate-400 pt-2 text-sm font-semibold text-slate-800">
                Borrower signature
              </div>
              <p class="mt-1 text-xs text-slate-500">
                {{ customerContract.borrower.name }}
              </p>
              <p
                v-if="customerContract.borrower.termsAcceptedAt"
                class="mt-1 text-[11px] text-slate-400"
              >
                Terms accepted {{ date(customerContract.borrower.termsAcceptedAt) }}
              </p>
            </div>
          </template>

          <div
            v-else
            class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"
          >
            <i class="pi pi-file-edit text-2xl text-slate-400" />
            <strong class="mt-3 block text-slate-800">No contract available</strong>
            <span class="mt-1 block text-sm text-slate-500">
              Your contract will appear after a loan is approved.
            </span>
          </div>
        </section>
      </template>

      <template #footer>
        <Button
          label="Close"
          severity="secondary"
          @click="informationDialogVisible = false"
        />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.credit-gauge {
  --credit-angle: 0deg;
  position: relative;
  display: grid;
  width: 10rem;
  height: 10rem;
  place-items: center;
  overflow: hidden;
  border-radius: 9999px;
  background: conic-gradient(
    from 210deg,
    #6ee7b7 0deg,
    #10b981 var(--credit-angle),
    #064e3b var(--credit-angle),
    #064e3b 360deg
  );
  box-shadow:
    0 12px 25px rgba(6, 78, 59, 0.22),
    inset 0 0 0 2px rgba(255, 255, 255, 0.22);
}

.credit-gauge::before {
  position: absolute;
  inset: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: inherit;
  content: '';
}

.credit-gauge__ticks {
  position: absolute;
  inset: 0.8rem;
  border-radius: inherit;
  background: repeating-conic-gradient(
    from 210deg,
    rgba(255, 255, 255, 0.45) 0deg 1.5deg,
    transparent 1.5deg 10deg
  );
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 63% 68%, transparent 69%);
  mask: radial-gradient(circle, transparent 62%, #000 63% 68%, transparent 69%);
}

.credit-gauge__center {
  position: relative;
  z-index: 1;
  display: flex;
  width: 7.4rem;
  height: 7.4rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(145deg, #047857, #065f46);
  color: white;
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.16);
}

.credit-gauge__center strong {
  font-size: 2.25rem;
  font-weight: 500;
  line-height: 1;
}

.credit-gauge__center span {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: #d1fae5;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 0;
}

.detail-row > span {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.detail-row > strong {
  min-width: 0;
  text-align: right;
  font-size: 0.875rem;
  color: #1e293b;
}

.contract-row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 1rem;
  border-top: 1px solid #f1f5f9;
  padding: 0.875rem 1rem;
}

.contract-row:first-child {
  border-top: 0;
}

.contract-row > span {
  color: #64748b;
  font-size: 0.875rem;
}

.contract-row > strong {
  min-width: 0;
  text-align: right;
  color: #1e293b;
  font-size: 0.875rem;
}

.contract-body {
  white-space: pre-wrap;
  border-radius: 0.75rem;
  background: #f8fafc;
  padding: 1rem;
  color: #334155;
  font-size: 0.875rem;
  line-height: 1.75;
  text-align: justify;
}

@media (max-width: 480px) {
  .contract-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .contract-row > strong {
    text-align: left;
  }
}
</style>
