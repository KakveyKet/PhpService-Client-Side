<script setup>
import { computed, onMounted, ref } from "vue";

import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";

import PageHeader from "../components/PageHeader.vue";

import api from "../services/api.js";

import { useAuthStore } from "../stores/auth.js";

import { useRealtimeRefresh } from "../composables/useRealtimeRefresh.js";

import {
  apiError,
  currency,
  date,
  dateTime,
  fullName,
  numberValue,
  statusSeverity,
} from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();

/*
|--------------------------------------------------------------------------
| Main data
|--------------------------------------------------------------------------
*/

const items = ref([]);
const customers = ref([]);

const loading = ref(false);

/*
|--------------------------------------------------------------------------
| Filters
|--------------------------------------------------------------------------
*/

const filterSearch = ref("");
const filterCustomerId = ref(null);
const filterStatus = ref(null);

function defaultDateRange() {
  const end = new Date();

  end.setHours(23, 59, 59, 999);

  const start = new Date(end);

  start.setDate(start.getDate() - 6);

  start.setHours(0, 0, 0, 0);

  return [start, end];
}

const filterDateRange = ref(defaultDateRange());

const statusOptions = [
  {
    label: "Approved",
    value: "APPROVED",
  },
  {
    label: "Active",
    value: "ACTIVE",
  },
  {
    label: "Overdue",
    value: "OVERDUE",
  },
  {
    label: "Completed",
    value: "COMPLETED",
  },
  {
    label: "Cancelled",
    value: "CANCELLED",
  },
];

/*
|--------------------------------------------------------------------------
| Customer options
|--------------------------------------------------------------------------
*/

const customerOptions = computed(() => {
  return customers.value.map((customer) => ({
    ...customer,

    searchLabel: [fullName(customer), customer.customerCode, customer.phone]
      .filter(Boolean)
      .join(" — "),
  }));
});

/*
|--------------------------------------------------------------------------
| Client search
|--------------------------------------------------------------------------
*/

const filteredItems = computed(() => {
  const query = filterSearch.value.trim().toLowerCase();

  return items.value.filter((loan) => {
    /*
        |--------------------------------------------------------------------------
        | Exact customer
        |--------------------------------------------------------------------------
        */

    if (
      !auth.isCustomer &&
      filterCustomerId.value &&
      loan.customerId?._id !== filterCustomerId.value
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    /*
        |--------------------------------------------------------------------------
        | Free-text search
        |--------------------------------------------------------------------------
        */

    const searchableValues = [
      loan.loanNumber,

      fullName(loan.customerId),

      loan.customerId?.customerCode,

      loan.customerId?.phone,

      loan.productSnapshot?.name,

      loan.productId?.name,

      loan.status,
    ];

    return searchableValues.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    );
  });
});

/*
|--------------------------------------------------------------------------
| Loan detail
|--------------------------------------------------------------------------
*/

const detailVisible = ref(false);

const detailLoading = ref(false);

const selected = ref(null);

const installments = ref([]);
const transactions = ref([]);

const disbursing = ref(false);

/*
|--------------------------------------------------------------------------
| Computed detail
|--------------------------------------------------------------------------
*/

const nextInstallment = computed(() => {
  return installments.value.find((item) =>
    ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(item.status),
  );
});

const paidProgress = computed(() => {
  const total = numberValue(selected.value?.totalPayable);

  if (!total) {
    return 0;
  }

  const paid = numberValue(selected.value?.balances?.totalPaid);

  return Math.min(100, Math.round((paid / total) * 100));
});

/*
|--------------------------------------------------------------------------
| API params
|--------------------------------------------------------------------------
*/

function loanParams() {
  const params = {
    limit: 100,
  };

  if (!auth.isCustomer && filterCustomerId.value) {
    params.customerId = filterCustomerId.value;
  }

  if (filterStatus.value) {
    params.status = filterStatus.value;
  }

  const [selectedFrom, selectedTo] = filterDateRange.value || [];

  if (selectedFrom) {
    const dateFrom = new Date(selectedFrom);

    dateFrom.setHours(0, 0, 0, 0);

    params.dateFrom = dateFrom.toISOString();
  }

  if (selectedTo) {
    const dateTo = new Date(selectedTo);

    dateTo.setHours(23, 59, 59, 999);

    params.dateTo = dateTo.toISOString();
  }

  return params;
}

/*
|--------------------------------------------------------------------------
| Load loans
|--------------------------------------------------------------------------
*/

async function load() {
  loading.value = true;

  try {
    const requests = [
      api.get("/loans", {
        params: loanParams(),
      }),
    ];

    if (!auth.isCustomer) {
      requests.push(
        api.get("/customers", {
          params: {
            limit: 100,
          },
        }),
      );
    }

    const [loanResponse, customerResponse] = await Promise.all(requests);

    items.value = loanResponse.data.items || [];

    customers.value = customerResponse?.data?.items || [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load loans",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

/*
|--------------------------------------------------------------------------
| Filters
|--------------------------------------------------------------------------
*/

function resetFilters() {
  filterSearch.value = "";

  filterCustomerId.value = null;

  filterStatus.value = null;

  filterDateRange.value = defaultDateRange();

  load();
}

/*
|--------------------------------------------------------------------------
| Loan detail
|--------------------------------------------------------------------------
*/

async function openDetail(loan) {
  selected.value = loan;

  installments.value = [];
  transactions.value = [];

  detailVisible.value = true;

  detailLoading.value = true;

  try {
    const { data } = await api.get(`/loans/${loan._id}`);

    selected.value = data.item;

    installments.value = data.installments || [];

    transactions.value = data.transactions || [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load loan detail",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    detailLoading.value = false;
  }
}

/*
|--------------------------------------------------------------------------
| Disbursement
|--------------------------------------------------------------------------
*/

async function disburseLoan() {
  if (!auth.isAdmin || !selected.value) {
    return;
  }

  if (selected.value.status !== "APPROVED") {
    return;
  }

  disbursing.value = true;

  try {
    await api.post(`/loans/${selected.value._id}/disburse`, {
      disbursedAt: new Date(),
    });

    toast.add({
      severity: "success",
      summary: "Loan disbursed",
      detail: "The loan is now active.",
      life: 3000,
    });

    await load();

    await openDetail(selected.value);
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot disburse loan",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    disbursing.value = false;
  }
}

/*
|--------------------------------------------------------------------------
| Realtime
|--------------------------------------------------------------------------
*/

useRealtimeRefresh(["loans", "repayments", "withdrawals"], load);

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      title="Loans"
      subtitle="Approved, active and completed customer loans."
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
      <!-- Filters -->
      <div
        class="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5"
      >
        <!-- Customer search -->
        <div v-if="!auth.isCustomer" class="min-w-[220px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Search customer
          </label>

          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />

            <InputText
              v-model="filterSearch"
              fluid
              placeholder="Name, code, phone, loan..."
            />
          </span>
        </div>

        <!-- Customer dropdown -->
        <div v-if="!auth.isCustomer" class="min-w-[240px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Customer
          </label>

          <Select
            v-model="filterCustomerId"
            :options="customerOptions"
            option-label="searchLabel"
            option-value="_id"
            filter
            show-clear
            fluid
            placeholder="All customers"
          >
            <template #option="{ option }">
              <div>
                <strong class="block text-sm">
                  {{ fullName(option) }}
                </strong>

                <small class="text-slate-500">
                  {{ option.customerCode }}

                  <template v-if="option.phone">
                    —
                    {{ option.phone }}
                  </template>
                </small>
              </div>
            </template>

            <template #value="{ value, placeholder }">
              <span v-if="value">
                {{
                  fullName(customers.find((customer) => customer._id === value))
                }}
              </span>

              <span v-else>
                {{ placeholder }}
              </span>
            </template>
          </Select>
        </div>

        <!-- Status -->
        <div class="min-w-[180px]">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Status
          </label>

          <Select
            v-model="filterStatus"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            show-clear
            fluid
            placeholder="All statuses"
          />
        </div>

        <!-- Created date -->
        <div class="min-w-[240px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Created date
          </label>

          <DatePicker
            v-model="filterDateRange"
            selection-mode="range"
            :manual-input="false"
            date-format="M dd, yy"
            show-icon
            fluid
            placeholder="Select date range"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button
            label="Filter"
            icon="pi pi-filter"
            :loading="loading"
            @click="load"
          />

          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            @click="resetFilters"
          />
        </div>
      </div>

      <!-- Loans table -->
      <DataTable
        :value="filteredItems"
        :loading="loading"
        striped-rows
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        responsive-layout="scroll"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-wallet" />

            No loans found.
          </div>
        </template>

        <!-- Loan -->
        <Column field="loanNumber" header="Loan" sortable>
          <template #body="{ data }">
            <strong>
              {{ data.loanNumber }}
            </strong>

            <small class="table-subtext">
              {{ date(data.createdAt) }}
            </small>
          </template>
        </Column>

        <!-- Customer -->
        <Column v-if="!auth.isCustomer" header="Customer">
          <template #body="{ data }">
            <strong class="block">
              {{ fullName(data.customerId) }}
            </strong>

            <small class="table-subtext">
              {{ data.customerId?.customerCode }}
            </small>
          </template>
        </Column>

        <!-- Product -->
        <Column header="Product">
          <template #body="{ data }">
            {{ data.productSnapshot?.name || data.productId?.name || "—" }}
          </template>
        </Column>

        <!-- Principal -->
        <Column header="Principal">
          <template #body="{ data }">
            <strong>
              {{ currency(data.principalAmount) }}
            </strong>
          </template>
        </Column>

        <!-- Outstanding -->
        <Column header="Outstanding">
          <template #body="{ data }">
            <strong>
              {{ currency(data.balances?.total) }}
            </strong>

            <small class="table-subtext">
              Paid:
              {{ currency(data.balances?.totalPaid) }}
            </small>
          </template>
        </Column>

        <!-- Term -->
        <Column header="Term">
          <template #body="{ data }">
            {{ data.term }}

            {{ data.termUnit?.toLowerCase() }}(s)
          </template>
        </Column>

        <!-- Maturity -->
        <Column header="Maturity">
          <template #body="{ data }">
            {{ date(data.maturityDate) }}
          </template>
        </Column>

        <!-- Status -->
        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <!-- Action -->
        <Column header="">
          <template #body="{ data }">
            <div class="flex justify-end">
              <Button
                label="View"
                icon="pi pi-eye"
                severity="secondary"
                text
                @click="openDetail(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- Detail dialog -->
    <Dialog
      v-model:visible="detailVisible"
      modal
      :header="selected?.loanNumber || 'Loan detail'"
      :style="{
        width: '1000px',
        maxWidth: '96vw',
      }"
    >
      <template v-if="selected">
        <!-- Loading -->
        <div
          v-if="detailLoading"
          class="py-10 text-center text-sm text-slate-500"
        >
          <i class="pi pi-spin pi-spinner mr-2" />

          Loading loan detail...
        </div>

        <template v-else>
          <!-- Header cards -->
          <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl bg-slate-50 p-4">
              <span class="text-xs text-slate-500"> Customer </span>

              <strong class="mt-1 block text-sm">
                {{ fullName(selected.customerId) }}
              </strong>

              <small class="mt-1 block text-xs text-slate-500">
                {{ selected.customerId?.customerCode }}
              </small>
            </div>

            <div class="rounded-xl bg-slate-50 p-4">
              <span class="text-xs text-slate-500"> Principal </span>

              <strong class="mt-1 block text-sm">
                {{ currency(selected.principalAmount) }}
              </strong>
            </div>

            <div class="rounded-xl bg-slate-50 p-4">
              <span class="text-xs text-slate-500"> Outstanding </span>

              <strong class="mt-1 block text-sm">
                {{ currency(selected.balances?.total) }}
              </strong>
            </div>

            <div class="rounded-xl bg-slate-50 p-4">
              <span class="text-xs text-slate-500"> Status </span>

              <div class="mt-1">
                <Tag
                  :value="selected.status"
                  :severity="statusSeverity(selected.status)"
                />
              </div>
            </div>
          </div>

          <!-- Payment progress -->
          <div class="mb-5 rounded-xl border border-slate-200 p-4">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-semibold text-slate-700">
                Payment progress
              </span>

              <strong class="text-sm"> {{ paidProgress }}% </strong>
            </div>

            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-emerald-500 transition-all"
                :style="{
                  width: `${paidProgress}%`,
                }"
              />
            </div>
          </div>

          <!-- Loan information -->
          <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="detail-item">
              <span> Product </span>

              <strong>
                {{
                  selected.productSnapshot?.name ||
                  selected.productId?.name ||
                  "—"
                }}
              </strong>
            </div>

            <div class="detail-item">
              <span> Total payable </span>

              <strong>
                {{ currency(selected.totalPayable) }}
              </strong>
            </div>

            <div class="detail-item">
              <span> Total paid </span>

              <strong>
                {{ currency(selected.balances?.totalPaid) }}
              </strong>
            </div>

            <div class="detail-item">
              <span> Interest </span>

              <strong>
                {{ currency(selected.totalInterest) }}
              </strong>
            </div>

            <div class="detail-item">
              <span>Rate</span>

              <strong>
                {{ numberValue(selected.rateSnapshot?.ratePercent) }}%
              </strong>
            </div>

            <div class="detail-item">
              <span>Term</span>

              <strong>
                {{ selected.term }}
                {{ selected.termUnit?.toLowerCase() }}(s)
              </strong>
            </div>

            <div class="detail-item">
              <span> Start date </span>

              <strong>
                {{ date(selected.startDate) }}
              </strong>
            </div>

            <div class="detail-item">
              <span> Maturity </span>

              <strong>
                {{ date(selected.maturityDate) }}
              </strong>
            </div>
          </div>

          <!-- Next installment -->
          <div
            v-if="nextInstallment"
            class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span
                  class="text-xs font-semibold uppercase tracking-wide text-amber-700"
                >
                  Next payment
                </span>

                <strong class="mt-1 block text-lg text-slate-900">
                  {{ currency(nextInstallment.remainingDue) }}
                </strong>
              </div>

              <div class="text-right">
                <span class="block text-xs text-slate-500"> Due date </span>

                <strong class="text-sm">
                  {{ date(nextInstallment.dueDate) }}
                </strong>
              </div>
            </div>
          </div>

          <!-- Installments -->
          <div class="mb-6">
            <h3 class="mb-3 font-bold text-slate-900">Installment schedule</h3>

            <DataTable
              :value="installments"
              striped-rows
              paginator
              :rows="6"
              responsive-layout="scroll"
            >
              <template #empty>
                <div class="empty-state">No installments.</div>
              </template>

              <Column field="installmentNumber" header="#" />

              <Column header="Due date">
                <template #body="{ data }">
                  {{ date(data.dueDate) }}
                </template>
              </Column>

              <Column header="Principal">
                <template #body="{ data }">
                  {{ currency(data.principalDue) }}
                </template>
              </Column>

              <Column header="Interest">
                <template #body="{ data }">
                  {{ currency(data.interestDue) }}
                </template>
              </Column>

              <Column header="Total">
                <template #body="{ data }">
                  <strong>
                    {{ currency(data.totalDue) }}
                  </strong>
                </template>
              </Column>

              <Column header="Paid">
                <template #body="{ data }">
                  {{ currency(data.totalPaid) }}
                </template>
              </Column>

              <Column header="Remaining">
                <template #body="{ data }">
                  {{ currency(data.remainingDue) }}
                </template>
              </Column>

              <Column header="Status">
                <template #body="{ data }">
                  <Tag
                    :value="data.status"
                    :severity="statusSeverity(data.status)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Transactions -->
          <div>
            <h3 class="mb-3 font-bold text-slate-900">Transactions</h3>

            <DataTable
              :value="transactions"
              striped-rows
              paginator
              :rows="5"
              responsive-layout="scroll"
            >
              <template #empty>
                <div class="empty-state">No transactions.</div>
              </template>

              <Column field="transactionNumber" header="Transaction" />

              <Column header="Type">
                <template #body="{ data }">
                  {{ data.transactionType?.replaceAll("_", " ") }}
                </template>
              </Column>

              <Column header="Amount">
                <template #body="{ data }">
                  <strong>
                    {{ currency(data.amount) }}
                  </strong>
                </template>
              </Column>

              <Column field="description" header="Description" />

              <Column header="Date">
                <template #body="{ data }">
                  {{ dateTime(data.transactionDate) }}
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </template>

      <template #footer>
        <Button
          label="Close"
          severity="secondary"
          text
          @click="detailVisible = false"
        />

        <Button
          v-if="auth.isAdmin && selected?.status === 'APPROVED'"
          label="Disburse loan"
          icon="pi pi-send"
          severity="success"
          :loading="disbursing"
          @click="disburseLoan"
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

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #ffffff;
}

.detail-item span {
  font-size: 0.75rem;
  color: #64748b;
}

.detail-item strong {
  font-size: 0.875rem;
  color: #0f172a;
}
</style>
