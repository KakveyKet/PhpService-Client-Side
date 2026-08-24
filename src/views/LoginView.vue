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
const errorMessage = ref("");

const form = reactive({
  login: "",
  password: "",
});

async function submit() {
  errorMessage.value = "";

  try {
    await auth.login(form);

    const redirect =
      typeof route.query.redirect === "string" ? route.query.redirect : "/";

    router.push(redirect);
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
          Microfinance MS
        </span>

        <h1 class="mt-4 text-2xl font-bold text-slate-900">Welcome Back</h1>

        <!-- <p class="mt-1 text-sm text-slate-500">Sign in to manage the system.</p> -->
      </div>

      <form
        class="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        @submit.prevent="submit"
      >
        <Message v-if="errorMessage" severity="error" :closable="false">
          {{ errorMessage }}
        </Message>

        <div>
          <label
            for="login"
            class="mb-2 block text-sm font-semibold text-slate-700"
          >
            Username or email
          </label>

          <InputText
            id="login"
            v-model="form.login"
            autocomplete="username"
            placeholder="Enter your username"
            class="w-full"
            required
          />
        </div>

        <div>
          <label
            for="password"
            class="mb-2 block text-sm font-semibold text-slate-700"
          >
            Password
          </label>

          <Password
            id="password"
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
      </form>

      <div class="mt-5 text-center text-sm text-slate-500">
        Customer portal?

        <RouterLink
          to="/customer/login"
          class="font-semibold text-emerald-700 hover:underline"
        >
          Sign in
        </RouterLink>

        <span class="mx-1">or</span>

        <RouterLink
          to="/customer/register"
          class="font-semibold text-emerald-700 hover:underline"
        >
          create an account
        </RouterLink>
      </div>
    </section>
  </main>
</template>
