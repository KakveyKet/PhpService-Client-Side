<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.js';
import { useRealtimeRefresh } from '../composables/useRealtimeRefresh.js';
import { useAuthStore } from '../stores/auth.js';
import { apiError, numberValue } from '../utils/formatters.js';

const auth = useAuthStore();
const confirm = useConfirm();
const toast = useToast();
const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref(null);
const emptyForm = () => ({ rateCode: '', name: '', ratePercent: 0.7 });
const form = reactive(emptyForm());

async function load() {
  loading.value = true;
  try {
    items.value = (await api.get('/rates')).data.items;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Cannot load rates', detail: apiError(error), life: 4000 });
  } finally { loading.value = false; }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(item) {
  editingId.value = item._id;
  Object.assign(form, {
    rateCode: item.rateCode,
    name: item.name,
    ratePercent: numberValue(item.ratePercent)
  });
  dialogVisible.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (editingId.value) await api.patch(`/rates/${editingId.value}`, form);
    else await api.post('/rates', form);
    toast.add({ severity: 'success', summary: 'Rate saved', life: 2500 });
    dialogVisible.value = false;
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: apiError(error), life: 4000 });
  } finally { saving.value = false; }
}

function confirmDelete(item) {
  if (!auth.isAdmin) return;

  confirm.require({
    header: 'Delete interest rate',
    message: `Delete ${item.rateCode} — ${item.name}?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete rate',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/rates/${item._id}`);
        toast.add({
          severity: 'success',
          summary: 'Rate deleted',
          life: 2500
        });
        await load();
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: apiError(error),
          life: 4500
        });
      }
    }
  });
}

useRealtimeRefresh(['rates'], load);
onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Interest rates" subtitle="Reusable rate definitions assigned to loan products.">
      <Button v-if="auth.isAdmin" label="Add rate" icon="pi pi-plus" @click="openCreate" />
    </PageHeader>
    <section class="table-card">
      <DataTable :value="items" :loading="loading" striped-rows responsive-layout="scroll">
        <template #empty><div class="empty-state"><i class="pi pi-percentage" />No rates configured.</div></template>
        <Column field="rateCode" header="Code" />
        <Column field="name" header="Rate name" />
        <Column header="Percentage"><template #body="{ data }"><strong>{{ numberValue(data.ratePercent) }}%</strong></template></Column>
        <Column field="period" header="Period" />
        <Column v-if="auth.isAdmin" header="">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button icon="pi pi-pencil" severity="secondary" text rounded aria-label="Edit rate" @click="openEdit(data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Delete rate" @click="confirmDelete(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId ? 'Edit rate' : 'Add rate'" :style="{ width: '560px', maxWidth: '95vw' }">
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="form-field"><label>Rate code *</label><InputText v-model.trim="form.rateCode" required /></div>
          <div class="form-field"><label>Name *</label><InputText v-model="form.name" required /></div>
          <div class="form-field"><label>Percentage *</label><InputNumber v-model="form.ratePercent" suffix="%" :min-fraction-digits="1" :max-fraction-digits="6" :min="0" required /></div>
        </div>
        <div class="form-actions"><Button label="Cancel" severity="secondary" text type="button" @click="dialogVisible = false" /><Button label="Save rate" type="submit" :loading="saving" /></div>
      </form>
    </Dialog>
  </div>
</template>
