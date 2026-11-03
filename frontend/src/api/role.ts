// 角色接口
import { del, get, post, put } from "./request";
import type { PageResult, SysRole } from "@/types";

export function listRoles() {
	return get<SysRole[]>("/role/list");
}

export function pageRoles(params: {
	pageNum: number;
	pageSize: number;
	roleName?: string;
}) {
	return get<PageResult<SysRole>>("/role/page", params);
}

export function getRole(id: number) {
	return get<SysRole>(`/role/${id}`);
}

export function addRole(data: SysRole) {
	return post<void>("/role", data);
}

export function updateRole(data: SysRole) {
	return put<void>("/role", data);
}

export function deleteRoles(ids: number[]) {
	return del<void>(`/role/${ids.join(",")}`);
}

export function assignRoleMenus(roleId: number, menuIds: number[]) {
	return put<void>("/role/assign-menus", { id: roleId, menuIds });
}

export function assignRolePermissions(roleId: number, permissionIds: number[]) {
	return put<void>("/role/assign-permissions", { id: roleId, permissionIds });
}
