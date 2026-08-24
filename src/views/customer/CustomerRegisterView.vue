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

const form = reactive({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  username: "",
  password: "",
});

async function submit() {
  errorMessage.value = "";

  try {
    await auth.registerCustomer(form);
    router.push("/customer/home");
  } catch (error) {
    errorMessage.value = apiError(error);
  }
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-white px-4 py-10">
    <section class="w-full max-w-md">
      <RouterLink
        to="/customer/login"
        class="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        aria-label="Back to login"
      >
        <i class="pi pi-arrow-left text-sm" />
      </RouterLink>

      <div class="text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"
        >
          <i class="pi pi-user-plus text-lg" />
        </div>

        <h1 class="mt-4 text-2xl font-bold text-slate-900">Create account</h1>

        <p class="mt-1 text-sm text-slate-500">
          Enter your information to get started.
        </p>
      </div>

      <form
        class="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        @submit.prevent="submit"
      >
        <Message v-if="errorMessage" severity="error" :closable="false">
          {{ errorMessage }}
        </Message>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-700">
              First name *
            </label>

            <InputText
              v-model="form.firstName"
              placeholder="First name"
              autocomplete="given-name"
              class="w-full"
              required
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-700">
              Last name *
            </label>

            <InputText
              v-model="form.lastName"
              placeholder="Last name"
              autocomplete="family-name"
              class="w-full"
              required
            />
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Phone number *
          </label>

          <InputText
            v-model="form.phone"
            placeholder="Enter your phone number"
            autocomplete="tel"
            class="w-full"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Email
          </label>

          <InputText
            v-model="form.email"
            type="email"
            placeholder="Enter your email"
            autocomplete="email"
            class="w-full"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Username *
          </label>

          <InputText
            v-model="form.username"
            placeholder="Choose a username"
            autocomplete="username"
            class="w-full"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">
            Password *
          </label>

          <Password
            v-model="form.password"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="new-password"
            placeholder="Create a password"
            required
          />
        </div>

        <Button
          type="submit"
          label="Create account"
          icon="pi pi-check"
          fluid
          :loading="auth.loading"
        />

        <p class="text-center text-sm text-slate-500">
          Already registered?

          <RouterLink
            to="/customer/login"
            class="font-semibold text-emerald-700 hover:underline"
          >
            Sign in
          </RouterLink>
        </p>
      </form>
    </section>
  </main>
</template>
