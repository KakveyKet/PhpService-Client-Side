<script setup>
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import InputNumber from "primevue/inputnumber";
import api from "../../services/api.js";
import { apiError, currency, numberValue } from "../../utils/formatters.js";

const toast = useToast();
const products = ref([]);
const amount = ref(0);
const months = ref(6);
const agreed = ref(false);
const loading = ref(true);
const applying = ref(false);
const highlightSlider = ref(null);
const calculatorSection = ref(null);
const activeHighlight = ref(0);

const highlights = [
  {
    title: "Personal Loan",
    description: "Simple support for your everyday needs.",
    icon: "pi pi-user",
  },
  {
    title: "Business Loan",
    description: "Extra funds to help your business move forward.",
    icon: "pi pi-briefcase",
  },
  {
    title: "OFW Loan",
    description: "Flexible support for you and your family.",
    icon: "pi pi-globe",
  },
];

const monthOptions = [6, 12, 24, 36];

// The calculator uses the first active product returned by the API.
const selectedProduct = computed(() => products.value[0] || null);

const ratePercent = computed(() => {
  return numberValue(selectedProduct.value?.rateId?.ratePercent);
});

const processingFee = computed(() => {
  const feePercent = numberValue(selectedProduct.value?.processingFeePercent);
  return (amount.value * feePercent) / 100;
});

const totalInterest = computed(() => {
  const rate = ratePercent.value / 100;

  if (selectedProduct.value?.rateId?.calculationMethod === "REDUCING_BALANCE") {
    return (amount.value * rate * (months.value + 1)) / 2;
  }

  return amount.value * rate * months.value;
});

const totalPayable = computed(() => {
  return amount.value + totalInterest.value + processingFee.value;
});

const monthlyPayment = computed(() => {
  return months.value ? totalPayable.value / months.value : 0;
});

const canApply = computed(() => {
  const product = selectedProduct.value;

  if (!product) return false;

  return (
    agreed.value &&
    amount.value >= numberValue(product.minimumAmount) &&
    amount.value <= numberValue(product.maximumAmount) &&
    monthOptions.includes(months.value)
  );
});

function scrollToHighlight(index) {
  const slide = highlightSlider.value?.children[index];

  slide?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "start",
  });
}

function updateActiveHighlight() {
  const slider = highlightSlider.value;

  if (!slider) return;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  Array.from(slider.children).forEach((slide, index) => {
    const distance = Math.abs(slide.offsetLeft - slider.scrollLeft);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  activeHighlight.value = closestIndex;
}

function goToCalculator() {
  calculatorSection.value?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function load() {
  loading.value = true;

  try {
    const { data } = await api.get("/products", {
      params: { status: "ACTIVE" },
    });

    products.value = data.items;

    if (selectedProduct.value) {
      amount.value = numberValue(selectedProduct.value.minimumAmount);
      months.value = monthOptions[0];
    }
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Cannot load loan calculator",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

async function applyForLoan() {
  if (!canApply.value) return;

  applying.value = true;

  try {
    await api.post("/loan-applications", {
      productId: selectedProduct.value._id,
      requestedAmount: amount.value,
      requestedTerm: months.value,
      purpose: "Loan application submitted from customer portal",
    });

    toast.add({
      severity: "success",
      summary: "Application submitted",
      detail: "Your loan request was sent successfully.",
      life: 3500,
    });

    agreed.value = false;
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Application failed",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    applying.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
    <!-- Fixed highlight slider -->
    <section>
      <div
        ref="highlightSlider"
        class="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        @scroll.passive="updateActiveHighlight"
      >
        <article
          v-for="highlight in highlights"
          :key="highlight.title"
          class="relative min-h-40 w-full shrink-0 snap-start overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-sm"
        >
          <div class="relative z-10 max-w-[72%]">
            <h2 class="text-xl font-bold">{{ highlight.title }}</h2>
            <p class="mt-1 text-sm leading-5 text-emerald-50">
              {{ highlight.description }}
            </p>
            <button
              type="button"
              class="mt-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
              @click="goToCalculator"
            >
              Calculate now
              <i class="pi pi-arrow-right text-xs" />
            </button>
          </div>

          <i
            :class="highlight.icon"
            class="absolute right-5 top-1/2 -translate-y-1/2 text-6xl text-white/20"
          />

          <div
            class="absolute -bottom-12 -right-8 h-32 w-32 rounded-full bg-white/10"
          />
        </article>
      </div>

      <div class="mt-3 flex items-center justify-center gap-1.5">
        <button
          v-for="(_, index) in highlights"
          :key="index"
          type="button"
          :aria-label="`Show highlight ${index + 1}`"
          class="h-1.5 rounded-full transition-all"
          :class="
            activeHighlight === index
              ? 'w-6 bg-emerald-600'
              : 'w-1.5 bg-emerald-200'
          "
          @click="scrollToHighlight(index)"
        />
      </div>
    </section>

    <!-- Loading calculator -->
    <div
      v-if="loading"
      class="h-[620px] animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm"
    />

    <!-- Loan calculator -->
    <section
      v-else-if="selectedProduct"
      ref="calculatorSection"
      class="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white shadow-sm"
    >
      <div class="p-5">
        <h1 class="text-lg font-bold text-slate-900">Loan Calculator</h1>

        <div class="mt-6">
          <div class="mb-2 flex items-center justify-between gap-3">
            <label
              class="text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Borrowing amount (₱)
            </label>
            <strong class="text-sm text-emerald-700">{{
              currency(amount)
            }}</strong>
          </div>

          <InputNumber
            v-model="amount"
            mode="currency"
            currency="PHP"
            locale="en-PH"
            :min="numberValue(selectedProduct.minimumAmount)"
            :max="numberValue(selectedProduct.maximumAmount)"
            fluid
          />

          <p class="mt-2 text-[11px] font-medium uppercase text-slate-400">
            Enter amount between
            {{ currency(selectedProduct.minimumAmount) }} and
            {{ currency(selectedProduct.maximumAmount) }}
          </p>
        </div>

        <div class="mt-6">
          <div class="mb-3 flex items-center justify-between gap-3">
            <label
              class="text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Repayment duration
            </label>
            <span
              class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
            >
              {{ months }} months
            </span>
          </div>

          <div
            class="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              v-for="option in monthOptions"
              :key="option"
              type="button"
              class="h-10 min-w-14 shrink-0 rounded-xl border px-3 text-sm font-semibold transition"
              :class="
                months === option
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
              "
              @click="months = option"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <!-- Estimate -->
        <div class="mt-6 rounded-2xl bg-emerald-800 p-5 text-white">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span
                class="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200"
              >
                Monthly bill
              </span>
              <strong class="mt-1 block text-3xl font-bold">
                {{ currency(monthlyPayment) }}
              </strong>
            </div>
            <span
              class="rounded-full border border-emerald-500 bg-emerald-700 px-2.5 py-1 text-[10px] font-bold text-emerald-100"
            >
              {{ ratePercent }}% / MO
            </span>
          </div>

          <div class="my-5 h-px bg-white/10" />

          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between gap-4">
              <span
                class="text-xs font-semibold uppercase tracking-wide text-emerald-200"
              >
                Loan principal
              </span>
              <strong>{{ currency(amount) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span
                class="text-xs font-semibold uppercase tracking-wide text-emerald-200"
              >
                Interest
              </span>
              <strong>{{ currency(totalInterest) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span
                class="text-xs font-semibold uppercase tracking-wide text-emerald-200"
              >
                Processing fee
              </span>
              <strong>{{ currency(processingFee) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span
                class="text-xs font-semibold uppercase tracking-wide text-emerald-200"
              >
                Total term
              </span>
              <strong>{{ months }} months</strong>
            </div>
          </div>

          <div
            class="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4"
          >
            <span
              class="text-sm font-bold uppercase tracking-wide text-emerald-100"
            >
              Total pay
            </span>
            <strong class="text-xl">{{ currency(totalPayable) }}</strong>
          </div>
        </div>

        <label
          class="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <Checkbox v-model="agreed" binary class="mt-0.5" />
          <span>
            <strong class="block text-xs text-slate-800">
              I Agree to the
              <span class="text-emerald-700 underline"
                >Loan Service Terms &amp; Agreement</span
              >
            </strong>
            <small class="mt-1 block text-[11px] leading-4 text-slate-500">
              By applying, I confirm all data provided is accurate and I
              understand the repayment terms.
            </small>
          </span>
        </label>

        <Button
          label="APPLY FOR LOAN NOW"
          icon="pi pi-arrow-right"
          icon-pos="right"
          fluid
          class="mt-5"
          :disabled="!canApply"
          :loading="applying"
          @click="applyForLoan"
        />
      </div>
    </section>

    <div
      v-else
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
    >
      <i class="pi pi-calculator text-2xl text-slate-400" />
      <strong class="mt-3 block text-slate-800">Calculator unavailable</strong>
      <span class="mt-1 block text-sm text-slate-500">
        There is no active loan product available right now.
      </span>
    </div>
  </div>
</template>
