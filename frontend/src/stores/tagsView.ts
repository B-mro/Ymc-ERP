import { defineStore } from 'pinia'
import { nextTick, ref } from "vue";
import type { RouteLocationNormalized } from "vue-router";

/**
 * 标签页（tagsView）状态
 * - visitedViews：标签栏展示的页面，唯一键统一使用 route.path
 * - cachedViews：需要 keep-alive 缓存的组件名，与各页面 defineOptions({ name }) 一致
 * - 标签一旦打开会一直保留，除非手动关闭；退出登录时由路由守卫调用 resetViews 全部摧毁
 */
export interface TagView {
	/** 路由完整路径，标签唯一键 */
	path: string;
	/** 标签标题，取 route.meta.title */
	title: string;
	/** keep-alive 缓存组件名，取 route.meta.cacheName */
	cacheName?: string;
	/** 固定标签（如工作台），不可关闭 */
	affix?: boolean;
}

export const useTagsViewStore = defineStore("tagsView", () => {
	const visitedViews = ref<TagView[]>([]);
	const cachedViews = ref<string[]>([]);
	/** 刷新计数器：与 route.path 组合作为 router-view 的 key，强制当前页重渲染 */
	const refreshKey = ref(0);

	/** 路由变化时调用：把当前页加入标签栏（Layout 下、有标题的业务页面才收录） */
	function addView(route: RouteLocationNormalized) {
		if (route.matched.length < 2 || !route.meta?.title) return;
		const path = route.path;
		if (visitedViews.value.some((v) => v.path === path)) return;
		const cacheName = (route.meta.cacheName as string | undefined) || undefined;
		visitedViews.value.push({
			path,
			title: route.meta.title as string,
			cacheName,
			affix: !!route.meta.affix,
		});
		if (cacheName && !cachedViews.value.includes(cacheName)) {
			cachedViews.value.push(cacheName);
		}
	}

	/** 关闭指定标签；若关闭的是当前页，返回应跳转的相邻标签路径，否则返回 null */
	function closeView(path: string): string | null {
		const index = visitedViews.value.findIndex((v) => v.path === path);
		if (index === -1 || visitedViews.value[index].affix) return null;
		const [removed] = visitedViews.value.splice(index, 1);
		if (removed.cacheName) {
			cachedViews.value = cachedViews.value.filter(
				(name) => name !== removed.cacheName,
			);
		}
		const next = visitedViews.value[index] || visitedViews.value[index - 1];
		return next ? next.path : null;
	}

	/** 关闭其他标签（固定标签保留） */
	function closeOthers(path: string) {
		visitedViews.value = visitedViews.value.filter(
			(v) => v.affix || v.path === path,
		);
		const keep = new Set(
			visitedViews.value.map((v) => v.cacheName).filter(Boolean),
		);
		cachedViews.value = cachedViews.value.filter((name) => keep.has(name));
	}

	/** 关闭全部标签（固定标签保留），返回应跳转的路径 */
	function closeAll(): string {
		visitedViews.value = visitedViews.value.filter((v) => v.affix);
		const keep = new Set(
			visitedViews.value.map((v) => v.cacheName).filter(Boolean),
		);
		cachedViews.value = cachedViews.value.filter((name) => keep.has(name));
		return visitedViews.value[0]?.path || "/dashboard";
	}

	/** 刷新指定标签：清除 keep-alive 缓存，当前页强制重渲染，其他标签下次进入时重新加载 */
	function refreshView(path: string, isCurrent: boolean) {
		const tag = visitedViews.value.find((v) => v.path === path);
		if (!tag) return;
		// 先移出 include，keep-alive 会销毁该缓存实例
		if (tag.cacheName) {
			cachedViews.value = cachedViews.value.filter((n) => n !== tag.cacheName);
		}
		// 下一帧重新加入缓存；若是当前页则自增 refreshKey 触发重渲染
		nextTick(() => {
			if (tag.cacheName && !cachedViews.value.includes(tag.cacheName)) {
				cachedViews.value.push(tag.cacheName);
			}
			if (isCurrent) {
				refreshKey.value++;
			}
		});
	}

	/** 退出登录时摧毁全部标签与缓存 */
	function resetViews() {
		visitedViews.value = [];
		cachedViews.value = [];
	}

	return {
		visitedViews,
		cachedViews,
		refreshKey,
		addView,
		closeView,
		closeOthers,
		closeAll,
		refreshView,
		resetViews,
	};
});
