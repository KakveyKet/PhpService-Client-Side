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
      typeof route.query.redirect === "string"
        ? route.query.redirect
        : "/";

    await router.push(redirect);
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <main
    class="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10"
  >
    <section class="w-full max-w-sm">
      <header class="text-center">
        <div
          class="mx-auto h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          <img
            src="https://res.cloudinary.com/dvljcimlz/image/upload/v1787582112/photo_2026-08-24_21-33-46_wupszz.jpg"
            alt="Loan Filipinas Service logo"
            class="h-full w-full rounded-xl object-cover"
          />
        </div>

        <span
          class="mt-4 block text-sm font-bold uppercase tracking-wide text-emerald-700"
        >
          Loan Filipinas Service
        </span>

        <h1 class="mt-3 text-2xl font-bold text-slate-900">
          Welcome Back
        </h1>
      </header>

      <form
        class="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        @submit.prevent="submit"
      >
        <Message
          v-if="errorMessage"
          severity="error"
          :closable="false"
        >
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