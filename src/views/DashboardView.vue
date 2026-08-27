<script setup>
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import PageHeader from '../components/PageHeader.vue';
import StatCard from '../components/StatCard.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { apiError, currency, date, fullName, numberValue, statusSeverity } from '../utils/formatters.js';

const auth = useAuthStore();
const loading = ref(true);
const errorMessage = ref('');
const dashboard = ref({});
const quickAccessItems = [
  {
    label: 'Customers',
    description: 'View and manage customer accounts',
    icon: 'pi pi-users',
    to: '/customers'
  },
  {
    label: 'Loan applications',
    description: 'Review pending loan requests',
    icon: 'pi pi-file-edit',
    to: '/applications'
  },
  {
    label: 'Loans',
    description: 'Open approved and active loans',
    icon: 'pi pi-wallet',
    to: '/loans'
  },
  {
    label: 'Reports',
    description: 'View loan approval and repayment reports',
    icon: 'pi pi-chart-bar',
    to: '/reports'
  }
];

const customerOutstanding = computed(() => {
  return (dashboard.value.loans || [])
    .filter((loan) => ['ACTIVE', 'OVERDUE'].includes(loan.status))
    .reduce((sum, loan) => sum + numberValue(loan.balances?.total), 0);
});

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const { data } = await api.get('/dashboard');
    dashboard.value = data.data;
  } catch (error) {
    errorMessage.value = apiError(error);
  } finally {
    loading.value = false;
  }
}

useRealtimeRefresh(['dashboard'], loadDashboard);
onMounted(loadDashboard);
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      :subtitle="auth.isCustomer ? 'Your applications, balances and next payment.' : 'A live overview of lending operations.'"
    >
      <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined @click="loadDashboard" />
    </PageHeader>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div v-if="loading" class="stats-grid">
      <Skeleton v-for="index in 4" :key="index" height="126px" border-radius="18px" />
    </div>

    <template v-else-if="auth.isCustomer">
      <div class="stats-grid">
        <StatCard label="Applications" :value="dashboard.applicationCount || 0" icon="pi pi-file-edit" tone="blue" />
        <StatCard label="Active loans" :value="dashboard.activeLoanCount || 0" icon="pi pi-wallet" />
        <StatCard label="Outstanding" :value="currency(customerOutstanding)" icon="pi pi-chart-line" tone="amber" />
        <StatCard label="Next payment" :value="currency(dashboard.nextInstallment?.remainingDue)" icon="pi pi-calendar" tone="rose" :note="date(dashboard.nextInstallment?.dueDate)" />
      </div>
      <section class="table-card">
        <div class="panel-card__header"><h2>My loans</h2><RouterLink to="/applications"><Button label="Request loan" icon="pi pi-plus" size="small" /></RouterLink></div>
        <DataTable :value="dashboard.loans || []" striped-rows responsive-layout="scroll">
          <template #empty><div class="empty-state"><i class="pi pi-wallet" />No loans yet.</div></template>
          <Column field="loanNumber" header="Loan number" />
          <Column header="Product"><template #body="{ data }">{{ data.productSnapshot?.name }}</template></Column>
          <Column header="Principal"><template #body="{ data }">{{ currency(data.principalAmount) }}</template></Column>
          <Column header="Balance"><template #body="{ data }"><strong>{{ currency(data.balances?.total) }}</strong></template></Column>
          <Column header="Maturity"><template #body="{ data }">{{ date(data.maturityDate) }}</template></Column>
          <Column header="Status"><template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template></Column>
        </DataTable>
      </section>
    </template>

    <template v-else-if="!loading">
      <div class="stats-grid">
        <StatCard label="Active customers" :value="dashboard.customerCount || 0" icon="pi pi-users" />
        <StatCard label="Pending applications" :value="dashboard.pendingApplicationCount || 0" icon="pi pi-file-edit" tone="blue" />
        <StatCard label="Portfolio balance" :value="currency(dashboard.portfolioBalance)" icon="pi pi-wallet" tone="amber" />
        <StatCard label="Today's collections" :value="currency(dashboard.todayCollections)" icon="pi pi-receipt" tone="rose" />
      </div>

      <div class="content-grid">
        <section class="table-card">
          <div class="panel-card__header"><h2>Recent applications</h2><RouterLink to="/applications"><Button label="View all" size="small" text /></RouterLink></div>
          <DataTable :value="dashboard.recentApplications || []" striped-rows responsive-layout="scroll">
            <template #empty><div class="empty-state"><i class="pi pi-file" />No applications found.</div></template>
            <Column field="applicationNumber" header="Application" />
            <Column header="Customer"><template #body="{ data }">{{ fullName(data.customerId) }}</template></Column>
            <Column header="Product"><template #body="{ data }">{{ data.productId?.name }}</template></Column>
            <Column header="Amount"><template #body="{ data }">{{ currency(data.requestedAmount) }}</template></Column>
            <Column header="Status"><template #body="{ data }"><Tag :value="data.status" :severity="statusSeverity(data.status)" /></template></Column>
          </DataTable>
        </section>

        <section class="panel-card">
          <div class="panel-card__header">
            <h2>Quick access</h2>
          </div>
          <div class="grid gap-3 p-4">
            <RouterLink
              v-for="item in quickAccessItems"
              :key="item.to"
              :to="item.to"
              class="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm"
            >
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                <i :class="item.icon" />
              </span>
              <span class="min-w-0 flex-1">
                <strong class="block text-sm text-slate-900">{{ item.label }}</strong>
                <small class="mt-0.5 block text-xs leading-5 text-slate-500">{{ item.description }}</small>
              </span>
              <i class="pi pi-chevron-right text-xs text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
            </RouterLink>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
