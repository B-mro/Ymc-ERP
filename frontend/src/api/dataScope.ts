import { del, get, post, put } from "./request";
import type { PageResult } from "@/types";

export interface MenuPermOption {
  perms: string
  menuName: string
  menuType: string
}

export interface SysDataScope {
  id?: number
  scopeName: string
  perms?: string
  tableName?: string
  scopeType: 'ALL' | 'SELF' | 'DEPT'
  fieldName: string
  valueSource: 'USERNAME' | 'USERID'
  status: string
  remark?: string
  createTime?: string
  updateTime?: string
}

export function getMenuPerms() {
  return get<MenuPermOption[]>("/data-scope/menu-perms");
}

export function pageDataScopes(params: {
  pageNum: number
  pageSize: number
  tableName?: string
  perms?: string
}) {
  return post<PageResult<SysDataScope>>("/data-scope/page", params);
}

export function listDataScopes(tableName?: string) {
  const body: Record<string, string> = {}
  if (tableName) body.tableName = tableName
  return post<SysDataScope[]>("/data-scope/list", body);
}

export function saveDataScope(scope: SysDataScope, roleIds: number[]) {
  return post<number>("/data-scope/save", { scope, roleIds });
}

export function updateDataScope(scope: SysDataScope, roleIds: number[]) {
  return post<void>("/data-scope/update", { scope, roleIds });
}

export function deleteDataScope(id: number) {
  return post<void>("/data-scope/delete", { id });
}

export function bindRoles(scopeId: number, roleIds: number[]) {
  return post<void>("/data-scope/bindRoles", { scopeId, roleIds });
}

export function getBoundRoles(scopeId: number) {
  return post<Set<number>>("/data-scope/boundRoles", { scopeId });
}