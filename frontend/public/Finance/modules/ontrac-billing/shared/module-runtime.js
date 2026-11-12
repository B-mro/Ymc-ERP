/**
 * ontrac-billing/shared/module-runtime.js —— OnTrac 模块运行时宿主通信层
 *
 * 本模块是 ShipGrid 模块化架构中 **每个承运商模块** 的 **通用运行时基座**。
 * 它不包含任何承运商专属计费逻辑，只负责：
 *   1. 读取 window.ShipGridModuleConfig（config.js 注入的模块元信息）
 *   2. 建立与父页面的 postMessage 双向通信
 *   3. 维护模块级状态（UI ref、Vue app 实例、busy/error/summary）
 *   4. 暴露统一的 status() / mount(ui) / unmount() 接口
 *
 * 为什么每个模块都有一份独立副本？
 *   - 各模块运行在不同的 iframe / Web Component 中，无法共享同一闭包
 *   - 代码量极小（< 5KB），复制成本低于跨模块依赖
 *   - 未来允许各模块自定义扩展（如 UPS 模块需额外挂载 Worker）
 *
 * 核心接口：
 *   status() : 返回当前模块健康状态
 *     { moduleId, version, ready, busy, error, summary }
 *     父页面定时轮询此接口渲染模块卡片状态
 *   mount(uiRef) : UI 层 setup() 完成后挂载响应式引用
 *     module-runtime 从中读取 busy/error/result 状态填入 status()
 *   parentOrigin() : 安全校验——只允许同源或配置白名单内的父页面通信
 *
 * postMessage 协议：
 *   父页面 → 模块 iframe  ：{ type: 'ping' }                    健康检查
 *   模块 iframe → 父页面  ：{ type: 'status', payload: status() } 状态广播
 *
 * 对外暴露：不直接挂载到 root，由 UI 层（ui/ontrac-billing.js）import 并初始化。
 *
 * 依赖：root.ShipGridModuleConfig（config.js 注入）、root.Vue（unref）
 */
(function (root) {
	"use strict";
	const cfg = root.ShipGridModuleConfig,
		state = { ui: null, app: null };
	function unref(v) {
		return root.Vue?.unref(v);
	}
	function status() {
		const u = state.ui || {},
			r = unref(u.result),
			report = unref(u.shipmentReport);
		return {
			moduleId: cfg.moduleId,
			version: cfg.version,
			ready: !!state.ui,
			busy: !!unref(u.busy),
			error: String(unref(u.error) || ""),
			summary: report?.summary || r?.summary || null,
		};
	}
	function parentOrigin() {
		if (root.parent === root) return null;
		try {
			const o = new URL(document.referrer).origin;
			return o === location.origin ||
				(cfg.allowedParentOrigins || []).includes(o)
				? o
				: null;
		} catch {
			return null;
		}
	}
	function send(type, payload, requestId) {
		const o = parentOrigin();
		if (o)
			root.parent.postMessage(
				{
					channel: "shipgrid-finance-v1",
					moduleId: cfg.moduleId,
					type,
					payload,
					requestId,
				},
				o,
			);
	}
	root.ShipGridModule = {
		getStatus: status,
		createApp(options) {
			const original = options.setup;
			options = {
				...options,
				setup(...args) {
					state.ui = original.apply(this, args);
					return state.ui;
				},
			};
			state.app = root.Vue.createApp(options);
			return state.app;
		},
	};
	root.addEventListener("message", (event) => {
		const m = event.data,
			o = parentOrigin();
		if (
			!o ||
			event.source !== root.parent ||
			event.origin !== o ||
			!m ||
			m.channel !== "shipgrid-finance-v1" ||
			m.moduleId !== cfg.moduleId
		)
			return;
		if (m.type === "get-status") send("status", status(), m.requestId);
	});
	if (new URLSearchParams(location.search).get("embed") === "1")
		document.documentElement.classList.add("sg-embedded");
	root.addEventListener("DOMContentLoaded", () => send("ready", status()));
})(globalThis);
