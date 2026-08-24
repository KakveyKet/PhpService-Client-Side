<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  tone: { type: String, default: 'teal' },
  note: { type: String, default: '' }
});
</script>

<template>
  <article class="stat-card">
    <div class="stat-card__icon" :class="`stat-card__icon--${tone}`"><i :class="icon" /></div>
    <div>
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
      <small v-if="note">{{ note }}</small>
    </div>
  </article>
</template>
