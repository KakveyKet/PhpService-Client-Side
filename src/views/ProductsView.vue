<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";

import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";
import {
  apiError,
  currency,
  numberValue,
  statusSeverity,
} from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();

const items = ref([]);
const rates = ref([]);

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);

const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);

const editingId = ref(null);
const deleteTarget = ref(null);

const canManage = computed(() => auth.isAdmin || auth.isSuperAdmin);

function emptyForm() {
  return {
    productCode: "",
    name: "",
    description: "",
    rateId: null,
    minimumAmount: 1000,
    maximumAmount: 50000,
    minimumTerm: 3,
    maximumTerm: 12,
    termUnit: "MONTH",
    repaymentFrequency: "MONTHLY",
    processingFeePercent: 0,
    lateFeeType: "NONE",
    lateFeeValue: 0,
    gracePeriodDays: 0,
    status: "ACTIVE",
  };
}

const form = reactive(emptyForm());

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPayload() {
  const payload = {
    productCode: cleanText(form.productCode).toUpperCase(),
    name: cleanText(form.name),
    description: cleanText(form.description),
    rateId: form.rateId,
    minimumAmount: Number(form.minimumAmount),
    maximumAmount: Number(form.maximumAmount),
    minimumTerm: Number(form.minimumTerm),
    maximumTerm: Number(form.maximumTerm),
  };

  if (auth.isSuperAdmin) {
    Object.assign(payload, {
      termUnit: form.termUnit,
      repaymentFrequency: form.repaymentFrequency,
      processingFeePercent: Number(form.processingFeePercent),
      lateFeeType: form.lateFeeType,
      lateFeeValue: Number(form.lateFeeValue),
      gracePeriodDays: Number(form.gracePeriodDays),
      status: form.status,
    });
  }

  return payload;
}

function validateForm() {
  if (!cleanText(form.productCode)) {
    toast.add({
      severity: "warn",
      summary: "Product code required",
      life: 3000,
    });

    return false;
  }

  if (!cleanText(form.name)) {
    toast.add({
      severity: "warn",
      summary: "Product name required",
      life: 3000,
    });

    return false;
  }

  if (!form.rateId) {
    toast.add({
      severity: "warn",
      summary: "Interest rate required",
      detail: "Please select an interest rate.",
      life: 3500,
    });

    return false;
  }

  if (Number(form.maximumAmount) < Number(form.minimumAmount)) {
    toast.add({
      severity: "warn",
      summary: "Invalid amount range",
      detail: "Maximum amount must be greater than or equal to minimum amount.",
      life: 4000,
    });

    return false;
  }

  if (Number(form.maximumTerm) < Number(form.minimumTerm)) {
    toast.add({
      severity: "warn",
      summary: "Invalid term range",
      detail: "Maximum term must be greater than or equal to minimum term.",
      life: 4000,
    });

    return false;
  }

  return true;
}

async function load() {
  loading.value = true;

  try {
    const [productsResponse, ratesResponse] = await Promise.all([
      api.get("/products"),
      api.get("/rates", {
        params: {
          status: "ACTIVE",
        },
      }),
    ]);

    items.value = Array.isArray(productsResponse.data?.items)
      ? productsResponse.data.items
      : [];

    rates.value = Array.isArray(ratesResponse.data?.items)
      ? ratesResponse.data.items
      : [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load products",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!canManage.value) {
    return;
  }

  editingId.value = null;
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(item) {
  if (!canManage.value) {
    return;
  }

  editingId.value = item._id;

  Object.assign(form, {
    productCode: item.productCode || "",
    name: item.name || "",
    description: item.description || "",
    rateId: item.rateId?._id || item.rateId || null,
    minimumAmount: numberValue(item.minimumAmount),
    maximumAmount: numberValue(item.maximumAmount),
    minimumTerm: item.minimumTerm || 1,
    maximumTerm: item.maximumTerm || 1,
    termUnit: item.termUnit || "MONTH",
    repaymentFrequency: item.repaymentFrequency || "MONTHLY",
    processingFeePercent: numberValue(item.processingFeePercent),
    lateFeeType: item.lateFeeType || "NONE",
    lateFeeValue: numberValue(item.lateFeeValue),
    gracePeriodDays: item.gracePeriodDays || 0,
    status: item.status || "ACTIVE",
  });

  dialogVisible.value = true;
}

function closeDialog() {
  if (saving.value) {
    return;
  }

  dialogVisible.value = false;
  editingId.value = null;
  Object.assign(form, emptyForm());
}

async function save() {
  if (!canManage.value || !validateForm()) {
    return;
  }

  saving.value = true;
  const isEditing = Boolean(editingId.value);

  try {
    const payload = buildPayload();

    if (isEditing) {
      await api.patch(`/products/${editingId.value}`, payload);
    } else {
      await api.post("/products", payload);
    }

    toast.add({
      severity: "success",
      summary: isEditing ? "Product updated" : "Product created",
      life: 2500,
    });

    dialogVisible.value = false;
    editingId.value = null;
    Object.assign(form, emptyForm());

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

function openDeleteDialog(item) {
  if (!canManage.value) {
    return;
  }

  deleteTarget.value = item;
  deleteDialogVisible.value = true;
}

function closeDeleteDialog() {
  if (deleting.value) {
    return;
  }

  deleteDialogVisible.value = false;
  deleteTarget.value = null;
}

function handleDeleteDialogHide() {
  if (!deleting.value) {
    deleteTarget.value = null;
  }
}

async function confirmDelete() {
  const product = deleteTarget.value;

  if (!canManage.value || !product?._id) {
    return;
  }

  deleting.value = true;

  try {
    await api.delete(`/products/${product._id}`);

    toast.add({
      severity: "success",
      summary: "Product deleted",
      detail: `${product.name} was deleted successfully.`,
      life: 3000,
    });

    deleteDialogVisible.value = false;
    deleteTarget.value = null;

    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot delete product",
      detail: apiError(error),
      life: 5000,
    });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Loan products">
      <Button
        v-if="canManage"
        label="Add product"
        icon="pi pi-plus"
        @click="openCreate"
      />
    </PageHeader>

    <section class="table-card">
      <DataTable
        :value="items"
        :loading="loading"
        striped-rows
        responsive-layout="scroll"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-briefcase" />
            No loan products found.
          </div>
        </template>

        <Column field="productCode" header="Code" />

        <Column field="name" header="Product" />

        <Column header="Amount range">
          <template #body="{ data }">
            {{ currency(data.minimumAmount) }}
            –
            {{ currency(data.maximumAmount) }}
          </template>
        </Column>

        <Column header="Rate">
          <template #body="{ data }">
            <strong> {{ numberValue(data.rateId?.ratePercent) }}% </strong>

            {{ data.rateId?.period?.toLowerCase() || "" }}
          </template>
        </Column>

        <Column header="Term">
          <template #body="{ data }">
            {{ data.minimumTerm }}–{{ data.maximumTerm }}
            {{ data.termUnit?.toLowerCase() || "month" }}(s)
          </template>
        </Column>

        <Column field="repaymentFrequency" header="Repayment" />

        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column v-if="canManage" header="Actions">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit product"
                @click="openEdit(data)"
              />

              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Delete product"
                @click="openDeleteDialog(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- Create and edit dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="editingId ? 'Edit loan product' : 'Add loan product'"
      :style="{
        width: '760px',
        maxWidth: '95vw',
      }"
      :closable="!saving"
      :close-on-escape="!saving"
      @hide="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field">
            <label> Product code * </label>

            <InputText v-model.trim="form.productCode" required />
          </div>

          <div class="form-field">
            <label> Product name * </label>

            <InputText v-model.trim="form.name" required />
          </div>

          <div class="form-field form-field--full">
            <label>Description</label>

            <Textarea v-model="form.description" rows="2" />
          </div>

          <div class="form-field form-field--full">
            <label> Interest rate * </label>

            <Select
              v-model="form.rateId"
              :options="rates"
              option-label="name"
              option-value="_id"
              placeholder="Select rate"
              class="w-full"
              required
            />
          </div>

          <div class="form-field">
            <label> Minimum amount </label>

            <InputNumber
              v-model="form.minimumAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
              fluid
            />
          </div>

          <div class="form-field">
            <label> Maximum amount </label>

            <InputNumber
              v-model="form.maximumAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
              fluid
            />
          </div>

          <div class="form-field">
            <label> Minimum term </label>

            <InputNumber v-model="form.minimumTerm" :min="1" fluid />
          </div>

          <div class="form-field">
            <label> Maximum term </label>

            <InputNumber v-model="form.maximumTerm" :min="1" fluid />
          </div>

          <template v-if="auth.isSuperAdmin">
            <div class="form-field">
              <label>Term unit</label>

              <Select
                v-model="form.termUnit"
                :options="['DAY', 'WEEK', 'MONTH', 'YEAR']"
                class="w-full"
              />
            </div>

            <div class="form-field">
              <label> Repayment frequency </label>

              <Select
                v-model="form.repaymentFrequency"
                :options="['DAILY', 'WEEKLY', 'MONTHLY']"
                class="w-full"
              />
            </div>

            <div class="form-field">
              <label> Processing fee </label>

              <InputNumber
                v-model="form.processingFeePercent"
                suffix="%"
                :min="0"
                :max-fraction-digits="6"
                fluid
              />
            </div>

            <div class="form-field">
              <label> Grace period </label>

              <InputNumber
                v-model="form.gracePeriodDays"
                suffix=" days"
                :min="0"
                fluid
              />
            </div>

            <div class="form-field">
              <label> Late fee type </label>

              <Select
                v-model="form.lateFeeType"
                :options="['NONE', 'FIXED', 'PERCENTAGE']"
                class="w-full"
              />
            </div>

            <div class="form-field">
              <label> Late fee value </label>

              <InputNumber
                v-model="form.lateFeeValue"
                :prefix="form.lateFeeType === 'FIXED' ? '₱' : ''"
                :suffix="form.lateFeeType === 'PERCENTAGE' ? '%' : ''"
                :min="0"
                fluid
              />
            </div>

            <div class="form-field">
              <label>Status</label>

              <Select
                v-model="form.status"
                :options="['ACTIVE', 'INACTIVE']"
                class="w-full"
              />
            </div>
          </template>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            severity="secondary"
            text
            type="button"
            :disabled="saving"
            @click="closeDialog"
          />

          <Button
            :label="editingId ? 'Update product' : 'Create product'"
            type="submit"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>

    <!-- Delete confirmation dialog -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      header="Delete loan product"
      :style="{
        width: '430px',
        maxWidth: '92vw',
      }"
      :closable="!deleting"
      :close-on-escape="!deleting"
      @hide="handleDeleteDialogHide"
    >
      <div class="text-center">
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600"
        >
          <i class="pi pi-trash text-xl" />
        </div>

        <h3 class="mt-4 text-lg font-bold text-slate-900">
          Delete this product?
        </h3>

        <p class="mt-2 text-sm leading-6 text-slate-500">
          You are about to delete
          <strong class="text-slate-700">
            {{ deleteTarget?.name }} </strong
          >. This action cannot be undone.
        </p>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          :disabled="deleting"
          @click="closeDeleteDialog"
        />

        <Button
          label="Delete product"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </Dialog>
  </div>
</template>
