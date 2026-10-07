<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";
import { useRealtimeRefresh } from "../composables/useRealtimeRefresh.js";
import {
  apiError,
  currency,
  dateTime,
  statusSeverity,
} from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();

const items = ref([]);
const loading = ref(false);
const search = ref("");

const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const resetPasswordDialogVisible = ref(false);
const depositDialogVisible = ref(false);
const creditDialogVisible = ref(false);

const saving = ref(false);
const deleting = ref(false);
const resettingPassword = ref(false);
const loadingIdentityImages = ref(false);
const loadingDepositWallet = ref(false);
const savingDeposit = ref(false);
const savingCredit = ref(false);

const editingId = ref(null);
const customerToDelete = ref(null);
const customerForPasswordReset = ref(null);
const customerForDeposit = ref(null);
const customerForCredit = ref(null);
const depositWallet = ref({ availableBalance: 0 });
const depositTransactions = ref([]);
const identityFiles = reactive({
  frontIdCard: null,
  backIdCard: null,
  selfieWithId: null,
});
const identityPreviewUrls = reactive({
  frontIdCard: "",
  backIdCard: "",
  selfieWithId: "",
});
const savedIdentityUrls = reactive({
  frontIdCard: "",
  backIdCard: "",
  selfieWithId: "",
});

const emptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  bankName: "",
  bankNumber: "",
  nationalId: "",
  gender: null,
  dateOfBirth: null,
  occupation: "",
  monthlyIncome: 0,
  status: "ACTIVE",
  identityVerificationStatus: "NOT_SUBMITTED",
  identityVerificationNote: "",
  address: {
    street: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
  },
});

const emptyPasswordForm = () => ({
  newPassword: "",
  confirmPassword: "",
});

const form = reactive(emptyForm());
const passwordForm = reactive(emptyPasswordForm());
const depositForm = reactive({
  operation: "ADD",
  amount: null,
  reference: "",
  reason: "",
  requestKey: "",
});
const creditForm = reactive({
  operation: "ADD",
  points: null,
  reason: "",
});
const balanceOperationOptions = [
  { label: "Add money", value: "ADD" },
  { label: "Subtract money", value: "SUBTRACT" },
];
const creditOperationOptions = [
  { label: "Add credit points", value: "ADD" },
  { label: "Subtract credit points", value: "SUBTRACT" },
];

const currentCreditScore = computed(() => {
  return Number(customerForCredit.value?.creditScore || 0);
});

const creditScoreAfterAdjustment = computed(() => {
  const points = Number(creditForm.points || 0);
  const validPoints = Number.isFinite(points) ? points : 0;
  return creditForm.operation === "ADD"
    ? currentCreditScore.value + validPoints
    : currentCreditScore.value - validPoints;
});

const balanceAfterAdjustment = computed(() => {
  const current = Number(depositWallet.value?.availableBalance || 0);
  const amount = Number(depositForm.amount || 0);
  return depositForm.operation === "ADD"
    ? current + amount
    : current - amount;
});

function newRequestKey() {
  return globalThis.crypto?.randomUUID?.() ||
    `wallet-adjustment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function customerUserId(customer) {
  if (!customer?.userId) return null;
  return typeof customer.userId === "object"
    ? customer.userId._id || customer.userId.id
    : customer.userId;
}

function customerName(customer) {
  if (!customer) return "Customer";

  const legacyName = [
    customer.firstName,
    customer.middleName,
    customer.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return customer.name || legacyName || customer.phone || "Customer";
}

function identitySeverity(status) {
  return {
    VERIFIED: "success",
    PENDING: "warn",
    REJECTED: "danger",
    NOT_SUBMITTED: "secondary",
  }[status] || "secondary";
}

function clearIdentityImages() {
  for (const field of ["frontIdCard", "backIdCard", "selfieWithId"]) {
    if (identityPreviewUrls[field]) {
      URL.revokeObjectURL(identityPreviewUrls[field]);
    }

    identityFiles[field] = null;
    identityPreviewUrls[field] = "";
    savedIdentityUrls[field] = "";
  }
}

function selectIdentityImage(event, field) {
  const file = event.target.files?.[0] || null;

  if (!file) {
    identityFiles[field] = null;
    identityPreviewUrls[field] = "";
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    event.target.value = "";
    toast.add({
      severity: "warn",
      summary: "Image is too large",
      detail: "Each identity image must not exceed 8 MB.",
      life: 3500,
    });
    return;
  }

  if (identityPreviewUrls[field]) {
    URL.revokeObjectURL(identityPreviewUrls[field]);
  }

  identityFiles[field] = file;
  identityPreviewUrls[field] = URL.createObjectURL(file);
}

async function loadSavedIdentityImages(customer) {
  for (const field of ["frontIdCard", "backIdCard", "selfieWithId"]) {
    savedIdentityUrls[field] = "";
  }

  const hasIdentityImage = [
    customer?.frontIdCard?.publicId,
    customer?.backIdCard?.publicId,
    customer?.selfieWithId?.publicId,
  ].some(Boolean);

  if (!hasIdentityImage) return;

  loadingIdentityImages.value = true;

  try {
    const { data } = await api.get(
      `/customers/${customer._id}/identity-images`,
    );
    Object.assign(savedIdentityUrls, data.images || {});
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load identity images",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loadingIdentityImages.value = false;
  }
}

async function load() {
  loading.value = true;

  try {
    const { data } = await api.get("/customers", {
      params: {
        q: search.value.trim(),
        limit: 100,
      },
    });

    items.value = data.items || [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load customers",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  clearIdentityImages();
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

async function openEdit(customer) {
  editingId.value = customer._id;
  clearIdentityImages();

  Object.assign(form, {
    name: customerName(customer),
    phone: customer.phone || "",
    email: customer.email || "",
    bankName: customer.bankName || "",
    bankNumber: customer.bankNumber || "",
    nationalId: customer.nationalId || "",
    gender: customer.gender || null,
    dateOfBirth: customer.dateOfBirth
      ? String(customer.dateOfBirth).slice(0, 10)
      : null,
    occupation: customer.occupation || "",
    monthlyIncome: Number(
      customer.monthlyIncome?.$numberDecimal || customer.monthlyIncome || 0,
    ),
    status: customer.status || "ACTIVE",
    identityVerificationStatus:
      customer.identityVerificationStatus || "NOT_SUBMITTED",
    identityVerificationNote: customer.identityVerificationNote || "",
    address: {
      ...emptyForm().address,
      ...customer.address,
    },
  });

  dialogVisible.value = true;
  await loadSavedIdentityImages(customer);
}

function closeCustomerDialog() {
  dialogVisible.value = false;
  editingId.value = null;
  clearIdentityImages();
  Object.assign(form, emptyForm());
}

async function uploadIdentityImages(customerId) {
  const selectedFields = ["frontIdCard", "backIdCard", "selfieWithId"].filter(
    (field) => identityFiles[field],
  );

  if (!selectedFields.length) return;

  const uploadData = new FormData();
  for (const field of selectedFields) {
    uploadData.append(field, identityFiles[field]);
  }

  await api.post(`/customers/${customerId}/identity-images`, uploadData);
}

async function save() {
  saving.value = true;

  try {
    let savedCustomer;

    if (editingId.value) {
      const { data } = await api.patch(`/customers/${editingId.value}`, form);
      savedCustomer = data.item;
    } else {
      const { data } = await api.post("/customers", form);
      savedCustomer = data.item;
    }

    await uploadIdentityImages(savedCustomer?._id || editingId.value);

    toast.add({
      severity: "success",
      summary: editingId.value ? "Customer updated" : "Customer created",
      life: 2500,
    });

    closeCustomerDialog();
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Save failed",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    saving.value = false;
  }
}

function openDelete(customer) {
  customerToDelete.value = customer;
  deleteDialogVisible.value = true;
}

function closeDeleteDialog() {
  if (deleting.value) return;
  deleteDialogVisible.value = false;
  customerToDelete.value = null;
}

async function removeCustomer() {
  if (!customerToDelete.value?._id) return;

  deleting.value = true;

  try {
    const { data } = await api.delete(
      `/customers/${customerToDelete.value._id}`,
    );

    toast.add({
      severity: "success",
      summary: "Customer permanently deleted",
      detail: data.message,
      life: 3500,
    });

    deleteDialogVisible.value = false;
    customerToDelete.value = null;
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Delete failed",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    deleting.value = false;
  }
}

function openResetPassword(customer) {
  if (!customerUserId(customer)) {
    toast.add({
      severity: "warn",
      summary: "No login account",
      detail: "This customer does not have a linked user account.",
      life: 3500,
    });
    return;
  }

  customerForPasswordReset.value = customer;
  Object.assign(passwordForm, emptyPasswordForm());
  resetPasswordDialogVisible.value = true;
}

function closeResetPasswordDialog() {
  if (resettingPassword.value) return;
  resetPasswordDialogVisible.value = false;
  customerForPasswordReset.value = null;
  Object.assign(passwordForm, emptyPasswordForm());
}

async function resetCustomerPassword() {
  const userId = customerUserId(customerForPasswordReset.value);

  if (!userId) {
    toast.add({
      severity: "error",
      summary: "Reset failed",
      detail: "The customer login account could not be found.",
      life: 4000,
    });
    return;
  }

  if (passwordForm.newPassword.length < 8) {
    toast.add({
      severity: "warn",
      summary: "Password is too short",
      detail: "The new password must contain at least 8 characters.",
      life: 3500,
    });
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.add({
      severity: "warn",
      summary: "Passwords do not match",
      detail: "New password and confirmation must be the same.",
      life: 3500,
    });
    return;
  }

  resettingPassword.value = true;

  try {
    await api.patch(`/users/${userId}/reset-password`, {
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    });

    toast.add({
      severity: "success",
      summary: "Password reset",
      detail: `The password for ${customerName(customerForPasswordReset.value)} was updated.`,
      life: 3000,
    });

    resetPasswordDialogVisible.value = false;
    customerForPasswordReset.value = null;
    Object.assign(passwordForm, emptyPasswordForm());
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Password reset failed",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    resettingPassword.value = false;
  }
}

async function openCustomerDeposit(customer) {
  customerForDeposit.value = customer;
  Object.assign(depositForm, {
    operation: "ADD",
    amount: null,
    reference: "",
    reason: "",
    requestKey: newRequestKey(),
  });
  depositWallet.value = { availableBalance: 0 };
  depositTransactions.value = [];
  depositDialogVisible.value = true;
  loadingDepositWallet.value = true;

  try {
    const { data } = await api.get(`/customers/${customer._id}/wallet`, {
      params: { limit: 10 },
    });
    depositWallet.value = data.wallet || { availableBalance: 0 };
    depositTransactions.value = data.transactions || [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load customer balance",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loadingDepositWallet.value = false;
  }
}

function closeDepositDialog() {
  if (savingDeposit.value) return;
  depositDialogVisible.value = false;
  customerForDeposit.value = null;
  depositWallet.value = { availableBalance: 0 };
  depositTransactions.value = [];
  Object.assign(depositForm, {
    operation: "ADD",
    amount: null,
    reference: "",
    reason: "",
    requestKey: "",
  });
}

async function adjustCustomerBalance() {
  if (!customerForDeposit.value?._id) return;

  const amount = Number(depositForm.amount);
  const operation = depositForm.operation === "SUBTRACT" ? "SUBTRACT" : "ADD";

  if (!Number.isFinite(amount) || amount <= 0) {
    toast.add({
      severity: "warn",
      summary: "Valid amount required",
      detail: "Enter a money amount greater than zero.",
      life: 3000,
    });
    return;
  }

  if (
    operation === "SUBTRACT" &&
    amount > Number(depositWallet.value?.availableBalance || 0)
  ) {
    toast.add({
      severity: "warn",
      summary: "Insufficient balance",
      detail: "The subtraction cannot make the customer balance go below zero.",
      life: 3500,
    });
    return;
  }

  savingDeposit.value = true;

  try {
    const { data } = await api.post(
      `/customers/${customerForDeposit.value._id}/wallet-adjustments`,
      {
        operation,
        amount,
        reference: String(depositForm.reference || "").trim(),
        reason: String(depositForm.reason || "").trim(),
        requestKey: depositForm.requestKey || newRequestKey(),
      },
    );

    depositWallet.value = data.wallet || depositWallet.value;
    toast.add({
      severity: "success",
      summary: data.duplicate
        ? "Adjustment already recorded"
        : "Balance adjusted",
      detail: `${currency(amount)} was ${
        operation === "ADD" ? "added" : "subtracted"
      }. New balance: ${currency(data.wallet?.availableBalance)}.`,
      life: 3500,
    });
    depositDialogVisible.value = false;
    customerForDeposit.value = null;
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot adjust balance",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    savingDeposit.value = false;
  }
}

function openCreditAdjustment(customer) {
  customerForCredit.value = customer;
  Object.assign(creditForm, {
    operation: "ADD",
    points: null,
    reason: "",
  });
  creditDialogVisible.value = true;
}

function closeCreditDialog() {
  if (savingCredit.value) return;
  creditDialogVisible.value = false;
  customerForCredit.value = null;
  Object.assign(creditForm, {
    operation: "ADD",
    points: null,
    reason: "",
  });
}

async function adjustCustomerCredit() {
  if (!customerForCredit.value?._id) return;

  const points = Number(creditForm.points);
  const operation = creditForm.operation === "SUBTRACT" ? "SUBTRACT" : "ADD";

  if (!Number.isInteger(points) || points <= 0) {
    toast.add({
      severity: "warn",
      summary: "Valid points required",
      detail: "Enter whole-number credit points greater than zero.",
      life: 3000,
    });
    return;
  }

  if (operation === "SUBTRACT" && points > currentCreditScore.value) {
    toast.add({
      severity: "warn",
      summary: "Insufficient credit",
      detail: "The subtraction cannot make the customer credit go below zero.",
      life: 3500,
    });
    return;
  }

  savingCredit.value = true;

  try {
    const { data } = await api.patch(
      `/customers/${customerForCredit.value._id}/credit`,
      {
        points,
        operation,
        reason: String(creditForm.reason || "").trim(),
      },
    );

    const newCreditScore = Number(
      data.newCreditScore ?? creditScoreAfterAdjustment.value,
    );

    toast.add({
      severity: "success",
      summary: "Credit score adjusted",
      detail: `${points} points were ${
        operation === "ADD" ? "added" : "subtracted"
      }. New credit: ${newCreditScore}.`,
      life: 3500,
    });

    creditDialogVisible.value = false;
    customerForCredit.value = null;
    Object.assign(creditForm, {
      operation: "ADD",
      points: null,
      reason: "",
    });
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot adjust customer credit",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    savingCredit.value = false;
  }
}

useRealtimeRefresh(["customers", "customer-wallets"], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Customers">
      <Button
        v-if="auth.isAdmin"
        label="Add customer"
        icon="pi pi-plus"
        @click="openCreate"
      />
    </PageHeader>

    <section class="table-card">
      <div class="table-toolbar">
        <div class="search-field">
          <i class="pi pi-search" />
          <InputText
            v-model="search"
            placeholder="Search customers"
            @keyup.enter="load"
          />
        </div>

        <Button
          label="Search"
          icon="pi pi-search"
          severity="secondary"
          outlined
          @click="load"
        />
      </div>

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
            <i class="pi pi-users" />
            No customers found.
          </div>
        </template>

        <Column field="customerCode" header="Customer ID" sortable />

        <Column header="Name" sortable>
          <template #body="{ data }">
            <strong>{{ customerName(data) }}</strong>
          </template>
        </Column>

        <Column field="phone" header="Phone" />
        <Column field="occupation" header="Occupation" />

        <Column header="Monthly income">
          <template #body="{ data }">
            {{ currency(data.monthlyIncome) }}
          </template>
        </Column>

        <Column header="Credit">
          <template #body="{ data }">
            <strong>{{ Number(data.creditScore || 0) }}</strong>
          </template>
        </Column>

        <Column header="Login">
          <template #body="{ data }">
            {{ data.userId?.username || (data.userId ? "Linked account" : "No account") }}
          </template>
        </Column>

        <Column header="Identity">
          <template #body="{ data }">
            <Tag
              :value="data.identityVerificationStatus || 'NOT_SUBMITTED'"
              :severity="identitySeverity(data.identityVerificationStatus)"
            />
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

        <Column header="Actions">
          <template #body="{ data }">
            <div class="flex flex-wrap justify-end gap-1">
              <Button
                v-if="auth.isAdmin"
                label="Adjust credit"
                icon="pi pi-star"
                severity="warn"
                size="small"
                outlined
                aria-label="Adjust customer credit score"
                @click="openCreditAdjustment(data)"
              />

              <Button
                v-if="auth.isAdmin"
                label="Adjust money"
                icon="pi pi-wallet"
                severity="success"
                size="small"
                outlined
                aria-label="Adjust customer available balance"
                @click="openCustomerDeposit(data)"
              />

              <Button
                v-if="auth.isAdmin"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit customer"
                @click="openEdit(data)"
              />

              <Button
                v-if="auth.isAdmin"
                icon="pi pi-key"
                severity="warn"
                text
                rounded
                aria-label="Reset customer password"
                :disabled="!customerUserId(data)"
                @click="openResetPassword(data)"
              />

              <Button
                v-if="auth.isAdmin"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Delete customer"
                @click="openDelete(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="editingId ? 'Edit customer' : 'Add customer'"
      :style="{ width: '760px', maxWidth: '95vw' }"
      @hide="closeCustomerDialog"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label for="customerName">Name *</label>
            <InputText
              id="customerName"
              v-model.trim="form.name"
              placeholder="Enter the customer's full name"
              required
            />
          </div>

          <div class="form-field">
            <label for="customerGender">Gender</label>
            <Select
              id="customerGender"
              v-model="form.gender"
              :options="['MALE', 'FEMALE', 'OTHER']"
              placeholder="Select gender"
            />
          </div>

          <div class="form-field">
            <label for="customerDateOfBirth">Date of birth</label>
            <InputText
              id="customerDateOfBirth"
              v-model="form.dateOfBirth"
              type="date"
            />
          </div>

          <div class="form-field">
            <label for="customerPhone">Phone *</label>
            <InputText
              id="customerPhone"
              v-model.trim="form.phone"
              autocomplete="tel"
              required
            />
          </div>

          <div class="form-field">
            <label for="customerEmail">Email</label>
            <InputText
              id="customerEmail"
              v-model.trim="form.email"
              type="email"
              autocomplete="email"
            />
          </div>

          <div class="form-field">
            <label for="customerNationalId">National ID</label>
            <InputText
              id="customerNationalId"
              v-model.trim="form.nationalId"
            />
          </div>

          <div class="form-field">
            <label for="customerBankName">Bank name</label>
            <InputText
              id="customerBankName"
              v-model.trim="form.bankName"
              placeholder="Enter bank or e-wallet name"
            />
          </div>

          <div class="form-field">
            <label for="customerBankNumber">Bank account number</label>
            <InputText
              id="customerBankNumber"
              v-model.trim="form.bankNumber"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Enter account number"
            />
          </div>

          <div class="form-field">
            <label for="customerOccupation">Occupation</label>
            <InputText
              id="customerOccupation"
              v-model.trim="form.occupation"
            />
          </div>

          <div class="form-field">
            <label for="customerMonthlyIncome">Monthly income</label>
            <InputNumber
              input-id="customerMonthlyIncome"
              v-model="form.monthlyIncome"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
            />
          </div>

          <div class="form-field">
            <label for="customerStatus">Status</label>
            <Select
              id="customerStatus"
              v-model="form.status"
              :options="['ACTIVE', 'INACTIVE', 'BLACKLISTED']"
            />
          </div>

          <div class="form-field form-field--full">
            <label for="customerStreet">Street</label>
            <InputText
              id="customerStreet"
              v-model.trim="form.address.street"
            />
          </div>

          <div class="form-field">
            <label for="customerBarangay">Barangay</label>
            <InputText
              id="customerBarangay"
              v-model.trim="form.address.barangay"
            />
          </div>

          <div class="form-field">
            <label for="customerCity">City</label>
            <InputText
              id="customerCity"
              v-model.trim="form.address.city"
            />
          </div>

          <div class="form-field">
            <label for="customerProvince">Province</label>
            <InputText
              id="customerProvince"
              v-model.trim="form.address.province"
            />
          </div>

          <div class="form-field">
            <label for="customerPostalCode">Postal code</label>
            <InputText
              id="customerPostalCode"
              v-model.trim="form.address.postalCode"
            />
          </div>

          <div class="form-field">
            <label for="customerFrontIdCard">ID card — front</label>
            <input
              id="customerFrontIdCard"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-700"
              @change="selectIdentityImage($event, 'frontIdCard')"
            />
            <img
              v-if="identityPreviewUrls.frontIdCard || savedIdentityUrls.frontIdCard"
              :src="identityPreviewUrls.frontIdCard || savedIdentityUrls.frontIdCard"
              alt="Front of customer ID card"
              class="mt-3 h-44 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          </div>

          <div class="form-field">
            <label for="customerBackIdCard">ID card — back</label>
            <input
              id="customerBackIdCard"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-700"
              @change="selectIdentityImage($event, 'backIdCard')"
            />
            <img
              v-if="identityPreviewUrls.backIdCard || savedIdentityUrls.backIdCard"
              :src="identityPreviewUrls.backIdCard || savedIdentityUrls.backIdCard"
              alt="Back of customer ID card"
              class="mt-3 h-44 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          </div>

          <div class="form-field form-field--full">
            <label for="customerSelfieWithId">Selfie holding the ID card</label>
            <input
              id="customerSelfieWithId"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-700"
              @change="selectIdentityImage($event, 'selfieWithId')"
            />
            <small class="text-slate-500">
              JPG, PNG or WEBP. Maximum 8 MB per image. Images are stored privately.
            </small>
            <img
              v-if="identityPreviewUrls.selfieWithId || savedIdentityUrls.selfieWithId"
              :src="identityPreviewUrls.selfieWithId || savedIdentityUrls.selfieWithId"
              alt="Customer selfie holding ID card"
              class="mt-3 max-h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          </div>

          <div
            v-if="loadingIdentityImages"
            class="form-field form-field--full text-sm text-slate-500"
          >
            Loading saved identity images...
          </div>

          <template
            v-if="
              editingId &&
              (savedIdentityUrls.frontIdCard ||
                savedIdentityUrls.backIdCard ||
                savedIdentityUrls.selfieWithId)
            "
          >
            <div class="form-field">
              <label for="identityVerificationStatus">
                Identity verification
              </label>
              <Select
                id="identityVerificationStatus"
                v-model="form.identityVerificationStatus"
                :options="['PENDING', 'VERIFIED', 'REJECTED']"
              />
            </div>

            <div class="form-field">
              <label for="identityVerificationNote">Verification note</label>
              <InputText
                id="identityVerificationNote"
                v-model.trim="form.identityVerificationNote"
                maxlength="500"
              />
            </div>
          </template>
        </div>

        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            @click="closeCustomerDialog"
          />
          <Button type="submit" label="Save customer" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="creditDialogVisible"
      modal
      header="Adjust customer credit score"
      :style="{ width: '520px', maxWidth: '95vw' }"
      :closable="!savingCredit"
      :close-on-escape="!savingCredit"
      @hide="closeCreditDialog"
    >
      <form @submit.prevent="adjustCustomerCredit">
        <div class="mb-5 flex items-start gap-3">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
          >
            <i class="pi pi-star-fill" />
          </div>

          <div>
            <span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer
            </span>
            <strong class="mt-1 block text-slate-900">
              {{ customerForCredit ? customerName(customerForCredit) : "Customer" }}
            </strong>
            <span class="mt-0.5 block text-xs text-slate-500">
              {{ customerForCredit?.customerCode || "—" }}
            </span>
          </div>
        </div>

        <div class="mb-5 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-slate-50 p-4">
            <span class="block text-xs text-slate-500">Current credit</span>
            <strong class="mt-1 block text-2xl text-slate-900">
              {{ currentCreditScore }}
            </strong>
          </div>
          <div
            class="rounded-xl p-4"
            :class="creditForm.operation === 'ADD' ? 'bg-emerald-50' : 'bg-red-50'"
          >
            <span
              class="block text-xs"
              :class="creditForm.operation === 'ADD' ? 'text-emerald-700' : 'text-red-700'"
            >
              Credit after adjustment
            </span>
            <strong
              class="mt-1 block text-2xl"
              :class="creditForm.operation === 'ADD' ? 'text-emerald-800' : 'text-red-700'"
            >
              {{ creditScoreAfterAdjustment }}
            </strong>
          </div>
        </div>

        <div class="space-y-4">
          <div class="form-field">
            <label for="creditAdjustmentOperation">Operation *</label>
            <Select
              input-id="creditAdjustmentOperation"
              v-model="creditForm.operation"
              :options="creditOperationOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </div>

          <div class="form-field">
            <label for="additionalCreditPoints">Credit points *</label>
            <InputNumber
              input-id="additionalCreditPoints"
              v-model="creditForm.points"
              :min="1"
              :use-grouping="false"
              fluid
              :max="creditForm.operation === 'SUBTRACT' ? currentCreditScore : undefined"
              placeholder="Enter points"
              required
            />
            <small class="text-slate-500">
              Credit score cannot go below zero.
            </small>
          </div>

          <div class="form-field">
            <label for="creditAdjustmentReason">Description (optional)</label>
            <Textarea
              id="creditAdjustmentReason"
              v-model.trim="creditForm.reason"
              rows="3"
              maxlength="500"
              placeholder="Optional note about this credit adjustment"
            />
          </div>
        </div>

        <p class="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          The automatic 500 points are granted only for the customer's first
          approved loan. Admins can add or subtract points here to correct a
          mistake or apply an approved credit change. Every change is audited.
        </p>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            :disabled="savingCredit"
            @click="closeCreditDialog"
          />
          <Button
            type="button"
            :label="creditForm.operation === 'ADD' ? 'Add credit points' : 'Subtract credit points'"
            :icon="creditForm.operation === 'ADD' ? 'pi pi-plus-circle' : 'pi pi-minus-circle'"
            :severity="creditForm.operation === 'ADD' ? 'success' : 'danger'"
            :loading="savingCredit"
            @click="adjustCustomerCredit"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="depositDialogVisible"
      modal
      header="Adjust customer money balance"
      :style="{ width: '600px', maxWidth: '95vw' }"
      :closable="!savingDeposit"
      :close-on-escape="!savingDeposit"
      @hide="closeDepositDialog"
    >
      <form @submit.prevent="adjustCustomerBalance">
        <div class="mb-5 rounded-2xl bg-emerald-600 p-4 text-white">
          <span class="block text-xs font-semibold uppercase tracking-wide text-emerald-100">
            Customer available balance
          </span>
          <strong class="mt-1 block text-2xl">
            {{
              loadingDepositWallet
                ? "Loading..."
                : currency(depositWallet.availableBalance)
            }}
          </strong>
          <span class="mt-1 block text-sm text-emerald-100">
            {{ customerForDeposit ? customerName(customerForDeposit) : "Customer" }}
          </span>
        </div>

        <div class="mb-5 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-slate-50 p-4">
            <span class="block text-xs text-slate-500">Current balance</span>
            <strong class="mt-1 block text-lg text-slate-900">
              {{ currency(depositWallet.availableBalance) }}
            </strong>
          </div>
          <div
            class="rounded-xl p-4"
            :class="depositForm.operation === 'ADD' ? 'bg-emerald-50' : 'bg-red-50'"
          >
            <span
              class="block text-xs"
              :class="depositForm.operation === 'ADD' ? 'text-emerald-700' : 'text-red-700'"
            >
              Balance after adjustment
            </span>
            <strong
              class="mt-1 block text-lg"
              :class="depositForm.operation === 'ADD' ? 'text-emerald-800' : 'text-red-700'"
            >
              {{ currency(balanceAfterAdjustment) }}
            </strong>
          </div>
        </div>

        <div class="space-y-4">
          <div class="form-field">
            <label for="balanceAdjustmentOperation">Operation *</label>
            <Select
              input-id="balanceAdjustmentOperation"
              v-model="depositForm.operation"
              :options="balanceOperationOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </div>

          <div class="form-field">
            <label for="customerDepositAmount">Money amount *</label>
            <InputNumber
              input-id="customerDepositAmount"
              v-model="depositForm.amount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="1"
              :max="depositForm.operation === 'SUBTRACT' ? Number(depositWallet.availableBalance || 0) : undefined"
              fluid
              required
            />
          </div>

          <div class="form-field">
            <label for="customerDepositReference">Reference</label>
            <InputText
              id="customerDepositReference"
              v-model.trim="depositForm.reference"
              maxlength="120"
              placeholder="Bank receipt or transfer reference"
            />
          </div>

          <div class="form-field">
            <label for="customerDepositNote">Description (optional)</label>
            <Textarea
              id="customerDepositNote"
              v-model.trim="depositForm.reason"
              rows="3"
              maxlength="500"
              placeholder="Optional note about this money adjustment"
            />
          </div>
        </div>

        <div v-if="depositTransactions.length" class="mt-5">
          <h3 class="mb-2 text-sm font-bold text-slate-800">Recent wallet activity</h3>
          <div class="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
            <div
              v-for="transaction in depositTransactions"
              :key="transaction._id"
              class="flex items-start justify-between gap-3 border-b border-slate-100 p-3 last:border-b-0"
            >
              <div class="min-w-0">
                <strong class="block text-sm text-slate-800">
                  {{ transaction.transactionType.replaceAll("_", " ") }}
                </strong>
                <small class="block truncate text-slate-500">
                  {{ transaction.description || transaction.externalReference || "Customer wallet activity" }}
                </small>
                <small class="block text-slate-400">
                  {{ dateTime(transaction.transactionDate) }}
                </small>
              </div>
              <strong
                class="shrink-0 text-sm"
                :class="transaction.direction === 'CREDIT' ? 'text-emerald-700' : 'text-red-600'"
              >
                {{ transaction.direction === "CREDIT" ? "+" : "−" }}{{ currency(transaction.amount) }}
              </strong>
            </div>
          </div>
        </div>

        <p class="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          Add increases the customer's combined balance. Subtract corrects or
          removes money, but cannot reduce the balance below zero. Every
          adjustment is recorded with the administrator. The description is optional.
        </p>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            :disabled="savingDeposit"
            @click="closeDepositDialog"
          />
          <Button
            type="button"
            :label="depositForm.operation === 'ADD' ? 'Add money' : 'Subtract money'"
            :icon="depositForm.operation === 'ADD' ? 'pi pi-plus-circle' : 'pi pi-minus-circle'"
            :severity="depositForm.operation === 'ADD' ? 'success' : 'danger'"
            :loading="savingDeposit"
            @click="adjustCustomerBalance"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="resetPasswordDialogVisible"
      modal
      header="Reset customer password"
      :style="{ width: '520px', maxWidth: '95vw' }"
      :closable="!resettingPassword"
      :close-on-escape="!resettingPassword"
      @hide="closeResetPasswordDialog"
    >
      <form @submit.prevent="resetCustomerPassword">
        <div class="mb-5 flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"
          >
            <i class="pi pi-key" />
          </div>

          <div>
            <p class="font-semibold text-slate-900">
              {{
                customerForPasswordReset
                  ? customerName(customerForPasswordReset)
                  : "Customer"
              }}
            </p>
            <p class="mt-1 text-sm leading-5 text-slate-500">
              Enter and confirm the new password. The customer will use it on
              their next login.
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="form-field">
            <label for="customerNewPassword">New customer password *</label>
            <Password
              input-id="customerNewPassword"
              v-model="passwordForm.newPassword"
              toggle-mask
              fluid
              autocomplete="new-password"
              :minlength="8"
              required
            />
            <small class="text-slate-500">Minimum 8 characters.</small>
          </div>

          <div class="form-field">
            <label for="customerConfirmPassword">Confirm new password *</label>
            <Password
              input-id="customerConfirmPassword"
              v-model="passwordForm.confirmPassword"
              :feedback="false"
              toggle-mask
              fluid
              autocomplete="new-password"
              :minlength="8"
              required
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            :disabled="resettingPassword"
            @click="closeResetPasswordDialog"
          />
          <Button
            type="submit"
            label="Reset password"
            icon="pi pi-key"
            severity="warn"
            :loading="resettingPassword"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      header="Delete customer"
      :style="{ width: '440px', maxWidth: '95vw' }"
      :closable="!deleting"
      :close-on-escape="!deleting"
      @hide="closeDeleteDialog"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
        >
          <i class="pi pi-exclamation-triangle" />
        </div>

        <div>
          <p class="font-semibold text-slate-900">
            Delete
            {{
              customerToDelete ? customerName(customerToDelete) : "this customer"
            }}?
          </p>
          <p class="mt-1 text-sm leading-5 text-slate-500">
            This action cannot be undone. The customer login account and all
            related applications, loans, installments, repayments, and
            transaction records will also be permanently deleted.
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          text
          :disabled="deleting"
          @click="closeDeleteDialog"
        />
        <Button
          type="button"
          label="Delete permanently"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="removeCustomer"
        />
      </div>
    </Dialog>
  </div>
</template>
