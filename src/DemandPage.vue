<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  DIGITAL_OPTIONS,
  MAINTAIN_OPTIONS,
  PAGE_SIZE_OPTIONS,
  PROGRESS_OPTIONS,
  TYPE_OPTIONS,
  emptyForm,
  emptyQuery,
  loadRecords,
  saveRecords,
  validateForm,
} from "./store";
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

const isReporter = computed(() => props.user.role === "reporter");

const visible = computed(() => {
  const source = isReporter.value
    ? records.value.filter((item) => item.createdBy === props.user.id)
    : records.value;
  const q = applied.value;
  const has = (value: string, keyword: string) => value.toLowerCase().includes(keyword.trim().toLowerCase());
  return source.filter((item) => {
    if (q.keyword && !has(item.recordNo, q.keyword) && !has(item.title, q.keyword)) return false;
    if (q.proposeDept && !has(item.proposeDept, q.proposeDept)) return false;
    if (q.developDept && !has(item.developDept, q.developDept)) return false;
    if (q.maintainMode && item.maintainMode !== q.maintainMode) return false;
    if (q.progress.length && !q.progress.includes(item.progress)) return false;
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

onMounted(() => document.addEventListener("click", closeProgress));
onBeforeUnmount(() => document.removeEventListener("click", closeProgress));

function search() {
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

function openCreate() {
  Object.assign(form, emptyForm());
  if (isReporter.value) {
    form.proposeDept = props.user.dept;
    form.proposeContact = props.user.name;
  }
  editingId.value = null;
  mode.value = "create";
  clearErrors();
}

function openRecord(row: Demand, nextMode: "edit" | "view") {
  Object.assign(form, emptyForm(), row);
  editingId.value = row.id;
  mode.value = nextMode;
  clearErrors();
}

function closeForm() {
  mode.value = null;
}

function saveForm() {
  clearErrors();
  const found = validateForm(form, records.value, editingId.value ?? undefined);
  Object.assign(errors, found);
  if (Object.keys(found).length) return;
  const payload: DemandForm = { ...form };
  for (const key of Object.keys(payload) as (keyof DemandForm)[]) {
    payload[key] = payload[key].trim();
  }
  if (mode.value === "create") {
    const created: Demand = {
      ...payload,
      id: crypto.randomUUID(),
      createdBy: props.user.id,
      createdAt: new Date().toISOString(),
    };
    persist([created, ...records.value]);
    showToast("已新建需求备案");
  } else if (mode.value === "edit" && editingId.value) {
    persist(
      records.value.map((item) =>
        item.id === editingId.value && item.createdBy === props.user.id ? { ...item, ...payload } : item,
      ),
    );
    showToast("已保存修改");
  }
  closeForm();
  goPage(1);
}

function askDelete(row: Demand) {
  confirmText.value = `确定删除需求备案「${row.title}」吗？删除后不可恢复。`;
  confirmAction.value = () => {
    persist(records.value.filter((item) => item.id !== row.id || item.createdBy !== props.user.id));
    selected.value = selected.value.filter((id) => id !== row.id);
    showToast("已删除");
    if (page.value > totalPages.value) goPage(totalPages.value);
  };
}

function askBatchDelete() {
  if (!selected.value.length) {
    showToast("请先选择要删除的数据");
    return;
  }
  const ids = [...selected.value];
  confirmText.value = `确定删除选中的 ${ids.length} 条需求备案吗？删除后不可恢复。`;
  confirmAction.value = () => {
    persist(records.value.filter((item) => !(ids.includes(item.id) && item.createdBy === props.user.id)));
    selected.value = [];
    showToast("已批量删除");
    if (page.value > totalPages.value) goPage(totalPages.value);
  };
}

function runConfirm() {
  confirmAction.value?.();
  confirmAction.value = null;
}

const dialogTitle = computed(() => {
  if (mode.value === "create") return "新建需求备案";
  if (mode.value === "edit") return "修改需求备案";
  return "查看需求备案";
});
const readonly = computed(() => mode.value === "view");
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
            <span class="user-role">{{ isReporter ? "填报者" : "查看者" }}</span>
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
          @click="item.key === 'demand' ? undefined : showToast('该栏目为平台导航示意，当前开放需求备案')"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          {{ item.label }}
        </button>
      </aside>

      <main class="main">
        <div class="tabbar"><div class="tab">需求备案</div></div>
        <section class="panel">
          <div class="section-label">查询条件</div>
          <div class="query-row">
            <div class="query-item">
              <label>需求：</label>
              <input v-model="draft.keyword" placeholder="请输入需求备案号或需求标题" />
            </div>
            <div class="query-item">
              <label>需求提出部门：</label>
              <input v-model="draft.proposeDept" placeholder="请输入" />
            </div>
            <div class="query-item">
              <label>需求开发部门：</label>
              <input v-model="draft.developDept" placeholder="请输入" />
            </div>
            <div class="query-item">
              <label>统维/自建：</label>
              <select v-model="draft.maintainMode">
                <option value="">全部</option>
                <option v-for="item in MAINTAIN_OPTIONS" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
            <div class="query-item">
              <label>需求建设进度：</label>
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
              <span></span>
              <div class="query-actions">
                <button class="btn primary" type="button" @click="search">查询</button>
                <button class="btn" type="button" @click="resetQuery">重置</button>
              </div>
            </div>
          </div>

          <div class="list-head">
            <div class="section-label" style="margin: 0">数据列表</div>
            <div v-if="isReporter" class="list-actions">
              <button class="btn primary" type="button" @click="openCreate">新建</button>
              <button class="btn danger" type="button" :disabled="!selected.length" @click="askBatchDelete">批量删除</button>
            </div>
          </div>

          <div class="table-wrap">
            <table :class="{ 'has-check': isReporter }">
              <thead>
                <tr>
                  <th v-if="isReporter" class="check freeze freeze-check">
                    <input type="checkbox" :checked="allChecked" @change="toggleAll" />
                  </th>
                  <th class="col-no freeze freeze-no">序号</th>
                  <th class="col-record freeze freeze-record">需求备案号</th>
                  <th class="col-title freeze freeze-title">需求标题</th>
                  <th>需求所属系统</th>
                  <th>需求模块</th>
                  <th>需求类型</th>
                  <th>统维/自建</th>
                  <th>需求提出部门</th>
                  <th>需求开发部门</th>
                  <th>需求提出时间</th>
                  <th class="clip">需求详述</th>
                  <th>需求建设进度</th>
                  <th class="ops">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in pageRows" :key="row.id">
                  <td v-if="isReporter" class="check freeze freeze-check">
                    <input type="checkbox" :checked="selected.includes(row.id)" @change="toggleOne(row.id, $event)" />
                  </td>
                  <td class="col-no freeze freeze-no">{{ (page - 1) * pageSize + index + 1 }}</td>
                  <td class="col-record freeze freeze-record">{{ row.recordNo }}</td>
                  <td class="col-title freeze freeze-title">{{ row.title }}</td>
                  <td>{{ row.systemName }}</td>
                  <td>{{ row.moduleName }}</td>
                  <td>{{ row.demandType }}</td>
                  <td>{{ row.maintainMode }}</td>
                  <td>{{ row.proposeDept }}</td>
                  <td>{{ row.developDept }}</td>
                  <td>{{ row.proposeDate }}</td>
                  <td class="clip"><span class="clip-text" :title="row.detail">{{ row.detail }}</span></td>
                  <td>{{ row.progress }}</td>
                  <td class="ops">
                    <button v-if="isReporter" class="link" type="button" @click="openRecord(row, 'edit')">修改</button>
                    <button v-if="isReporter" class="link danger" type="button" @click="askDelete(row)">删除</button>
                    <button class="link" type="button" @click="openRecord(row, 'view')">查看</button>
                  </td>
                </tr>
                <tr v-for="n in blankRows" :key="`blank-${n}`" class="empty-row">
                  <td v-if="isReporter" class="check freeze freeze-check" />
                  <td class="col-no freeze freeze-no">{{ (page - 1) * pageSize + pageRows.length + n }}</td>
                  <td class="col-record freeze freeze-record"></td>
                  <td class="col-title freeze freeze-title"></td>
                  <td v-for="col in 9" :key="col"></td>
                  <td class="ops"></td>
                </tr>
                <tr v-if="pageRows.length === 0">
                  <td :colspan="isReporter ? 14 : 13">暂无数据</td>
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
      </main>
    </div>

    <div v-if="mode" class="mask" @click.self="closeForm">
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-hd">
          <span>{{ dialogTitle }}</span>
          <button type="button" aria-label="关闭" @click="closeForm">×</button>
        </div>
        <div class="dialog-bd">
          <div class="form-grid">
            <div class="field" :class="{ error: errors.recordNo }">
              <label><span class="req">*</span>需求备案号</label>
              <input v-model="form.recordNo" :disabled="readonly" maxlength="40" />
              <span v-if="errors.recordNo" class="err">{{ errors.recordNo }}</span>
            </div>
            <div class="field" :class="{ error: errors.title }">
              <label><span class="req">*</span>需求标题</label>
              <input v-model="form.title" :disabled="readonly" maxlength="80" />
              <span v-if="errors.title" class="err">{{ errors.title }}</span>
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
            <div class="field" :class="{ error: errors.maintainMode }">
              <label><span class="req">*</span>统维/自建</label>
              <select v-model="form.maintainMode" :disabled="readonly">
                <option value="">请选择</option>
                <option v-for="item in MAINTAIN_OPTIONS" :key="item">{{ item }}</option>
              </select>
              <span v-if="errors.maintainMode" class="err">{{ errors.maintainMode }}</span>
            </div>
            <div class="field" :class="{ error: errors.digitalMode }">
              <label><span class="req">*</span>数字化/智能化</label>
              <select v-model="form.digitalMode" :disabled="readonly">
                <option value="">请选择</option>
                <option v-for="item in DIGITAL_OPTIONS" :key="item">{{ item }}</option>
              </select>
              <span v-if="errors.digitalMode" class="err">{{ errors.digitalMode }}</span>
            </div>
            <div class="field" :class="{ error: errors.proposeDept }">
              <label><span class="req">*</span>需求提出部门</label>
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
            <div class="field" :class="{ error: errors.developDept }">
              <label><span class="req">*</span>需求开发部门</label>
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
            <div class="field" :class="{ error: errors.proposeDate }">
              <label><span class="req">*</span>需求提出时间</label>
              <input v-model="form.proposeDate" type="date" :disabled="readonly" />
              <span v-if="errors.proposeDate" class="err">{{ errors.proposeDate }}</span>
            </div>
            <div class="field full" :class="{ error: errors.detail }">
              <label><span class="req">*</span>需求详述</label>
              <textarea v-model="form.detail" :disabled="readonly" maxlength="2000" />
              <span v-if="errors.detail" class="err">{{ errors.detail }}</span>
            </div>
            <div class="field" :class="{ error: errors.expectOnlineDate }">
              <label><span class="req">*</span>期望上线时间</label>
              <input v-model="form.expectOnlineDate" type="date" :disabled="readonly" />
              <span v-if="errors.expectOnlineDate" class="err">{{ errors.expectOnlineDate }}</span>
            </div>
            <div class="field" :class="{ error: errors.planOnlineDate }">
              <label><span class="req">*</span>预计上线时间</label>
              <input v-model="form.planOnlineDate" type="date" :disabled="readonly" />
              <span v-if="errors.planOnlineDate" class="err">{{ errors.planOnlineDate }}</span>
            </div>
            <div class="field">
              <label>实际上线时间</label>
              <input v-model="form.actualOnlineDate" type="date" :disabled="readonly" />
            </div>
            <div class="field" :class="{ error: errors.progress }">
              <label><span class="req">*</span>需求建设进度</label>
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
        <div class="dialog-ft">
          <button class="btn" type="button" @click="closeForm">{{ readonly ? "关闭" : "取消" }}</button>
          <button v-if="!readonly" class="btn primary" type="button" @click="saveForm">确定</button>
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
