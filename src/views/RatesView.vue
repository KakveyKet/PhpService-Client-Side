<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";

import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";
import { apiError, numberValue } from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();

const items = ref([]);

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
    rateCode: "",
    name: "",
    ratePercent: 0.7,
  };
}

const form = reactive(emptyForm());

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function load() {
  loading.value = true;

  try {
    const response = await api.get("/rates");

    items.value = Array.isArray(response.data?.items)
      ? response.data.items
      : [];
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load rates",
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
    rateCode: item.rateCode || "",
    name: item.name || "",
    ratePercent: numberValue(item.ratePercent),
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

function validateForm() {
  if (!cleanText(form.rateCode)) {
    toast.add({
      severity: "warn",
      summary: "Rate code required",
      life: 3000,
    });

    return false;
  }

  if (!cleanText(form.name)) {
    toast.add({
      severity: "warn",
      summary: "Rate name required",
      life: 3000,
    });

    return false;
  }

  if (
    form.ratePercent === null ||
    form.ratePercent === undefined ||
    Number(form.ratePercent) < 0
  ) {
    toast.add({
      severity: "warn",
      summary: "Invalid percentage",
      detail: "Rate percentage must be zero or greater.",
      life: 3500,
    });

    return false;
  }

  return true;
}

async function save() {
  if (!canManage.value || !validateForm()) {
    return;
  }

  saving.value = true;
  const isEditing = Boolean(editingId.value);

  const payload = {
    rateCode: cleanText(form.rateCode).toUpperCase(),
    name: cleanText(form.name),
    ratePercent: Number(form.ratePercent),
  };

  try {
    if (isEditing) {
      await api.patch(`/rates/${editingId.value}`, payload);
    } else {
      await api.post("/rates", payload);
    }

    toast.add({
      severity: "success",
      summary: isEditing ? "Rate updated" : "Rate created",
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
  const rate = deleteTarget.value;

  if (!canManage.value || !rate?._id) {
    return;
  }

  deleting.value = true;

  try {
    await api.delete(`/rates/${rate._id}`);

    toast.add({
      severity: "success",
      summary: "Rate deleted",
      detail: `${rate.name} was deleted successfully.`,
      life: 3000,
    });

    deleteDialogVisible.value = false;
    deleteTarget.value = null;

    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot delete rate",
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
    <PageHeader title="Interest rates">
      <Button
        v-if="canManage"
        label="Add rate"
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
            <i class="pi pi-percentage" />
            No rates configured.
          </div>
        </template>

        <Column field="rateCode" header="Code" />

        <Column field="name" header="Rate name" />

        <Column header="Percentage">
          <template #body="{ data }">
            <strong> {{ numberValue(data.ratePercent) }}% </strong>
          </template>
        </Column>

        <Column field="period" header="Period" />

        <Column v-if="canManage" header="Actions">
          <template #body="{ data }">
            <div class="flex items-center gap-1">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit rate"
                @click="openEdit(data)"
              />

              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Delete rate"
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
      :header="editingId ? 'Edit rate' : 'Add rate'"
      :style="{
        width: '560px',
        maxWidth: '95vw',
      }"
      :closable="!saving"
      :close-on-escape="!saving"
      @hide="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field">
            <label>Rate code *</label>

            <InputText v-model.trim="form.rateCode" required />
          </div>

          <div class="form-field">
            <label>Name *</label>

            <InputText v-model.trim="form.name" required />
          </div>

          <div class="form-field">
            <label>Percentage *</label>

            <InputNumber
              v-model="form.ratePercent"
              suffix="%"
              :min-fraction-digits="1"
              :max-fraction-digits="6"
              :min="0"
              fluid
              required
            />
          </div>
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
            :label="editingId ? 'Update rate' : 'Create rate'"
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
      header="Delete interest rate"
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

        <h3 class="mt-4 text-lg font-bold text-slate-900">Delete this rate?</h3>

        <p class="mt-2 text-sm leading-6 text-slate-500">
          You are about to delete
          <strong class="text-slate-700"> {{ deleteTarget?.name }} </strong>.
          This action cannot be undone.
        </p>

        <p
          class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700"
        >
          A rate assigned to a loan product may not be deleted.
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
          label="Delete rate"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </Dialog>
  </div>
</template>
