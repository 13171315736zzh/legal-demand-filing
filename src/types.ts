export type Role = "reporter" | "director" | "group";

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
  business: string;
  systemName: string;
  moduleName: string;
  demandType: string;
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
  approvalStatus: string;
  approvalOpinion: string;
  createdBy: string;
  createdAt: string;
}

export type DemandForm = Omit<Demand, "id" | "createdBy" | "createdAt">;

export interface QueryState {
  keyword: string;
  proposeDept: string;
  developDept: string;
  demandType: string;
  approvalStatus: string;
  progress: string[];
  proposeDateStart: string;
  proposeDateEnd: string;
}
