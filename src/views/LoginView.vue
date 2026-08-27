<script setup>
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Password from "primevue/password";
import { useAuthStore } from "../stores/auth.js";
import { apiError } from "../utils/formatters.js";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const form = reactive({ login: "", password: "" });
const errorMessage = ref("");

async function submit() {
  errorMessage.value = "";
  try {
    await auth.login(form);
    router.push(route.query.redirect || "/");
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <div class="login-page">
    <section class="auth-panel">
      <form class="auth-card" @submit.prevent="submit">
        <div class="auth-logo"><i class="pi pi-chart-line" /></div>
        <h1>Welcome back</h1>
        <p>Sign in to manage customers, applications and repayments.</p>
        <Message v-if="errorMessage" severity="error" :closable="false">{{
          errorMessage
        }}</Message>
        <div class="form-field">
          <label for="login">Username or email</label>
          <InputText
            id="login"
            placeholder="Enter your username or email"
            v-model="form.login"
            autocomplete="username"
            required
          />
        </div>
        <div class="form-field">
          <label for="password">Password</label>
          <Password
            id="password"
            placeholder="Enter your password"
            v-model="form.password"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="current-password"
            required
          />
        </div>
        <Button
          type="submit"
          label="Sign in"
          icon="pi pi-arrow-right"
          icon-pos="right"
          fluid
          :loading="auth.loading"
        />
        <div class="login-hint">
          Development seed: <strong>superadmin</strong> /
          <strong>ChangeMe123!</strong>
        </div>
        <div class="auth-card__footer">
          Customer portal?
          <RouterLink to="/customer/login">Sign in</RouterLink> or
          <RouterLink to="/customer/register">create an account</RouterLink>
        </div>
      </form>
    </section>
    <section class="auth-visual">
      <div class="auth-visual__content">
        <h2>Clear lending operations from application to final payment.</h2>
        <p>
          A focused starter for PHP loan products, controlled approvals,
          installment schedules and auditable collections.
        </p>
      </div>
    </section>
  </div>
</template>
