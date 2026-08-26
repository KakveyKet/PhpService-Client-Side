<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { useAuthStore } from '../../stores/auth.js';
import { apiError } from '../../utils/formatters.js';

const auth = useAuthStore();
const router = useRouter();
const errorMessage = ref('');
const form = reactive({
  phone: '',
  password: ''
});

async function submit() {
  errorMessage.value = '';
  try {
    await auth.registerCustomer(form);
    await router.push('/customer/home');
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <main class="customer-register-page">
    <header class="customer-register-header">
      <RouterLink to="/customer/login" aria-label="Back"><i class="pi pi-arrow-left" /></RouterLink>
      <div><span>Create account</span><strong>Register with your phone</strong></div>
    </header>
    <form class="customer-register-card" @submit.prevent="submit">
      <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
      <div class="customer-form-section">
        <span>Login information</span>
        <div class="customer-form-grid">
          <div class="form-field customer-form-full">
            <label>Phone number *</label>
            <InputText
              v-model.trim="form.phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="Enter your phone number"
              required
            />
          </div>
          <div class="form-field customer-form-full">
            <label>Password *</label>
            <Password
              v-model="form.password"
              toggle-mask
              fluid
              autocomplete="new-password"
              placeholder="Create a password"
              :minlength="8"
              required
            />
          </div>
        </div>
      </div>
      <Button type="submit" label="Create customer account" icon="pi pi-check" fluid :loading="auth.loading" />
      <div class="customer-auth-switch">Already registered? <RouterLink to="/customer/login">Sign in</RouterLink></div>
    </form>
  </main>
</template>
