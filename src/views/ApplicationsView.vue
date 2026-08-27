<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { apiError, currency, date, fullName, numberValue, statusSeverity } from '../utils/formatters.js';

const auth = useAuthStore();
const toast = useToast();
const items = ref([]);
const customers = ref([]);
const products = ref([]);
const loading = ref(false);
const saving = ref(false);
const createVisible = ref(false);
const reviewVisible = ref(false);
const planVisible = ref(false);
const selected = ref(null);
const filterCustomerId = ref(null);

function defaultDateRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

const filterDateRange = ref(defaultDateRange());
const form = reactive({
  customerId: null,
  productId: null,
  requestedAmount: 0,
  requestedTerm: 3,
  purpose: '',
  monthlyIncome: 0,
  monthlyExpense: 0,
  collateralDescription: ''
});
const reviewForm = reactive({
  decision: 'APPROVED',
  approvedAmount: 0,
  approvedTerm: 3,
  startDate: new Date(),
  comment: ''
});
const planForm = reactive({
  requestedAmount: 0,
  requestedTerm: 6,
  comment: ''
});
const customerTermOptions = [6, 12, 24, 36, 48];

const selectedProduct = computed(() =>
  products.value.find((product) => product._id === form.productId)
);
const planProduct = computed(() => selected.value?.productId || null);

function applicationParams() {
  const params = { limit: 100 };
  const [selectedFrom, selectedTo] = filterDateRange.value || [];

  if (!auth.isCustomer && filterCustomerId.value) {
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
    const requests = [
      api.get('/loan-applications', { params: applicationParams() }),
      api.get('/products', { params: { status: 'ACTIVE' } })
    ];

    if (!auth.isCustomer) {
      requests.push(api.get('/customers', { params: { limit: 100 } }));
    }

    const [applicationResponse, productResponse, customerResponse] = await Promise.all(requests);
    items.value = applicationResponse.data.items;
    products.value = productResponse.data.items;
    customers.value = customerResponse?.data.items || [];
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load applications',
      detail: apiError(error),
      life: 4000
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

function openCreate() {
  Object.assign(form, {
    customerId: null,
    productId: products.value[0]?._id || null,
    requestedAmount: 0,
    requestedTerm: 3,
    purpose: '',
    monthlyIncome: 0,
    monthlyExpense: 0,
    collateralDescription: ''
  });
  applyProductDefaults();
  createVisible.value = true;
}

function applyProductDefaults() {
  const product = selectedProduct.value;
  if (!product) return;
  form.requestedAmount = numberValue(product.minimumAmount);
  form.requestedTerm = product.minimumTerm;
}

async function submitApplication() {
  saving.value = true;
  try {
    await api.post('/loan-applications', form);
    toast.add({ severity: 'success', summary: 'Application submitted', life: 2500 });
    createVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Submission failed',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    saving.value = false;
  }
}

function openPlan(item) {
  selected.value = item;
  Object.assign(planForm, {
    requestedAmount: numberValue(item.requestedAmount),
    requestedTerm: Number(item.requestedTerm),
    comment: ''
  });
  planVisible.value = true;
}

async function savePlan() {
  if (!selected.value) return;

  saving.value = true;
  try {
    await api.patch(`/loan-applications/${selected.value._id}/plan`, planForm);
    toast.add({
      severity: 'success',
      summary: 'Application plan updated',
      life: 2500
    });
    planVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Plan update failed',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    saving.value = false;
  }
}

function openReview(item, decision = 'APPROVED') {
  selected.value = item;
  Object.assign(reviewForm, {
    decision,
    approvedAmount: numberValue(item.requestedAmount),
    approvedTerm: item.requestedTerm,
    startDate: new Date(),
    comment: ''
  });
  reviewVisible.value = true;
}

async function submitReview() {
  saving.value = true;
  try {
    await api.post(`/loan-applications/${selected.value._id}/review`, reviewForm);
    toast.add({
      severity: 'success',
      summary: `Application ${reviewForm.decision.toLowerCase()}`,
      life: 2500
    });
    reviewVisible.value = false;
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Review failed', detail: apiError(error), life: 4000 });
  } finally {
    saving.value = false;
  }
}

useRealtimeRefresh(['applications'], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Loan applications" subtitle="Requests awaiting review and approved loan creation.">
      <Button label="New application" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>

    <section class="table-card">
      <div class="mb-5 flex flex-wrap items-end gap-3 border-b border-slate-100 pb-5">
        <div v-if="!auth.isCustomer" class="min-w-[220px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">Customer</label>
          <Select
            v-model="filterCustomerId"
            :options="customers"
            option-value="_id"
            filter
            show-clear
            fluid
            placeholder="All customers"
          >
            <template #option="{ option }">{{ fullName(option) }} — {{ option.customerCode }}</template>
            <template #value="{ value, placeholder }">
              <span v-if="value">{{ fullName(customers.find((customer) => customer._id === value)) }}</span>
              <span v-else>{{ placeholder }}</span>
            </template>
          </Select>
        </div>

        <div class="min-w-[250px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">Submitted date</label>
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
          <Button label="Filter" icon="pi pi-filter" :loading="loading" @click="load" />
          <Button label="Reset" icon="pi pi-refresh" severity="secondary" outlined @click="resetFilters" />
        </div>
      </div>

      <DataTable :value="items" :loading="loading" striped-rows paginator :rows="10" responsive-layout="scroll">
        <template #empty>
          <div class="empty-state"><i class="pi pi-file-edit" />No applications found.</div>
        </template>
        <Column field="applicationNumber" header="Application" sortable />
        <Column v-if="!auth.isCustomer" header="Customer">
          <template #body="{ data }">
            {{ fullName(data.customerId) }}
            <small class="table-subtext">{{ data.customerId?.customerCode }}</small>
          </template>
        </Column>
        <Column header="Product"><template #body="{ data }">{{ data.productId?.name }}</template></Column>
        <Column header="Requested">
          <template #body="{ data }">
            <strong>{{ currency(data.requestedAmount) }}</strong>
            <small class="table-subtext">
              {{ data.requestedTerm }} {{ data.productId?.termUnit?.toLowerCase() }}(s)
            </small>
          </template>
        </Column>
        <Column header="Submitted"><template #body="{ data }">{{ date(data.submittedAt) }}</template></Column>
        <Column header="Status">
          <template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template>
        </Column>
        <Column v-if="auth.isAdmin" header="Review">
          <template #body="{ data }">
            <div v-if="['SUBMITTED', 'UNDER_REVIEW'].includes(data.status)" class="row-actions">
              <Button icon="pi pi-pencil" severity="secondary" size="small" text rounded aria-label="Edit amount and term" @click="openPlan(data)" />
              <Button icon="pi pi-check" severity="success" size="small" text rounded aria-label="Approve" @click="openReview(data, 'APPROVED')" />
              <Button icon="pi pi-times" severity="danger" size="small" text rounded aria-label="Reject" @click="openReview(data, 'REJECTED')" />
            </div>
            <span v-else>—</span>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog v-model:visible="createVisible" modal header="New loan application" :style="{ width: '720px', maxWidth: '95vw' }">
      <form @submit.prevent="submitApplication">
        <div class="form-grid">
          <div v-if="!auth.isCustomer" class="form-field form-field--full">
            <label>Customer *</label>
            <Select v-model="form.customerId" :options="customers" option-value="_id" filter placeholder="Select customer" required>
              <template #option="{ option }">{{ fullName(option) }} — {{ option.customerCode }}</template>
              <template #value="{ value }">{{ fullName(customers.find((customer) => customer._id === value)) }}</template>
            </Select>
          </div>
          <div class="form-field form-field--full">
            <label>Loan product *</label>
            <Select v-model="form.productId" :options="products" option-label="name" option-value="_id" placeholder="Select product" required @change="applyProductDefaults" />
          </div>
          <div class="form-field">
            <label>Requested amount *</label>
            <InputNumber v-model="form.requestedAmount" mode="currency" currency="PHP" locale="en-PH" :min="numberValue(selectedProduct?.minimumAmount)" :max="numberValue(selectedProduct?.maximumAmount) || undefined" required />
          </div>
          <div class="form-field">
            <label>Requested term *</label>
            <InputNumber v-model="form.requestedTerm" :min="selectedProduct?.minimumTerm || 1" :max="selectedProduct?.maximumTerm || undefined" suffix=" periods" required />
          </div>
          <div class="form-field">
            <label>Monthly income</label>
            <InputNumber v-model="form.monthlyIncome" mode="currency" currency="PHP" locale="en-PH" :min="0" />
          </div>
          <div class="form-field">
            <label>Monthly expense</label>
            <InputNumber v-model="form.monthlyExpense" mode="currency" currency="PHP" locale="en-PH" :min="0" />
          </div>
          <div class="form-field form-field--full"><label>Purpose *</label><Textarea v-model="form.purpose" rows="3" required /></div>
          <div class="form-field form-field--full"><label>Collateral description</label><Textarea v-model="form.collateralDescription" rows="2" /></div>
        </div>
        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text @click="createVisible = false" />
          <Button label="Submit application" type="submit" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <Dialog v-model:visible="planVisible" modal header="Edit application plan" :style="{ width: '560px', maxWidth: '95vw' }">
      <form @submit.prevent="savePlan">
        <div class="form-grid">
          <div class="form-field">
            <label>Requested amount *</label>
            <InputNumber
              v-model="planForm.requestedAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="numberValue(planProduct?.minimumAmount)"
              :max="numberValue(planProduct?.maximumAmount) || undefined"
              required
            />
          </div>
          <div class="form-field">
            <label>Requested term *</label>
            <Select
              v-if="selected?.termsAcceptedAt"
              v-model="planForm.requestedTerm"
              :options="customerTermOptions"
              fluid
            />
            <InputNumber
              v-else
              v-model="planForm.requestedTerm"
              :min="planProduct?.minimumTerm || 1"
              :max="planProduct?.maximumTerm || undefined"
              suffix=" periods"
              required
            />
          </div>
          <div class="form-field form-field--full">
            <label>Reason or customer request note</label>
            <Textarea v-model="planForm.comment" rows="3" />
          </div>
        </div>
        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text @click="planVisible = false" />
          <Button label="Save new plan" type="submit" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <Dialog v-model:visible="reviewVisible" modal :header="`${reviewForm.decision === 'APPROVED' ? 'Approve' : 'Reject'} application`" :style="{ width: '560px', maxWidth: '95vw' }">
      <form @submit.prevent="submitReview">
        <div class="form-grid">
          <div class="form-field form-field--full"><label>Decision</label><Select v-model="reviewForm.decision" :options="['APPROVED', 'REJECTED', 'RETURNED']" /></div>
          <template v-if="reviewForm.decision === 'APPROVED'">
            <div class="form-field"><label>Approved amount</label><InputNumber v-model="reviewForm.approvedAmount" mode="currency" currency="PHP" locale="en-PH" :min="0" required /></div>
            <div class="form-field"><label>Approved term</label><InputNumber v-model="reviewForm.approvedTerm" suffix=" periods" :min="1" required /></div>
            <div class="form-field form-field--full"><label>Schedule start date</label><DatePicker v-model="reviewForm.startDate" date-format="M dd, yy" show-icon fluid /></div>
          </template>
          <div class="form-field form-field--full"><label>Review comment</label><Textarea v-model="reviewForm.comment" rows="3" /></div>
        </div>
        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text @click="reviewVisible = false" />
          <Button :label="reviewForm.decision === 'APPROVED' ? 'Approve application' : 'Save decision'" type="submit" :severity="reviewForm.decision === 'REJECTED' ? 'danger' : 'success'" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext {
  display: block;
  margin-top: 0.15rem;
  color: #82919a;
}

.row-actions {
  display: flex;
  gap: 0.2rem;
}
</style>
