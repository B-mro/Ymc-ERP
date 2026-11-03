// 权限接口
import { del, get, post, put } from "./request";
import type { PageResult, SysPermission } from "@/types";

export function pagePermissions(params: {
	pageNum: number;
	pageSize: number;
	permissionName?: string;
	permissionCode?: string;
}) {
	return get<PageResult<SysPermission>>("/permission/page", params);
}

export function listPermissions() {
	return get<SysPermission[]>("/permission/list");
}

export function addPermission(data: SysPermission) {
	return post<void>("/permission", data);
}

export function updatePermission(data: SysPermission) {
	return put<void>("/permission", data);
}

export function deletePermissions(ids: number[]) {
	return del<void>(`/permission/${ids.join(",")}`);
}
