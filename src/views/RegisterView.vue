<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { useAuthStore } from '../stores/auth.js';
import { apiError } from '../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const errorMessage = ref('');
const form = reactive({
  username: '',
  email: '',
  phone: '',
  password: '',
  firstName: '',
  middleName: '',
  lastName: '',
  nationalId: '',
  occupation: '',
  monthlyIncome: 0,
  address: { street: '', barangay: '', city: '', province: '', postalCode: '' }
});

async function submit() {
  errorMessage.value = '';
  try {
    await auth.registerCustomer(form);
    router.push('/');
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <div class="login-page">
    <section class="auth-panel">
      <form class="auth-card" @submit.prevent="submit">
        <div class="auth-logo"><i class="pi pi-user-plus" /></div>
        <h1>Customer account</h1>
        <p>Register to submit a loan request and follow your balance.</p>
        <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
        <div class="form-grid">
          <div class="form-field"><label>First name</label><InputText v-model="form.firstName" required /></div>
          <div class="form-field"><label>Last name</label><InputText v-model="form.lastName" required /></div>
          <div class="form-field"><label>Username</label><InputText v-model="form.username" autocomplete="username" required /></div>
          <div class="form-field"><label>Phone</label><InputText v-model="form.phone" required /></div>
          <div class="form-field form-field--full"><label>Email</label><InputText v-model="form.email" type="email" /></div>
          <div class="form-field"><label>Occupation</label><InputText v-model="form.occupation" /></div>
          <div class="form-field"><label>Monthly income</label><InputNumber v-model="form.monthlyIncome" mode="currency" currency="PHP" locale="en-PH" :min="0" /></div>
          <div class="form-field form-field--full"><label>Password</label><Password v-model="form.password" toggle-mask fluid autocomplete="new-password" required /></div>
        </div>
        <Button class="mt-button" type="submit" label="Create customer account" icon="pi pi-check" fluid :loading="auth.loading" />
        <div class="auth-card__footer">Already registered? <RouterLink to="/login">Sign in</RouterLink></div>
      </form>
    </section>
    <section class="auth-visual">
      <div class="auth-visual__content">
        <h2>Your loan information in one secure place.</h2>
        <p>See applications, approved balances, upcoming installments and payment history from your customer portal.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mt-button { margin-top: 1.25rem; }
.auth-card { width: min(100%, 580px); }
</style>
