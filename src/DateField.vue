<script setup lang="ts">
import { ref } from "vue";

const model = defineModel<string>({ default: "" });
defineProps<{ disabled?: boolean }>();
const native = ref<HTMLInputElement | null>(null);

function onInput(event: Event) {
  model.value = (event.target as HTMLInputElement).value;
}

function openPicker() {
  const input = native.value;
  if (!input || input.disabled) return;
  input.focus();
  try {
    input.showPicker();
  } catch {
    // 个别浏览器只允许在真实点击里打开日历，忽略重复打开即可。
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openPicker();
}
</script>

<template>
  <span
    class="date-field"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled || undefined"
    :aria-label="model || '选择日期'"
    @click="openPicker"
    @keydown="onKeydown"
  >
    <input class="date-text" :value="model" placeholder="年-月-日" readonly tabindex="-1" aria-hidden="true" :disabled="disabled" />
    <input ref="native" class="date-native" type="date" :value="model" tabindex="-1" aria-hidden="true" :disabled="disabled" @input="onInput" />
  </span>
</template>
