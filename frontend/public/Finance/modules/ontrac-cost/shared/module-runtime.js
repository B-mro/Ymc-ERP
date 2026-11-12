// ============================================================================
// shared/module-runtime.js —— 模块运行时与宿主通信层
// ----------------------------------------------------------------------------
// 功能分两块：
//   1) createApp —— 对 Vue.createApp 的轻量包装，在 setup() 执行后把 UI 状态
//      保存到 state.ui，让宿主平台随时能 getStatus() 拉取模块当前状态。
//   2) postMessage 桥 —— 当本模块被 iframe 嵌入宿主页面时，通过
//      parent.postMessage 和宿主通信。支持两类消息：
//        a) 页面加载完后主动 send("ready", status()) 通知宿主
//        b) 宿主发 "get-status" 来查询（busy/error/summary 等），收到后
//           回发 "status"
//   3) embed=1 参数检测 —— URL 带 ?embed=1 时加 .sg-embedded 类，隐藏
//      侧边栏和模块切换条，让模块以"纯净嵌入模式"呈现。
// ============================================================================
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
