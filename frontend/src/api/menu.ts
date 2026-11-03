// 菜单接口
import { del, get, post, put } from "./request";
import type { SysMenu } from "@/types";

export function listMenus(menuName?: string) {
	return get<SysMenu[]>("/menu/list", { menuName });
}

export function treeMenus(menuName?: string) {
	return get<SysMenu[]>("/menu/tree", { menuName });
}

export function addMenu(data: SysMenu) {
	return post<void>("/menu", data);
}

export function updateMenu(data: SysMenu) {
	return put<void>("/menu", data);
}

export function deleteMenu(id: number) {
	return del<void>(`/menu/${id}`);
}
