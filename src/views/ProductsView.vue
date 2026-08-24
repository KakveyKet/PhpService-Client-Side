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
const dialogVisible = ref(false);
const editingId = ref(null);

const emptyForm = () => ({
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
});

const form = reactive(emptyForm());

function buildPayload() {
  const payload = {
    productCode: form.productCode,
    name: form.name,
    description: form.description,
    rateId: form.rateId,
    minimumAmount: form.minimumAmount,
    maximumAmount: form.maximumAmount,
    minimumTerm: form.minimumTerm,
    maximumTerm: form.maximumTerm,
  };

  if (auth.isSuperAdmin) {
    Object.assign(payload, {
      termUnit: form.termUnit,
      repaymentFrequency: form.repaymentFrequency,
      processingFeePercent: form.processingFeePercent,
      lateFeeType: form.lateFeeType,
      lateFeeValue: form.lateFeeValue,
      gracePeriodDays: form.gracePeriodDays,
      status: form.status,
    });
  }

  return payload;
}

async function load() {
  loading.value = true;

  try {
    const [productsResponse, ratesResponse] = await Promise.all([
      api.get("/products"),
      api.get("/rates", {
        params: { status: "ACTIVE" },
      }),
    ]);

    items.value = productsResponse.data.items;
    rates.value = ratesResponse.data.items;
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
  editingId.value = null;
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(item) {
  editingId.value = item._id;

  Object.assign(form, {
    productCode: item.productCode,
    name: item.name,
    description: item.description,
    rateId: item.rateId?._id,
    minimumAmount: numberValue(item.minimumAmount),
    maximumAmount: numberValue(item.maximumAmount),
    minimumTerm: item.minimumTerm,
    maximumTerm: item.maximumTerm,
    termUnit: item.termUnit,
    repaymentFrequency: item.repaymentFrequency,
    processingFeePercent: numberValue(item.processingFeePercent),
    lateFeeType: item.lateFeeType,
    lateFeeValue: numberValue(item.lateFeeValue),
    gracePeriodDays: item.gracePeriodDays,
    status: item.status,
  });

  dialogVisible.value = true;
}

async function save() {
  saving.value = true;

  try {
    const payload = buildPayload();

    if (editingId.value) {
      await api.patch(`/products/${editingId.value}`, payload);
    } else {
      await api.post("/products", payload);
    }

    toast.add({
      severity: "success",
      summary: "Product saved",
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

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Loan products">
      <Button
        v-if="auth.isAdmin"
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
            {{ data.rateId?.period?.toLowerCase() }}
          </template>
        </Column>

        <Column header="Term">
          <template #body="{ data }">
            {{ data.minimumTerm }}–{{ data.maximumTerm }}
            {{ data.termUnit.toLowerCase() }}(s)
          </template>
        </Column>

        <Column field="repaymentFrequency" header="Repayment" />

        <Column header="Status">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column v-if="auth.isAdmin" header="">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              @click="openEdit(data)"
            />
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="editingId ? 'Edit loan product' : 'Add loan product'"
      :style="{ width: '760px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field">
            <label>Product code *</label>
            <InputText v-model.trim="form.productCode" required />
          </div>

          <div class="form-field">
            <label>Product name *</label>
            <InputText v-model="form.name" required />
          </div>

          <div class="form-field form-field--full">
            <label>Description</label>
            <Textarea v-model="form.description" rows="2" />
          </div>

          <div class="form-field form-field--full">
            <label>Interest rate *</label>
            <Select
              v-model="form.rateId"
              :options="rates"
              option-label="name"
              option-value="_id"
              placeholder="Select rate"
              required
            />
          </div>

          <div class="form-field">
            <label>Minimum amount</label>
            <InputNumber
              v-model="form.minimumAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
            />
          </div>

          <div class="form-field">
            <label>Maximum amount</label>
            <InputNumber
              v-model="form.maximumAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0"
            />
          </div>

          <div class="form-field">
            <label>Minimum term</label>
            <InputNumber v-model="form.minimumTerm" :min="1" />
          </div>

          <div class="form-field">
            <label>Maximum term</label>
            <InputNumber v-model="form.maximumTerm" :min="1" />
          </div>

          <!-- SUPER_ADMIN fields only -->
          <template v-if="auth.isSuperAdmin">
            <div class="form-field">
              <label>Term unit</label>
              <Select
                v-model="form.termUnit"
                :options="['DAY', 'WEEK', 'MONTH', 'YEAR']"
              />
            </div>

            <div class="form-field">
              <label>Repayment frequency</label>
              <Select
                v-model="form.repaymentFrequency"
                :options="['DAILY', 'WEEKLY', 'MONTHLY']"
              />
            </div>

            <div class="form-field">
              <label>Processing fee</label>
              <InputNumber
                v-model="form.processingFeePercent"
                suffix="%"
                :min="0"
                :max-fraction-digits="6"
              />
            </div>

            <div class="form-field">
              <label>Grace period</label>
              <InputNumber
                v-model="form.gracePeriodDays"
                suffix=" days"
                :min="0"
              />
            </div>

            <div class="form-field">
              <label>Late fee type</label>
              <Select
                v-model="form.lateFeeType"
                :options="['NONE', 'FIXED', 'PERCENTAGE']"
              />
            </div>

            <div class="form-field">
              <label>Late fee value</label>
              <InputNumber
                v-model="form.lateFeeValue"
                :prefix="form.lateFeeType === 'FIXED' ? '₱' : ''"
                :suffix="form.lateFeeType === 'PERCENTAGE' ? '%' : ''"
                :min="0"
              />
            </div>

            <div class="form-field">
              <label>Status</label>
              <Select v-model="form.status" :options="['ACTIVE', 'INACTIVE']" />
            </div>
          </template>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            severity="secondary"
            text
            type="button"
            @click="dialogVisible = false"
          />

          <Button label="Save product" type="submit" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
