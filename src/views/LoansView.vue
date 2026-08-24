<script setup>
import { onMounted, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { apiError, currency, date, fullName, numberValue, statusSeverity } from '../utils/formatters.js';

const auth = useAuthStore();
const confirm = useConfirm();
const toast = useToast();
const items = ref([]);
const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const selected = ref(null);
const installments = ref([]);
const transactions = ref([]);

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
        <Column header=""><template #body="{ data }"><Button icon="pi pi-eye" severity="secondary" text rounded @click="openDetail(data)" /></template></Column>
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
        <Button v-if="auth.isAdmin && selected?.status === 'APPROVED'" label="Disburse loan" icon="pi pi-wallet" severity="success" @click="confirmDisburse(selected)" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext { display: block; margin-top: .15rem; color: #82919a; }
.loan-summary { margin-bottom: 1.25rem; }
h3 { margin: 1.25rem 0 .75rem; font-size: 1rem; }
</style>
