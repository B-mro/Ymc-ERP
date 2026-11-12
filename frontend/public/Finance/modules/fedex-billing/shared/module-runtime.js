/**
 * module-runtime.js — 模块运行时 & 宿主通信层
 * =============================================
 * 职责：
 *   1. 管理 Vue 应用生命周期（createApp 包装 setup 以捕获 UI 状态）
 *   2. 实现宿主框架与嵌入模块之间的 postMessage 双向通信协议
 *      协议名称：shipgrid-finance-v1
 *      支持的消息类型：get-status / status / ready
 *   3. 跨域安全校验 — 只允许同源或 allowedParentOrigins 白名单内的父页面
 *   4. 嵌入模式样式检测 — URL 参数 embed=1 时添加 sg-embedded CSS 类
 *
 * 导出接口（挂载到 globalThis.ShipGridModule）：
 *   - getStatus()       → 返回模块当前状态快照
 *   - createApp(options) → 包装 Vue.createApp，自动捕获 UI reactive 对象
 *
 * 被谁依赖：index.html 入口脚本、各承运商 billing 模块的 UI 组件
 */
(function (root) {
	("use strict");
	const cfg = root.ShipGridModuleConfig,
		state = { ui: null, app: null };

	// 从 Vue ref 或 reactive 对象中提取原始值，兼容非 Vue 环境
	function unref(v) {
		return root.Vue?.unref(v);
	}

	/**
	 * status — 生成模块当前状态快照
	 * 被 get-status 协议和 ready 事件调用
	 * @returns {{moduleId, version, ready, busy, error, summary}}
	 */
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

	/**
	 * parentOrigin — 安全校验：判断父页面是否在允许列表中
	 * 规则：同源 或 cfg.allowedParentOrigins 白名单
	 * @returns {string|null} — 合法父页面 origin，null 表示独立页面或非法来源
	 */
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

	/**
	 * send — 向合法父页面发送 postMessage
	 * @param {string} type    — 消息类型（ready / status）
	 * @param {*} payload      — 消息载荷
	 * @param {string} requestId — 请求关联ID（用于响应匹配）
	 */
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

		/**
		 * createApp — 包装 Vue.createApp
		 * 在 setup 执行后把返回的 reactive UI 对象存入 state.ui
		 * 这样 status() 就能读取 UI 层的 busy/error/result 等状态
		 */
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

	// 监听父页面发来的 get-status 请求，通过 send('status', ...) 响应
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

	// 嵌入模式：URL 带 ?embed=1 时切换为紧凑样式
	if (new URLSearchParams(location.search).get("embed") === "1")
		document.documentElement.classList.add("sg-embedded");

	// DOM 就绪后通知父页面模块已加载
	root.addEventListener("DOMContentLoaded", () => send("ready", status()));
})(globalThis);
