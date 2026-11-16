<script setup lang="ts">
import { ref } from "vue";
import DemandPage from "./DemandPage.vue";
import { loadSession, saveSession, USERS } from "./store";
import type { SessionUser } from "./types";

const user = ref<SessionUser | null>(loadSession());

function enter(next: SessionUser) {
  user.value = next;
  saveSession(next);
}

function logout() {
  user.value = null;
  saveSession(null);
}
</script>

<template>
  <div v-if="!user" class="login">
    <div class="login-card">
      <div class="brand" style="color: #1a9b86">
        <span class="logo" style="border-color: #1a9b86; color: #1a9b86">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 3v18M7 7h10M8 21h8" />
            <path d="M8 7l-3 6h6L8 7zm8 0l-3 6h6l-3-6z" />
          </svg>
        </span>
      </div>
      <h1>数字化法治企业建设平台</h1>
      <p>集团法律部需求备案。填报者维护本单位数据，查看者可查阅全部备案。</p>
      <div class="login-actions">
        <button
          v-for="item in USERS"
          :key="item.id"
          type="button"
          :class="{ primary: item.role === 'reporter' }"
          @click="enter(item)"
        >
          {{ item.role === "reporter" ? "填报者" : "查看者" }}进入 · {{ item.name }}
        </button>
      </div>
      <div class="login-note">填报者示例为王填报。另有张明提交的备案，只有查看者能看到。</div>
    </div>
  </div>
  <DemandPage v-else :user="user" @logout="logout" />
</template>
