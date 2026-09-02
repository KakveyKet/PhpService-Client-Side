<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { apiError, currency, dateTime, fullName } from '../utils/formatters.js';
import {
  datePeriodOptions,
  matchesCustomerSearch,
  matchesDatePeriod
} from '../utils/tableFilters.js';

const toast = useToast();
const confirm = useConfirm();
const customers = ref([]);
const withdrawals = ref([]);
const withdrawalCodes = ref([]);
const loading = ref(false);
const filterSearch = ref('');
const filterPeriod = ref('ALL');
const filterDateRange = ref(null);
const detailsVisible = ref(false);
const codeVisible = ref(false);
const rejectVisible = ref(false);
const selectedRow = ref(null);
const selectedCustomer = ref(null);
const selectedWithdrawal = ref(null);
const creatingCode = ref(false);
const rejecting = ref(false);
const deletingWithdrawalId = ref(null);
const codeForm = reactive({ customerId: null, code: '' });
const rejectForm = reactive({
  method: 'SELECT',
  reason: '',
  customReason: ''
});

const rejectionMethodOptions = [
  { label: 'Choose reason', value: 'SELECT' },
  { label: 'Write custom reason', value: 'CUSTOM' }
];

const rejectionReasonOptions = [
  'WITHDRAWAL WRONG AMOUNT',
  'WRONG BANK ACCOUNT',
  'LOW CREDIT',
  'WRONG INFORMATION',
  'INSURANCE',
  'PLATEFORM FEE',
  'VIP CHANNEL',
  'NEW DOCUMENT AND NEW OTP CODE',
  'FREEZE LOAN ACCOUNT',
  'INLAND REVENUE TAX',
  'NEED NEW OTP CODE'
];

function recordId(value) {
  return String(value?._id || value || '');
}

const customerRows = computed(() => {
  const latestByCustomer = new Map();
  const activeCodeByCustomer = new Map();

  for (const withdrawal of withdrawals.value) {
    const customerId = recordId(withdrawal.customerId);
    if (customerId && !latestByCustomer.has(customerId)) {
      latestByCustomer.set(customerId, withdrawal);
    }
  }

  for (const code of withdrawalCodes.value) {
    const customerId = recordId(code.customerId);
    if (customerId && code.status === 'ACTIVE' && !activeCodeByCustomer.has(customerId)) {
      activeCodeByCustomer.set(customerId, code);
    }
  }

  return customers.value.map((customer, index) => {
    const customerId = recordId(customer);
    return {
      number: index + 1,
      customer,
      withdrawal: latestByCustomer.get(customerId) || null,
      activeCode: activeCodeByCustomer.get(customerId) || null
    };
  });
});

const filteredCustomerRows = computed(() => {
  const dateFilterIsInactive = filterPeriod.value === 'ALL' ||
    (filterPeriod.value === 'CUSTOM' && !filterDateRange.value?.[0]);

  return customerRows.value
    .filter((row) => matchesCustomerSearch(row.customer, filterSearch.value))
    .map((row) => {
      if (dateFilterIsInactive) return row;

      const matchingWithdrawal = withdrawals.value.find((withdrawal) => {
        return recordId(withdrawal.customerId) === recordId(row.customer) &&
          matchesDatePeriod(
            withdrawal.createdAt,
            filterPeriod.value,
            filterDateRange.value
          );
      });

      return matchingWithdrawal ? { ...row, withdrawal: matchingWithdrawal } : null;
    })
    .filter(Boolean);
});

function statusLabel(status) {
  if (status === 'REFUNDED') return 'REJECTED';
  if (['WAITING_FOR_OTP', 'OTP_REQUIRED'].includes(status)) return 'WAITING FOR CODE';
  if (status === 'OTP_VERIFIED') return 'NEW CODE REQUIRED';
  if (['APPROVED', 'COMPLETED'].includes(status)) return 'WITHDRAW SUCCESS';
  return status?.replaceAll('_', ' ') || 'NO WITHDRAWAL';
}

function statusSeverity(status) {
  return {
    PENDING_REVIEW: 'warn',
    WAITING_FOR_CODE: 'info',
    WAITING_FOR_OTP: 'info',
    OTP_REQUIRED: 'info',
    OTP_VERIFIED: 'info',
    APPROVED: 'success',
    COMPLETED: 'success',
    REFUNDED: 'warn',
    REJECTED: 'danger',
    EXPIRED: 'secondary',
    CANCELLED: 'secondary'
  }[status] || 'secondary';
}

function rowStatusLabel(row) {
  if (row.withdrawal) return statusLabel(row.withdrawal.status);
  return row.activeCode ? 'CODE READY' : 'NO WITHDRAWAL';
}

function rowStatusSeverity(row) {
  if (row.withdrawal) return statusSeverity(row.withdrawal.status);
  return row.activeCode ? 'info' : 'secondary';
}

function isOpen(withdrawal) {
  return [
    'PENDING_REVIEW',
    'WAITING_FOR_CODE',
    'WAITING_FOR_OTP',
    'OTP_REQUIRED',
    'OTP_VERIFIED'
  ].includes(withdrawal?.status);
}

function isCompleted(withdrawal) {
  return ['COMPLETED', 'APPROVED'].includes(withdrawal?.status);
}

function canReject(withdrawal) {
  return isOpen(withdrawal) || isCompleted(withdrawal);
}

function username(customer) {
  return customer?.userId?.username || '—';
}

async function load() {
  loading.value = true;
  try {
    const [customerResponse, withdrawalResponse, codeResponse] = await Promise.all([
      api.get('/customers', { params: { limit: 1000 } }),
      api.get('/withdrawals', { params: { limit: 1000 } }),
      api.get('/withdrawals/codes', { params: { limit: 1000 } })
    ]);
    customers.value = customerResponse.data.items || [];
    withdrawals.value = withdrawalResponse.data.items || [];
    withdrawalCodes.value = codeResponse.data.items || [];
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load withdrawal operations',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    loading.value = false;
  }
}

function openDetails(row) {
  selectedRow.value = row;
  detailsVisible.value = true;
}

function resetFilters() {
  filterSearch.value = '';
  filterPeriod.value = 'ALL';
  filterDateRange.value = null;
}

function normalizeWithdrawCode(value) {
  return String(value || '').normalize('NFKC').replace(/\D/g, '').slice(0, 8);
}

function updateWithdrawCode(event) {
  codeForm.code = normalizeWithdrawCode(event.target.value);
}

function openCreateCode(customer) {
  selectedCustomer.value = customer;
  codeForm.customerId = recordId(customer);
  codeForm.code = '';
  codeVisible.value = true;
}

async function createWithdrawCode() {
  const code = normalizeWithdrawCode(codeForm.code);
  if (!codeForm.customerId) return;

  if (!/^\d{6}$|^\d{8}$/.test(code)) {
    toast.add({
      severity: 'warn',
      summary: 'Complete code required',
      detail: 'Enter exactly 6 or 8 digits.',
      life: 3000
    });
    return;
  }

  creatingCode.value = true;
  try {
    await api.post('/withdrawals/codes', { customerId: codeForm.customerId, code });
    codeVisible.value = false;
    codeForm.code = '';
    toast.add({
      severity: 'success',
      summary: 'Withdraw code created',
      detail: 'Provide the code to the customer securely.',
      life: 3500
    });
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot create withdraw code',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    creatingCode.value = false;
  }
}

function openReject(withdrawal) {
  if (!canReject(withdrawal)) return;
  selectedWithdrawal.value = withdrawal;
  rejectForm.method = 'SELECT';
  rejectForm.reason = '';
  rejectForm.customReason = '';
  rejectVisible.value = true;
}

function completeRejectionReason() {
  if (rejectForm.method === 'CUSTOM') {
    return rejectForm.customReason.trim().slice(0, 500);
  }
  return rejectForm.reason.trim().slice(0, 500);
}

async function rejectWithdrawal(reason) {
  const withdrawal = selectedWithdrawal.value;
  if (!withdrawal) return;
  rejecting.value = true;

  try {
    const completed = isCompleted(withdrawal);
    const path = completed
      ? `/withdrawals/${withdrawal._id}/reject-completed`
      : `/withdrawals/${withdrawal._id}/reject`;
    await api.post(path, { reason });
    rejectVisible.value = false;
    toast.add({
      severity: 'success',
      summary: 'Withdrawal rejected',
      detail: completed
        ? 'The amount was returned to the customer wallet.'
        : 'The withdrawal was rejected.',
      life: 3500
    });
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot reject withdrawal',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    rejecting.value = false;
  }
}

function confirmRejection() {
  const withdrawal = selectedWithdrawal.value;
  const reason = completeRejectionReason();
  if (!withdrawal) return;

  if (!reason) {
    toast.add({
      severity: 'warn',
      summary: 'Rejection reason required',
      detail: 'Select a reason or write a custom reason.',
      life: 3000
    });
    return;
  }

  confirm.require({
    header: 'Reject withdrawal',
    message: isCompleted(withdrawal)
      ? `Reject ${withdrawal.withdrawalNumber} and return ${currency(withdrawal.amount)} to the customer wallet?`
      : `Reject ${withdrawal.withdrawalNumber}?`,
    icon: 'pi pi-times-circle',
    acceptLabel: 'Reject withdrawal',
    rejectLabel: 'Cancel',
    accept: () => rejectWithdrawal(reason)
  });
}

async function forceDeleteWithdrawal(withdrawal) {
  if (!withdrawal) return;
  deletingWithdrawalId.value = withdrawal._id;

  try {
    await api.delete(`/withdrawals/${withdrawal._id}/force`);
    detailsVisible.value = false;
    selectedRow.value = null;
    toast.add({
      severity: 'success',
      summary: 'Withdrawal deleted',
      detail: 'The withdrawal and related transactions were permanently removed.',
      life: 3500
    });
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot delete withdrawal',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    deletingWithdrawalId.value = null;
  }
}

function confirmForceDelete(withdrawal) {
  if (!withdrawal) return;
  confirm.require({
    header: 'Permanently delete withdrawal',
    message: `Delete ${withdrawal.withdrawalNumber} and all related withdrawal transactions? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: () => forceDeleteWithdrawal(withdrawal)
  });
}

useRealtimeRefresh(['withdrawals', 'withdrawal-codes', 'customers'], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      title="Withdrawals"
      subtitle="Manage customer withdraw codes and withdrawal operations."
    >
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        @click="load"
      />
    </PageHeader>

    <section class="table-card">
      <div class="filter-bar">
        <div class="filter-field min-w-[240px] flex-1">
          <label>Customer or username</label>
          <InputText
            v-model="filterSearch"
            class="w-full"
            placeholder="Search name, username, code or phone"
          />
        </div>

        <div class="filter-field min-w-[190px]">
          <label>Date period</label>
          <Select
            v-model="filterPeriod"
            :options="datePeriodOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>

        <div v-if="filterPeriod === 'CUSTOM'" class="filter-field min-w-[260px] flex-1">
          <label>Date range</label>
          <DatePicker
            v-model="filterDateRange"
            selection-mode="range"
            :manual-input="false"
            date-format="M dd, yy"
            show-icon
            fluid
            placeholder="Start date - End date"
          />
        </div>

        <Button
          label="Reset"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          @click="resetFilters"
        />
      </div>

      <DataTable
        :value="filteredCustomerRows"
        :loading="loading"
        striped-rows
        paginator
        :rows="10"
        :rows-per-page-options="[10, 25, 50, 100]"
        responsive-layout="scroll"
      >
        <template #empty>
          <div class="empty-state"><i class="pi pi-users" /> No customers found.</div>
        </template>

        <Column field="number" header="No." />
        <Column header="Withdrawal">
          <template #body="{ data }">
            <strong>{{ data.withdrawal?.withdrawalNumber || '—' }}</strong>
            <small v-if="data.withdrawal" class="table-subtext">
              {{ data.withdrawal.loanId?.loanNumber || '—' }}
            </small>
          </template>
        </Column>
        <Column header="Name">
          <template #body="{ data }">
            <strong class="text-primary">{{ fullName(data.customer) }}</strong>
            <small class="table-subtext">{{ data.customer.customerCode }}</small>
          </template>
        </Column>
        <Column header="Username">
          <template #body="{ data }">
            {{ username(data.customer) }}
            <small class="table-subtext">{{ data.customer.phone || '—' }}</small>
          </template>
        </Column>
        <Column header="Amount">
          <template #body="{ data }">
            <strong>{{ data.withdrawal ? currency(data.withdrawal.amount) : '—' }}</strong>
          </template>
        </Column>
        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="rowStatusLabel(data)" :severity="rowStatusSeverity(data)" />
          </template>
        </Column>
        <Column header="Withdrawal date">
          <template #body="{ data }">
            {{ data.withdrawal ? dateTime(data.withdrawal.createdAt) : '—' }}
          </template>
        </Column>
        <Column header="Operations">
          <template #body="{ data }">
            <div class="flex min-w-max flex-wrap gap-2">
              <Button
                label="Check data"
                icon="pi pi-eye"
                size="small"
                severity="info"
                @click="openDetails(data)"
              />
              <Button
                :label="data.activeCode ? 'Replace code' : 'Create code'"
                icon="pi pi-key"
                size="small"
                severity="success"
                @click="openCreateCode(data.customer)"
              />
              <Button
                label="Reject withdrawal"
                icon="pi pi-times-circle"
                size="small"
                severity="danger"
                outlined
                :disabled="!canReject(data.withdrawal)"
                @click="openReject(data.withdrawal)"
              />
              <Button
                label="Delete"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                :disabled="!data.withdrawal"
                :loading="deletingWithdrawalId === data.withdrawal?._id"
                @click="confirmForceDelete(data.withdrawal)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="detailsVisible"
      modal
      :header="selectedRow ? fullName(selectedRow.customer) : 'Customer withdrawal data'"
      :style="{ width: '680px', maxWidth: '96vw' }"
    >
      <template v-if="selectedRow">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Customer code</span>
            <strong class="mt-1 block text-sm">{{ selectedRow.customer.customerCode || '—' }}</strong>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Username</span>
            <strong class="mt-1 block text-sm">{{ username(selectedRow.customer) }}</strong>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Phone</span>
            <strong class="mt-1 block text-sm">{{ selectedRow.customer.phone || '—' }}</strong>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Withdraw code</span>
            <Tag
              class="mt-1"
              :value="selectedRow.activeCode?.status || 'NO ACTIVE CODE'"
              :severity="selectedRow.activeCode ? 'success' : 'secondary'"
            />
          </div>
        </div>

        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div class="detail-row bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Field</span><span>Information</span>
          </div>
          <div class="detail-row"><strong>Withdrawal</strong><span>{{ selectedRow.withdrawal?.withdrawalNumber || 'No withdrawal yet' }}</span></div>
          <div class="detail-row"><strong>Amount</strong><span>{{ selectedRow.withdrawal ? currency(selectedRow.withdrawal.amount) : '—' }}</span></div>
          <div class="detail-row"><strong>Bank name</strong><span class="break-words">{{ selectedRow.withdrawal?.requestedBank?.bankName || selectedRow.customer.bankName || '—' }}</span></div>
          <div class="detail-row"><strong>Bank account</strong><span class="break-all">{{ selectedRow.withdrawal?.requestedBank?.bankAccountNumber || selectedRow.customer.bankNumber || '—' }}</span></div>
          <div class="detail-row"><strong>Status</strong><Tag :value="rowStatusLabel(selectedRow)" :severity="rowStatusSeverity(selectedRow)" /></div>
          <div v-if="selectedRow.withdrawal?.rejectionReason" class="detail-row">
            <strong>Rejection reason</strong>
            <span class="break-words text-red-700">{{ selectedRow.withdrawal.rejectionReason }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <Button label="Close" severity="secondary" @click="detailsVisible = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="codeVisible" modal header="Create withdraw code" :style="{ width: '500px', maxWidth: '95vw' }">
      <form @submit.prevent="createWithdrawCode">
        <div class="rounded-xl bg-slate-50 p-3">
          <span class="block text-xs text-slate-500">Customer</span>
          <strong class="mt-1 block text-sm">{{ fullName(selectedCustomer) }}</strong>
          <small class="mt-1 block text-slate-500">{{ selectedCustomer?.customerCode }} · {{ selectedCustomer?.phone }}</small>
        </div>
        <div class="form-field mt-4">
          <label>Withdraw code *</label>
          <InputText
            :model-value="codeForm.code"
            inputmode="numeric"
            autocomplete="off"
            maxlength="8"
            placeholder="Enter 6 or 8 digits"
            class="w-full text-center font-mono text-xl tracking-[0.25em]"
            required
            autofocus
            @input="updateWithdrawCode"
          />
          <small>The code is valid for 10 minutes and can be used once.</small>
        </div>
        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text @click="codeVisible = false" />
          <Button label="Create code" type="submit" icon="pi pi-key" :loading="creatingCode" />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="rejectVisible"
      modal
      header="Reject withdrawal"
      :style="{ width: '560px', maxWidth: '95vw' }"
      :closable="!rejecting"
    >
      <form @submit.prevent="confirmRejection">
        <div class="rounded-xl bg-slate-50 p-3">
          <span class="block text-xs text-slate-500">Withdrawal</span>
          <strong class="mt-1 block text-sm">
            {{ selectedWithdrawal?.withdrawalNumber }} · {{ currency(selectedWithdrawal?.amount) }}
          </strong>
        </div>
        <div class="form-field mt-4">
          <label>Reason method</label>
          <SelectButton
            v-model="rejectForm.method"
            :options="rejectionMethodOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            fluid
          />
        </div>
        <div v-if="rejectForm.method === 'SELECT'" class="form-field mt-4">
          <label>Rejection reason *</label>
          <Select
            v-model="rejectForm.reason"
            :options="rejectionReasonOptions"
            placeholder="Select a reason"
            show-clear
            fluid
          />
        </div>
        <div v-else class="form-field mt-4">
          <label>Custom rejection reason *</label>
          <Textarea
            v-model="rejectForm.customReason"
            rows="3"
            maxlength="500"
            class="w-full"
            placeholder="Write the reason for rejecting this withdrawal"
          />
        </div>
        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text :disabled="rejecting" @click="rejectVisible = false" />
          <Button label="Reject withdrawal" type="submit" icon="pi pi-times-circle" severity="danger" :loading="rejecting" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext {
  display: block;
  margin-top: 0.15rem;
  color: #82919a;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  padding: 1rem;
}

.filter-field label {
  display: block;
  margin-bottom: 0.5rem;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 600;
}

.detail-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 0.75rem;
  border-top: 1px solid #f1f5f9;
  padding: 0.75rem;
  font-size: 0.875rem;
}

.detail-row:first-child {
  border-top: 0;
}
</style>
