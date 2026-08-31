<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tag from "primevue/tag";
import api from "../../services/api.js";
import { useRealtimeRefresh } from "../../composables/useRealtimeRefresh.js";
import {
  apiError,
  currency,
  date,
  dateTime,
  numberValue,
  statusSeverity,
} from "../../utils/formatters.js";

const toast = useToast();
const loans = ref([]);
const selectedLoanId = ref(null);
const loanDetail = ref(null);
const installments = ref([]);
const transactions = ref([]);
const wallet = ref({
  availableBalance: 0,
  reservedBalance: 0,
  withdrawnAmount: 0,
  originalBalance: 0,
});
const withdrawals = ref([]);
const loading = ref(true);
const detailLoading = ref(false);
const withdrawVisible = ref(false);
const withdrawing = ref(false);
const verifyingOtp = ref(false);
const dialogWithdrawalId = ref(null);
const otpCode = ref("");
const withdrawForm = reactive({
  amount: null,
});

const selectedLoan = computed(() => {
  return loans.value.find((loan) => loan._id === selectedLoanId.value);
});

const nextInstallment = computed(() => {
  return installments.value.find((item) => {
    return ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(item.status);
  });
});

const paidProgress = computed(() => {
  const total = numberValue(loanDetail.value?.totalPayable);

  if (!total) return 0;

  const paid = numberValue(loanDetail.value?.balances?.totalPaid);
  return Math.min(100, Math.round((paid / total) * 100));
});

const openWithdrawal = computed(() => {
  return withdrawals.value.find((item) => {
    return [
      "PENDING_REVIEW",
      "WAITING_FOR_OTP",
      "OTP_REQUIRED",
      "OTP_VERIFIED",
    ].includes(item.status);
  });
});

const dialogWithdrawal = computed(() => {
  return (
    withdrawals.value.find((item) => item._id === dialogWithdrawalId.value) ||
    null
  );
});

const isOtpStep = computed(() => {
  return ["PENDING_REVIEW", "WAITING_FOR_OTP", "OTP_REQUIRED"].includes(
    dialogWithdrawal.value?.status,
  );
});

const otpReady = computed(() => {
  return (
    ["WAITING_FOR_OTP", "OTP_REQUIRED"].includes(
      dialogWithdrawal.value?.status,
    ) && [6, 8].includes(dialogWithdrawal.value?.otpLength)
  );
});

const availableBalance = computed(() => {
  return numberValue(wallet.value?.availableBalance);
});

const canOpenWithdrawDialog = computed(() => {
  if (openWithdrawal.value) return true;
  return (
    ["APPROVED", "ACTIVE"].includes(loanDetail.value?.status) &&
    availableBalance.value > 0
  );
});

const withdrawButtonLabel = computed(() => {
  return openWithdrawal.value ? "Continue" : "Withdraw";
});

function isRepayment(transaction) {
  return transaction.transactionType === "REPAYMENT";
}

function isMoneyOut(transaction) {
  return ["REPAYMENT", "WITHDRAWAL"].includes(transaction.transactionType);
}

function transactionLabel(transaction) {
  return transaction.transactionType?.replaceAll("_", " ") || "Transaction";
}

function withdrawalSeverity(status) {
  const severities = {
    PENDING_REVIEW: "warn",
    WAITING_FOR_OTP: "info",
    OTP_REQUIRED: "info",
    OTP_VERIFIED: "success",
    APPROVED: "success",
    COMPLETED: "success",
    REJECTED: "danger",
    EXPIRED: "secondary",
    CANCELLED: "secondary",
  };
  return severities[status] || "secondary";
}

function withdrawalLabel(status) {
  return status?.replaceAll("_", " ") || "UNKNOWN";
}

async function loadLoanDetail(id) {
  if (!id) return;

  detailLoading.value = true;

  try {
    const [loanResponse, withdrawalResponse] = await Promise.all([
      api.get(`/loans/${id}`),
      api.get("/withdrawals", { params: { loanId: id, limit: 100 } }),
    ]);

    loanDetail.value = loanResponse.data.item;
    installments.value = loanResponse.data.installments;
    transactions.value = loanResponse.data.transactions;
    wallet.value = loanResponse.data.wallet || wallet.value;
    withdrawals.value = withdrawalResponse.data.items;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load wallet",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    detailLoading.value = false;
  }
}

async function load() {
  loading.value = true;

  try {
    const { data } = await api.get("/loans", {
      params: { limit: 100 },
    });

    loans.value = data.items;

    const preferred =
      loans.value.find((loan) => {
        return loan._id === selectedLoanId.value;
      }) ||
      loans.value.find((loan) => {
        return ["ACTIVE", "OVERDUE"].includes(loan.status);
      }) ||
      loans.value[0];

    selectedLoanId.value = preferred?._id || null;
    await loadLoanDetail(selectedLoanId.value);
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
  dialogWithdrawalId.value = openWithdrawal.value?._id || null;
  otpCode.value = "";
  withdrawVisible.value = true;
}

function closeWithdraw() {
  withdrawVisible.value = false;
  dialogWithdrawalId.value = null;
  otpCode.value = "";
}

async function submitWithdrawal() {
  if (!selectedLoanId.value) return;
  withdrawing.value = true;

  try {
    const { data } = await api.post("/withdrawals", {
      loanId: selectedLoanId.value,
      amount: withdrawForm.amount,
    });
    dialogWithdrawalId.value = data.item._id;
    withdrawals.value = [
      data.item,
      ...withdrawals.value.filter((item) => item._id !== data.item._id),
    ];
    toast.add({
      severity: "success",
      summary: "Withdrawal submitted",
      detail: "Enter the OTP after an administrator provides your code.",
      life: 4000,
    });
    await loadLoanDetail(selectedLoanId.value);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Withdrawal failed",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    withdrawing.value = false;
  }
}

function normalizeOtp(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\D/g, "")
    .slice(0, 8);
}

async function verifyOtp() {
  if (!dialogWithdrawal.value) return;

  const otp = normalizeOtp(otpCode.value);
  otpCode.value = otp;

  if (!/^\d{6}$|^\d{8}$/.test(otp)) {
    toast.add({
      severity: "warn",
      summary: "Complete OTP required",
      detail: "Enter the complete 6- or 8-digit OTP.",
      life: 3000,
    });
    return;
  }

  verifyingOtp.value = true;

  try {
    await api.post(`/withdrawals/${dialogWithdrawal.value._id}/verify-otp`, {
      otp,
    });
    toast.add({
      severity: "success",
      summary: "OTP verified",
      detail: "Your withdrawal is waiting for final administrator approval.",
      life: 3500,
    });
    await loadLoanDetail(selectedLoanId.value);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "OTP verification failed",
      detail: apiError(error),
      life: 4500,
    });
    await loadLoanDetail(selectedLoanId.value);
  } finally {
    verifyingOtp.value = false;
  }
}

watch(selectedLoanId, (id, oldId) => {
  if (id && oldId && id !== oldId) {
    closeWithdraw();
    loadLoanDetail(id);
  }
});

watch(
  [
    () => dialogWithdrawal.value?.status,
    () => dialogWithdrawal.value?.otpGeneratedAt,
  ],
  ([status, generatedAt], [oldStatus, oldGeneratedAt]) => {
    if (
      ["WAITING_FOR_OTP", "OTP_REQUIRED"].includes(status) &&
      (status !== oldStatus || generatedAt !== oldGeneratedAt)
    ) {
      otpCode.value = "";
    }
  },
);

watch(otpCode, (value) => {
  const normalized = normalizeOtp(value);
  if (normalized !== value) otpCode.value = normalized;
});

useRealtimeRefresh(["loans", "repayments", "withdrawals"], load);
onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
    <header>
      <span
        class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600"
      >
        My wallet
      </span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">Loan balance</h1>
    </header>

    <template v-if="loading">
      <div class="h-56 animate-pulse rounded-2xl bg-emerald-100" />

      <div class="grid grid-cols-2 gap-3">
        <div class="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div class="h-28 animate-pulse rounded-2xl bg-slate-100" />
      </div>

      <div class="h-48 animate-pulse rounded-2xl bg-slate-100" />
    </template>

    <template v-else-if="loanDetail">
      <!-- Loan selector -->
      <section
        v-if="loans.length > 1"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label
          class="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500"
        >
          Select loan
        </label>

        <Select
          v-model="selectedLoanId"
          :options="loans"
          option-value="_id"
          fluid
        >
          <template #option="{ option }">
            <div>
              <strong class="block text-sm text-slate-800">
                {{ option.loanNumber }}
              </strong>
              <span class="text-xs text-slate-500">
                {{ option.productSnapshot?.name || "Loan" }}
              </span>
            </div>
          </template>

          <template #value>
            <span>{{ selectedLoan?.loanNumber || "Select loan" }}</span>
          </template>
        </Select>
      </section>

      <div
        class="space-y-5 transition-opacity"
        :class="
          detailLoading ? 'pointer-events-none opacity-60' : 'opacity-100'
        "
      >
        <!-- Balance card -->
        <section
          class="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-sm"
        >
          <div class="relative z-10">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span
                  class="text-xs font-semibold uppercase tracking-wide text-emerald-100"
                >
                  Balance
                </span>
                <strong class="mt-1 block text-3xl font-bold tracking-tight">
                  {{ currency(wallet.availableBalance) }}
                </strong>
              </div>

              <div
                class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"
              >
                <i class="pi pi-wallet text-lg" />
              </div>
            </div>

            <div class="mt-6 flex items-end justify-between gap-4">
              <div class="min-w-0">
                <span class="text-xs text-emerald-100">Loan number</span>
                <strong class="mt-0.5 block truncate text-sm">
                  {{ loanDetail.loanNumber }}
                </strong>
                <span class="mt-0.5 block truncate text-xs text-emerald-100">
                  {{ loanDetail.productSnapshot?.name || "Loan" }}
                </span>
              </div>

              <Tag
                :value="loanDetail.status"
                :severity="statusSeverity(loanDetail.status)"
              />
            </div>
          </div>

          <div
            class="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-white/10"
          />
          <div
            class="absolute -right-8 -top-16 h-32 w-32 rounded-full bg-white/10"
          />
        </section>

        <!-- Withdrawal action -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"
            >
              <i class="pi pi-money-bill" />
            </div>
            <div class="min-w-0 flex-1">
              <strong class="block text-sm text-slate-900"
                >Withdraw money</strong
              >
            </div>
            <Button
              :label="withdrawButtonLabel"
              icon="pi pi-arrow-up-right"
              size="small"
              :disabled="!canOpenWithdrawDialog"
              @click="openWithdraw"
            />
          </div>
        </section>

        <!-- Withdrawal requests -->
        <section v-if="withdrawals.length">
          <div class="mb-3">
            <span
              class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600"
            >
              Withdrawal
            </span>
            <h2 class="mt-1 text-xl font-bold text-slate-900">Requests</h2>
          </div>

          <div
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <article
              v-for="item in withdrawals"
              :key="item._id"
              class="border-b border-slate-100 p-4 last:border-b-0"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <strong class="block text-sm text-slate-900">
                    {{ currency(item.amount) }}
                  </strong>
                  <span class="mt-1 block text-xs text-slate-500">
                    {{ item.withdrawalNumber }} · {{ dateTime(item.createdAt) }}
                  </span>
                  <span class="mt-1 block truncate text-xs text-slate-500">
                    {{ item.requestedBank?.bankName }} ·
                    {{ item.requestedBank?.bankAccountNumber }}
                  </span>
                </div>
                <Tag
                  :value="withdrawalLabel(item.status)"
                  :severity="withdrawalSeverity(item.status)"
                />
              </div>

              <p
                v-if="item.rejectionReason"
                class="mt-3 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700"
              >
                {{ item.rejectionReason }}
              </p>

              <Message
                v-if="item.status === 'OTP_VERIFIED'"
                class="mt-3"
                severity="success"
                :closable="false"
              >
                OTP verified.
              </Message>
            </article>
          </div>
        </section>

        <!-- Transactions -->
        <section>
          <div class="mb-3">
            <span
              class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600"
            >
              History
            </span>
            <h2 class="mt-1 text-xl font-bold text-slate-900">Transactions</h2>
          </div>

          <div
            v-if="transactions.length"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <article
              v-for="transaction in transactions"
              :key="transaction._id"
              class="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0"
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                :class="
                  isMoneyOut(transaction)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                "
              >
                <i
                  :class="
                    isMoneyOut(transaction)
                      ? 'pi pi-arrow-up-right'
                      : 'pi pi-arrow-down-left'
                  "
                />
              </div>

              <div class="min-w-0 flex-1">
                <strong class="block truncate text-sm text-slate-800">
                  {{ transactionLabel(transaction) }}
                </strong>
                <span class="mt-0.5 block text-xs text-slate-400">
                  {{ dateTime(transaction.transactionDate) }}
                </span>
              </div>

              <strong
                class="shrink-0 text-right text-sm"
                :class="
                  isMoneyOut(transaction)
                    ? 'text-emerald-700'
                    : 'text-slate-800'
                "
              >
                {{ isMoneyOut(transaction) ? "−" : ""
                }}{{ currency(transaction.amount) }}
              </strong>
            </article>
          </div>

          <div
            v-else
            class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"
          >
            <div
              class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
            >
              <i class="pi pi-receipt" />
            </div>
            <strong class="mt-3 block text-sm text-slate-800"
              >No transactions</strong
            >
            <span class="mt-1 block text-xs text-slate-500">
              Confirmed loan activity will appear here.
            </span>
          </div>
        </section>
      </div>
    </template>

    <!-- Empty wallet -->
    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
    >
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"
      >
        <i class="pi pi-wallet text-xl" />
      </div>
      <strong class="mt-4 block text-slate-800">Your wallet is empty</strong>
      <span
        class="mx-auto mt-1 block max-w-xs text-sm leading-5 text-slate-500"
      >
        Once a loan is approved, its balance and transactions will appear here.
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
      :header="dialogWithdrawal ? 'Enter OTP Code' : 'Withdraw wallet balance'"
      :style="{ width: '520px', maxWidth: '95vw' }"
      @hide="closeWithdraw"
    >
      <form v-if="!dialogWithdrawal" @submit.prevent="submitWithdrawal">
        <div class="space-y-4">
          <!-- <Message severity="info" :closable="false">
            Your destination bank name and account number will be taken
            automatically from this loan application.
          </Message> -->

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
            <small>Available: {{ currency(wallet.availableBalance) }}</small>
          </div>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            type="button"
            severity="secondary"
            text
            @click="closeWithdraw"
          />
          <Button
            label="Submit withdrawal"
            type="submit"
            :loading="withdrawing"
          />
        </div>
      </form>

      <template v-else>
        <form v-if="isOtpStep" class="mt-4" @submit.prevent="verifyOtp">
          <div class="form-field">
            <label>OTP code</label>
            <InputText
              v-model="otpCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="8"
              placeholder="Enter OTP"
              class="w-full text-center text-2xl font-bold tracking-[0.3em]"
              :autofocus="otpReady"
            />
          </div>

          <div class="form-actions">
            <Button
              label="Close"
              type="button"
              severity="secondary"
              text
              @click="closeWithdraw"
            />
            <Button
              label="Verify OTP"
              type="submit"
              icon="pi pi-check"
              :loading="verifyingOtp"
            />
          </div>
        </form>

        <Message
          v-else-if="dialogWithdrawal.status === 'OTP_VERIFIED'"
          class="mt-4"
          severity="success"
          :closable="false"
        >
          OTP verified successfully.
        </Message>

        <Message
          v-else-if="
            ['APPROVED', 'COMPLETED'].includes(dialogWithdrawal.status)
          "
          class="mt-4"
          severity="success"
          :closable="false"
        >
          Withdrawal approved. The amount has been processed and recorded in
          your transaction history.
        </Message>

        <Message
          v-else
          class="mt-4"
          :severity="dialogWithdrawal.status === 'REJECTED' ? 'error' : 'warn'"
          :closable="false"
        >
          {{
            dialogWithdrawal.rejectionReason ||
            `Withdrawal status: ${withdrawalLabel(dialogWithdrawal.status)}`
          }}
        </Message>

        <div v-if="!isOtpStep" class="form-actions">
          <Button label="Close" severity="secondary" @click="closeWithdraw" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
