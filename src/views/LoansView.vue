<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { apiError, currency, date, fullName, numberValue, statusSeverity } from '../utils/formatters.js';

const auth = useAuthStore();
const confirm = useConfirm();
const toast = useToast();
const items = ref([]);
const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const planVisible = ref(false);
const savingPlan = ref(false);
const selected = ref(null);
const installments = ref([]);
const transactions = ref([]);
const planForm = reactive({
  principalAmount: 0,
  term: 6,
  comment: ''
});

function canRestructure(item) {
  return auth.isAdmin && ['APPROVED', 'ACTIVE', 'OVERDUE'].includes(item?.status);
}

function principalPaid(item) {
  return Math.max(
    numberValue(item?.principalAmount) - numberValue(item?.balances?.principal),
    0
  );
}

function minimumPrincipal(item) {
  return Math.max(principalPaid(item) + 0.01, 0.01);
}

async function load() {
  loading.value = true;
  try {
    items.value = (await api.get('/loans', { params: { limit: 100 } })).data.items;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Cannot load loans', detail: apiError(error), life: 4000 });
  } finally { loading.value = false; }
}

async function openDetail(item) {
  detailVisible.value = true;
  detailLoading.value = true;
  selected.value = item;
  installments.value = [];
  transactions.value = [];
  try {
    const { data } = await api.get(`/loans/${item._id}`);
    selected.value = data.item;
    installments.value = data.installments;
    transactions.value = data.transactions;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Cannot load loan', detail: apiError(error), life: 4000 });
  } finally { detailLoading.value = false; }
}

function openPlan(item) {
  selected.value = item;
  Object.assign(planForm, {
    principalAmount: numberValue(item.principalAmount),
    term: Number(item.term),
    comment: ''
  });
  planVisible.value = true;
}

async function savePlan() {
  if (!selected.value) return;

  savingPlan.value = true;
  try {
    await api.patch(`/loans/${selected.value._id}/plan`, planForm);
    toast.add({
      severity: 'success',
      summary: 'Loan restructured',
      detail: 'Paid history was preserved and the future schedule was regenerated.',
      life: 3000
    });
    planVisible.value = false;
    detailVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Plan update failed',
      detail: apiError(error),
      life: 4500
    });
  } finally {
    savingPlan.value = false;
  }
}

function confirmDisburse(item) {
  confirm.require({
    message: `Disburse ${item.loanNumber} and activate its repayment schedule?`,
    header: 'Confirm disbursement',
    icon: 'pi pi-wallet',
    acceptLabel: 'Disburse loan',
    accept: async () => {
      try {
        await api.post(`/loans/${item._id}/disburse`);
        toast.add({ severity: 'success', summary: 'Loan disbursed', life: 2500 });
        detailVisible.value = false;
        await load();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Disbursement failed', detail: apiError(error), life: 4000 });
      }
    }
  });
}

useRealtimeRefresh(['loans', 'repayments'], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Loan list" subtitle="Approved, active, overdue and completed customer loans.">
      <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </PageHeader>
    <section class="table-card">
      <DataTable :value="items" :loading="loading" striped-rows paginator :rows="10" responsive-layout="scroll">
        <template #empty><div class="empty-state"><i class="pi pi-wallet" />No loans found.</div></template>
        <Column field="loanNumber" header="Loan number" sortable />
        <Column v-if="!auth.isCustomer" header="Customer"><template #body="{ data }">{{ fullName(data.customerId) }}<small class="table-subtext">{{ data.customerId?.customerCode }}</small></template></Column>
        <Column header="Product"><template #body="{ data }">{{ data.productSnapshot?.name || data.productId?.name }}</template></Column>
        <Column header="Principal"><template #body="{ data }">{{ currency(data.principalAmount) }}</template></Column>
        <Column header="Outstanding"><template #body="{ data }"><strong>{{ currency(data.balances?.total) }}</strong></template></Column>
        <Column header="Rate"><template #body="{ data }">{{ numberValue(data.rateSnapshot?.ratePercent) }}%</template></Column>
        <Column header="Maturity"><template #body="{ data }">{{ date(data.maturityDate) }}</template></Column>
        <Column header="Status"><template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template></Column>
        <Column header="">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-if="canRestructure(data)"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit loan amount and term"
                @click="openPlan(data)"
              />
              <Button icon="pi pi-eye" severity="secondary" text rounded aria-label="View loan" @click="openDetail(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog v-model:visible="detailVisible" modal :header="selected?.loanNumber || 'Loan details'" :style="{ width: '1000px', maxWidth: '96vw' }">
      <div v-if="selected" class="detail-list loan-summary">
        <div class="detail-item"><span>Customer</span><strong>{{ fullName(selected.customerId) }}</strong></div>
        <div class="detail-item"><span>Product</span><strong>{{ selected.productSnapshot?.name }}</strong></div>
        <div class="detail-item"><span>Principal</span><strong>{{ currency(selected.principalAmount) }}</strong></div>
        <div class="detail-item"><span>Outstanding</span><strong>{{ currency(selected.balances?.total) }}</strong></div>
        <div class="detail-item"><span>Interest</span><strong>{{ currency(selected.totalInterest) }}</strong></div>
        <div class="detail-item"><span>Status</span><Tag :value="selected.status" :severity="statusSeverity(selected.status)" /></div>
      </div>

      <h3>Installment schedule</h3>
      <DataTable :value="installments" :loading="detailLoading" striped-rows scrollable scroll-height="340px" responsive-layout="scroll">
        <template #empty><div class="empty-state">No installment schedule.</div></template>
        <Column field="installmentNumber" header="#" />
        <Column header="Due date"><template #body="{ data }">{{ date(data.dueDate) }}</template></Column>
        <Column header="Principal"><template #body="{ data }">{{ currency(data.principalDue) }}</template></Column>
        <Column header="Interest"><template #body="{ data }">{{ currency(data.interestDue) }}</template></Column>
        <Column header="Total due"><template #body="{ data }">{{ currency(data.totalDue) }}</template></Column>
        <Column header="Remaining"><template #body="{ data }"><strong>{{ currency(data.remainingDue) }}</strong></template></Column>
        <Column header="Status"><template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template></Column>
      </DataTable>

      <template #footer>
        <Button label="Close" severity="secondary" text @click="detailVisible = false" />
        <Button v-if="canRestructure(selected)" label="Edit plan" icon="pi pi-pencil" severity="secondary" outlined @click="openPlan(selected)" />
        <Button v-if="auth.isAdmin && selected?.status === 'APPROVED'" label="Disburse loan" icon="pi pi-wallet" severity="success" @click="confirmDisburse(selected)" />
      </template>
    </Dialog>

    <Dialog v-model:visible="planVisible" modal header="Restructure loan plan" :style="{ width: '600px', maxWidth: '95vw' }">
      <form @submit.prevent="savePlan">
        <div v-if="selected" class="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div>
            <span class="block text-slate-500">Principal already paid</span>
            <strong class="text-slate-900">{{ currency(principalPaid(selected)) }}</strong>
          </div>
          <div>
            <span class="block text-slate-500">Current outstanding principal</span>
            <strong class="text-slate-900">{{ currency(selected.balances?.principal) }}</strong>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label>New total principal amount *</label>
            <InputNumber
              v-model="planForm.principalAmount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="minimumPrincipal(selected)"
              required
            />
          </div>
          <div class="form-field">
            <label>Remaining future installments *</label>
            <InputNumber v-model="planForm.term" suffix=" installments" :min="1" required />
          </div>
          <div class="form-field form-field--full">
            <label>Reason or customer request note</label>
            <Textarea v-model="planForm.comment" rows="3" />
          </div>
        </div>

        <p class="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          Saving keeps all repayment receipts, allocations, transactions and paid installments. Existing unpaid installments are waived and replaced with a new future schedule. The new total principal must be greater than the principal already paid.
        </p>

        <div class="form-actions">
          <Button label="Cancel" type="button" severity="secondary" text @click="planVisible = false" />
          <Button label="Restructure loan" type="submit" :loading="savingPlan" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext { display: block; margin-top: .15rem; color: #82919a; }
.loan-summary { margin-bottom: 1.25rem; }
h3 { margin: 1.25rem 0 .75rem; font-size: 1rem; }
</style>
