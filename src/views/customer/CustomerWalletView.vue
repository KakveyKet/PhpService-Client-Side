<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import Select from "primevue/select";
import Tag from "primevue/tag";
import api from "../../services/api.js";
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
const loading = ref(true);
const detailLoading = ref(false);

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

function isRepayment(transaction) {
  return transaction.transactionType === "REPAYMENT";
}

function transactionLabel(transaction) {
  return transaction.transactionType?.replaceAll("_", " ") || "Transaction";
}

async function loadLoanDetail(id) {
  if (!id) return;

  detailLoading.value = true;

  try {
    const { data } = await api.get(`/loans/${id}`);

    loanDetail.value = data.item;
    installments.value = data.installments;
    transactions.value = data.transactions;
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
        return ["ACTIVE", "OVERDUE"].includes(loan.status);
      }) || loans.value[0];

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

watch(selectedLoanId, (id, oldId) => {
  if (id && oldId && id !== oldId) {
    loadLoanDetail(id);
  }
});

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
      <p class="mt-1 text-sm text-slate-500">
        View your balance, payment progress and transactions.
      </p>
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
                  Outstanding balance
                </span>
                <strong class="mt-1 block text-3xl font-bold tracking-tight">
                  {{ currency(loanDetail.balances?.total) }}
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

            <div class="mt-6">
              <div class="mb-2 flex items-center justify-between text-xs">
                <span class="text-emerald-100">Payment progress</span>
                <strong>{{ paidProgress }}%</strong>
              </div>

              <div class="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  class="h-full rounded-full bg-white transition-all duration-500"
                  :style="{ width: `${paidProgress}%` }"
                />
              </div>
            </div>
          </div>

          <div
            class="absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-white/10"
          />
          <div
            class="absolute -right-8 -top-16 h-32 w-32 rounded-full bg-white/10"
          />
        </section>

        <!-- Quick balance details -->
        <section class="grid grid-cols-2 gap-3">
          <article
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
            >
              <i class="pi pi-check-circle" />
            </div>
            <span class="mt-3 block text-xs text-slate-500">Total paid</span>
            <strong class="mt-1 block break-all text-base text-slate-900">
              {{ currency(loanDetail.balances?.totalPaid) }}
            </strong>
          </article>

          <article
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
            >
              <i class="pi pi-calendar" />
            </div>
            <span class="mt-3 block text-xs text-slate-500">Next payment</span>
            <strong class="mt-1 block break-all text-base text-slate-900">
              {{ currency(nextInstallment?.remainingDue) }}
            </strong>
            <small class="mt-1 block text-[11px] text-slate-400">
              {{
                nextInstallment
                  ? date(nextInstallment.dueDate)
                  : "No payment due"
              }}
            </small>
          </article>
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
                  isRepayment(transaction)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                "
              >
                <i
                  :class="
                    isRepayment(transaction)
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
                  isRepayment(transaction)
                    ? 'text-emerald-700'
                    : 'text-slate-800'
                "
              >
                {{ isRepayment(transaction) ? "−" : ""
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
  </div>
</template>
