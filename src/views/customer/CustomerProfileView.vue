<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import api from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";
import { useRealtimeRefresh } from "../../composables/useRealtimeRefresh.js";
import { creditLevelDetails } from "../../utils/credit.js";
import { apiError, currency, date, fullName } from "../../utils/formatters.js";

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const customer = ref(null);
const dashboard = ref({});
const loading = ref(true);

const credit = computed(() => creditLevelDetails(customer.value?.creditScore));

const initials = computed(() => {
  const words = fullName(customer.value)
    .split(/\s+/)
    .filter((word) => word && word !== "—");
  const firstInitial = words[0]?.[0] || "";
  const lastInitial = words.length > 1 ? words.at(-1)?.[0] || "" : "";

  return `${firstInitial}${lastInitial}`.toUpperCase() || "C";
});

const formattedAddress = computed(() => {
  const address = customer.value?.address;

  if (!address) return "No address provided";

  return (
    [
      address.street,
      address.barangay,
      address.city,
      address.province,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ") || "No address provided"
  );
});

async function load() {
  loading.value = true;

  try {
    const [customerResponse, dashboardResponse] = await Promise.all([
      api.get("/customers/me"),
      api.get("/dashboard"),
    ]);

    customer.value = customerResponse.data.item;
    dashboard.value = dashboardResponse.data.data;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load profile",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

function logout() {
  auth.logout();
  router.push("/customer/login");
}

useRealtimeRefresh(["profile", "customers"], load);
onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
    <header>
      <span
        class="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600"
      >
        My account
      </span>
      <h1 class="mt-1 text-2xl font-bold text-slate-900">Profile</h1>
      <p class="mt-1 text-sm text-slate-500">
        View your personal and account information.
      </p>
    </header>

    <template v-if="loading">
      <div class="h-40 animate-pulse rounded-2xl bg-emerald-100" />

      <div class="grid grid-cols-2 gap-3">
        <div class="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div class="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>

      <div class="h-72 animate-pulse rounded-2xl bg-slate-100" />
    </template>

    <template v-else-if="customer">
      <!-- Customer identity -->
      <section
        class="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-sm"
      >
        <div class="relative z-10 flex items-center gap-4">
          <div
            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-xl font-bold"
          >
            {{ initials }}
          </div>

          <div class="min-w-0 flex-1">
            <h2 class="truncate text-xl font-bold">
              {{ fullName(customer) }}
            </h2>
            <p class="mt-0.5 text-sm text-emerald-50">
              {{ customer.customerCode }}
            </p>

            <span
              class="mt-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            >
              {{ customer.status }}
            </span>
          </div>
        </div>

        <div
          class="absolute -bottom-12 -right-8 h-32 w-32 rounded-full bg-white/10"
        />
        <div
          class="absolute -right-4 -top-12 h-24 w-24 rounded-full bg-white/10"
        />
      </section>
      <section
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-col items-center text-center">
          <!-- <span
            class="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"
          >
            Customer credit
          </span> -->

          <div
            class="credit-gauge"
            :style="{ '--credit-angle': `${credit.progress * 3.6}deg` }"
          >
            <div class="credit-gauge__ticks" />
            <div class="credit-gauge__center">
              <strong>{{ credit.score }}</strong>
              <span> Credit</span>
            </div>
          </div>

          <!-- <small class="mt-3 text-slate-500">
            <template v-if="credit.nextScore">
              Update to {{ credit.nextScore }} points
            </template>
            <template v-else>Highest credit level reached</template>
          </small> -->
        </div>
      </section>
      <!-- Account summary -->
      <section class="grid grid-cols-2 gap-3">
        <article
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
          >
            <i class="pi pi-file-edit" />
          </div>
          <strong class="mt-3 block text-2xl text-slate-900">
            {{ dashboard.applicationCount || 0 }}
          </strong>
          <span class="mt-0.5 block text-xs text-slate-500">Applications</span>
        </article>

        <article
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
          >
            <i class="pi pi-wallet" />
          </div>
          <strong class="mt-3 block text-2xl text-slate-900">
            {{ dashboard.activeLoanCount || 0 }}
          </strong>
          <span class="mt-0.5 block text-xs text-slate-500">Active loans</span>
        </article>
      </section>

      <!-- Personal information -->
      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <header
          class="flex items-center gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
          >
            <i class="pi pi-user" />
          </div>
          <h3 class="font-bold text-slate-900">Personal information</h3>
        </header>

        <div class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Full name</span>
            <strong class="text-right text-sm text-slate-800">
              {{ fullName(customer) }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Phone</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.phone || "—" }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Email</span>
            <strong class="min-w-0 break-all text-right text-sm text-slate-800">
              {{ customer.email || "—" }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Occupation</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.occupation || "—" }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Monthly income</span>
            <strong class="text-right text-sm text-slate-800">
              {{ currency(customer.monthlyIncome) }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Date of birth</span>
            <strong class="text-right text-sm text-slate-800">
              {{ date(customer.dateOfBirth) }}
            </strong>
          </div>
        </div>
      </section>

      <!-- Masked bank information -->
      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <header
          class="flex items-center gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
            >
              <i class="pi pi-credit-card" />
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Bank information</h3>
              <p class="mt-0.5 text-xs text-slate-500">
                Sensitive details are masked
              </p>
            </div>
          </div>
        </header>

        <div class="divide-y divide-slate-100 px-4">
          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank name</span>
            <strong class="text-right text-sm text-slate-800">
              {{ customer.maskedBankDetails?.bankName || "—" }}
            </strong>
          </div>

          <div class="flex items-start justify-between gap-4 py-3.5">
            <span class="text-sm text-slate-500">Bank account number</span>
            <strong class="break-all text-right text-sm text-slate-800">
              {{ customer.maskedBankDetails?.bankAccountNumber || "—" }}
            </strong>
          </div>
        </div>
      </section>

      <Button
        label="Sign out"
        icon="pi pi-sign-out"
        severity="danger"
        outlined
        fluid
        @click="logout"
      />
    </template>

    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
    >
      <i class="pi pi-user text-2xl text-slate-400" />
      <strong class="mt-3 block text-slate-800">Profile unavailable</strong>
      <span class="mt-1 block text-sm text-slate-500">
        Your customer profile could not be loaded.
      </span>
    </div>
  </div>
</template>

<style scoped>
.credit-gauge {
  --credit-angle: 0deg;
  position: relative;
  display: grid;
  width: 10rem;
  height: 10rem;
  place-items: center;
  overflow: hidden;
  border-radius: 9999px;
  background: conic-gradient(
    from 210deg,
    #6ee7b7 0deg,
    #10b981 var(--credit-angle),
    #064e3b var(--credit-angle),
    #064e3b 360deg
  );
  box-shadow:
    0 12px 25px rgba(6, 78, 59, 0.22),
    inset 0 0 0 2px rgba(255, 255, 255, 0.22);
}

.credit-gauge::before {
  position: absolute;
  inset: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: inherit;
  content: "";
}

.credit-gauge__ticks {
  position: absolute;
  inset: 0.8rem;
  border-radius: inherit;
  background: repeating-conic-gradient(
    from 210deg,
    rgba(255, 255, 255, 0.45) 0deg 1.5deg,
    transparent 1.5deg 10deg
  );
  -webkit-mask: radial-gradient(
    circle,
    transparent 62%,
    #000 63% 68%,
    transparent 69%
  );
  mask: radial-gradient(circle, transparent 62%, #000 63% 68%, transparent 69%);
}

.credit-gauge__center {
  position: relative;
  z-index: 1;
  display: flex;
  width: 7.4rem;
  height: 7.4rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: linear-gradient(145deg, #047857, #065f46);
  color: white;
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.16);
}

.credit-gauge__center strong {
  font-size: 2.25rem;
  font-weight: 500;
  line-height: 1;
}

.credit-gauge__center span {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: #d1fae5;
}
</style>
