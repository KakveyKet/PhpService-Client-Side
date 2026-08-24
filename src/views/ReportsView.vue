<script setup>
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import DatePicker from "primevue/datepicker";
import Select from "primevue/select";
import Tag from "primevue/tag";
import PageHeader from "../components/PageHeader.vue";
import StatCard from "../components/StatCard.vue";
import api from "../services/api.js";
import {
  apiError,
  currency,
  date,
  dateTime,
  fullName,
  numberValue,
  statusSeverity,
} from "../utils/formatters.js";

const toast = useToast();

const loans = ref([]);
const repayments = ref([]);
const customers = ref([]);
const loading = ref(false);

const reportType = ref("LOAN_APPROVAL");
const filterCustomerId = ref(null);

const rowsPerPageOptions = [25, 50, 100];

const reportTypes = [
  {
    value: "LOAN_APPROVAL",
    label: "Loan approval report",
    icon: "pi pi-check-circle",
  },
  {
    value: "REPAYMENT",
    label: "Repayment report",
    icon: "pi pi-receipt",
  },
];

function defaultDateRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return [start, end];
}

const filterDateRange = ref(defaultDateRange());

const totalApprovedLoans = computed(() => loans.value.length);

const totalPrincipal = computed(() =>
  loans.value.reduce((sum, loan) => sum + numberValue(loan.principalAmount), 0),
);

const totalOutstanding = computed(() =>
  loans.value.reduce((sum, loan) => sum + numberValue(loan.balances?.total), 0),
);

const confirmedRepayments = computed(() =>
  repayments.value.filter((repayment) => repayment.status === "CONFIRMED"),
);

const totalCollected = computed(() =>
  confirmedRepayments.value.reduce(
    (sum, repayment) => sum + numberValue(repayment.amount),
    0,
  ),
);

const cashCollected = computed(() =>
  confirmedRepayments.value
    .filter((repayment) => repayment.paymentMethod === "CASH")
    .reduce((sum, repayment) => sum + numberValue(repayment.amount), 0),
);

const reversedAmount = computed(() =>
  repayments.value
    .filter((repayment) => repayment.status === "REVERSED")
    .reduce((sum, repayment) => sum + numberValue(repayment.amount), 0),
);

const reportTitle = computed(() =>
  reportType.value === "REPAYMENT"
    ? "Repayment report"
    : "Loan approval report",
);

function reportParams() {
  const params = {
    limit: 100,
  };

  const [selectedFrom, selectedTo] = filterDateRange.value || [];

  if (filterCustomerId.value) {
    params.customerId = filterCustomerId.value;
  }

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

async function load() {
  loading.value = true;

  try {
    const params = reportParams();

    const [loanResponse, repaymentResponse, customerResponse] =
      await Promise.all([
        api.get("/loans", { params }),
        api.get("/repayments", { params }),
        api.get("/customers", {
          params: {
            limit: 100,
          },
        }),
      ]);

    loans.value = loanResponse.data.items;
    repayments.value = repaymentResponse.data.items;
    customers.value = customerResponse.data.items;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load report",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filterCustomerId.value = null;
  filterDateRange.value = defaultDateRange();
  load();
}

function safeCsvDate(value, includeTime = false) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return includeTime ? parsed.toISOString() : parsed.toISOString().slice(0, 10);
}

function downloadCsv(header, rows, filename) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  const csv = [header, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], {
      type: "text/csv;charset=utf-8",
    }),
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function exportLoanApprovalCsv() {
  const header = [
    "Loan Number",
    "Customer",
    "Customer Code",
    "Product",
    "Approved Amount PHP",
    "Outstanding PHP",
    "Approved Date",
    "Maturity Date",
    "Status",
  ];

  const rows = loans.value.map((loan) => [
    loan.loanNumber,
    fullName(loan.customerId),
    loan.customerId?.customerCode,
    loan.productSnapshot?.name,
    numberValue(loan.principalAmount).toFixed(2),
    numberValue(loan.balances?.total).toFixed(2),
    safeCsvDate(loan.createdAt),
    safeCsvDate(loan.maturityDate),
    loan.status,
  ]);

  downloadCsv(
    header,
    rows,
    `loan-approval-report-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function exportRepaymentCsv() {
  const header = [
    "Receipt Number",
    "Customer",
    "Customer Code",
    "Loan Number",
    "Amount PHP",
    "Payment Method",
    "Reference",
    "Payment Date",
    "Received By",
    "Status",
  ];

  const rows = repayments.value.map((repayment) => [
    repayment.receiptNumber,
    fullName(repayment.customerId),
    repayment.customerId?.customerCode,
    repayment.loanId?.loanNumber,
    numberValue(repayment.amount).toFixed(2),
    repayment.paymentMethod,
    repayment.transactionReference,
    safeCsvDate(repayment.paymentDate, true),
    repayment.receivedBy?.displayName,
    repayment.status,
  ]);

  downloadCsv(
    header,
    rows,
    `repayment-report-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function exportCsv() {
  if (reportType.value === "REPAYMENT") {
    exportRepaymentCsv();
    return;
  }

  exportLoanApprovalCsv();
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Reports">
      <Button
        label="Export CSV"
        icon="pi pi-download"
        severity="secondary"
        outlined
        :disabled="
          reportType === 'REPAYMENT' ? !repayments.length : !loans.length
        "
        @click="exportCsv"
      />
    </PageHeader>

    <div class="mb-5 grid gap-3 sm:grid-cols-2">
      <button
        v-for="type in reportTypes"
        :key="type.value"
        type="button"
        class="flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition"
        :class="
          reportType === type.value
            ? 'border-emerald-500 ring-2 ring-emerald-100'
            : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
        "
        @click="reportType = type.value"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl"
          :class="
            reportType === type.value
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-100 text-emerald-700'
          "
        >
          <i :class="type.icon" />
        </span>

        <strong class="text-sm text-slate-900">
          {{ type.label }}
        </strong>

        <i
          v-if="reportType === type.value"
          class="pi pi-check-circle ml-auto text-emerald-600"
        />
      </button>
    </div>

    <section class="table-card mb-5">
      <div class="mb-4 px-5 pt-5">
        <h2 class="text-lg font-bold text-slate-900">
          {{ reportTitle }}
        </h2>
      </div>

      <div class="flex flex-wrap items-end gap-3 p-5 pt-0">
        <div class="min-w-[220px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Customer
          </label>

          <Select
            v-model="filterCustomerId"
            :options="customers"
            option-value="_id"
            filter
            show-clear
            fluid
            placeholder="All customers"
          >
            <template #option="{ option }">
              {{ fullName(option) }} — {{ option.customerCode }}
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

        <div class="min-w-[250px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            {{ reportType === "REPAYMENT" ? "Payment date" : "Approval date" }}
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
    </section>

    <template v-if="reportType === 'LOAN_APPROVAL'">
      <div class="stats-grid">
        <StatCard
          label="Approved loans"
          :value="totalApprovedLoans"
          icon="pi pi-check-circle"
          tone="blue"
        />

        <StatCard
          label="Approved principal"
          :value="currency(totalPrincipal)"
          icon="pi pi-wallet"
        />

        <StatCard
          label="Outstanding"
          :value="currency(totalOutstanding)"
          icon="pi pi-chart-line"
          tone="amber"
        />
      </div>

      <section class="table-card">
        <DataTable
          :value="loans"
          :loading="loading"
          striped-rows
          paginator
          :rows="25"
          :rows-per-page-options="rowsPerPageOptions"
          responsive-layout="scroll"
        >
          <template #empty>
            <div class="empty-state">
              <i class="pi pi-chart-bar" />
              No approved loans found for this date range.
            </div>
          </template>

          <Column field="loanNumber" header="Loan" sortable />

          <Column header="Customer">
            <template #body="{ data }">
              {{ fullName(data.customerId) }}

              <small class="table-subtext">
                {{ data.customerId?.customerCode }}
              </small>
            </template>
          </Column>

          <Column header="Product">
            <template #body="{ data }">
              {{ data.productSnapshot?.name }}
            </template>
          </Column>

          <Column header="Approved amount">
            <template #body="{ data }">
              {{ currency(data.principalAmount) }}
            </template>
          </Column>

          <Column header="Outstanding">
            <template #body="{ data }">
              <strong>
                {{ currency(data.balances?.total) }}
              </strong>
            </template>
          </Column>

          <Column header="Approved date">
            <template #body="{ data }">
              {{ date(data.createdAt) }}
            </template>
          </Column>

          <Column header="Maturity">
            <template #body="{ data }">
              {{ date(data.maturityDate) }}
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
      </section>
    </template>

    <template v-else>
      <div class="stats-grid">
        <StatCard
          label="Confirmed payments"
          :value="confirmedRepayments.length"
          icon="pi pi-check-circle"
          tone="blue"
        />

        <StatCard
          label="Total collected"
          :value="currency(totalCollected)"
          icon="pi pi-receipt"
        />

        <StatCard
          label="Cash collected"
          :value="currency(cashCollected)"
          icon="pi pi-money-bill"
          tone="amber"
        />

        <StatCard
          label="Reversed amount"
          :value="currency(reversedAmount)"
          icon="pi pi-undo"
          tone="rose"
        />
      </div>

      <section class="table-card">
        <DataTable
          :value="repayments"
          :loading="loading"
          striped-rows
          paginator
          :rows="25"
          :rows-per-page-options="rowsPerPageOptions"
          responsive-layout="scroll"
        >
          <template #empty>
            <div class="empty-state">
              <i class="pi pi-receipt" />
              No repayments found for this date range.
            </div>
          </template>

          <Column field="receiptNumber" header="Receipt" sortable />

          <Column header="Customer">
            <template #body="{ data }">
              {{ fullName(data.customerId) }}

              <small class="table-subtext">
                {{ data.customerId?.customerCode }}
              </small>
            </template>
          </Column>

          <Column header="Loan">
            <template #body="{ data }">
              {{ data.loanId?.loanNumber || "—" }}
            </template>
          </Column>

          <Column header="Amount">
            <template #body="{ data }">
              <strong>
                {{ currency(data.amount) }}
              </strong>
            </template>
          </Column>

          <Column field="paymentMethod" header="Method" />

          <Column header="Payment date">
            <template #body="{ data }">
              {{ dateTime(data.paymentDate) }}
            </template>
          </Column>

          <Column header="Received by">
            <template #body="{ data }">
              {{ data.receivedBy?.displayName || "—" }}
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
      </section>
    </template>
  </div>
</template>

<style scoped>
.table-subtext {
  display: block;
  margin-top: 0.15rem;
  color: #82919a;
}
</style>
