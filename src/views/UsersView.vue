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

function emptyForm() {
  return {
    username: "",
    email: "",
    phone: "",
    password: "",
    displayName: "",
    role: "USER",
    status: "ACTIVE",
  };
}

const form = reactive(emptyForm());

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roleLabel(role) {
  return (
    roleOptions.find((option) => option.value === role)?.label || role || "—"
  );
}

function detailedApiError(error) {
  const data = error.response?.data;

  if (Array.isArray(data?.errors)) {
    const messages = data.errors
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return item.message || item.msg || item.error;
      })
      .filter(Boolean);

    if (messages.length) {
      return messages.join(", ");
    }
  }

  if (data?.errors && typeof data.errors === "object") {
    const messages = Object.values(data.errors)
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return item?.message || item?.msg;
      })
      .filter(Boolean);

    if (messages.length) {
      return messages.join(", ");
    }
  }

  return data?.message || apiError(error);
}

async function load() {
  loading.value = true;

  try {
    const response = await api.get("/users", {
      params: {
        limit: 100,
      },
    });

    items.value = Array.isArray(response.data?.items)
      ? response.data.items
      : [];
  } catch (error) {
    console.error("Load users failed:", error.response?.data);

    toast.add({
      severity: "error",
      summary: "Cannot load users",
      detail: detailedApiError(error),
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
  editingId.value = item._id || item.id;

  Object.assign(form, {
    username: item.username || "",
    email: item.email || "",
    phone: item.phone || "",
    password: "",
    displayName: item.displayName || "",
    role: item.roleId?.name || item.role || "USER",
    status: item.status || "ACTIVE",
  });

  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
  editingId.value = null;
  Object.assign(form, emptyForm());
}

function buildCreatePayload() {
  const payload = {
    username: cleanText(form.username),
    displayName: cleanText(form.displayName),
    password: form.password,
    role: form.role,
  };

  const email = cleanText(form.email).toLowerCase();

  const phone = cleanText(form.phone);

  // Do not send optional fields as empty strings.
  if (email) {
    payload.email = email;
  }

  if (phone) {
    payload.phone = phone;
  }

  return payload;
}

function buildUpdatePayload() {
  const payload = {
    username: cleanText(form.username),
    displayName: cleanText(form.displayName),
    role: form.role,
    status: form.status,
  };

  const email = cleanText(form.email).toLowerCase();

  const phone = cleanText(form.phone);

  // Empty optional values are omitted to avoid
  // backend validation errors.
  if (email) {
    payload.email = email;
  }

  if (phone) {
    payload.phone = phone;
  }

  if (form.password) {
    payload.password = form.password;
  }

  return payload;
}

function validateForm() {
  const displayName = cleanText(form.displayName);

  const username = cleanText(form.username);

  if (!displayName) {
    toast.add({
      severity: "warn",
      summary: "Display name required",
      detail: "Please enter the user's display name.",
      life: 3500,
    });

    return false;
  }

  if (!username) {
    toast.add({
      severity: "warn",
      summary: "Username required",
      detail: "Please enter a username.",
      life: 3500,
    });

    return false;
  }

  if (username.length < 3) {
    toast.add({
      severity: "warn",
      summary: "Invalid username",
      detail: "Username must contain at least 3 characters.",
      life: 3500,
    });

    return false;
  }

  if (!form.role) {
    toast.add({
      severity: "warn",
      summary: "Role required",
      detail: "Please select a system role.",
      life: 3500,
    });

    return false;
  }

  if (!editingId.value && !form.password) {
    toast.add({
      severity: "warn",
      summary: "Password required",
      detail: "Please enter a password.",
      life: 3500,
    });

    return false;
  }

  if (form.password && form.password.length < 8) {
    toast.add({
      severity: "warn",
      summary: "Invalid password",
      detail: "Password must contain at least 8 characters.",
      life: 4000,
    });

    return false;
  }

  return true;
}

async function save() {
  if (!validateForm()) {
    return;
  }

  saving.value = true;

  const isEditing = Boolean(editingId.value);

  try {
    if (isEditing) {
      const payload = buildUpdatePayload();

      await api.patch(`/users/${editingId.value}`, payload);

      const currentUserId = auth.user?.id || auth.user?._id;

      if (String(editingId.value) === String(currentUserId)) {
        await auth.fetchMe();
      }
    } else {
      const payload = buildCreatePayload();

      await api.post("/users", payload);
    }

    toast.add({
      severity: "success",
      summary: isEditing ? "User updated" : "User created",
      life: 2500,
    });

    closeDialog();
    await load();
  } catch (error) {
    console.error("Save user failed:", error.response?.data);

    toast.add({
      severity: "error",
      summary: "Save failed",
      detail: detailedApiError(error),
      life: 5000,
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
            <Tag
              :value="roleLabel(data.roleId?.name || data.role)"
              severity="info"
            />
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
            <label for="displayName"> Display name * </label>

            <InputText
              id="displayName"
              v-model.trim="form.displayName"
              autocomplete="name"
              required
            />
          </div>

          <div class="form-field">
            <label for="username"> Username * </label>

            <InputText
              id="username"
              v-model.trim="form.username"
              autocomplete="username"
              minlength="3"
              required
            />
          </div>

          <div class="form-field">
            <label for="userEmail"> Email </label>

            <InputText
              id="userEmail"
              v-model.trim="form.email"
              type="email"
              autocomplete="email"
            />
          </div>

          <div class="form-field">
            <label for="userPhone"> Phone </label>

            <InputText
              id="userPhone"
              v-model.trim="form.phone"
              autocomplete="tel"
              inputmode="tel"
            />
          </div>

          <div class="form-field">
            <label for="userRole"> Role * </label>

            <Select
              id="userRole"
              v-model="form.role"
              :options="roleOptions"
              option-label="label"
              option-value="value"
              placeholder="Select role"
              class="w-full"
              required
            />
          </div>

          <div v-if="editingId" class="form-field">
            <label for="userStatus"> Status * </label>

            <Select
              id="userStatus"
              v-model="form.status"
              :options="statusOptions"
              class="w-full"
              required
            />
          </div>

          <div
            class="form-field"
            :class="{
              'form-field--full': !editingId,
            }"
          >
            <label for="userPassword">
              {{ editingId ? "New password (optional)" : "Password *" }}
            </label>

            <Password
              id="userPassword"
              v-model="form.password"
              toggle-mask
              fluid
              :feedback="!editingId"
              :required="!editingId"
              minlength="8"
              autocomplete="new-password"
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
            :label="editingId ? 'Update user' : 'Create user'"
            type="submit"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>
