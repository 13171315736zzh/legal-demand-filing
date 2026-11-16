import type { Demand, DemandForm, SessionUser } from "./types";

const STORAGE_KEY = "legal-demand-filing-v7";
const SESSION_KEY = "legal-demand-session-v1";

export const USERS: SessionUser[] = [
  { id: "u-wang", name: "王填报", role: "reporter", dept: "国网冀北电力法律部" },
  { id: "u-zhao", name: "赵主任", role: "director", dept: "国网冀北电力法律部" },
  { id: "u-sun", name: "孙主任", role: "director", dept: "国网山东电力法律部" },
  { id: "u-li", name: "李总", role: "group", dept: "集团法律部" },
  { id: "u-zhou", name: "周审", role: "group", dept: "集团法律部" },
];

export function roleLabel(role: SessionUser["role"]) {
  if (role === "reporter") return "填报员";
  if (role === "director") return "部门主任";
  return "集团审批";
}

export const BUSINESS_OPTIONS = ["诉讼处", "合同处", "法律合规处", "综合处"];
export const DIGITAL_OPTIONS = ["数字化", "智能化"];
export const TYPE_OPTIONS = ["自建", "统维"];
export const PROGRESS_OPTIONS = [
  "备案中",
  "备案通过",
  "需求分析",
  "产品设计",
  "功能开发",
  "功能发布",
  "试点验证",
  "上线应用",
  "取消",
  "全面推广（纳入统维）",
];

export const APPROVAL_OPTIONS = ["待提报", "待一级审批", "待二级审批", "审批通过", "已退回"];
export const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function emptyForm(): DemandForm {
  return {
    recordNo: "",
    title: "",
    business: "",
    systemName: "",
    moduleName: "",
    demandType: "",
    digitalMode: "",
    proposeDept: "",
    proposeContact: "",
    proposePhone: "",
    developDept: "",
    developContact: "",
    developPhone: "",
    proposeDate: "",
    detail: "",
    expectOnlineDate: "",
    planOnlineDate: "",
    actualOnlineDate: "",
    progress: "",
    progressDesc: "",
    remark: "",
  };
}

export function emptyQuery() {
  return {
    keyword: "",
    proposeDept: "",
    developDept: "",
    demandType: "",
    approvalStatus: "",
    progress: [] as string[],
    proposeDateStart: "",
    proposeDateEnd: "",
  };
}

const REQUIRED: (keyof DemandForm)[] = [
  "recordNo",
  "title",
  "business",
  "systemName",
  "moduleName",
  "demandType",
  "digitalMode",
  "proposeDept",
  "proposePhone",
  "developDept",
  "developPhone",
  "proposeDate",
  "detail",
  "expectOnlineDate",
  "planOnlineDate",
  "progress",
];

const PHONE = /^(1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/;

export function validateForm(form: DemandForm, records: Demand[], editingId?: string) {
  const errors: Partial<Record<keyof DemandForm, string>> = {};
  for (const key of REQUIRED) {
    if (!String(form[key] ?? "").trim()) errors[key] = "此项为必填";
  }
  if (form.proposePhone.trim() && !PHONE.test(form.proposePhone.trim())) {
    errors.proposePhone = "请输入有效电话";
  }
  if (form.developPhone.trim() && !PHONE.test(form.developPhone.trim())) {
    errors.developPhone = "请输入有效电话";
  }
  const recordNo = form.recordNo.trim();
  if (recordNo && records.some((item) => item.recordNo === recordNo && item.id !== editingId)) {
    errors.recordNo = "需求编号已存在";
  }
  return errors;
}

function seed(): Demand[] {
  const owners: { id: string; name: string; phone: string; dept: string; statuses: { status: string; opinion: string }[] }[] = [
    {
      id: "u-wang",
      name: "王填报",
      phone: "13811330021",
      dept: "国网冀北电力法律部",
      statuses: [
        { status: "待提报", opinion: "" },
        { status: "待提报", opinion: "" },
        { status: "待一级审批", opinion: "" },
        { status: "待一级审批", opinion: "" },
        { status: "待二级审批", opinion: "一级审批通过。" },
        { status: "审批通过", opinion: "同意备案。" },
        { status: "已退回", opinion: "需求描述不完整，请补充后重新提报。" },
      ],
    },
    {
      id: "u-zhao",
      name: "赵主任",
      phone: "13811330088",
      dept: "国网冀北电力法律部",
      statuses: [
        { status: "待提报", opinion: "" },
        { status: "待二级审批", opinion: "部门主任已提报。" },
      ],
    },
    {
      id: "u-zhang",
      name: "张明",
      phone: "13905318820",
      dept: "国网山东电力法律部",
      statuses: [
        { status: "待一级审批", opinion: "" },
        { status: "待一级审批", opinion: "" },
        { status: "已退回", opinion: "请补充所属业务后再提报。" },
      ],
    },
    {
      id: "u-sun",
      name: "孙主任",
      phone: "13905310011",
      dept: "国网山东电力法律部",
      statuses: [
        { status: "待提报", opinion: "" },
        { status: "审批通过", opinion: "同意备案。" },
      ],
    },
  ];
  const systems = ["数字化法治企业建设平台", "智慧法务平台", "合同管理系统"];
  const modules = ["合同管理", "合规业务", "案件管理", "规章制度", "普法宣传", "统计周报"];
  const developDepts = ["集团法律部数字化处", "国网信通公司", "北京法务科技中心"];
  const titles = [
    "子分公司合同模板在线备案",
    "合规审查意见线上流转",
    "案件台账与集团库对账",
    "规章制度版本对比",
    "普法学习时长自动汇总",
    "周报指标一键抽取",
    "定制化审批流配置",
    "外聘律师评价表对接",
  ];
  const list: Demand[] = [];
  let n = 1;
  for (const owner of owners) {
    owner.statuses.forEach((item, i) => {
      const day = String((i % 27) + 1).padStart(2, "0");
      list.push({
        id: `seed-${n}`,
        recordNo: `BA-2026-${String(n).padStart(4, "0")}`,
        title: titles[(n - 1) % titles.length],
        business: BUSINESS_OPTIONS[i % BUSINESS_OPTIONS.length],
        systemName: systems[i % systems.length],
        moduleName: modules[i % modules.length],
        demandType: TYPE_OPTIONS[i % TYPE_OPTIONS.length],
        digitalMode: i % 3 === 0 ? "智能化" : "数字化",
        proposeDept: owner.dept,
        proposeContact: owner.name,
        proposePhone: owner.phone,
        developDept: developDepts[i % developDepts.length],
        developContact: "周工",
        developPhone: "010-66521880",
        proposeDate: `2026-03-${day}`,
        detail: `子分公司提出的定制化需求，需备案至集团法律部。事项涉及${modules[i % modules.length]}，要求按统一口径留痕并可追溯。`,
        expectOnlineDate: `2026-06-${day}`,
        planOnlineDate: `2026-07-${day}`,
        actualOnlineDate: item.status === "审批通过" ? `2026-07-${day}` : "",
        progress: PROGRESS_OPTIONS[i % PROGRESS_OPTIONS.length],
        progressDesc: i % 2 === 0 ? "已完成需求确认，等待排期。" : "",
        remark: "",
        approvalStatus: item.status,
        approvalOpinion: item.opinion,
        createdBy: owner.id,
        createdAt: `2026-03-${day}T09:00:00.000Z`,
      });
      n += 1;
    });
  }
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function loadRecords(): Demand[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const data = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  try {
    const parsed = JSON.parse(raw) as Demand[];
    return Array.isArray(parsed) ? parsed : seed();
  } catch {
    return seed();
  }
}

export function saveRecords(records: Demand[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function loadSession(): SessionUser | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    return USERS.find((user) => user.id === parsed.id) ?? null;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser | null) {
  if (!user) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
