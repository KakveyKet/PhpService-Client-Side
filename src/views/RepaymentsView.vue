<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import DatePicker from "primevue/datepicker";
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
  dateTime,
  fullName,
  numberValue,
  statusSeverity,
} from "../utils/formatters.js";

const auth = useAuthStore();
const toast = useToast();
const items = ref([]);
const loans = ref([]);
const loading = ref(false);
const saving = ref(false);
const createVisible = ref(false);
const reverseVisible = ref(false);
const selectedRepayment = ref(null);
const selectedInstallment = ref(null);
const loadingInstallment = ref(false);
const form = reactive({
  loanId: null,
  amount: 0,
  paymentMethod: "CASH",
  transactionReference: "",
  paymentDate: new Date(),
  note: "",
});
const reverseReason = ref("");
const selectedLoan = computed(() =>
  loans.value.find((loan) => loan._id === form.loanId),
);

async function load() {
  loading.value = true;
  try {
    const [repaymentResponse, loanResponse] = await Promise.all([
      api.get("/repayments"),
      api.get("/loans", { params: { limit: 100 } }),
    ]);
    items.value = repaymentResponse.data.items;
    loans.value = loanResponse.data.items.filter((loan) => {
      return ["APPROVED", "ACTIVE", "OVERDUE"].includes(loan.status);
    });
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load repayments",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!auth.isAdmin) return;

  Object.assign(form, {
    loanId: loans.value[0]?._id || null,
    amount: 0,
    paymentMethod: "CASH",
    transactionReference: "",
    paymentDate: new Date(),
    note: "",
  });
  selectedInstallment.value = null;
  createVisible.value = true;

  if (form.loanId) applyBalance();
}

async function applyBalance() {
  form.amount = 0;
  selectedInstallment.value = null;

  if (!form.loanId) return;

  loadingInstallment.value = true;

  try {
    const { data } = await api.get(`/loans/${form.loanId}`);
    const installment = (data.installments || []).find((item) => {
      return ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(item.status);
    });

    selectedInstallment.value = installment || null;

    if (installment) {
      form.amount = numberValue(
        installment.status === "PARTIALLY_PAID"
          ? installment.remainingDue
          : installment.totalDue,
      );
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load installment amount",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loadingInstallment.value = false;
  }
}

async function save() {
  if (!auth.isAdmin) return;

  saving.value = true;
  try {
    await api.post("/repayments", form);
    toast.add({
      severity: "success",
      summary: "Repayment confirmed",
      life: 2500,
    });
    createVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Payment failed",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    saving.value = false;
  }
}

function openReverse(item) {
  if (!auth.isAdmin) return;

  selectedRepayment.value = item;
  reverseReason.value = "";
  reverseVisible.value = true;
}

async function reversePayment() {
  if (!auth.isAdmin || !selectedRepayment.value) return;

  saving.value = true;
  try {
    await api.post(`/repayments/${selectedRepayment.value._id}/reverse`, {
      reason: reverseReason.value,
    });
    toast.add({
      severity: "success",
      summary: "Repayment reversed",
      life: 2500,
    });
    reverseVisible.value = false;
    await load();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Reversal failed",
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
      title="Repayments"
      subtitle="Record customer returns and allocate them to the oldest unpaid installments."
    >
      <Button
        v-if="auth.isAdmin"
        label="Record repayment"
        icon="pi pi-plus"
        @click="openCreate"
      />
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
        <template #empty
          ><div class="empty-state">
            <i class="pi pi-receipt" />No repayments found.
          </div></template
        >
        <Column field="receiptNumber" header="Receipt" sortable />
        <Column header="Customer"
          ><template #body="{ data }"
            >{{ fullName(data.customerId)
            }}<small class="table-subtext">{{
              data.customerId?.customerCode
            }}</small></template
          ></Column
        >
        <Column header="Amount"
          ><template #body="{ data }"
            ><strong>{{ currency(data.amount) }}</strong></template
          ></Column
        >
        <Column field="paymentMethod" header="Method" />
        <Column header="Payment date"
          ><template #body="{ data }">{{
            dateTime(data.paymentDate)
          }}</template></Column
        >
        <Column header="Received by"
          ><template #body="{ data }">{{
            data.receivedBy?.displayName
          }}</template></Column
        >
        <Column header="Status"
          ><template #body="{ data }"
            ><Tag
              :value="data.status"
              :severity="statusSeverity(data.status)" /></template
        ></Column>
        <Column v-if="auth.isAdmin" header=""
          ><template #body="{ data }"
            ><Button
              v-if="data.status === 'CONFIRMED'"
              icon="pi pi-undo"
              severity="danger"
              text
              rounded
              aria-label="Reverse payment"
              @click="openReverse(data)" /></template
        ></Column>
      </DataTable>
    </section>

    <Dialog
      v-if="auth.isAdmin"
      v-model:visible="createVisible"
      modal
      header="Record repayment"
      :style="{ width: '620px', maxWidth: '95vw' }"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field form-field--full">
            <label>Approved or active loan *</label
            ><Select
              v-model="form.loanId"
              :options="loans"
              option-value="_id"
              filter
              placeholder="Select loan"
              required
              @change="applyBalance"
              ><template #option="{ option }"
                >{{ option.loanNumber }} — {{ fullName(option.customerId) }} —
                {{ option.status }} —
                {{ currency(option.balances?.total) }}</template
              ><template #value="{ value }"
                ><span v-if="value">{{
                  loans.find((loan) => loan._id === value)?.loanNumber
                }}</span
                ><span v-else>Select loan</span></template
              ></Select
            >
          </div>
          <div v-if="selectedLoan" class="form-field form-field--full">
            <div class="detail-item">
              <span>Outstanding balance</span
              ><strong>{{ currency(selectedLoan.balances?.total) }}</strong>
            </div>
          </div>
          <div v-if="selectedInstallment" class="form-field form-field--full">
            <div class="detail-item">
              <span>Next installment total due</span
              ><strong>{{ currency(selectedInstallment.totalDue) }}</strong>
            </div>
            <div class="detail-item">
              <span>Remaining due</span
              ><strong>{{ currency(selectedInstallment.remainingDue) }}</strong>
            </div>
          </div>
          <div class="form-field">
            <label>Payment amount *</label
            ><InputNumber
              v-model="form.amount"
              mode="currency"
              currency="PHP"
              locale="en-PH"
              :min="0.01"
              :max="numberValue(selectedLoan?.balances?.total) || undefined"
              :disabled="loadingInstallment"
              required
            />
          </div>
          <div class="form-field">
            <label>Payment method *</label
            ><Select
              v-model="form.paymentMethod"
              :options="['CASH', 'BANK_TRANSFER']"
            />
          </div>
          <div class="form-field">
            <label>Payment date</label
            ><DatePicker
              v-model="form.paymentDate"
              show-time
              hour-format="12"
              show-icon
              fluid
            />
          </div>
          <div class="form-field">
            <label>Reference</label
            ><InputText v-model="form.transactionReference" />
          </div>
          <div class="form-field form-field--full">
            <label>Note</label><Textarea v-model="form.note" rows="2" />
          </div>
        </div>
        <div class="form-actions">
          <Button
            label="Cancel"
            severity="secondary"
            text
            type="button"
            @click="createVisible = false"
          /><Button
            label="Confirm repayment"
            type="submit"
            :disabled="loadingInstallment || !form.loanId || form.amount <= 0"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>

    <Dialog
      v-if="auth.isAdmin"
      v-model:visible="reverseVisible"
      modal
      header="Reverse repayment"
      :style="{ width: '480px', maxWidth: '95vw' }"
    >
      <p>
        This restores the loan and installment balances. The original receipt
        remains in the audit history.
      </p>
      <div class="form-field">
        <label>Reversal reason *</label
        ><Textarea v-model="reverseReason" rows="3" required />
      </div>
      <template #footer
        ><Button
          label="Cancel"
          severity="secondary"
          text
          @click="reverseVisible = false" /><Button
          label="Reverse repayment"
          severity="danger"
          :disabled="!reverseReason"
          :loading="saving"
          @click="reversePayment"
      /></template>
    </Dialog>
  </div>
</template>

<style scoped>
.table-subtext {
  display: block;
  margin-top: 0.15rem;
  color: #82919a;
}
</style>
