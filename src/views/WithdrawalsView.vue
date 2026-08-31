<script setup>
import { computed, onMounted, ref } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";

import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useRealtimeRefresh } from "../composables/useRealtimeRefresh.js";

import { apiError, currency, dateTime, fullName } from "../utils/formatters.js";

const toast = useToast();
const confirm = useConfirm();

/*
|--------------------------------------------------------------------------
| Data
|--------------------------------------------------------------------------
*/

const items = ref([]);
const customers = ref([]);

const loading = ref(false);

const reviewVisible = ref(false);
const selected = ref(null);

/*
|--------------------------------------------------------------------------
| Filters
|--------------------------------------------------------------------------
*/

const filterSearch = ref("");
const filterCustomerId = ref(null);

const customerOptions = computed(() => {
  return customers.value.map((customer) => ({
    ...customer,

    searchLabel: [fullName(customer), customer.customerCode, customer.phone]
      .filter(Boolean)
      .join(" — "),
  }));
});

const filteredItems = computed(() => {
  const query = filterSearch.value.trim().toLowerCase();

  return items.value.filter((item) => {
    /*
    |--------------------------------------------------------------------------
    | Exact customer filter
    |--------------------------------------------------------------------------
    */

    if (
      filterCustomerId.value &&
      item.customerId?._id !== filterCustomerId.value
    ) {
      return false;
    }

    /*
    |--------------------------------------------------------------------------
    | Text search
    |--------------------------------------------------------------------------
    */

    if (!query) {
      return true;
    }

    const searchableValues = [
      item.withdrawalNumber,

      fullName(item.customerId),

      item.customerId?.customerCode,

      item.customerId?.phone,

      item.loanId?.loanNumber,

      item.requestedBank?.bankName,

      item.requestedBank?.bankAccountNumber,

      item.status,
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
| Review state
|--------------------------------------------------------------------------
*/

const otpLength = ref(6);
const reviewNote = ref("");
const rejectionReason = ref("");

const generating = ref(false);
const rejecting = ref(false);
const approving = ref(false);

const generatedOtp = ref("");
const generatedOtpExpiresAt = ref(null);

/*
|--------------------------------------------------------------------------
| Options
|--------------------------------------------------------------------------
*/

const otpLengthOptions = [
  {
    label: "6 digits",
    value: 6,
  },
  {
    label: "8 digits",
    value: 8,
  },
];

const rejectionReasonOptions = [
  "WITHDRAWAL WRONG AMOUNT",
  "WRONG BANK ACCOUNT",
  "LOW CREDIT",
  "WRONG INFORMATION",
  "INSURANCE",
  "PLATEFORM FEE",
  "VIP CHANNEL",
  "NEW DOCUMENT AND NEW OTP CODE",
  "FREEZE LOAN ACCOUNT",
  "INLAND REVENUE TAX",
  "NEED NEW OTP CODE",
];

/*
|--------------------------------------------------------------------------
| Status helpers
|--------------------------------------------------------------------------
*/

function statusLabel(status) {
  return status?.replaceAll("_", " ") || "UNKNOWN";
}

function statusSeverity(status) {
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

function isOpen(item) {
  return [
    "PENDING_REVIEW",
    "WAITING_FOR_OTP",
    "OTP_REQUIRED",
    "OTP_VERIFIED",
  ].includes(item?.status);
}

function canGenerateOtp(item) {
  return ["PENDING_REVIEW", "WAITING_FOR_OTP", "OTP_REQUIRED"].includes(
    item?.status,
  );
}

function canApprove(item) {
  return item?.status === "OTP_VERIFIED";
}

function canReject(item) {
  return isOpen(item);
}

/*
|--------------------------------------------------------------------------
| Load
|--------------------------------------------------------------------------
*/

async function load() {
  loading.value = true;

  try {
    const params = {
      limit: 100,
    };

    /*
    |--------------------------------------------------------------------------
    | Send customerId too
    |--------------------------------------------------------------------------
    |
    | If your withdrawal backend already supports it,
    | filtering happens server-side.
    |
    | filteredItems still checks customerId client-side.
    |
    */

    if (filterCustomerId.value) {
      params.customerId = filterCustomerId.value;
    }

    const [withdrawalResponse, customerResponse] = await Promise.all([
      api.get("/withdrawals", {
        params,
      }),

      api.get("/customers", {
        params: {
          limit: 100,
        },
      }),
    ]);

    items.value = withdrawalResponse.data.items || [];

    customers.value = customerResponse.data.items || [];

    /*
    |--------------------------------------------------------------------------
    | Refresh currently opened item
    |--------------------------------------------------------------------------
    */

    if (selected.value) {
      const refreshed = items.value.find(
        (item) => item._id === selected.value._id,
      );

      if (refreshed) {
        selected.value = refreshed;

        if (refreshed.status === "OTP_VERIFIED") {
          generatedOtp.value = "";

          generatedOtpExpiresAt.value = null;
        }
      }
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load withdrawals",
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

  load();
}

/*
|--------------------------------------------------------------------------
| Review
|--------------------------------------------------------------------------
*/

function openReview(item) {
  selected.value = item;

  otpLength.value = item.otpLength || 6;

  reviewNote.value = item.reviewNote || "";

  rejectionReason.value = "";

  generatedOtp.value = "";

  generatedOtpExpiresAt.value = null;

  reviewVisible.value = true;
}

/*
|--------------------------------------------------------------------------
| OTP
|--------------------------------------------------------------------------
*/

async function generateOtp() {
  if (!selected.value) return;

  generating.value = true;

  try {
    const { data } = await api.post(
      `/withdrawals/${selected.value._id}/generate-otp`,
      {
        length: otpLength.value,
        note: reviewNote.value,
      },
    );

    selected.value = data.item;

    generatedOtp.value = data.otp;

    generatedOtpExpiresAt.value = data.expiresAt;

    toast.add({
      severity: "success",
      summary: "OTP generated",
      detail: "Copy the code now and provide it to the customer securely.",
      life: 4000,
    });

    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot generate OTP",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    generating.value = false;
  }
}

async function copyOtp() {
  if (!generatedOtp.value) return;

  try {
    await navigator.clipboard.writeText(generatedOtp.value);

    toast.add({
      severity: "success",
      summary: "OTP copied",
      life: 2000,
    });
  } catch {
    toast.add({
      severity: "warn",
      summary: "Copy unavailable",
      detail: "Select and copy the OTP manually.",
      life: 3000,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Reject
|--------------------------------------------------------------------------
*/

async function rejectWithdrawal() {
  if (!selected.value) return;

  if (!rejectionReason.value.trim()) {
    toast.add({
      severity: "warn",
      summary: "Reason required",
      detail: "Select why the withdrawal is rejected.",
      life: 3000,
    });

    return;
  }

  rejecting.value = true;

  try {
    await api.post(`/withdrawals/${selected.value._id}/reject`, {
      reason: rejectionReason.value.trim(),
    });

    reviewVisible.value = false;

    toast.add({
      severity: "success",
      summary: "Withdrawal rejected",
      life: 2500,
    });

    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot reject withdrawal",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    rejecting.value = false;
  }
}

/*
|--------------------------------------------------------------------------
| Approve
|--------------------------------------------------------------------------
*/

async function approveWithdrawal() {
  if (!selected.value) return;

  approving.value = true;

  try {
    await api.post(`/withdrawals/${selected.value._id}/approve`, {
      note: reviewNote.value,
    });

    reviewVisible.value = false;

    toast.add({
      severity: "success",
      summary: "Withdrawal approved",
      detail: "The withdrawal transaction has been completed.",
      life: 3500,
    });

    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot approve withdrawal",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    approving.value = false;
  }
}

function confirmApproval() {
  if (!selected.value) return;

  confirm.require({
    header: "Approve withdrawal",

    message:
      `Approve ${selected.value.withdrawalNumber} ` +
      `for ${currency(selected.value.amount)}? ` +
      `This creates the withdrawal transaction and releases the reserved funds.`,

    icon: "pi pi-check-circle",

    acceptLabel: "Approve withdrawal",

    rejectLabel: "Cancel",

    accept: approveWithdrawal,
  });
}

/*
|--------------------------------------------------------------------------
| Realtime
|--------------------------------------------------------------------------
*/

useRealtimeRefresh(["withdrawals"], load);

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      title="Withdrawals"
      subtitle="Review withdrawal requests, issue secure one-time passwords and approve verified requests."
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
      The destination bank details are copied from the customer's loan
      application. Review them before generating an OTP, and reject the request
      if the saved information is not valid.
    </Message>

    <section class="table-card">
      <!-- Filters -->
      <div
        class="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5"
      >
        <!-- Search -->
        <div class="min-w-[220px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Search customer
          </label>

          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />

            <InputText
              v-model="filterSearch"
              fluid
              placeholder="Name, code, phone, withdrawal..."
            />
          </span>
        </div>

        <!-- Customer -->
        <div class="min-w-[240px] flex-1">
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
                    — {{ option.phone }}
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

      <!-- Table -->
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
            <i class="pi pi-money-bill" />

            No withdrawal requests found.
          </div>
        </template>

        <Column field="withdrawalNumber" header="Withdrawal" sortable>
          <template #body="{ data }">
            <strong>
              {{ data.withdrawalNumber }}
            </strong>

            <small class="table-subtext">
              {{ dateTime(data.createdAt) }}
            </small>
          </template>
        </Column>

        <Column header="Customer">
          <template #body="{ data }">
            <strong class="block">
              {{ fullName(data.customerId) }}
            </strong>

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

        <Column header="Destination bank">
          <template #body="{ data }">
            <div>
              <strong class="block text-sm">
                {{ data.requestedBank?.bankName || "—" }}
              </strong>

              <small class="table-subtext">
                {{ data.requestedBank?.bankAccountNumber || "—" }}
              </small>
            </div>
          </template>
        </Column>

        <Column header="Status">
          <template #body="{ data }">
            <Tag
              :value="statusLabel(data.status)"
              :severity="statusSeverity(data.status)"
            />
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

    <!-- Review dialog -->
    <Dialog
      v-model:visible="reviewVisible"
      modal
      :header="selected?.withdrawalNumber || 'Withdrawal review'"
      :style="{
        width: '760px',
        maxWidth: '96vw',
      }"
      @hide="generatedOtp = ''"
    >
      <template v-if="selected">
        <div class="mb-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500"> Customer </span>

            <strong class="mt-1 block text-sm text-slate-900">
              {{ fullName(selected.customerId) }}
            </strong>

            <small class="mt-1 block text-xs text-slate-500">
              {{ selected.customerId?.customerCode }}
            </small>
          </div>

          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500"> Amount </span>

            <strong class="mt-1 block text-sm text-slate-900">
              {{ currency(selected.amount) }}
            </strong>
          </div>

          <div class="rounded-xl bg-slate-50 p-3">
            <span class="block text-xs text-slate-500"> Status </span>

            <Tag
              class="mt-1"
              :value="statusLabel(selected.status)"
              :severity="statusSeverity(selected.status)"
            />
          </div>
        </div>

        <h3 class="mb-3 font-bold text-slate-900">
          Destination from loan application
        </h3>

        <div class="overflow-hidden rounded-xl border border-slate-200">
          <div
            class="grid grid-cols-[120px_1fr] gap-3 bg-slate-50 p-3 text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            <span>Field</span>
            <span> Saved information </span>
          </div>

          <div
            class="grid grid-cols-[120px_1fr] gap-3 border-t border-slate-100 p-3 text-sm"
          >
            <strong> Bank name </strong>

            <span class="break-words">
              {{ selected.requestedBank?.bankName || "—" }}
            </span>
          </div>

          <div
            class="grid grid-cols-[120px_1fr] gap-3 border-t border-slate-100 p-3 text-sm"
          >
            <strong> Account </strong>

            <span class="break-all">
              {{ selected.requestedBank?.bankAccountNumber || "—" }}
            </span>
          </div>
        </div>

        <Message
          v-if="generatedOtp"
          class="mt-5"
          severity="success"
          :closable="false"
        >
          <div>
            <strong class="block">
              Provide this OTP to the customer now
            </strong>

            <div class="mt-3 flex items-center gap-3">
              <code
                class="rounded-lg bg-white px-4 py-2 text-2xl font-bold tracking-[0.25em] text-emerald-800"
              >
                {{ generatedOtp }}
              </code>

              <Button
                label="Copy"
                icon="pi pi-copy"
                size="small"
                @click="copyOtp"
              />
            </div>

            <small class="mt-2 block">
              Expires
              {{ dateTime(generatedOtpExpiresAt) }}.
            </small>
          </div>
        </Message>

        <template v-if="isOpen(selected)">
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div v-if="canGenerateOtp(selected)" class="form-field">
              <label> OTP length </label>

              <Select
                v-model="otpLength"
                :options="otpLengthOptions"
                option-label="label"
                option-value="value"
                fluid
              />
            </div>

            <div
              class="form-field"
              :class="{
                'sm:col-span-2': !canGenerateOtp(selected),
              }"
            >
              <label> Review note </label>

              <Textarea v-model="reviewNote" rows="2" maxlength="500" />
            </div>
          </div>

          <div
            v-if="canReject(selected)"
            class="mt-5 rounded-xl border border-red-100 bg-red-50 p-4"
          >
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
      </template>

      <template #footer>
        <Button
          label="Close"
          severity="secondary"
          text
          @click="reviewVisible = false"
        />

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
          v-if="canApprove(selected)"
          label="Approve withdrawal"
          icon="pi pi-check"
          severity="success"
          :loading="approving"
          @click="confirmApproval"
        />

        <Button
          v-if="canGenerateOtp(selected)"
          :label="
            ['WAITING_FOR_OTP', 'OTP_REQUIRED'].includes(selected?.status)
              ? 'Generate new OTP'
              : 'Generate OTP'
          "
          icon="pi pi-key"
          :loading="generating"
          @click="generateOtp"
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
