<script setup>
import { reactive, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import api from '../services/api.js';
import { apiError } from '../utils/formatters.js';

const submitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const form = reactive({
  recoveryKey: '',
  displayName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: ''
});

function validateForm() {
  if (form.password !== form.confirmPassword) {
    return 'Password confirmation does not match.';
  }

  const strongPassword =
    form.password.length >= 12 &&
    /[a-z]/.test(form.password) &&
    /[A-Z]/.test(form.password) &&
    /\d/.test(form.password) &&
    /[^A-Za-z0-9]/.test(form.password);

  if (!strongPassword) {
    return 'Password must have at least 12 characters with uppercase, lowercase, number and special character.';
  }

  return '';
}

async function submit() {
  errorMessage.value = '';
  successMessage.value = '';

  const validationError = validateForm();
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  submitting.value = true;
  try {
    const { data } = await api.post(
      '/recovery/bootstrap-super-admin',
      {
        displayName: form.displayName,
        username: form.username,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password
      },
      {
        headers: {
          'x-recovery-key': form.recoveryKey
        }
      }
    );

    successMessage.value = data.message;
    form.recoveryKey = '';
    form.password = '';
    form.confirmPassword = '';
  } catch (error) {
    if (error.response?.status === 503) {
      errorMessage.value =
        'Recovery is not configured. Add ENABLE_SUPER_ADMIN_RECOVERY=true and a SUPER_ADMIN_RECOVERY_KEY of at least 32 characters to backend/.env, then restart the backend.';
    } else {
      errorMessage.value = apiError(error);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-100 px-4 py-8 sm:py-12">
    <section class="mx-auto max-w-2xl">
      <header class="mb-6 text-center">
        <div class="mx-auto h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img
            src="https://res.cloudinary.com/dvljcimlz/image/upload/v1787582112/photo_2026-08-24_21-33-46_wupszz.jpg"
            alt="Loan Filipinas Service logo"
            class="h-full w-full object-cover"
          />
        </div>
        <p class="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Loan Filipinas Service
        </p>
        <h1 class="mt-2 text-2xl font-bold text-slate-950">
          Super Admin Recovery
        </h1>
        <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Create a replacement Super Admin only when the original account no longer exists.
        </p>
      </header>

      <form
        class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        @submit.prevent="submit"
      >
        <Message severity="warn" :closable="false">
          The backend recovery option must be temporarily enabled. This form will not work while recovery is disabled or when a Super Admin already exists.
        </Message>

        <Message
          v-if="errorMessage"
          class="mt-4"
          severity="error"
          :closable="false"
        >
          {{ errorMessage }}
        </Message>

        <Message
          v-if="successMessage"
          class="mt-4"
          severity="success"
          :closable="false"
        >
          {{ successMessage }}
        </Message>

        <div v-if="!successMessage" class="mt-6 grid gap-5 sm:grid-cols-2">
          <div class="form-field sm:col-span-2">
            <label for="recoveryKey">Recovery key *</label>
            <Password
              id="recoveryKey"
              v-model="form.recoveryKey"
              :feedback="false"
              toggle-mask
              fluid
              autocomplete="off"
              placeholder="Enter the key configured on the server"
              required
            />
            <small class="mt-1.5 block text-xs text-slate-500">
              The recovery key is sent once and is not saved in the browser.
            </small>
          </div>

          <div class="form-field sm:col-span-2">
            <label for="displayName">Display name *</label>
            <InputText
              id="displayName"
              v-model="form.displayName"
              placeholder="Recovery Super Admin"
              autocomplete="name"
              required
            />
          </div>

          <div class="form-field">
            <label for="username">Username *</label>
            <InputText
              id="username"
              v-model="form.username"
              placeholder="recoveryadmin"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-field">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="form.email"
              type="email"
              placeholder="admin@example.com"
              autocomplete="email"
            />
          </div>

          <div class="form-field sm:col-span-2">
            <label for="phone">Phone</label>
            <InputText
              id="phone"
              v-model="form.phone"
              placeholder="Enter phone number"
              autocomplete="tel"
            />
          </div>

          <div class="form-field">
            <label for="password">New password *</label>
            <Password
              id="password"
              v-model="form.password"
              :feedback="false"
              toggle-mask
              fluid
              autocomplete="new-password"
              placeholder="Enter a strong password"
              required
            />
          </div>

          <div class="form-field">
            <label for="confirmPassword">Confirm password *</label>
            <Password
              id="confirmPassword"
              v-model="form.confirmPassword"
              :feedback="false"
              toggle-mask
              fluid
              autocomplete="new-password"
              placeholder="Repeat the password"
              required
            />
          </div>
        </div>

        <div v-if="!successMessage" class="mt-6">
          <Button
            type="submit"
            label="Create Super Admin"
            icon="pi pi-shield"
            fluid
            :loading="submitting"
          />
        </div>

        <div v-else class="mt-6 grid gap-3">
          <RouterLink to="/login">
            <Button
              label="Continue to login"
              icon="pi pi-arrow-right"
              icon-pos="right"
              fluid
            />
          </RouterLink>
          <p class="text-center text-xs leading-5 text-rose-600">
            Disable the recovery option in the backend environment and restart the server now.
          </p>
        </div>

        <div class="mt-6 border-t border-slate-100 pt-5 text-center">
          <RouterLink
            to="/login"
            class="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Return to staff login
          </RouterLink>
        </div>
      </form>
    </section>
  </main>
</template>
