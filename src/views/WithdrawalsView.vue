<script setup>
import { onMounted, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import {
  apiError,
  currency,
  dateTime,
  fullName
} from '../utils/formatters.js';

const toast = useToast();
const confirm = useConfirm();
const items = ref([]);
const loading = ref(false);
const reviewVisible = ref(false);
const selected = ref(null);
const withdrawCode = ref('');
const reviewNote = ref('');
const rejectionReason = ref('');
const completedRejectionReason = ref('');
const settingCode = ref(false);
const rejecting = ref(false);
const rejectingCompleted = ref(false);
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

function statusLabel(status) {
  if (status === 'REFUNDED') return 'REJECTED';
  if (['WAITING_FOR_OTP', 'OTP_REQUIRED'].includes(status)) {
    return 'WAITING FOR CODE';
  }
  if (status === 'OTP_VERIFIED') return 'NEW CODE REQUIRED';
  if (['APPROVED', 'COMPLETED'].includes(status)) return 'WITHDRAW SUCCESS';
  return status?.replaceAll('_', ' ') || 'UNKNOWN';
}

function statusSeverity(status) {
  const severities = {
    PENDING_REVIEW: 'warn',
    WAITING_FOR_CODE: 'info',
    WAITING_FOR_OTP: 'info',
    OTP_REQUIRED: 'info',
    OTP_VERIFIED: 'success',
    APPROVED: 'success',
    COMPLETED: 'success',
    REFUNDED: 'warn',
    REJECTED: 'danger',
    EXPIRED: 'secondary',
    CANCELLED: 'secondary'
  };
  return severities[status] || 'secondary';
}

function isOpen(item) {
  return [
    'PENDING_REVIEW',
    'WAITING_FOR_CODE',
    'WAITING_FOR_OTP',
    'OTP_REQUIRED',
    'OTP_VERIFIED'
  ].includes(item?.status);
}

function canSetWithdrawCode(item) {
  return [
    'PENDING_REVIEW',
    'WAITING_FOR_CODE',
    'WAITING_FOR_OTP',
    'OTP_REQUIRED',
    'OTP_VERIFIED'
  ].includes(item?.status);
}

function canRejectCompleted(item) {
  return ['COMPLETED', 'APPROVED'].includes(item?.status);
}

function canReject(item) {
  return isOpen(item);
}

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/withdrawals', { params: { limit: 100 } });
    items.value = data.items;

    if (selected.value) {
      const refreshed = items.value.find((item) => item._id === selected.value._id);
      if (refreshed) {
        selected.value = refreshed;
      }
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load withdrawals',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    loading.value = false;
  }
}

function openReview(item) {
  selected.value = item;
  withdrawCode.value = '';
  reviewNote.value = item.reviewNote || '';
  rejectionReason.value = '';
  completedRejectionReason.value = '';
  reviewVisible.value = true;
}

function normalizeWithdrawCode(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\D/g, '')
    .slice(0, 8);
}

function updateWithdrawCode(event) {
  withdrawCode.value = normalizeWithdrawCode(event.target.value);
}

async function setWithdrawCode() {
  if (!selected.value) return;
  const code = normalizeWithdrawCode(withdrawCode.value);
  if (!/^\d{6}$|^\d{8}$/.test(code)) {
    toast.add({
      severity: 'warn',
      summary: 'Complete code required',
      detail: 'Enter exactly 6 or 8 digits.',
      life: 3000
    });
    return;
  }
  settingCode.value = true;

  try {
    const { data } = await api.post(
      `/withdrawals/${selected.value._id}/set-code`,
      {
        code,
        note: reviewNote.value
      }
    );
    selected.value = data.item;
    withdrawCode.value = '';
    toast.add({
      severity: 'success',
      summary: 'Withdraw code saved',
      detail: 'Provide the code to the customer securely.',
      life: 4000
    });
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot save withdraw code',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    settingCode.value = false;
  }
}

async function rejectWithdrawal() {
  if (!selected.value) return;
  if (!rejectionReason.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Reason required',
      detail: 'Select why the withdrawal is rejected.',
      life: 3000
    });
    return;
  }

  rejecting.value = true;
  try {
    await api.post(`/withdrawals/${selected.value._id}/reject`, {
      reason: rejectionReason.value.trim()
    });
    reviewVisible.value = false;
    toast.add({ severity: 'success', summary: 'Withdrawal rejected', life: 2500 });
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

async function rejectCompletedWithdrawal() {
  if (!selected.value) return;
  if (!completedRejectionReason.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Rejection reason required',
      detail: 'Select why the completed withdrawal must be rejected.',
      life: 3000
    });
    return;
  }
  rejectingCompleted.value = true;

  try {
    await api.post(`/withdrawals/${selected.value._id}/reject-completed`, {
      reason: completedRejectionReason.value.trim()
    });
    reviewVisible.value = false;
    toast.add({
      severity: 'success',
      summary: 'Withdrawal rejected',
      detail: 'The amount has been returned to the customer wallet.',
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
    rejectingCompleted.value = false;
  }
}

function confirmCompletedRejection() {
  if (!selected.value) return;
  if (!completedRejectionReason.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Rejection reason required',
      life: 2500
    });
    return;
  }
  confirm.require({
    header: 'Reject completed withdrawal',
    message: `Reject ${selected.value.withdrawalNumber} and return ${currency(selected.value.amount)} to the customer wallet?`,
    icon: 'pi pi-times-circle',
    acceptLabel: 'Reject withdrawal',
    rejectLabel: 'Cancel',
    accept: rejectCompletedWithdrawal
  });
}

useRealtimeRefresh(['withdrawals'], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      title="Withdrawals"
      subtitle="Review requests, set customer withdraw codes and reject completed withdrawals when needed."
    >
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        @click="load"
      />
    </PageHeader>

    <Message class="mb-5" severity="warn" :closable="false">
      Review the saved bank details before setting a withdraw code. A correct customer code completes the withdrawal immediately.
    </Message>

    <section class="table-card">
      <DataTable
        :value="items"
        :loading="loading"
        striped-rows
        paginator
        :rows="10"
        responsive-layout="scroll"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-money-bill" />
            No withdrawal requests found.
          </div>
        </template>

        <Column field="withdrawalNumber" header="Withdrawal" sortable>
          <template #body="{ data }">
            <strong>{{ data.withdrawalNumber }}</strong>
            <small class="table-subtext">{{ dateTime(data.createdAt) }}</small>
          </template>
        </Column>
        <Column header="Customer">
          <template #body="{ data }">
            {{ fullName(data.customerId) }}
            <small class="table-subtext">{{ data.customerId?.customerCode }}</small>
          </template>
        </Column>
        <Column header="Loan">
          <template #body="{ data }">{{ data.loanId?.loanNumber }}</template>
        </Column>
        <Column header="Amount">
          <template #body="{ data }">
            <strong>{{ currency(data.amount) }}</strong>
          </template>
        </Column>
        <Column header="Destination bank">
          <template #body="{ data }">
            <div>
              <strong class="block text-sm">{{ data.requestedBank?.bankName || '—' }}</strong>
              <small class="table-subtext">{{ data.requestedBank?.bankAccountNumber || '—' }}</small>
            </div>
          </template>
        </Column>
        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="flex justify-end">
              <Button
                :label="isOpen(data) ? 'Review' : 'View'"
                icon="pi pi-eye"
                severity="secondary"
                text
                @click="openReview(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="reviewVisible"
      modal
      :header="selected?.withdrawalNumber || 'Withdrawal review'"
      :style="{ width: '760px', maxWidth: '96vw' }"
      @hide="withdrawCode = ''"
    >
      <template v-if="selected">
        <div class="mb-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Customer</span>
            <strong class="mt-1 block text-sm text-slate-900">
              {{ fullName(selected.customerId) }}
            </strong>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Amount</span>
            <strong class="mt-1 block text-sm text-slate-900">
              {{ currency(selected.amount) }}
            </strong>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500">Status</span>
            <Tag
              class="mt-1"
              :value="statusLabel(selected.status)"
              :severity="statusSeverity(selected.status)"
            />
          </div>
        </div>

        <h3 class="mb-3 font-bold text-slate-900">Destination from loan application</h3>
        <div class="overflow-hidden rounded-xl border border-slate-200">
          <div class="grid grid-cols-[120px_1fr] gap-3 bg-slate-50 p-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Field</span>
            <span>Saved information</span>
          </div>
          <div class="grid grid-cols-[120px_1fr] gap-3 border-t border-slate-100 p-3 text-sm">
            <strong>Bank name</strong>
            <span class="break-words">{{ selected.requestedBank?.bankName || '—' }}</span>
          </div>
          <div class="grid grid-cols-[120px_1fr] gap-3 border-t border-slate-100 p-3 text-sm">
            <strong>Account</strong>
            <span class="break-all">{{ selected.requestedBank?.bankAccountNumber || '—' }}</span>
          </div>
        </div>

        <template v-if="isOpen(selected)">
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div v-if="canSetWithdrawCode(selected)" class="form-field">
              <label>Withdraw code *</label>
              <InputText
                :model-value="withdrawCode"
                inputmode="numeric"
                autocomplete="off"
                maxlength="8"
                placeholder="Enter 6 or 8 digits"
                class="w-full font-mono text-lg tracking-[0.2em]"
                @input="updateWithdrawCode"
              />
              <small>Create the code yourself and send it to the customer. It expires after 10 minutes.</small>
            </div>
            <div class="form-field" :class="{ 'sm:col-span-2': !canSetWithdrawCode(selected) }">
              <label>Review note</label>
              <Textarea v-model="reviewNote" rows="2" maxlength="500" />
            </div>
          </div>

          <div v-if="canReject(selected)" class="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
            <label class="mb-2 block text-sm font-semibold text-red-800">
              Rejection reason
            </label>
            <Select
              v-model="rejectionReason"
              :options="rejectionReasonOptions"
              placeholder="Select rejection reason"
              fluid
            />
          </div>
        </template>

        <div
          v-if="canRejectCompleted(selected)"
          class="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <label class="mb-2 block text-sm font-semibold text-amber-900">
            Rejection reason
          </label>
          <Select
            v-model="completedRejectionReason"
            :options="rejectionReasonOptions"
            placeholder="Select rejection reason"
            fluid
          />
        </div>

        <Message
          v-if="selected.rejectedAfterCompletionAt || selected.refundedAt || selected.status === 'REFUNDED'"
          class="mt-5"
          severity="warn"
          :closable="false"
        >
          Rejected: {{ selected.rejectionReason || selected.refundReason || 'No reason recorded' }}
        </Message>
      </template>

      <template #footer>
        <Button label="Close" severity="secondary" text @click="reviewVisible = false" />
        <Button
          v-if="canReject(selected)"
          label="Reject"
          icon="pi pi-times"
          severity="danger"
          outlined
          :loading="rejecting"
          @click="rejectWithdrawal"
        />
        <Button
          v-if="canRejectCompleted(selected)"
          label="Reject"
          icon="pi pi-times"
          severity="danger"
          :loading="rejectingCompleted"
          @click="confirmCompletedRejection"
        />
        <Button
          v-if="canSetWithdrawCode(selected)"
          :label="selected?.status === 'PENDING_REVIEW' ? 'Set withdraw code' : 'Replace withdraw code'"
          icon="pi pi-key"
          :loading="settingCode"
          @click="setWithdrawCode"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext {
  display: block;
  margin-top: 0.15rem;
  color: #82919a;
}
</style>
