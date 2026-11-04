import {
	createRouter,
	createWebHistory,
	type RouteRecordRaw,
} from "vue-router";
import Layout from "@/layout/index.vue";
import { useUserStore } from "@/stores/user";
import { useTagsViewStore } from "@/stores/tagsView";
import type { SysMenu } from "@/types";

/** 静态路由 */
export const constantRoutes: RouteRecordRaw[] = [
	{
		path: "/login",
		name: "Login",
		component: () => import("@/views/login/index.vue"),
		meta: { title: "登录" },
	},
	{
		path: "/register",
		name: "Register",
		component: () => import("@/views/register/index.vue"),
		meta: { title: "注册" },
	},
	{
		path: "/",
		component: Layout,
		redirect: "/dashboard",
		children: [
			{
				path: "dashboard",
				name: "Dashboard",
				component: () => import("@/views/dashboard/index.vue"),
				meta: {
					title: "工作台",
					icon: "HomeFilled",
					cacheName: "DashboardView",
					affix: true,
				},
			},
			{
				path: "system/scheduledTask",
				name: "ScheduledTask",
				component: () => import("@/views/system/scheduledTask/index.vue"),
				meta: {
					title: "定时任务",
					icon: "Clock",
					cacheName: "SystemScheduledTaskView",
				},
			},
		],
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes: constantRoutes,
});

// src/views 下全部页面组件，按后端 component 字段动态匹配
const viewModules = import.meta.glob("../views/**/*.vue");

function loadView(component?: string) {
	if (component) {
		const target = viewModules[`../views/${component}.vue`];
		if (target) {
			return target;
		}
	}
	return viewModules["../views/error/404.vue"];
}

/**
 * 后端 component 路径 → keep-alive 组件缓存名，
 * 必须与各页面 defineOptions({ name }) 保持一致，如 system/user/index → SystemUserView
 */
function toCacheName(component?: string) {
	if (!component) return undefined;
	const parts = component
		.split("/")
		.filter(Boolean)
		.filter((p) => p !== "index");
	if (!parts.length) return undefined;
	return `${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")}View`;
}

/** 过滤不可见的菜单（按钮 F 不生成路由） */
function filterMenus(menus: SysMenu[]): SysMenu[] {
	return (menus || []).filter((m) => m.menuType && m.menuType !== "F");
}

/** 拼接两级 path（兼容空 path 与绝对 path） */
function joinPath(base: string, path: string): string {
	if (!base) return path || "";
	if (path.startsWith("/")) return path;
	if (!path) return base;
	return `${base.endsWith("/") ? base : `${base}/`}${path}`;
}

/** 查找第一个可导航叶子菜单的完整路径，用于目录 redirect */
function findFirstLeafPath(menus: SysMenu[], base = ""): string | undefined {
	const visible = filterMenus(menus);
	for (const menu of visible) {
		const current = joinPath(base, menu.path || "");
		const children = filterMenus(menu.children || []);
		if (menu.menuType === "C" || children.length === 0) {
			return current;
		}
		const deeper = findFirstLeafPath(children, current);
		if (deeper) return deeper;
	}
	return undefined;
}

/** 组装菜单页（C）子路由 */
function buildMenuRoute(menu: SysMenu): RouteRecordRaw {
	return {
		path: menu.path || "",
		name: `Menu${menu.id}`,
		meta: {
			title: menu.menuName,
			icon: menu.icon,
			perms: menu.perms,
		},
		children: [
			{
				path: "",
				name: `Menu${menu.id}Index`,
				component: loadView(menu.component),
				meta: {
					title: menu.menuName,
					icon: menu.icon,
					perms: menu.perms,
					cacheName: toCacheName(menu.component),
				},
			},
		],
	};
}

/**
 * 生成顶层子级（目录 M 或菜单 C）路由。
 * 目录：无 component 的分组传递，深层页面仍由顶层 Layout 渲染；菜单：叶子页面。
 */
function buildChildrenRoutes(menus: SysMenu[]): RouteRecordRaw[] {
	return filterMenus(menus).map((menu) => {
		const children = filterMenus(menu.children || []);
		// 目录，或自身挂了子级则按目录分组处理（支持两级菜单）
		if (menu.menuType === "M" || children.length > 0) {
			return {
				path: menu.path || "",
				name: `Dir${menu.id}`,
				redirect: findFirstLeafPath(children),
				meta: { title: menu.menuName, icon: menu.icon, perms: menu.perms },
				children: buildChildrenRoutes(children),
			} as RouteRecordRaw;
		}
		// 叶子菜单页
		return buildMenuRoute(menu);
	});
}

/**
 * 将后端菜单树转换为动态路由，支持两级菜单：
 * 顶级：目录 M 或菜单 C 均挂 Layout 作为页面框架；
 * 子级：目录 M 作为无 component 的分组，菜单 C 映射到具体页面组件。
 */
export function generateRoutes(menuTree: SysMenu[]): RouteRecordRaw[] {
	return filterMenus(menuTree).map((menu) => {
		const children = filterMenus(menu.children || []);
		const leafPath = findFirstLeafPath(children);
		// 顶级目录：布局 + 子级路由
		if (menu.menuType === "M") {
			return {
				path: menu.path || "",
				name: `Dir${menu.id}`,
				component: Layout,
				redirect: leafPath,
				meta: { title: menu.menuName, icon: menu.icon },
				children: buildChildrenRoutes(children),
			};
		}
		// 顶级菜单：包一层 Layout
		return {
			path: menu.path || "",
			name: `Menu${menu.id}`,
			component: Layout,
			children: [
				{
					path: "",
					name: `Menu${menu.id}Index`,
					component: loadView(menu.component),
					meta: {
						title: menu.menuName,
						icon: menu.icon,
						perms: menu.perms,
						cacheName: toCacheName(menu.component),
					},
				},
			],
		};
	});
}

const WHITE_LIST = ["/login", "/register"];

router.beforeEach(async (to) => {
	const userStore = useUserStore();
	const tagsViewStore = useTagsViewStore();

	if (to.meta.title) {
		document.title = `${to.meta.title as string} - 管理系统`;
	}

	// 保存当前路由的 perms 到 sessionStorage，供 axios 请求拦截器使用
	const perms = to.meta?.perms as string | undefined;
	if (perms) {
		sessionStorage.setItem("__current_perms__", perms);
	} else {
		sessionStorage.removeItem("__current_perms__");
	}

	if (userStore.token) {
		if (to.path === "/login") {
			return "/";
		}
		if (!userStore.loaded) {
			try {
				await userStore.getInfo();
				const accessRoutes = generateRoutes(userStore.menus);
				accessRoutes.forEach((route) => router.addRoute(route));

				router.addRoute({
					path: "/functionalDesign/Interface",
					component: Layout,
					children: [
						{
							path: "interfaceForm",
							name: "DataInterfaceForm",
							component: () =>
								import("@/views/functionalDesign/Interface/interfaceForm.vue"),
							meta: { title: "接口表单", hidden: true },
						},
						{
							path: "interfaceTest",
							name: "DataInterfaceTest",
							component: () =>
								import("@/views/functionalDesign/Interface/interfaceTest.vue"),
							meta: { title: "接口测试", hidden: true },
						},
					],
				});

				router.addRoute({
					path: "/:pathMatch(.*)*",
					name: "NotFound",
					component: () => import("@/views/error/404.vue"),
					meta: { title: "404" },
				});
				return { ...to, replace: true };
			} catch (e: any) {
				console.error("[路由守卫] getInfo 失败:", e?.message || e);
				userStore.loaded = true;
				router.addRoute({
					path: "/functionalDesign/Interface",
					component: Layout,
					children: [
						{
							path: "interfaceForm",
							name: "DataInterfaceForm",
							component: () =>
								import("@/views/functionalDesign/Interface/interfaceForm.vue"),
							meta: { title: "接口表单", hidden: true },
						},
						{
							path: "interfaceTest",
							name: "DataInterfaceTest",
							component: () =>
								import("@/views/functionalDesign/Interface/interfaceTest.vue"),
							meta: { title: "接口测试", hidden: true },
						},
					],
				});
				router.addRoute({
					path: "/:pathMatch(.*)*",
					name: "NotFound",
					component: () => import("@/views/error/404.vue"),
					meta: { title: "404" },
				});
				return { ...to, replace: true };
			}
		}
		return true;
	}

	// 未登录（含主动退出、401 失效跳转）：摧毁全部标签页与缓存
	tagsViewStore.resetViews();

	if (WHITE_LIST.includes(to.path)) {
		return true;
	}
	return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
});

export default router;