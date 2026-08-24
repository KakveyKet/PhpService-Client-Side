<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import {
  apiError,
  currency,
  date,
  fullName,
  statusSeverity
} from '../utils/formatters.js';

const auth = useAuthStore();
const toast = useToast();

const loans = ref([]);
const selectedLoanId = ref(null);
const contractTemplate = ref(null);
const contract = ref(null);
const loading = ref(true);
const loadingContract = ref(false);
const saving = ref(false);
const editVisible = ref(false);

const editForm = reactive({
  title: '',
  beneficiaryBankName: '',
  body: '',
  status: 'ACTIVE'
});

const canEdit = computed(() => auth.isAdmin);
const selectedLoan = computed(() =>
  loans.value.find((loan) => loan._id === selectedLoanId.value)
);

async function loadContract() {
  if (!selectedLoanId.value) {
    contract.value = null;
    return;
  }

  loadingContract.value = true;
  try {
    const { data } = await api.get(`/contracts/loans/${selectedLoanId.value}`);
    contract.value = data.item;
    contractTemplate.value = data.item.template;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load contract',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    loadingContract.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    const [loanResponse, templateResponse] = await Promise.all([
      api.get('/loans', { params: { limit: 100 } }),
      api.get('/contracts/template')
    ]);

    loans.value = loanResponse.data.items.filter(
      (loan) => loan.status !== 'CANCELLED'
    );
    contractTemplate.value = templateResponse.data.item;

    const preferredLoan =
      loans.value.find((loan) =>
        ['APPROVED', 'ACTIVE', 'OVERDUE'].includes(loan.status)
      ) || loans.value[0];

    selectedLoanId.value = preferredLoan?._id || null;
    await loadContract();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Cannot load contracts',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  if (!contractTemplate.value || !canEdit.value) return;

  Object.assign(editForm, {
    title: contractTemplate.value.title || 'Loan Contract',
    beneficiaryBankName: contractTemplate.value.beneficiaryBankName || '',
    body: contractTemplate.value.body || '',
    status: contractTemplate.value.status || 'ACTIVE'
  });
  editVisible.value = true;
}

async function saveTemplate() {
  saving.value = true;
  try {
    const { data } = await api.patch('/contracts/template', editForm);
    contractTemplate.value = data.item;
    editVisible.value = false;

    if (selectedLoanId.value) {
      await loadContract();
    }

    toast.add({
      severity: 'success',
      summary: 'Contract template saved',
      life: 2500
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: apiError(error),
      life: 4000
    });
  } finally {
    saving.value = false;
  }
}

function printContract() {
  if (!contract.value) return;
  window.print();
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Loan contract">
      <Button
        v-if="canEdit"
        label="Edit contract"
        icon="pi pi-pencil"
        severity="secondary"
        outlined
        @click="openEdit"
      />
      <Button
        label="Print contract"
        icon="pi pi-print"
        :disabled="!contract"
        @click="printContract"
      />
    </PageHeader>

    <section class="contract-controls table-card mb-5">
      <div class="flex flex-wrap items-end gap-3 p-5">
        <div class="min-w-[280px] flex-1">
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Select borrower loan
          </label>
          <Select
            v-model="selectedLoanId"
            :options="loans"
            option-value="_id"
            filter
            fluid
            placeholder="Select a loan"
            @change="loadContract"
          >
            <template #option="{ option }">
              <div>
                <strong>{{ option.loanNumber }}</strong>
                <span class="ml-2 text-slate-500">
                  {{ fullName(option.customerId) }} — {{ option.productSnapshot?.name }}
                </span>
              </div>
            </template>
            <template #value="{ value, placeholder }">
              <span v-if="value">
                {{ selectedLoan?.loanNumber }} — {{ fullName(selectedLoan?.customerId) }}
              </span>
              <span v-else>{{ placeholder }}</span>
            </template>
          </Select>
        </div>

        <Tag
          v-if="selectedLoan"
          :value="selectedLoan.status"
          :severity="statusSeverity(selectedLoan.status)"
        />
      </div>
    </section>

    <Message class="contract-note mb-5" severity="warn" :closable="false">
      This is an editable system template, not legal advice. Have the final terms reviewed by qualified Philippine legal counsel before production use.
    </Message>

    <div v-if="loading || loadingContract" class="space-y-4">
      <Skeleton height="160px" border-radius="18px" />
      <Skeleton height="520px" border-radius="18px" />
    </div>

    <section
      v-else-if="contract"
      id="loan-contract"
      class="contract-paper mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10"
    >
      <header class="border-b border-slate-200 pb-6 text-center">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Loan Filipinas Service
        </p>
        <h1 class="mt-2 text-2xl font-bold uppercase text-slate-950">
          {{ contract.template.title }}
        </h1>
        <p class="mt-2 text-sm text-slate-500">
          Loan No. {{ contract.loan.loanNumber }}
        </p>
      </header>

      <dl class="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div class="contract-detail">
          <dt>Name of the borrower</dt>
          <dd>{{ contract.borrower.name }}</dd>
        </div>
        <div class="contract-detail">
          <dt>ID Number</dt>
          <dd>{{ contract.borrower.idNumber }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Mobile Number</dt>
          <dd>{{ contract.borrower.mobileNumber }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Installment Payment</dt>
          <dd>{{ currency(contract.loan.installmentPayment) }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Credit</dt>
          <dd>{{ contract.loan.creditTerm }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Beneficiary Bank Name</dt>
          <dd>{{ contract.template.beneficiaryBankName || '—' }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Principal Amount</dt>
          <dd>{{ currency(contract.loan.principalAmount) }}</dd>
        </div>
        <div class="contract-detail">
          <dt>Contract Period</dt>
          <dd>{{ date(contract.loan.startDate) }} — {{ date(contract.loan.maturityDate) }}</dd>
        </div>
      </dl>

      <div class="mt-8 whitespace-pre-wrap text-justify text-sm leading-7 text-slate-700">
        {{ contract.template.body }}
      </div>

      <div class="mt-14 grid grid-cols-2 gap-10 text-center text-sm text-slate-700">
        <div>
          <div class="h-16" />
          <div class="border-t border-slate-500 pt-2 font-semibold">Lender signature</div>
          <p class="mt-1 text-xs text-slate-500">Loan Filipinas Service</p>
        </div>
        <div>
          <div class="h-16" />
          <div class="border-t border-slate-500 pt-2 font-semibold">Borrower signature</div>
          <p class="mt-1 text-xs text-slate-500">{{ contract.borrower.name }}</p>
        </div>
      </div>
    </section>

    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
    >
      <i class="pi pi-file-edit text-3xl text-slate-400" />
      <strong class="mt-3 block text-slate-800">No loan contract available</strong>
      <span class="mt-1 block text-sm text-slate-500">
        A loan must be approved before its contract can be viewed.
      </span>
    </div>

    <Dialog
      v-model:visible="editVisible"
      modal
      header="Edit loan contract template"
      :style="{ width: '820px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="saveTemplate">
        <div class="form-grid">
          <div class="form-field">
            <label>Contract title *</label>
            <InputText v-model="editForm.title" required />
          </div>
          <div class="form-field">
            <label>Beneficiary bank name</label>
            <InputText v-model="editForm.beneficiaryBankName" />
          </div>
          <div class="form-field form-field--full">
            <label>Contract status</label>
            <Select v-model="editForm.status" :options="['ACTIVE', 'INACTIVE']" />
          </div>
          <div class="form-field form-field--full">
            <label>Agreement content *</label>
            <Textarea
              v-model="editForm.body"
              rows="24"
              auto-resize
              required
            />
          </div>
        </div>

        <div class="form-actions">
          <Button
            label="Cancel"
            type="button"
            severity="secondary"
            text
            @click="editVisible = false"
          />
          <Button label="Save contract" type="submit" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.contract-detail {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
}

.contract-detail dt {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.contract-detail dd {
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0;
}

@media print {
  :global(body) {
    background: white !important;
  }

  :global(.sidebar),
  :global(.topbar),
  :global(.page-header),
  .contract-controls,
  .contract-note {
    display: none !important;
  }

  :global(.app-main),
  :global(.page-container) {
    margin: 0 !important;
    max-width: none !important;
    padding: 0 !important;
    width: 100% !important;
  }

  .contract-paper {
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    max-width: none !important;
    padding: 0 !important;
  }
}
</style>
