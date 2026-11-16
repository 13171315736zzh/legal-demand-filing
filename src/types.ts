export type Role = "reporter" | "viewer";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  dept: string;
}

export interface Demand {
  id: string;
  recordNo: string;
  title: string;
  systemName: string;
  moduleName: string;
  demandType: string;
  maintainMode: string;
  digitalMode: string;
  proposeDept: string;
  proposeContact: string;
  proposePhone: string;
  developDept: string;
  developContact: string;
  developPhone: string;
  proposeDate: string;
  detail: string;
  expectOnlineDate: string;
  planOnlineDate: string;
  actualOnlineDate: string;
  progress: string;
  progressDesc: string;
  remark: string;
  createdBy: string;
  createdAt: string;
}

export type DemandForm = Omit<Demand, "id" | "createdBy" | "createdAt">;

export interface QueryState {
  keyword: string;
  proposeDept: string;
  developDept: string;
  maintainMode: string;
  progress: string[];
}
