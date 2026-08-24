<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Password from "primevue/password";
import { useAuthStore } from "../../stores/auth.js";
import { apiError } from "../../utils/formatters.js";

const auth = useAuthStore();
const router = useRouter();
const errorMessage = ref("");
const form = reactive({ login: "", password: "" });

async function submit() {
  errorMessage.value = "";
  try {
    const result = await auth.login(form);
    router.push(result.user.role === "CUSTOMER" ? "/customer/home" : "/");
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-white px-4 py-10">
    <section class="w-full max-w-sm">
      <div class="text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"
        >
          <i class="pi pi-chart-line text-lg" />
        </div>

        <span class="mt-3 block text-sm font-semibold text-emerald-700">
          Loan Filipinas Service
        </span>
        <h1 class="mt-4 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p class="mt-1 text-sm text-slate-500">
          Sign in to your customer account.
        </p>
      </div>

      <form
        class="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        @submit.prevent="submit"
      >
        <Message v-if="errorMessage" severity="error" :closable="false">
          {{ errorMessage }}
        </Message>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Username or email
          </label>
          <InputText
            v-model="form.login"
            autocomplete="username"
            placeholder="Enter your username"
            class="w-full"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Password
          </label>
          <Password
            v-model="form.password"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="current-password"
            placeholder="Enter your password"
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

        <p class="text-center text-sm text-slate-500">
          New customer?
          <RouterLink
            to="/customer/register"
            class="font-semibold text-emerald-700 hover:underline"
          >
            Create an account
          </RouterLink>
        </p>
      </form>

      <!-- <div class="mt-5 text-center">
        <RouterLink
          to="/login"
          class="text-xs font-medium text-slate-400 transition hover:text-emerald-700"
        >
          Staff or administrator login
        </RouterLink>
      </div> -->
    </section>
  </main>
</template>
