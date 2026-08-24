<script setup>
import { onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import PageHeader from "../components/PageHeader.vue";
import api from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";
import {
  apiError,
  currency,
  fullName,
  statusSeverity,
} from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();
const items = ref([]);
const loading = ref(false);
const search = ref("");
const dialogVisible = ref(false);
const deleteDialogVisible = ref(false);
const saving = ref(false);
const deleting = ref(false);
const editingId = ref(null);
const customerToDelete = ref(null);
const emptyForm = () => ({
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  email: "",
  nationalId: "",
  gender: null,
  occupation: "",
  monthlyIncome: 0,
  status: "ACTIVE",
  address: { street: "", barangay: "", city: "", province: "", postalCode: "" },
});
const form = reactive(emptyForm());

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get("/customers", {
      params: { q: search.value, limit: 100 },
    });
    items.value = data.items;
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
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(customer) {
  editingId.value = customer._id;
  Object.assign(form, {
    firstName: customer.firstName,
    middleName: customer.middleName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    nationalId: customer.nationalId,
    gender: customer.gender,
    occupation: customer.occupation,
    monthlyIncome: Number(
      customer.monthlyIncome?.$numberDecimal || customer.monthlyIncome || 0,
    ),
    status: customer.status,
    address: { ...emptyForm().address, ...customer.address },
  });
  dialogVisible.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (editingId.value) await api.patch(`/customers/${editingId.value}`, form);
    else await api.post("/customers", form);
    toast.add({
      severity: "success",
      summary: editingId.value ? "Customer updated" : "Customer created",
      life: 2500,
    });
    dialogVisible.value = false;
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

async function removeCustomer() {
  if (!customerToDelete.value?._id) return;

  deleting.value = true;

  try {
    await api.delete(`/customers/${customerToDelete.value._id}`);
    toast.add({
      severity: "success",
      summary: "Customer deleted",
      life: 2500,
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

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Customers">
      <Button label="Add customer" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>

    <section class="table-card">
      <div class="table-toolbar">
        <div class="search-field">
          <i class="pi pi-search" /><InputText
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
        <template #empty
          ><div class="empty-state">
            <i class="pi pi-users" />No customers found.
          </div></template
        >
        <Column field="customerCode" header="Customer ID" sortable />
        <Column header="Name" sortable
          ><template #body="{ data }"
            ><strong>{{ fullName(data) }}</strong></template
          ></Column
        >
        <Column field="phone" header="Phone" />
        <Column field="occupation" header="Occupation" />
        <Column header="Monthly income"
          ><template #body="{ data }">{{
            currency(data.monthlyIncome)
          }}</template></Column
        >
        <Column header="Login"
          ><template #body="{ data }">{{
            data.userId?.username || "No account"
          }}</template></Column
        >
        <Column header="Status"
          ><template #body="{ data }"
            ><Tag
              :value="data.status"
              :severity="statusSeverity(data.status)" /></template
        ></Column>
        <Column header="">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit customer"
                @click="openEdit(data)"
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
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field">
            <label>First name *</label
            ><InputText v-model="form.firstName" required />
          </div>
          <div class="form-field">
            <label>Last name *</label
            ><InputText v-model="form.lastName" required />
          </div>
          <div class="form-field">
            <label>Middle name</label><InputText v-model="form.middleName" />
          </div>
          <div class="form-field">
            <label>Gender</label
            ><Select
              v-model="form.gender"
              :options="['MALE', 'FEMALE', 'OTHER']"
              placeholder="Select gender"
            />
          </div>
          <div class="form-field">
            <label>Phone *</label><InputText v-model="form.phone" required />
          </div>
          <div class="form-field">
            <label>Email</label><InputText v-model="form.email" type="email" />
          </div>
          <div class="form-field">
            <label>National ID</label><InputText v-model="form.nationalId" />
          </div>
          <div class="form-field">
            <label>Occupation</label><InputText v-model="form.occupation" />
          </div>
          <div class="form-field">
            <label>Monthly income</label
            ><InputNumber
              v-model="form.monthlyIncome"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
            />
          </div>
          <div class="form-field">
            <label>Status</label
            ><Select
              v-model="form.status"
              :options="['ACTIVE', 'INACTIVE', 'BLACKLISTED']"
            />
          </div>
          <div class="form-field">
            <label>Barangay</label><InputText v-model="form.address.barangay" />
          </div>
          <div class="form-field">
            <label>City</label><InputText v-model="form.address.city" />
          </div>
          <div class="form-field">
            <label>Province</label><InputText v-model="form.address.province" />
          </div>
          <div class="form-field">
            <label>Postal code</label
            ><InputText v-model="form.address.postalCode" />
          </div>
        </div>
        <div class="form-actions">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            @click="dialogVisible = false"
          /><Button type="submit" label="Save customer" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      header="Delete customer"
      :style="{ width: '440px', maxWidth: '95vw' }"
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
              customerToDelete ? fullName(customerToDelete) : "this customer"
            }}?
          </p>
          <p class="mt-1 text-sm leading-5 text-slate-500">
            This action cannot be undone. Customers with applications, loans or
            repayments cannot be deleted.
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          text
          @click="deleteDialogVisible = false"
        />
        <Button
          type="button"
          label="Delete customer"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="removeCustomer"
        />
      </div>
    </Dialog>
  </div>
</template>
