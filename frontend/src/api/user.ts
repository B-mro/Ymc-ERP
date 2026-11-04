// 用户接口
import { del, get, post, put } from "./request";
import type { PageResult, SysUser } from "@/types";

export function pageUsers(params: {
	pageNum: number;
	pageSize: number;
	username?: string;
}) {
	return get<PageResult<SysUser>>("/user/page", params);
}

export function getUser(id: number) {
	return get<SysUser>(`/user/${id}`);
}

export function batchGetUsers(ids: number[]) {
	return get<SysUser[]>("/user/batch", { ids });
}

export function addUser(data: SysUser) {
	return post<void>("/user", data);
}

export function updateUser(data: SysUser) {
	return put<void>("/user", data);
}

export function deleteUsers(ids: number[]) {
	return del<void>(`/user/${ids.join(",")}`);
}

export function assignRoles(userId: number, roleIds: number[]) {
	return put<void>("/user/assign-roles", { id: userId, roleIds });
}
export interface ExcelFileInfo {
	fileName: string;
	fileSize: number;
	absolutePath: string;
	fileUrl: string;
	lastModified: string;
	fileType: string;
}

// export function getFileschange() {
// 	return get<ExcelFileInfo[]>("/excel/files");
// }
export function getFileschange() {
	return get<ExcelFileInfo[]>("/fedex/surcharge/sync");
}