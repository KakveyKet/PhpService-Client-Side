<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { useToast } from "primevue/usetoast";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import api from "../../services/api.js";
import { apiError, currency, numberValue } from "../../utils/formatters.js";

const toast = useToast();

const products = ref([]);
const amount = ref(0);
const months = ref(6);
const agreed = ref(false);
const loading = ref(true);
const applying = ref(false);
const applicationDialogVisible = ref(false);
const applicationFormLoading = ref(false);
const highlightSlider = ref(null);
const calculatorSection = ref(null);
const signatureCanvas = ref(null);
const activeHighlight = ref(0);

const identityFiles = reactive({
  frontIdCard: null,
  backIdCard: null,
  selfieWithId: null,
});

const identityPreviewUrls = reactive({
  frontIdCard: "",
  backIdCard: "",
  selfieWithId: "",
});

const savedIdentityImages = reactive({
  frontIdCard: false,
  backIdCard: false,
  selfieWithId: false,
});

const signatureMode = ref("DRAW");
const signatureFile = ref(null);
const signaturePreviewUrl = ref("");
const drawingSignature = ref(false);
const hasDrawnSignature = ref(false);

const applicationForm = reactive({
  name: "",
  address: "",
  idCardNumber: "",
  bankName: "",
  bankAccountNumber: "",
});

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

const monthOptions = [6, 12, 24, 36, 48];
const identityFields = ["frontIdCard", "backIdCard", "selfieWithId"];
const selectedProduct = computed(() => products.value[0] || null);

const ratePercent = computed(() =>
  numberValue(selectedProduct.value?.rateId?.ratePercent),
);

const processingFee = computed(() => {
  const feePercent = numberValue(
    selectedProduct.value?.processingFeePercent,
  );
  return (amount.value * feePercent) / 100;
});

const totalInterest = computed(() => {
  const rate = ratePercent.value / 100;

  if (
    selectedProduct.value?.rateId?.calculationMethod === "REDUCING_BALANCE"
  ) {
    return (amount.value * rate * (months.value + 1)) / 2;
  }

  return amount.value * rate * months.value;
});

const totalPayable = computed(
  () => amount.value + totalInterest.value + processingFee.value,
);

const monthlyPayment = computed(() =>
  months.value ? totalPayable.value / months.value : 0,
);

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

function formatAddress(address) {
  if (!address) return "";

  return [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function scrollToHighlight(index) {
  highlightSlider.value?.children[index]?.scrollIntoView({
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

function revokePreview(url) {
  if (url) URL.revokeObjectURL(url);
}

function clearApplicationFiles() {
  for (const field of identityFields) {
    revokePreview(identityPreviewUrls[field]);
    identityFiles[field] = null;
    identityPreviewUrls[field] = "";
    savedIdentityImages[field] = false;
  }

  revokePreview(signaturePreviewUrl.value);
  signatureFile.value = null;
  signaturePreviewUrl.value = "";
  signatureMode.value = "DRAW";
  drawingSignature.value = false;
  hasDrawnSignature.value = false;
}

function validateImage(file, input) {
  if (!file) return false;

  if (file.size > 8 * 1024 * 1024) {
    input.value = "";
    toast.add({
      severity: "warn",
      summary: "Image is too large",
      detail: "Each image must not exceed 8 MB.",
      life: 3500,
    });
    return false;
  }

  return true;
}

function selectIdentityImage(event, field) {
  const file = event.target.files?.[0] || null;
  if (!validateImage(file, event.target)) return;

  revokePreview(identityPreviewUrls[field]);
  identityFiles[field] = file;
  identityPreviewUrls[field] = URL.createObjectURL(file);
}

function hasIdentityImage(field) {
  return Boolean(identityFiles[field] || savedIdentityImages[field]);
}

function selectSignatureFile(event) {
  const file = event.target.files?.[0] || null;
  if (!validateImage(file, event.target)) return;

  revokePreview(signaturePreviewUrl.value);
  signatureFile.value = file;
  signaturePreviewUrl.value = URL.createObjectURL(file);
}

function canvasContext() {
  return signatureCanvas.value?.getContext("2d") || null;
}

function prepareSignatureCanvas() {
  if (signatureMode.value !== "DRAW") return;

  nextTick(() => {
    const canvas = signatureCanvas.value;
    const context = canvasContext();
    if (!canvas || !context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    hasDrawnSignature.value = false;
  });
}

function signaturePoint(event) {
  const canvas = signatureCanvas.value;
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function startSignature(event) {
  const context = canvasContext();
  if (!context) return;

  const point = signaturePoint(event);
  signatureCanvas.value.setPointerCapture?.(event.pointerId);
  context.beginPath();
  context.moveTo(point.x, point.y);
  drawingSignature.value = true;
}

function drawSignature(event) {
  if (!drawingSignature.value) return;

  const context = canvasContext();
  if (!context) return;

  const point = signaturePoint(event);
  context.lineTo(point.x, point.y);
  context.stroke();
  hasDrawnSignature.value = true;
}

function stopSignature(event) {
  if (!drawingSignature.value) return;
  drawingSignature.value = false;
  signatureCanvas.value?.releasePointerCapture?.(event.pointerId);
}

function chooseSignatureMode(mode) {
  signatureMode.value = mode;

  if (mode === "DRAW") {
    revokePreview(signaturePreviewUrl.value);
    signaturePreviewUrl.value = "";
    signatureFile.value = null;
    prepareSignatureCanvas();
  } else {
    hasDrawnSignature.value = false;
  }
}

function drawnSignatureBlob() {
  return new Promise((resolve) => {
    signatureCanvas.value?.toBlob(resolve, "image/png", 0.95);
  });
}

async function load() {
  loading.value = true;

  try {
    const { data } = await api.get("/products", {
      params: { status: "ACTIVE" },
    });

    products.value = data.items || [];
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

async function openApplicationForm() {
  if (!canApply.value) return;

  applicationDialogVisible.value = true;
  applicationFormLoading.value = true;
  clearApplicationFiles();

  try {
    const { data } = await api.get("/customers/me");
    const customer = data.item;

    Object.assign(applicationForm, {
      name:
        customer.name ||
        [customer.firstName, customer.middleName, customer.lastName]
          .filter(Boolean)
          .join(" "),
      address: formatAddress(customer.address),
      idCardNumber: customer.nationalId || "",
      bankName: customer.bankName || "",
      bankAccountNumber: customer.bankNumber || "",
    });

    savedIdentityImages.frontIdCard = Boolean(customer.frontIdCard?.publicId);
    savedIdentityImages.backIdCard = Boolean(customer.backIdCard?.publicId);
    savedIdentityImages.selfieWithId = Boolean(customer.selfieWithId?.publicId);
  } catch (error) {
    applicationDialogVisible.value = false;
    toast.add({
      severity: "error",
      summary: "Cannot open application form",
      detail: apiError(error),
      life: 4000,
    });
  } finally {
    applicationFormLoading.value = false;
    prepareSignatureCanvas();
  }
}

function closeApplicationForm() {
  if (applying.value) return;
  applicationDialogVisible.value = false;
  clearApplicationFiles();
}

async function submitApplication() {
  const missingField = [
    [applicationForm.name, "Name"],
    [applicationForm.address, "Address"],
    [applicationForm.idCardNumber, "ID card number"],
    [applicationForm.bankName, "Bank name"],
    [applicationForm.bankAccountNumber, "Bank account number"],
  ].find(([value]) => !String(value || "").trim());

  if (missingField) {
    toast.add({
      severity: "warn",
      summary: "Information required",
      detail: `${missingField[1]} is required.`,
      life: 3500,
    });
    return;
  }

  const missingImage = [
    ["frontIdCard", "front ID card image"],
    ["backIdCard", "back ID card image"],
    ["selfieWithId", "selfie with ID card"],
  ].find(([field]) => !hasIdentityImage(field));

  if (missingImage) {
    toast.add({
      severity: "warn",
      summary: "Identity image required",
      detail: `Please provide the ${missingImage[1]}.`,
      life: 3500,
    });
    return;
  }

  if (signatureMode.value === "UPLOAD" && !signatureFile.value) {
    toast.add({
      severity: "warn",
      summary: "Signature required",
      detail: "Select your signature image.",
      life: 3500,
    });
    return;
  }

  if (signatureMode.value === "DRAW" && !hasDrawnSignature.value) {
    toast.add({
      severity: "warn",
      summary: "Signature required",
      detail: "Draw your signature inside the signature box.",
      life: 3500,
    });
    return;
  }

  applying.value = true;

  try {
    const signature =
      signatureMode.value === "UPLOAD"
        ? signatureFile.value
        : await drawnSignatureBlob();

    if (!signature) throw new Error("Could not create the signature image");

    const data = new FormData();
    data.append("productId", selectedProduct.value._id);
    data.append("requestedAmount", String(amount.value));
    data.append("requestedTerm", String(months.value));
    data.append(
      "purpose",
      "Loan application submitted from customer portal",
    );
    data.append("termsAccepted", "true");
    data.append("applicantName", applicationForm.name.trim());
    data.append("applicantAddress", applicationForm.address.trim());
    data.append("idCardNumber", applicationForm.idCardNumber.trim());
    data.append("bankName", applicationForm.bankName.trim());
    data.append(
      "bankAccountNumber",
      applicationForm.bankAccountNumber.trim(),
    );

    for (const field of identityFields) {
      if (identityFiles[field]) data.append(field, identityFiles[field]);
    }

    data.append(
      "signature",
      signature,
      signatureMode.value === "DRAW"
        ? "drawn-signature.png"
        : signatureFile.value.name,
    );

    await api.post("/loan-applications", data);

    toast.add({
      severity: "success",
      summary: "Application submitted",
      detail: "Your loan request and documents were sent successfully.",
      life: 4000,
    });

    agreed.value = false;
    applicationDialogVisible.value = false;
    clearApplicationFiles();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Application failed",
      detail: apiError(error),
      life: 4500,
    });
  } finally {
    applying.value = false;
  }
}

onMounted(load);
onBeforeUnmount(clearApplicationFiles);
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 pb-6">
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

    <div
      v-if="loading"
      class="h-[620px] animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm"
    />

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
            <strong class="text-sm text-emerald-700">
              {{ currency(amount) }}
            </strong>
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
            Enter amount between {{ currency(selectedProduct.minimumAmount) }}
            and {{ currency(selectedProduct.maximumAmount) }}
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
              <span class="text-xs font-semibold uppercase text-emerald-200">
                Loan principal
              </span>
              <strong>{{ currency(amount) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs font-semibold uppercase text-emerald-200">
                Interest
              </span>
              <strong>{{ currency(totalInterest) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs font-semibold uppercase text-emerald-200">
                Processing fee
              </span>
              <strong>{{ currency(processingFee) }}</strong>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-xs font-semibold uppercase text-emerald-200">
                Total term
              </span>
              <strong>{{ months }} months</strong>
            </div>
          </div>

          <div
            class="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4"
          >
            <span class="text-sm font-bold uppercase text-emerald-100">
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
              <span class="text-emerald-700 underline">
                Loan Service Terms &amp; Agreement
              </span>
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
          @click="openApplicationForm"
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

    <Dialog
      v-model:visible="applicationDialogVisible"
      modal
      header="Complete loan application"
      :style="{ width: '760px', maxWidth: '96vw' }"
      :closable="!applying"
      :close-on-escape="!applying"
      @show="prepareSignatureCanvas"
      @hide="closeApplicationForm"
    >
      <div v-if="applicationFormLoading" class="space-y-3 py-2">
        <div class="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
        <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <form v-else @submit.prevent="submitApplication">
        <section
          class="mb-5 grid grid-cols-2 gap-3 rounded-2xl bg-emerald-50 p-4 text-sm"
        >
          <div>
            <span class="block text-xs text-slate-500">Requested amount</span>
            <strong class="text-emerald-800">{{ currency(amount) }}</strong>
          </div>
          <div>
            <span class="block text-xs text-slate-500">Repayment term</span>
            <strong class="text-emerald-800">{{ months }} months</strong>
          </div>
        </section>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label for="applicationName" class="form-label">Name *</label>
            <InputText
              id="applicationName"
              v-model.trim="applicationForm.name"
              class="w-full"
              required
            />
          </div>

          <div class="sm:col-span-2">
            <label for="applicationAddress" class="form-label">
              Address *
            </label>
            <Textarea
              id="applicationAddress"
              v-model.trim="applicationForm.address"
              rows="3"
              class="w-full"
              placeholder="Enter your complete address"
              required
            />
          </div>

          <div>
            <label for="applicationIdCardNumber" class="form-label">
              ID card number *
            </label>
            <InputText
              id="applicationIdCardNumber"
              v-model.trim="applicationForm.idCardNumber"
              class="w-full"
              required
            />
          </div>

          <div>
            <label for="applicationBankName" class="form-label">
              Bank name *
            </label>
            <InputText
              id="applicationBankName"
              v-model.trim="applicationForm.bankName"
              class="w-full"
              required
            />
          </div>

          <div class="sm:col-span-2">
            <label for="applicationBankNumber" class="form-label">
              Bank account number *
            </label>
            <InputText
              id="applicationBankNumber"
              v-model.trim="applicationForm.bankAccountNumber"
              inputmode="numeric"
              autocomplete="off"
              class="w-full"
              required
            />
          </div>

          <div>
            <label for="applicationFrontId" class="form-label">
              ID card front *
            </label>
            <input
              id="applicationFrontId"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="file-input"
              @change="selectIdentityImage($event, 'frontIdCard')"
            />
            <span
              v-if="savedIdentityImages.frontIdCard && !identityFiles.frontIdCard"
              class="saved-file"
            >
              <i class="pi pi-check-circle" /> Saved front ID will be used
            </span>
            <img
              v-if="identityPreviewUrls.frontIdCard"
              :src="identityPreviewUrls.frontIdCard"
              alt="Selected front ID card"
              class="image-preview"
            />
          </div>

          <div>
            <label for="applicationBackId" class="form-label">
              ID card back *
            </label>
            <input
              id="applicationBackId"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="file-input"
              @change="selectIdentityImage($event, 'backIdCard')"
            />
            <span
              v-if="savedIdentityImages.backIdCard && !identityFiles.backIdCard"
              class="saved-file"
            >
              <i class="pi pi-check-circle" /> Saved back ID will be used
            </span>
            <img
              v-if="identityPreviewUrls.backIdCard"
              :src="identityPreviewUrls.backIdCard"
              alt="Selected back ID card"
              class="image-preview"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="applicationSelfieId" class="form-label">
              Selfie with ID card *
            </label>
            <input
              id="applicationSelfieId"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="file-input"
              @change="selectIdentityImage($event, 'selfieWithId')"
            />
            <span
              v-if="savedIdentityImages.selfieWithId && !identityFiles.selfieWithId"
              class="saved-file"
            >
              <i class="pi pi-check-circle" /> Saved selfie will be used
            </span>
            <img
              v-if="identityPreviewUrls.selfieWithId"
              :src="identityPreviewUrls.selfieWithId"
              alt="Selected selfie with ID card"
              class="mt-2 max-h-56 w-full rounded-lg border border-slate-200 object-contain"
            />
            <small class="mt-2 block text-slate-500">
              JPG, PNG or WEBP; maximum 8 MB per image.
            </small>
          </div>

          <div class="sm:col-span-2">
            <div class="mb-2 flex items-center justify-between gap-3">
              <label class="block text-sm font-semibold text-slate-700">
                Signature *
              </label>
              <div class="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  class="signature-tab"
                  :class="
                    signatureMode === 'DRAW'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500'
                  "
                  @click="chooseSignatureMode('DRAW')"
                >
                  Draw
                </button>
                <button
                  type="button"
                  class="signature-tab"
                  :class="
                    signatureMode === 'UPLOAD'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500'
                  "
                  @click="chooseSignatureMode('UPLOAD')"
                >
                  Upload
                </button>
              </div>
            </div>

            <div v-if="signatureMode === 'DRAW'">
              <canvas
                ref="signatureCanvas"
                width="700"
                height="220"
                class="h-44 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white"
                @pointerdown.prevent="startSignature"
                @pointermove.prevent="drawSignature"
                @pointerup.prevent="stopSignature"
                @pointercancel.prevent="stopSignature"
                @pointerleave="stopSignature"
              />
              <div class="mt-2 flex items-center justify-between gap-3">
                <small class="text-slate-500">
                  Draw inside the box using your mouse or finger.
                </small>
                <Button
                  type="button"
                  label="Clear"
                  icon="pi pi-eraser"
                  severity="secondary"
                  text
                  size="small"
                  @click="prepareSignatureCanvas"
                />
              </div>
            </div>

            <div v-else>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="file-input"
                @change="selectSignatureFile"
              />
              <img
                v-if="signaturePreviewUrl"
                :src="signaturePreviewUrl"
                alt="Selected signature"
                class="mt-2 h-36 w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            </div>
          </div>
        </div>

        <div
          class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"
        >
          <i class="pi pi-check-circle mr-1" />
          You accepted the Loan Service Terms &amp; Agreement. Your submitted
          information, documents, and signature will be attached to this loan
          request.
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            label="Cancel"
            severity="secondary"
            text
            :disabled="applying"
            @click="closeApplicationForm"
          />
          <Button
            type="submit"
            label="Submit application"
            icon="pi pi-send"
            :loading="applying"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.file-input {
  display: block;
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: white;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #334155;
}

.file-input::file-selector-button {
  margin-right: 0.75rem;
  border: 0;
  border-radius: 0.375rem;
  background: #ecfdf5;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  color: #047857;
}

.saved-file {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #047857;
}

.image-preview {
  margin-top: 0.5rem;
  height: 9rem;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  object-fit: contain;
}

.signature-tab {
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 150ms ease;
}
</style>
