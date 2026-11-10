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
