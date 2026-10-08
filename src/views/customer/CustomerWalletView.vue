<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import api from "../../services/api.js";
import { useRealtimeRefresh } from "../../composables/useRealtimeRefresh.js";
import {
  apiError,
  currency,
  dateTime,
  numberValue,
  statusSeverity,
} from "../../utils/formatters.js";

const toast = useToast();
const loans = ref([]);
const applications = ref([]);
const selectedLoanId = ref(null);
const withdrawals = ref([]);
const wallet = ref({
  availableBalance: 0,
  loanBalance: 0,
  depositedAmount: 0,
  withdrawnAmount: 0,
  transactionCount: 0,
  eligibleLoanCount: 0,
});
const loading = ref(true);
const withdrawVisible = ref(false);
const withdrawing = ref(false);
const withdrawForm = reactive({ amount: null, code: "" });

const selectedLoan = computed(() => {
  return loans.value.find((loan) => loan._id === selectedLoanId.value) || null;
});

const pendingApplication = computed(() => {
  return (
    applications.value.find((application) =>
      ["SUBMITTED", "UNDER_REVIEW"].includes(application.status),
    ) || null
  );
});

const transactionHistory = computed(() => {
  const withdrawalItems = withdrawals.value.map((withdrawal) => ({
    id: `withdrawal-${withdrawal._id}`,
    type: "WITHDRAWAL",
    occurredAt:
      withdrawal.rejectedAfterCompletionAt ||
      withdrawal.refundedAt ||
      withdrawal.updatedAt ||
      withdrawal.createdAt,
    item: withdrawal,
  }));

  const messageItems = applications.value
    .filter((application) => String(application.customerNote || "").trim())
    .map((application) => ({
      id: `message-${application._id}-${application.customerNoteVersion || 1}`,
      type: "ADMIN_MESSAGE",
      occurredAt:
        application.customerNoteUpdatedAt ||
        application.updatedAt ||
        application.createdAt,
      item: application,
    }));

  const rejectedLoanItems = applications.value
    .filter((application) => application.status === "REJECTED")
    .map((application) => {
      const rejection = [...(application.approvalHistory || [])]
        .reverse()
        .find((review) => review.decision === "REJECTED");

      return {
        id: `loan-rejected-${application._id}`,
        type: "LOAN_REJECTED",
        occurredAt:
          rejection?.reviewedAt || application.updatedAt || application.createdAt,
        item: application,
        reason: rejection?.comment || "",
      };
    });

  return [...withdrawalItems, ...messageItems, ...rejectedLoanItems].sort(
    (first, second) => {
      const firstTime = new Date(first.occurredAt || 0).getTime() || 0;
      const secondTime = new Date(second.occurredAt || 0).getTime() || 0;
      return secondTime - firstTime;
    },
  );
});

const availableBalance = computed(() => {
  return numberValue(wallet.value?.availableBalance);
});

const hasWalletActivity = computed(() => {
  const hasFinancialActivity =
    availableBalance.value > 0 ||
    Number(wallet.value?.transactionCount || 0) > 0 ||
    Number(wallet.value?.eligibleLoanCount || 0) > 0 ||
    withdrawals.value.length > 0;

  return (
    hasFinancialActivity ||
    (!pendingApplication.value && transactionHistory.value.length > 0)
  );
});

const canWithdraw = computed(() => availableBalance.value > 0);

function isAdminMessageUnread(application) {
  if (!application?.customerNote) return false;

  const messageVersion = Number(application.customerNoteVersion || 0) || 1;
  return messageVersion > Number(application.customerNoteReadVersion || 0);
}

async function markAdminMessageRead(application) {
  if (!application?._id || !isAdminMessageUnread(application)) return;

  const previousReadVersion = Number(application.customerNoteReadVersion || 0);
  application.customerNoteReadVersion =
    Number(application.customerNoteVersion || 0) || 1;

  try {
    const { data } = await api.patch(
      `/loan-applications/${application._id}/customer-note/read`,
    );
    application.customerNoteReadVersion = Number(
      data.customerNoteReadVersion || 0,
    );
  } catch {
    application.customerNoteReadVersion = previousReadVersion;
  }
}

function withdrawalSeverity(status) {
  const severities = {
    PENDING_REVIEW: "warn",
    WAITING_FOR_CODE: "info",
    WAITING_FOR_OTP: "info",
    OTP_REQUIRED: "info",
    OTP_VERIFIED: "success",
    APPROVED: "success",
    COMPLETED: "success",
    REFUNDED: "warn",
    REJECTED: "danger",
    EXPIRED: "secondary",
    CANCELLED: "secondary",
  };
  return severities[status] || "secondary";
}

function withdrawalLabel(status) {
  if (status === "REFUNDED") return "REJECTED";
  if (["WAITING_FOR_OTP", "OTP_REQUIRED"].includes(status)) {
    return "WAITING FOR CODE";
  }
  if (status === "OTP_VERIFIED") return "NEW CODE REQUIRED";
  if (["APPROVED", "COMPLETED"].includes(status)) {
    return "WITHDRAW SUCCESS";
  }
  return status?.replaceAll("_", " ") || "UNKNOWN";
}

function loanTerm(loan) {
  if (!loan?.term) return "—";
  const unit = String(loan.termUnit || "MONTH").toLowerCase();
  return `${loan.term} ${unit}${Number(loan.term) === 1 ? "" : "s"}`;
}

async function load() {
  loading.value = true;

  try {
    const [loanResponse, applicationResponse, walletResponse, withdrawalResponse] =
      await Promise.all([
        api.get("/loans", { params: { limit: 100 } }),
        api.get("/loan-applications", { params: { limit: 100 } }),
        api.get("/customers/me/wallet", { params: { limit: 100 } }),
        api.get("/withdrawals", { params: { limit: 100 } }),
      ]);

    loans.value = loanResponse.data.items || [];
    applications.value = applicationResponse.data.items || [];
    wallet.value = walletResponse.data.wallet || wallet.value;
    withdrawals.value = withdrawalResponse.data.items || [];

    const preferred =
      loans.value.find((loan) => loan._id === selectedLoanId.value) ||
      loans.value.find((loan) => ["ACTIVE", "APPROVED"].includes(loan.status)) ||
      loans.value[0];
    selectedLoanId.value = preferred?._id || null;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load wallet",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function openWithdraw() {
  withdrawForm.amount = null;
  withdrawForm.code = "";
  withdrawVisible.value = true;
}

function closeWithdraw() {
  if (withdrawing.value) return;
  withdrawVisible.value = false;
  withdrawForm.amount = null;
  withdrawForm.code = "";
}

function normalizeWithdrawCode(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\D/g, "")
    .slice(0, 8);
}

function updateWithdrawCode(event) {
  withdrawForm.code = normalizeWithdrawCode(event.target.value);
}

async function submitWithdrawal() {
  const code = normalizeWithdrawCode(withdrawForm.code);
  withdrawForm.code = code;

  if (!withdrawForm.amount || numberValue(withdrawForm.amount) <= 0) {
    toast.add({
      severity: "warn",
      summary: "Amount required",
      detail: "Enter the amount you want to withdraw.",
      life: 3000,
    });
    return;
  }

  if (numberValue(withdrawForm.amount) > availableBalance.value) {
    toast.add({
      severity: "warn",
      summary: "Amount is too high",
      detail: "The withdrawal amount cannot exceed your available balance.",
      life: 3000,
    });
    return;
  }

  if (!/^\d{6}$|^\d{8}$/.test(code)) {
    toast.add({
      severity: "warn",
      summary: "Complete code required",
      detail: "Enter the complete 6- or 8-digit withdraw code.",
      life: 3000,
    });
    return;
  }

  withdrawing.value = true;

  try {
    await api.post("/withdrawals/complete", {
      ...(selectedLoanId.value ? { loanId: selectedLoanId.value } : {}),
      amount: withdrawForm.amount,
      code,
    });
    toast.add({
      severity: "success",
      summary: "Withdrawal successful",
      detail: "The amount was deducted from your available balance.",
      life: 3500,
    });
    withdrawVisible.value = false;
    withdrawForm.amount = null;
    withdrawForm.code = "";
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Withdrawal failed",
      detail: apiError(error),
      life: 4500,
    });
    await load();
  } finally {
    withdrawing.value = false;
  }
}

useRealtimeRefresh(
  ["applications", "loans", "repayments", "withdrawals", "customer-wallets"],
  load,
);
onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
    <header>
      <span class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
        My wallet
      </span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">Available balance</h1>
      <p class="mt-1 text-sm text-slate-500">
        Your approved loan funds and administrator deposits use one balance.
      </p>
    </header>

    <template v-if="loading">
      <div class="h-56 animate-pulse rounded-2xl bg-emerald-100" />
      <div class="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div class="h-48 animate-pulse rounded-2xl bg-slate-100" />
    </template>

    <template v-else-if="hasWalletActivity">
      <section
        v-if="loans.length > 1"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label class="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Loan reference
        </label>
        <Select v-model="selectedLoanId" :options="loans" option-value="_id" fluid>
          <template #option="{ option }">
            <div>
              <strong class="block text-sm text-slate-800">{{ option.loanNumber }}</strong>
              <span class="text-xs text-slate-500">
                {{ option.productSnapshot?.name || "Loan" }} · {{ loanTerm(option) }}
              </span>
            </div>
          </template>
          <template #value>
            <span>{{ selectedLoan?.loanNumber || "Select loan" }}</span>
          </template>
        </Select>
      </section>

      <section class="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
        <div class="relative z-10">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                Total available balance
              </span>
              <strong class="mt-1 block text-3xl font-bold tracking-tight">
                {{ currency(wallet.availableBalance) }}
              </strong>
              <span class="mt-2 block text-xs text-emerald-100">
                Loan funds and deposits are combined
              </span>
            </div>
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <i class="pi pi-wallet text-lg" />
            </div>
          </div>

          <div v-if="selectedLoan" class="mt-6 flex items-end justify-between gap-4">
            <div class="min-w-0">
              <span class="text-xs text-emerald-100">Loan reference</span>
              <strong class="mt-0.5 block truncate text-sm">{{ selectedLoan.loanNumber }}</strong>
              <span class="mt-0.5 block truncate text-xs text-emerald-100">
                {{ selectedLoan.productSnapshot?.name || "Loan" }} · {{ loanTerm(selectedLoan) }}
              </span>
            </div>
            <Tag :value="selectedLoan.status" :severity="statusSeverity(selectedLoan.status)" />
          </div>
        </div>
        <div class="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-white/10" />
        <div class="absolute -right-8 -top-16 h-32 w-32 rounded-full bg-white/10" />
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <i class="pi pi-money-bill" />
          </div>
          <div class="min-w-0 flex-1">
            <strong class="block text-sm text-slate-900">Withdraw money</strong>
            <span class="mt-0.5 block text-xs leading-5 text-slate-500">
              Enter an amount and the code provided by the administrator.
            </span>
          </div>
          <Button
            label="Withdraw"
            icon="pi pi-arrow-up-right"
            size="small"
            :disabled="!canWithdraw"
            @click="openWithdraw"
          />
        </div>
      </section>

      <section>
        <div class="mb-3">
          <span class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
            History
          </span>
          <h2 class="mt-1 text-xl font-bold text-slate-900">Transaction History</h2>
        </div>

        <div
          v-if="transactionHistory.length"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <article
            v-for="entry in transactionHistory"
            :key="entry.id"
            class="border-b border-slate-100 last:border-b-0"
          >
            <button
              v-if="entry.type === 'ADMIN_MESSAGE'"
              type="button"
              class="block w-full p-4 text-left transition hover:bg-slate-50"
              :class="
                isAdminMessageUnread(entry.item) ? 'bg-emerald-50/60' : 'bg-white'
              "
              @click="markAdminMessageRead(entry.item)"
            >
              <div class="flex items-center gap-2">
                <strong class="block text-sm text-slate-900">
                  Status from bank
                </strong>
                <span
                  v-if="isAdminMessageUnread(entry.item)"
                  class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                  aria-label="New status from bank"
                />
              </div>

              <span class="mt-0.5 block text-xs text-slate-400">
                {{ entry.item.applicationNumber }}
              </span>
              <p
                class="mt-2 whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-2.5 text-xs leading-5 text-emerald-800"
              >
                {{ entry.item.customerNote }}
              </p>
            </button>

            <div v-else-if="entry.type === 'LOAN_REJECTED'" class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <strong class="block text-sm text-slate-900">
                    {{ currency(entry.item.requestedAmount) }}
                  </strong>
                  <span class="mt-1 block text-xs text-slate-500">
                    {{ entry.item.applicationNumber }} ·
                    {{ dateTime(entry.occurredAt) }}
                  </span>
                  <span class="mt-1 block text-xs text-slate-500">
                    Loan application
                  </span>
                </div>
                <Tag value="LOAN REJECTED" severity="danger" />
              </div>

              <p
                v-if="entry.reason"
                class="mt-3 whitespace-pre-wrap break-words rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700"
              >
                {{ entry.reason }}
              </p>
            </div>

            <div v-else class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <strong class="block text-sm text-slate-900">
                    {{ currency(entry.item.amount) }}
                  </strong>
                  <span class="mt-1 block text-xs text-slate-500">
                    {{ entry.item.withdrawalNumber }} ·
                    {{ dateTime(entry.item.createdAt) }}
                  </span>
                </div>
                <Tag
                  :value="withdrawalLabel(entry.item.status)"
                  :severity="withdrawalSeverity(entry.item.status)"
                />
              </div>

              <p
                v-if="entry.item.rejectionReason"
                class="mt-3 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700"
              >
                {{ entry.item.rejectionReason }}
              </p>
              <div
                v-if="
                  entry.item.rejectedAfterCompletionAt ||
                  entry.item.refundedAt ||
                  entry.item.status === 'REFUNDED'
                "
                class="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"
              >
                This withdrawal was rejected and its amount was returned to
                your available balance.
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"
        >
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <i class="pi pi-receipt" />
          </div>
          <strong class="mt-3 block text-sm text-slate-800">No history</strong>
          <span class="mt-1 block text-xs text-slate-500">
            Withdrawals, rejected loans and bank statuses will appear here.
          </span>
        </div>
      </section>
    </template>

    <div
      v-else-if="pendingApplication"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
    >
      <div class="relative mx-auto h-20 w-20">
        <div class="absolute left-1 top-1 flex h-16 w-14 items-center justify-center rounded-xl bg-violet-50 text-violet-300">
          <i class="pi pi-file text-2xl" />
        </div>
        <div class="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-500">
          <i class="pi pi-search text-lg" />
        </div>
      </div>
      <strong class="mx-auto mt-5 block max-w-xs text-xl text-slate-900">
        Your loan application is under review.
      </strong>
      <span class="mx-auto mt-3 block max-w-sm text-sm leading-6 text-slate-500">
        Your balance will appear here after an administrator approves the loan or adds a deposit.
      </span>
      <div class="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3 text-left">
        <div class="rounded-xl bg-slate-50 p-3">
          <span class="block text-xs text-slate-500">Application</span>
          <strong class="mt-1 block truncate text-sm text-slate-800">
            {{ pendingApplication.applicationNumber }}
          </strong>
        </div>
        <div class="rounded-xl bg-slate-50 p-3">
          <span class="block text-xs text-slate-500">Requested amount</span>
          <strong class="mt-1 block text-sm text-slate-800">
            {{ currency(pendingApplication.requestedAmount) }}
          </strong>
        </div>
      </div>

      <button
        v-if="pendingApplication.customerNote"
        type="button"
        class="mx-auto mt-5 block w-full max-w-sm rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
        :class="
          isAdminMessageUnread(pendingApplication) ? 'bg-emerald-50' : 'bg-white'
        "
        @click="markAdminMessageRead(pendingApplication)"
      >
        <div class="flex items-center gap-2">
          <strong class="block text-sm text-slate-900">Status from bank</strong>
          <span
            v-if="isAdminMessageUnread(pendingApplication)"
            class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
            aria-label="New status from bank"
          />
        </div>

        <span class="mt-0.5 block text-xs text-slate-400">
          {{ pendingApplication.applicationNumber }}
        </span>
        <p
          class="mt-2 whitespace-pre-wrap break-words rounded-lg bg-emerald-100/70 p-2.5 text-xs leading-5 text-emerald-800"
        >
          {{ pendingApplication.customerNote }}
        </p>
      </button>

      <RouterLink
        to="/customer/home"
        class="mx-auto mt-7 inline-flex min-h-11 w-full max-w-sm items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        OK
      </RouterLink>
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <i class="pi pi-wallet text-xl" />
      </div>
      <strong class="mt-4 block text-slate-800">Your wallet is empty</strong>
      <span class="mx-auto mt-1 block max-w-xs text-sm leading-5 text-slate-500">
        An approved loan or administrator deposit will appear here.
      </span>
      <RouterLink
        to="/customer/home"
        class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
      >
        Explore loan options
        <i class="pi pi-arrow-right text-xs" />
      </RouterLink>
    </div>

    <Dialog
      v-model:visible="withdrawVisible"
      modal
      header="Withdraw available balance"
      :style="{ width: '520px', maxWidth: '95vw' }"
      :closable="!withdrawing"
      :close-on-escape="!withdrawing"
      @hide="closeWithdraw"
    >
      <form @submit.prevent="submitWithdrawal">
        <div class="space-y-4">
          <div class="rounded-xl bg-emerald-50 p-4">
            <span class="block text-xs font-semibold text-emerald-700">Available balance</span>
            <strong class="mt-1 block text-xl text-emerald-900">
              {{ currency(wallet.availableBalance) }}
            </strong>
          </div>
          <div class="form-field">
            <label>Withdrawal amount *</label>
            <InputNumber
              v-model="withdrawForm.amount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="1"
              :max="availableBalance"
              fluid
              required
            />
          </div>
          <div class="form-field">
            <label>Withdraw code *</label>
            <InputText
              :model-value="withdrawForm.code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="8"
              placeholder="Enter 6- or 8-digit code"
              class="w-full text-center text-2xl font-bold tracking-[0.3em]"
              required
              @input="updateWithdrawCode"
            />
          </div>
        </div>
        <div class="form-actions">
          <Button
            label="Cancel"
            type="button"
            severity="secondary"
            text
            :disabled="withdrawing"
            @click="closeWithdraw"
          />
          <Button label="Submit withdrawal" type="submit" :loading="withdrawing" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
