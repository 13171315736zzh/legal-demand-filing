<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  APPROVAL_OPTIONS,
  BUSINESS_OPTIONS,
  DIGITAL_OPTIONS,
  PAGE_SIZE_OPTIONS,
  PROGRESS_OPTIONS,
  TYPE_OPTIONS,
  emptyForm,
  emptyQuery,
  loadRecords,
  roleLabel,
  saveRecords,
  validateForm,
} from "./store";
import DateField from "./DateField.vue";
import type { Demand, DemandForm, QueryState, SessionUser } from "./types";

const props = defineProps<{ user: SessionUser }>();
defineEmits<{ logout: [] }>();

const nav = [
  { key: "demand", label: "需求备案" },
  { key: "contract", label: "合同管理" },
  { key: "compliance", label: "合规业务" },
  { key: "report", label: "统计周报" },
  { key: "rules", label: "规章制度" },
  { key: "case", label: "案件管理" },
  { key: "law", label: "普法宣传" },
];

const records = ref<Demand[]>(loadRecords());
const draft = reactive<QueryState>(emptyQuery());
const applied = ref<QueryState>(emptyQuery());
const page = ref(1);
const pageSize = ref(10);
const jump = ref("1");
const selected = ref<string[]>([]);
const toast = ref("");
const mode = ref<"create" | "edit" | "view" | null>(null);
const editingId = ref<string | null>(null);
const form = reactive<DemandForm>(emptyForm());
const errors = reactive<Partial<Record<keyof DemandForm, string>>>({});
const confirmText = ref("");
const confirmAction = ref<null | (() => void)>(null);
const approvalIds = ref<string[]>([]);
const approvalLevel = ref<1 | 2>(1);
const approvalOpinion = ref("");
const flowOpen = ref(false);
const flowSteps = [
  { name: "需求提报", role: "填报员 / 部门主任", statuses: ["待提报", "已退回"] },
  { name: "一级审批", role: "部门主任", statuses: ["待一级审批"] },
  { name: "二级审批", role: "集团法律部", statuses: ["待二级审批"] },
  { name: "审批通过", role: "备案生效", statuses: ["审批通过"] },
];

const isReporter = computed(() => props.user.role === "reporter");
const isDirector = computed(() => props.user.role === "director");
const isGroup = computed(() => props.user.role === "group");
const canFile = computed(() => isReporter.value || isDirector.value);

function canMaintain(row: Demand) {
  return canFile.value && row.createdBy === props.user.id && (row.approvalStatus === "待提报" || row.approvalStatus === "已退回");
}

function canApproveL1(row: Demand) {
  return isDirector.value && row.proposeDept === props.user.dept && row.createdBy !== props.user.id && row.approvalStatus === "待一级审批";
}

function canApproveL2(row: Demand) {
  return isGroup.value && row.approvalStatus === "待二级审批";
}

function canSee(row: Demand) {
  if (isGroup.value) return true;
  if (row.createdBy === props.user.id) return true;
  return isDirector.value && row.proposeDept === props.user.dept && row.approvalStatus !== "待提报";
}

function statusClass(status: string) {
  if (status === "待提报") return "st-draft";
  if (status === "待一级审批") return "st-l1";
  if (status === "待二级审批") return "st-l2";
  if (status === "审批通过") return "st-pass";
  return "st-back";
}

const visible = computed(() => {
  const source = records.value.filter((item) => canSee(item));
  const q = applied.value;
  const has = (value: string, keyword: string) => value.toLowerCase().includes(keyword.trim().toLowerCase());
  return source.filter((item) => {
    if (q.keyword && !has(item.recordNo, q.keyword) && !has(item.title, q.keyword)) return false;
    if (q.proposeDept && !has(item.proposeDept, q.proposeDept)) return false;
    if (q.developDept && !has(item.developDept, q.developDept)) return false;
    if (q.demandType && item.demandType !== q.demandType) return false;
    if (q.approvalStatus && item.approvalStatus !== q.approvalStatus) return false;
    if (q.progress.length && !q.progress.includes(item.progress)) return false;
    if (q.proposeDateStart && item.proposeDate < q.proposeDateStart) return false;
    if (q.proposeDateEnd && item.proposeDate > q.proposeDateEnd) return false;
    return true;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(visible.value.length / pageSize.value)));
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return visible.value.slice(start, start + pageSize.value);
});
const blankRows = computed(() => (pageRows.value.length === 0 ? 0 : Math.max(0, 6 - pageRows.value.length)));
const pageNumbers = computed(() => {
  const total = totalPages.value;
  const current = page.value;
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
});
const allChecked = computed(
  () => pageRows.value.length > 0 && pageRows.value.every((row) => selected.value.includes(row.id)),
);

let toastTimer = 0;
function showToast(message: string) {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = "";
  }, 2200);
}

function persist(next: Demand[]) {
  records.value = next;
  saveRecords(next);
}

const progressOpen = ref(false);
const progressBox = ref<HTMLElement | null>(null);
const progressLabel = computed(() => {
  const picked = PROGRESS_OPTIONS.filter((item) => draft.progress.includes(item));
  return picked.length ? picked.join("、") : "全部";
});

function toggleProgress(item: string) {
  const index = draft.progress.indexOf(item);
  if (index >= 0) draft.progress.splice(index, 1);
  else draft.progress.push(item);
}

function closeProgress(event: MouseEvent) {
  if (!progressBox.value?.contains(event.target as Node)) progressOpen.value = false;
}

onMounted(() => {
  document.addEventListener("click", closeProgress);
  window.addEventListener("hashchange", syncFromHash);
  if (!location.hash || location.hash === "#") history.replaceState(null, "", "#/demand");
  syncFromHash();
});
onBeforeUnmount(() => {
  document.removeEventListener("click", closeProgress);
  window.removeEventListener("hashchange", syncFromHash);
  document.title = "数字化法治企业建设平台";
});

function search() {
  if (draft.proposeDateStart && draft.proposeDateEnd && draft.proposeDateStart > draft.proposeDateEnd) {
    showToast("开始日期不能晚于结束日期");
    return;
  }
  applied.value = { ...draft, progress: [...draft.progress] };
  page.value = 1;
  jump.value = "1";
  selected.value = [];
}

function resetQuery() {
  Object.assign(draft, emptyQuery());
  progressOpen.value = false;
  search();
}

function goPage(next: number) {
  page.value = Math.min(Math.max(1, next), totalPages.value);
  jump.value = String(page.value);
  selected.value = [];
}

function jumpTo() {
  const target = Number(jump.value);
  if (!Number.isInteger(target)) return;
  goPage(target);
}

function changePageSize() {
  page.value = 1;
  jump.value = "1";
  selected.value = [];
}

function toggleAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  const ids = pageRows.value.map((row) => row.id);
  selected.value = checked
    ? Array.from(new Set([...selected.value, ...ids]))
    : selected.value.filter((id) => !ids.includes(id));
}

function toggleOne(id: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selected.value = checked ? [...selected.value, id] : selected.value.filter((item) => item !== id);
}

function clearErrors() {
  for (const key of Object.keys(errors) as (keyof DemandForm)[]) delete errors[key];
}

function applyCreate() {
  Object.assign(form, emptyForm());
  if (canFile.value) {
    form.proposeDept = props.user.dept;
    form.proposeContact = props.user.name;
  }
  editingId.value = null;
  mode.value = "create";
  clearErrors();
}

function applyRecord(row: Demand, nextMode: "edit" | "view") {
  Object.assign(form, emptyForm(), row);
  editingId.value = row.id;
  mode.value = nextMode;
  clearErrors();
}

function goList() {
  if (location.hash !== "#/demand") location.hash = "#/demand";
  else {
    mode.value = null;
    editingId.value = null;
  }
}

function openHash(next: string) {
  if (location.hash === next) syncFromHash();
  else location.hash = next;
}

function openCreate() {
  openHash("#/demand/create");
}

function openRecord(row: Demand, nextMode: "edit" | "view") {
  openHash(`#/demand/${nextMode}/${encodeURIComponent(row.id)}`);
}

function closeForm() {
  goList();
}

function syncFromHash() {
  const path = (location.hash.replace(/^#/, "") || "/demand").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts[1] === "create") {
    if (!canFile.value) {
      if (location.hash !== "#/demand") location.hash = "#/demand";
      else mode.value = null;
      return;
    }
    applyCreate();
    return;
  }
  if ((parts[1] === "edit" || parts[1] === "view") && parts[2]) {
    const row = records.value.find((item) => item.id === decodeURIComponent(parts[2]));
    if (!row) {
      showToast("未找到该需求备案");
      if (location.hash !== "#/demand") location.hash = "#/demand";
      else mode.value = null;
      return;
    }
    const canEdit = canMaintain(row);
    if (parts[1] === "edit" && !canEdit) {
      const viewHash = `#/demand/view/${encodeURIComponent(row.id)}`;
      if (location.hash !== viewHash) location.hash = viewHash;
      else applyRecord(row, "view");
      return;
    }
    applyRecord(row, parts[1] === "edit" ? "edit" : "view");
    return;
  }
  mode.value = null;
  editingId.value = null;
}

function saveForm() {
  clearErrors();
  const found = validateForm(form, records.value, editingId.value ?? undefined);
  Object.assign(errors, found);
  if (Object.keys(found).length) {
    nextTick(() => document.querySelector(".field.error")?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return;
  }
  const payload = emptyForm();
  for (const key of Object.keys(payload) as (keyof DemandForm)[]) {
    payload[key] = String(form[key] ?? "").trim();
  }
  if (mode.value === "create") {
    if (!canFile.value) return;
    const created: Demand = {
      ...payload,
      id: crypto.randomUUID(),
      createdBy: props.user.id,
      createdAt: new Date().toISOString(),
      approvalStatus: "待提报",
      approvalOpinion: "",
    };
    persist([created, ...records.value]);
    showToast("已新建需求备案");
  } else if (mode.value === "edit" && editingId.value) {
    const current = records.value.find((item) => item.id === editingId.value);
    if (!current || !canMaintain(current)) {
      showToast("当前状态不可修改");
      closeForm();
      return;
    }
    persist(records.value.map((item) => (item.id === current.id ? { ...item, ...payload } : item)));
    showToast("已保存修改");
  }
  closeForm();
  goPage(1);
}

const selectedRows = computed(() => records.value.filter((item) => selected.value.includes(item.id)));
const submittableCount = computed(() => selectedRows.value.filter((item) => canMaintain(item)).length);
const l1Count = computed(() => selectedRows.value.filter((item) => canApproveL1(item)).length);
const l2Count = computed(() => selectedRows.value.filter((item) => canApproveL2(item)).length);
const currentRecord = computed(() => records.value.find((item) => item.id === editingId.value) ?? null);
const currentStatus = computed(() => (mode.value === "create" ? "待提报" : currentRecord.value?.approvalStatus ?? ""));
const currentOpinion = computed(() => (mode.value === "create" ? "" : currentRecord.value?.approvalOpinion ?? ""));
const flowNodes = computed(() =>
  flowSteps.map((step) => ({ ...step, current: step.statuses.includes(currentStatus.value) })),
);

function askDelete(row: Demand) {
  if (!canMaintain(row)) {
    showToast("仅待提报或已退回的本人备案可以删除");
    return;
  }
  confirmText.value = `确定删除需求备案「${row.title}」吗？删除后不可恢复。`;
  confirmAction.value = () => {
    persist(records.value.filter((item) => item.id !== row.id));
    selected.value = selected.value.filter((id) => id !== row.id);
    showToast("已删除");
    if (page.value > totalPages.value) goPage(totalPages.value);
  };
}

function askBatchDelete() {
  const rows = selectedRows.value.filter((item) => canMaintain(item));
  if (!rows.length) {
    showToast("请选择本人待提报或已退回的备案");
    return;
  }
  const ids = rows.map((item) => item.id);
  confirmText.value = `确定删除选中的 ${ids.length} 条需求备案吗？删除后不可恢复。`;
  confirmAction.value = () => {
    persist(records.value.filter((item) => !ids.includes(item.id)));
    selected.value = selected.value.filter((id) => !ids.includes(id));
    showToast("已批量删除");
    if (page.value > totalPages.value) goPage(totalPages.value);
  };
}

function askSubmit(rows: Demand[]) {
  const eligible = rows.filter((item) => canMaintain(item));
  if (!eligible.length) {
    showToast("请选择本人待提报或已退回的备案");
    return;
  }
  const skipped = rows.length - eligible.length;
  const nextStatus = isDirector.value ? "待二级审批" : "待一级审批";
  const routeText = isDirector.value ? "部门主任提报后直接进入集团二级审批。" : "提报后进入本单位部门主任一级审批。";
  confirmText.value = `确定提报选中的 ${eligible.length} 条需求吗？${routeText}${skipped ? `另有 ${skipped} 条不符合提报条件，将跳过。` : ""}`;
  confirmAction.value = () => {
    const ids = new Set(eligible.map((item) => item.id));
    persist(
      records.value.map((item) => (ids.has(item.id) ? { ...item, approvalStatus: nextStatus, approvalOpinion: "" } : item)),
    );
    selected.value = selected.value.filter((id) => !ids.has(id));
    showToast(`已提报 ${ids.size} 条`);
  };
}

function askBatchSubmit() {
  askSubmit(selectedRows.value);
}

function openApproval(rows: Demand[], level: 1 | 2) {
  const eligible = rows.filter((item) => (level === 1 ? canApproveL1(item) : canApproveL2(item)));
  if (!eligible.length) {
    showToast(level === 1 ? "请选择本单位待一级审批、且非本人提报的备案" : "请选择待二级审批的备案");
    return;
  }
  approvalIds.value = eligible.map((item) => item.id);
  approvalLevel.value = level;
  approvalOpinion.value = "";
}

function runApproval(pass: boolean) {
  const opinion = approvalOpinion.value.trim();
  if (!pass && !opinion) {
    showToast("退回时请填写审批意见");
    return;
  }
  const ids = new Set(approvalIds.value);
  const status = pass ? (approvalLevel.value === 1 ? "待二级审批" : "审批通过") : "已退回";
  persist(
    records.value.map((item) => (ids.has(item.id) ? { ...item, approvalStatus: status, approvalOpinion: opinion } : item)),
  );
  selected.value = selected.value.filter((id) => !ids.has(id));
  approvalIds.value = [];
  showToast(pass ? `已通过 ${ids.size} 条` : `已退回 ${ids.size} 条`);
}

function runConfirm() {
  confirmAction.value?.();
  confirmAction.value = null;
}

const dialogTitle = computed(() => {
  if (mode.value === "create") return "新建需求备案";
  if (mode.value === "edit") return "修改需求备案";
  if (mode.value === "view") return "查看需求备案";
  return "需求备案";
});
const readonly = computed(() => mode.value === "view");

watch(
  [mode, dialogTitle],
  () => {
    flowOpen.value = false;
    document.title = mode.value ? `${dialogTitle.value} - 数字化法治企业建设平台` : "数字化法治企业建设平台";
  },
  { immediate: true },
);
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 3v18M7 7h10M8 21h8" />
            <path d="M8 7l-3 6h6L8 7zm8 0l-3 6h6l-3-6z" />
          </svg>
        </span>
        数字化法治企业建设平台
      </div>
      <div class="top-actions">
        <button class="icon-btn" type="button" aria-label="收藏">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.5L12 16.8 7 18.6l1.2-5.5L4 9.3l5.6-.6L12 3.5z"/></svg>
        </button>
        <button class="icon-btn" type="button" aria-label="通知">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 16V10a6 6 0 1112 0v6l1.5 2H4.5L6 16z"/><path d="M10 19a2 2 0 004 0"/></svg>
        </button>
        <div class="userbox">
          <span class="avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.4-2.8 3.8-4.2 7-4.2s5.6 1.4 7 4.2"/></svg>
          </span>
            <span class="user-meta">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-role">{{ roleLabel(user.role) }}</span>
          </span>
        </div>
        <button class="logout" type="button" @click="$emit('logout')">退出</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sider">
        <button
          v-for="item in nav"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: item.key === 'demand' }"
          @click="item.key === 'demand' ? goList() : showToast('该栏目为平台导航示意，当前开放需求备案')"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          {{ item.label }}
        </button>
      </aside>

      <main class="main">
        <div class="tabbar">
          <button class="tab" :class="{ current: !mode }" type="button" @click="goList">需求备案</button>
          <div v-if="mode" class="tab current">
            {{ dialogTitle }}
            <button class="tab-x" type="button" aria-label="关闭页面" @click="goList">×</button>
          </div>
        </div>
        <section v-if="!mode" class="panel">
          <div class="section-label">查询条件</div>
          <div class="query-row">
            <div class="query-item">
              <label>需求：</label>
              <input v-model="draft.keyword" placeholder="请输入需求编号或需求名称" />
            </div>
            <div class="query-item">
              <label>需求提出单位：</label>
              <input v-model="draft.proposeDept" placeholder="请输入" />
            </div>
            <div class="query-item">
              <label>需求开发单位：</label>
              <input v-model="draft.developDept" placeholder="请输入" />
            </div>
            <div class="query-item">
              <label>需求类型：</label>
              <select v-model="draft.demandType">
                <option value="">全部</option>
                <option v-for="item in TYPE_OPTIONS" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
            <div class="query-item">
              <label>审批状态：</label>
              <select v-model="draft.approvalStatus">
                <option value="">全部</option>
                <option v-for="item in APPROVAL_OPTIONS" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
            <div class="query-item">
              <label>需求处理进度：</label>
              <div ref="progressBox" class="multi" :class="{ open: progressOpen }">
                <button
                  class="multi-trigger"
                  type="button"
                  :title="progressLabel"
                  @click="progressOpen = !progressOpen"
                >
                  <span class="multi-text">{{ progressLabel }}</span>
                  <i class="multi-caret"></i>
                </button>
                <div v-if="progressOpen" class="multi-panel">
                  <label v-for="item in PROGRESS_OPTIONS" :key="item" class="multi-option">
                    <input
                      type="checkbox"
                      :checked="draft.progress.includes(item)"
                      @change="toggleProgress(item)"
                    />
                    <span>{{ item }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="query-item">
              <label>需求提出时间：</label>
              <div class="date-range">
                <DateField v-model="draft.proposeDateStart" />
                <span>至</span>
                <DateField v-model="draft.proposeDateEnd" />
              </div>
            </div>
            <div class="query-item query-actions-item">
              <div class="query-actions">
                <button class="btn primary" type="button" @click="search">查询</button>
                <button class="btn" type="button" @click="resetQuery">重置</button>
              </div>
            </div>
          </div>

          <div class="list-head">
            <div class="section-label" style="margin: 0">数据列表</div>
            <div class="list-actions">
              <button v-if="canFile" class="btn primary" type="button" @click="openCreate">新建</button>
              <button v-if="canFile" class="btn" type="button" :disabled="!submittableCount" @click="askBatchSubmit">批量提报</button>
              <button v-if="isDirector" class="btn" type="button" :disabled="!l1Count" @click="openApproval(selectedRows, 1)">一级审批</button>
              <button v-if="isGroup" class="btn" type="button" :disabled="!l2Count" @click="openApproval(selectedRows, 2)">二级审批</button>
              <button v-if="canFile" class="btn danger" type="button" :disabled="!submittableCount" @click="askBatchDelete">批量删除</button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="has-check">
              <thead>
                <tr>
                  <th class="check freeze freeze-check">
                    <input type="checkbox" :checked="allChecked" @change="toggleAll" />
                  </th>
                  <th class="col-no freeze freeze-no">序号</th>
                  <th class="col-record freeze freeze-record">需求编号</th>
                  <th class="col-title freeze freeze-title">需求名称</th>
                  <th>需求提出单位</th>
                  <th class="clip">需求描述</th>
                  <th>所属业务</th>
                  <th>需求所属系统</th>
                  <th>需求模块</th>
                  <th>需求类型</th>
                  <th>需求处理进度</th>
                  <th>需求开发单位</th>
                  <th>需求提出时间</th>
                  <th>审批状态</th>
                  <th class="ops">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in pageRows" :key="row.id">
                  <td class="check freeze freeze-check">
                    <input type="checkbox" :checked="selected.includes(row.id)" @change="toggleOne(row.id, $event)" />
                  </td>
                  <td class="col-no freeze freeze-no">{{ (page - 1) * pageSize + index + 1 }}</td>
                  <td class="col-record freeze freeze-record">{{ row.recordNo }}</td>
                  <td class="col-title freeze freeze-title">{{ row.title }}</td>
                  <td>{{ row.proposeDept }}</td>
                  <td class="clip"><span class="clip-text" :title="row.detail">{{ row.detail }}</span></td>
                  <td>{{ row.business }}</td>
                  <td>{{ row.systemName }}</td>
                  <td>{{ row.moduleName }}</td>
                  <td>{{ row.demandType }}</td>
                  <td>{{ row.progress }}</td>
                  <td>{{ row.developDept }}</td>
                  <td>{{ row.proposeDate }}</td>
                  <td><span :class="statusClass(row.approvalStatus)">{{ row.approvalStatus }}</span></td>
                  <td class="ops">
                    <button v-if="canMaintain(row)" class="link" type="button" @click="openRecord(row, 'edit')">修改</button>
                    <button class="link" type="button" @click="openRecord(row, 'view')">查看</button>
                    <button v-if="canMaintain(row)" class="link" type="button" @click="askSubmit([row])">提报</button>
                    <button v-if="canApproveL1(row)" class="link" type="button" @click="openApproval([row], 1)">一级审批</button>
                    <button v-if="canApproveL2(row)" class="link" type="button" @click="openApproval([row], 2)">二级审批</button>
                    <button v-if="canMaintain(row)" class="link danger" type="button" @click="askDelete(row)">删除</button>
                  </td>
                </tr>
                <tr v-for="n in blankRows" :key="`blank-${n}`" class="empty-row">
                  <td class="check freeze freeze-check" />
                  <td class="col-no freeze freeze-no">{{ (page - 1) * pageSize + pageRows.length + n }}</td>
                  <td class="col-record freeze freeze-record"></td>
                  <td class="col-title freeze freeze-title"></td>
                  <td v-for="col in 10" :key="col"></td>
                  <td class="ops"></td>
                </tr>
                <tr v-if="pageRows.length === 0">
                  <td colspan="15">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager">
            <button class="page-btn" type="button" :disabled="page <= 1" @click="goPage(page - 1)">‹</button>
            <button
              v-for="num in pageNumbers"
              :key="num"
              class="page-num"
              :class="{ active: num === page }"
              type="button"
              @click="goPage(num)"
            >
              {{ num }}
            </button>
            <button class="page-btn" type="button" :disabled="page >= totalPages" @click="goPage(page + 1)">›</button>
            <select v-model.number="pageSize" @change="changePageSize">
              <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}条/页</option>
            </select>
            <span>跳至</span>
            <input v-model="jump" class="jump" @keyup.enter="jumpTo" @blur="jumpTo" />
            <span>页</span>
          </div>
        </section>
        <section v-else class="panel form-page">
          <div class="form-body">
            <div class="page-title-row">
              <h2 class="page-title">{{ dialogTitle }}</h2>
              <button v-if="readonly" class="btn" type="button" @click="flowOpen = true">审批流程</button>
            </div>
            <div class="form-block">
              <div class="section-label">需求信息</div>
              <div class="form-grid">
                <div class="field" :class="{ error: errors.recordNo }">
                  <label><span class="req">*</span>需求编号</label>
                  <input v-model="form.recordNo" :disabled="readonly" maxlength="40" />
                  <span v-if="errors.recordNo" class="err">{{ errors.recordNo }}</span>
                </div>
                <div class="field" :class="{ error: errors.title }">
                  <label><span class="req">*</span>需求名称</label>
                  <input v-model="form.title" :disabled="readonly" maxlength="80" />
                  <span v-if="errors.title" class="err">{{ errors.title }}</span>
                </div>
                <div class="field" :class="{ error: errors.proposeDept }">
                  <label><span class="req">*</span>需求提出单位</label>
                  <input v-model="form.proposeDept" :disabled="readonly" maxlength="40" />
                  <span v-if="errors.proposeDept" class="err">{{ errors.proposeDept }}</span>
                </div>
                <div class="field">
                  <label>提出方联系人</label>
                  <input v-model="form.proposeContact" :disabled="readonly" maxlength="20" />
                </div>
                <div class="field" :class="{ error: errors.proposePhone }">
                  <label><span class="req">*</span>提出方电话</label>
                  <input v-model="form.proposePhone" :disabled="readonly" maxlength="20" />
                  <span v-if="errors.proposePhone" class="err">{{ errors.proposePhone }}</span>
                </div>
                <div class="field" :class="{ error: errors.proposeDate }">
                  <label><span class="req">*</span>需求提出时间</label>
                  <DateField v-model="form.proposeDate" :disabled="readonly" />
                  <span v-if="errors.proposeDate" class="err">{{ errors.proposeDate }}</span>
                </div>
                <div class="field full" :class="{ error: errors.detail }">
                  <label><span class="req">*</span>需求描述</label>
                  <textarea v-model="form.detail" :disabled="readonly" maxlength="2000" />
                  <span v-if="errors.detail" class="err">{{ errors.detail }}</span>
                </div>
                <div class="field" :class="{ error: errors.business }">
                  <label><span class="req">*</span>所属业务</label>
                  <select v-model="form.business" :disabled="readonly">
                    <option value="">请选择</option>
                    <option v-for="item in BUSINESS_OPTIONS" :key="item">{{ item }}</option>
                  </select>
                  <span v-if="errors.business" class="err">{{ errors.business }}</span>
                </div>
                <div class="field" :class="{ error: errors.systemName }">
                  <label><span class="req">*</span>需求所属系统</label>
                  <input v-model="form.systemName" :disabled="readonly" maxlength="40" />
                  <span v-if="errors.systemName" class="err">{{ errors.systemName }}</span>
                </div>
                <div class="field" :class="{ error: errors.moduleName }">
                  <label><span class="req">*</span>需求模块</label>
                  <input v-model="form.moduleName" :disabled="readonly" maxlength="40" />
                  <span v-if="errors.moduleName" class="err">{{ errors.moduleName }}</span>
                </div>
                <div class="field" :class="{ error: errors.demandType }">
                  <label><span class="req">*</span>需求类型</label>
                  <select v-model="form.demandType" :disabled="readonly">
                    <option value="">请选择</option>
                    <option v-for="item in TYPE_OPTIONS" :key="item">{{ item }}</option>
                  </select>
                  <span v-if="errors.demandType" class="err">{{ errors.demandType }}</span>
                </div>
                <div class="field" :class="{ error: errors.digitalMode }">
                  <label><span class="req">*</span>数字化/智能化</label>
                  <select v-model="form.digitalMode" :disabled="readonly">
                    <option value="">请选择</option>
                    <option v-for="item in DIGITAL_OPTIONS" :key="item">{{ item }}</option>
                  </select>
                  <span v-if="errors.digitalMode" class="err">{{ errors.digitalMode }}</span>
                </div>
              </div>
            </div>
            <div class="form-block">
              <div class="section-label">建设处理</div>
              <div class="form-grid">
                <div class="field">
                  <label>审批状态</label>
                  <input :value="currentStatus" disabled />
                </div>
                <div v-if="currentOpinion" class="field full">
                  <label>审批意见</label>
                  <textarea :value="currentOpinion" disabled />
                </div>
                <div class="field" :class="{ error: errors.developDept }">
                  <label><span class="req">*</span>需求开发单位</label>
                  <input v-model="form.developDept" :disabled="readonly" maxlength="40" />
                  <span v-if="errors.developDept" class="err">{{ errors.developDept }}</span>
                </div>
                <div class="field">
                  <label>开发方联系人</label>
                  <input v-model="form.developContact" :disabled="readonly" maxlength="20" />
                </div>
                <div class="field" :class="{ error: errors.developPhone }">
                  <label><span class="req">*</span>开发方电话</label>
                  <input v-model="form.developPhone" :disabled="readonly" maxlength="20" />
                  <span v-if="errors.developPhone" class="err">{{ errors.developPhone }}</span>
                </div>
                <div class="field" :class="{ error: errors.expectOnlineDate }">
                  <label><span class="req">*</span>期望上线时间</label>
                  <DateField v-model="form.expectOnlineDate" :disabled="readonly" />
                  <span v-if="errors.expectOnlineDate" class="err">{{ errors.expectOnlineDate }}</span>
                </div>
                <div class="field" :class="{ error: errors.planOnlineDate }">
                  <label><span class="req">*</span>预计上线时间</label>
                  <DateField v-model="form.planOnlineDate" :disabled="readonly" />
                  <span v-if="errors.planOnlineDate" class="err">{{ errors.planOnlineDate }}</span>
                </div>
                <div class="field">
                  <label>实际上线时间</label>
                  <DateField v-model="form.actualOnlineDate" :disabled="readonly" />
                </div>
                <div class="field" :class="{ error: errors.progress }">
                  <label><span class="req">*</span>需求处理进度</label>
                  <select v-model="form.progress" :disabled="readonly">
                    <option value="">请选择</option>
                    <option v-for="item in PROGRESS_OPTIONS" :key="item">{{ item }}</option>
                  </select>
                  <span v-if="errors.progress" class="err">{{ errors.progress }}</span>
                </div>
                <div class="field full">
                  <label>当前进度描述</label>
                  <textarea v-model="form.progressDesc" :disabled="readonly" maxlength="500" />
                </div>
                <div class="field full">
                  <label>备注</label>
                  <textarea v-model="form.remark" :disabled="readonly" maxlength="500" />
                </div>
              </div>
            </div>
          </div>
          <div class="page-ft">
            <button class="btn" type="button" @click="closeForm">{{ readonly ? "返回" : "取消" }}</button>
            <button v-if="!readonly" class="btn primary" type="button" @click="saveForm">确定</button>
          </div>
        </section>
      </main>
    </div>

    <div v-if="flowOpen" class="mask" @click.self="flowOpen = false">
      <div class="dialog flow-dialog" role="dialog" aria-modal="true" aria-label="审批流程">
        <div class="dialog-hd">
          <span>审批流程</span>
          <button type="button" aria-label="关闭" @click="flowOpen = false">×</button>
        </div>
        <div class="dialog-bd">
          <p class="confirm-text">{{ form.recordNo }} {{ form.title }}</p>
          <div class="flow">
            <template v-for="(node, index) in flowNodes" :key="node.name">
              <div class="flow-node" :class="{ current: node.current }">
                <span class="flow-name">{{ node.name }}</span>
                <span class="flow-role">{{ node.role }}</span>
              </div>
              <span v-if="index < flowNodes.length - 1" class="flow-arrow" aria-hidden="true"></span>
            </template>
          </div>
          <p class="flow-note">当前状态：{{ currentStatus }}{{ currentStatus === "已退回" ? "，已回到需求提报" : "" }}</p>
        </div>
        <div class="dialog-ft">
          <button class="btn" type="button" @click="flowOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="approvalIds.length" class="mask">
      <div class="dialog approve" role="dialog" aria-modal="true">
        <div class="dialog-hd">
          <span>{{ approvalLevel === 1 ? "一级审批" : "二级审批" }}</span>
          <button type="button" aria-label="关闭" @click="approvalIds = []">×</button>
        </div>
        <div class="dialog-bd">
          <p class="confirm-text">将对 {{ approvalIds.length }} 条需求进行{{ approvalLevel === 1 ? "一级" : "二级" }}审批。通过后{{ approvalLevel === 1 ? "进入集团二级审批" : "备案生效" }}，退回后由提报人修改并重新提报。</p>
          <label class="opinion-label">审批意见</label>
          <textarea v-model="approvalOpinion" maxlength="200" placeholder="退回时必填"></textarea>
        </div>
        <div class="dialog-ft">
          <button class="btn" type="button" @click="approvalIds = []">取消</button>
          <button class="btn danger" type="button" @click="runApproval(false)">退回</button>
          <button class="btn primary" type="button" @click="runApproval(true)">通过</button>
        </div>
      </div>
    </div>

    <div v-if="confirmAction" class="mask">
      <div class="dialog small" role="dialog" aria-modal="true">
        <div class="dialog-hd"><span>删除确认</span></div>
        <div class="dialog-bd"><p class="confirm-text">{{ confirmText }}</p></div>
        <div class="dialog-ft">
          <button class="btn" type="button" @click="confirmAction = null">取消</button>
          <button class="btn primary" type="button" @click="runConfirm">确定</button>
        </div>
      </div>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
