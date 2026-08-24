<script setup>
import { onMounted, reactive, ref } from "vue";

import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Select from "primevue/select";
import Tag from "primevue/tag";

import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";

import { apiError, dateTime, statusSeverity } from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref(null);

const roleOptions = [
  {
    label: "Support Admin",
    value: "USER",
  },
  {
    label: "Admin",
    value: "ADMIN",
  },
  {
    label: "Super Admin",
    value: "SUPER_ADMIN",
  },
];

const statusOptions = ["ACTIVE", "INACTIVE", "LOCKED"];

const emptyForm = () => ({
  username: "",
  email: "",
  phone: "",
  password: "",
  displayName: "",
  role: "USER",
  status: "ACTIVE",
});

const form = reactive(emptyForm());

function roleLabel(role) {
  return (
    roleOptions.find((option) => option.value === role)?.label || role || "—"
  );
}

async function load() {
  loading.value = true;

  try {
    const response = await api.get("/users", {
      params: {
        limit: 100,
      },
    });

    items.value = response.data.items;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load users",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(item) {
  editingId.value = item._id;

  Object.assign(form, {
    username: item.username,
    email: item.email || "",
    phone: item.phone || "",
    password: "",
    displayName: item.displayName,
    role: item.roleId?.name,
    status: item.status,
  });

  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
  editingId.value = null;
  Object.assign(form, emptyForm());
}

function buildCreatePayload() {
  return {
    username: form.username,
    email: form.email,
    phone: form.phone,
    password: form.password,
    displayName: form.displayName,
    role: form.role,
  };
}

function buildUpdatePayload() {
  const payload = {
    username: form.username,
    email: form.email,
    phone: form.phone,
    displayName: form.displayName,
    role: form.role,
    status: form.status,
  };

  if (form.password) {
    payload.password = form.password;
  }

  return payload;
}

async function save() {
  saving.value = true;

  try {
    if (editingId.value) {
      const payload = buildUpdatePayload();

      await api.patch(`/users/${editingId.value}`, payload);

      /*
       * Refresh the current session if
       * the super admin edited their own
       * account.
       */
      if (editingId.value === auth.user?.id) {
        await auth.fetchMe();
      }
    } else {
      await api.post("/users", buildCreatePayload());
    }

    toast.add({
      severity: "success",
      summary: editingId.value ? "User updated" : "User created",
      life: 2500,
    });

    closeDialog();
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

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      title="System users"
      subtitle="Create staff accounts and control their system roles."
    >
      <Button label="Add user" icon="pi pi-user-plus" @click="openCreate" />
    </PageHeader>

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
            <i class="pi pi-user-edit" />
            No system users found.
          </div>
        </template>

        <Column field="displayName" header="Name" />

        <Column field="username" header="Username" />

        <Column field="email" header="Email">
          <template #body="{ data }">
            {{ data.email || "—" }}
          </template>
        </Column>

        <Column field="phone" header="Phone">
          <template #body="{ data }">
            {{ data.phone || "—" }}
          </template>
        </Column>

        <Column header="Role">
          <template #body="{ data }">
            <Tag :value="roleLabel(data.roleId?.name)" severity="info" />
          </template>
        </Column>

        <Column header="Last login">
          <template #body="{ data }">
            {{ dateTime(data.lastLoginAt) }}
          </template>
        </Column>

        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column header="">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              aria-label="Edit user"
              @click="openEdit(data)"
            />
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="editingId ? 'Edit user' : 'Add system user'"
      :style="{
        width: '620px',
        maxWidth: '95vw',
      }"
      @hide="closeDialog"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label> Display name * </label>

            <InputText v-model.trim="form.displayName" required />
          </div>

          <div class="form-field">
            <label> Username * </label>

            <InputText v-model.trim="form.username" required />
          </div>

          <div class="form-field">
            <label>Email</label>

            <InputText v-model.trim="form.email" type="email" />
          </div>

          <div class="form-field">
            <label>Phone</label>

            <InputText v-model.trim="form.phone" />
          </div>

          <div class="form-field">
            <label>Role *</label>

            <Select
              v-model="form.role"
              :options="roleOptions"
              option-label="label"
              option-value="value"
              placeholder="Select role"
              required
            />
          </div>

          <div v-if="editingId" class="form-field">
            <label>Status *</label>

            <Select v-model="form.status" :options="statusOptions" required />
          </div>

          <div
            class="form-field"
            :class="{
              'form-field--full': !editingId,
            }"
          >
            <label>
              {{ editingId ? "New password (optional)" : "Password *" }}
            </label>

            <Password
              v-model="form.password"
              toggle-mask
              fluid
              :feedback="!editingId"
              :required="!editingId"
            />
          </div>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            severity="secondary"
            text
            type="button"
            @click="closeDialog"
          />

          <Button
            :label="editingId ? 'Update user' : 'Create user'"
            type="submit"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>
