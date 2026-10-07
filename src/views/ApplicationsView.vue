<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { apiError, currency, date, fullName, numberValue, statusSeverity } from '../utils/formatters.js';
import {
  datePeriodOptions,
  matchesCustomerSearch,
  matchesDatePeriod
} from '../utils/tableFilters.js';

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
const noteVisible = ref(false);
const selected = ref(null);
const filterSearch = ref('');
const filterPeriod = ref('ALL');
const filterDateRange = ref(null);
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
const noteForm = reactive({
  note: ''
});
const customerTermOptions = [6, 12, 24, 36, 48];

const selectedProduct = computed(() =>
  products.value.find((product) => product._id === form.productId)
);
const planProduct = computed(() => selected.value?.productId || null);

const filteredItems = computed(() => {
  return items.value.filter((item) => {
    const submittedAt = item.submittedAt || item.createdAt;
    return matchesCustomerSearch(item.customerId, filterSearch.value) &&
      matchesDatePeriod(submittedAt, filterPeriod.value, filterDateRange.value);
  });
});

async function load() {
  loading.value = true;
  try {
    const requests = [
      api.get('/loan-applications', { params: { limit: 1000 } }),
      api.get('/products', { params: { status: 'ACTIVE' } })
    ];

    if (!auth.isCustomer) {
      requests.push(api.get('/customers', { params: { limit: 1000 } }));
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
  filterSearch.value = '';
  filterPeriod.value = 'ALL';
  filterDateRange.value = null;
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

function openCustomerNote(item) {
  selected.value = item;
  noteForm.note = item.customerNote || '';
  noteVisible.value = true;
}

async function saveCustomerNote() {
  if (!selected.value?._id) return;

  saving.value = true;
  try {
    await api.patch(`/loan-applications/${selected.value._id}/customer-note`, {
      note: noteForm.note
    });
    toast.add({
      severity: 'success',
      summary: noteForm.note.trim() ? 'Customer note sent' : 'Customer note cleared',
      detail: 'The application status was not changed.',
      life: 3000
    });
    noteVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot save customer note',
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
      <div class="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
        <div v-if="!auth.isCustomer" class="min-w-[240px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">Customer or username</label>
          <InputText
            v-model="filterSearch"
            class="w-full"
            placeholder="Search name, username, code or phone"
          />
        </div>

        <div class="min-w-[190px]">
          <label class="mb-2 block text-sm font-semibold text-slate-700">Date period</label>
          <Select
            v-model="filterPeriod"
            :options="datePeriodOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>

        <div v-if="filterPeriod === 'CUSTOM'" class="min-w-[260px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">Date range</label>
          <DatePicker
            v-model="filterDateRange"
            selection-mode="range"
            :manual-input="false"
            date-format="M dd, yy"
            show-icon
            fluid
            placeholder="Start date - End date"
          />
        </div>

        <Button label="Reset" icon="pi pi-filter-slash" severity="secondary" outlined @click="resetFilters" />
      </div>

      <DataTable :value="filteredItems" :loading="loading" striped-rows paginator :rows="10" responsive-layout="scroll">
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
        <Column header="Loan purpose"> 
          <template #body="{ data }"> 
            <span class="block max-w-[220px] whitespace-normal break-words"> 
              {{ data.purpose || '—' }} 
            </span> 
          </template> 
        </Column> 
        <Column header="Monthly income"> 
          <template #body="{ data }"> 
            <strong> 
              {{ currency(data.monthlyIncome ?? data.customerId?.monthlyIncome) }} 
            </strong> 
          </template> 
        </Column> 
        <Column header="Occupation"> 
          <template #body="{ data }"> 
            {{ data.applicantSnapshot?.occupation || data.customerId?.occupation || '—' }} 
          </template> 
        </Column> 
        <Column header="Submitted"><template #body="{ data }">{{ date(data.submittedAt) }}</template></Column> 
        <Column header="Status">
          <template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template>
        </Column>
        <Column header="Customer note">
          <template #body="{ data }">
            <span
              v-if="data.customerNote"
              class="block max-w-[260px] whitespace-normal rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800"
            >
              {{ data.customerNote }}
            </span>
            <span v-else class="text-slate-400">—</span>
          </template>
        </Column>
        <Column v-if="auth.isAdmin" header="Operations">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                label="Note"
                icon="pi pi-comment"
                severity="warn"
                size="small"
                text
                aria-label="Write customer note"
                @click="openCustomerNote(data)"
              />
              <template v-if="['SUBMITTED', 'UNDER_REVIEW'].includes(data.status)">
                <Button icon="pi pi-pencil" severity="secondary" size="small" text rounded aria-label="Edit amount and term" @click="openPlan(data)" />
                <Button icon="pi pi-check" severity="success" size="small" text rounded aria-label="Approve" @click="openReview(data, 'APPROVED')" />
                <Button icon="pi pi-times" severity="danger" size="small" text rounded aria-label="Reject" @click="openReview(data, 'REJECTED')" />
              </template>
            </div>
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

    <Dialog
      v-model:visible="noteVisible"
      modal
      header="Customer application note"
      :style="{ width: '560px', maxWidth: '95vw' }"
      :closable="!saving"
      :close-on-escape="!saving"
    >
      <form @submit.prevent="saveCustomerNote">
        <div v-if="selected" class="mb-4 rounded-xl bg-slate-50 p-4">
          <span class="block text-xs text-slate-500">Application</span>
          <strong class="mt-1 block text-sm text-slate-900">
            {{ selected.applicationNumber }} · {{ fullName(selected.customerId) }}
          </strong>
          <Tag
            class="mt-2"
            :value="selected.status"
            :severity="statusSeverity(selected.status)"
          />
        </div>

        <div class="form-field">
          <label for="applicationCustomerNote">Note for customer</label>
          <Textarea
            id="applicationCustomerNote"
            v-model="noteForm.note"
            rows="5"
            maxlength="1000"
            fluid
            placeholder="Example: Please provide a clearer ID card photo or confirm your bank account number."
          />
          <small>
            The customer will see this note and receive a notification. Saving
            it does not approve, reject, or change the application status.
          </small>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            type="button"
            severity="secondary"
            text
            :disabled="saving"
            @click="noteVisible = false"
          />
          <Button
            :label="noteForm.note.trim() ? 'Send note to customer' : 'Clear customer note'"
            type="submit"
            icon="pi pi-send"
            severity="warn"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>

    <Dialog v-model:visible="reviewVisible" modal :header="`${reviewForm.decision === 'APPROVED' ? 'Approve' : 'Reject'} application`" :style="{ width: '560px', maxWidth: '95vw' }"> 
      <form @submit.prevent="submitReview"> 
        <div v-if="selected" class="mb-5 grid gap-3 sm:grid-cols-3"> 
          <div class="rounded-xl bg-slate-50 p-3"> 
            <span class="block text-xs text-slate-500">Loan purpose</span> 
            <strong class="mt-1 block break-words text-sm text-slate-900"> 
              {{ selected.purpose || '—' }} 
            </strong> 
          </div> 
          <div class="rounded-xl bg-slate-50 p-3"> 
            <span class="block text-xs text-slate-500">Monthly income</span> 
            <strong class="mt-1 block text-sm text-slate-900"> 
              {{ currency(selected.monthlyIncome ?? selected.customerId?.monthlyIncome) }} 
            </strong> 
          </div> 
          <div class="rounded-xl bg-slate-50 p-3"> 
            <span class="block text-xs text-slate-500">Occupation</span> 
            <strong class="mt-1 block break-words text-sm text-slate-900"> 
              {{ selected.applicantSnapshot?.occupation || selected.customerId?.occupation || '—' }} 
            </strong> 
          </div> 
        </div> 
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
