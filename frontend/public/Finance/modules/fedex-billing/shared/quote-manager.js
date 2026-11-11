/*SG-AUDIT:finance-13.js*/ (function (root) {
	"use strict";
	// const names = [
	// 	"OnTrac2026D.xlsx",
	// 	"ONTRAC_RATE_D.xlsx",
	// 	"Fedex_2026C_CD.xlsx",
	// 	"FEDEX_2026A.xlsx",
	// 	"ONTRAC_RATE_C.xlsx",
	// 	"FEDEX_2026B_SD.xlsx",
	// 	"ONTRAC_RATE_A.xlsx",
	// 	"Fedex_2026D.xlsx",
	// 	"OnTrac_2026B.xlsx",
	// 	"ONTRAC_RATE_B.xlsx",
	// 	"FEDEX_2026B.xlsx",
	// 	"Fedex_2026C.xlsx",
	// ];
	// // IDs match server.seed_quotes; injected by build.py.
	// const fixed = [
	// 	{
	// 		id: "fixed-3e14c9816c896e2a",
	// 		carrier: "ontrac",
	// 		name: "OnTrac2026D",
	// 		fileName: "OnTrac2026D.xlsx",
	// 		url: new URL(
	// 			"excel_files/OnTrac2026D.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-68fb59a449dacc81",
	// 		carrier: "ontrac",
	// 		name: "ONTRAC_RATE_D",
	// 		fileName: "ONTRAC_RATE_D.xlsx",
	// 		url: new URL(
	// 			"excel_files/ONTRAC_RATE_D.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-27475eda4f0dae4f",
	// 		carrier: "fedex",
	// 		name: "Fedex_2026C_CD",
	// 		fileName: "Fedex_2026C_CD.xlsx",
	// 		url: new URL(
	// 			"excel_files/Fedex_2026C_CD.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-079cee94a89abffa",
	// 		carrier: "fedex",
	// 		name: "FEDEX_2026A",
	// 		fileName: "FEDEX_2026A.xlsx",
	// 		url: new URL(
	// 			"excel_files/FEDEX_2026A.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-c4607343818c9b27",
	// 		carrier: "ontrac",
	// 		name: "ONTRAC_RATE_C",
	// 		fileName: "ONTRAC_RATE_C.xlsx",
	// 		url: new URL(
	// 			"excel_files/ONTRAC_RATE_C.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-85927d2ee98aa7ee",
	// 		carrier: "fedex",
	// 		name: "FEDEX_2026B_SD",
	// 		fileName: "FEDEX_2026B_SD.xlsx",
	// 		url: new URL(
	// 			"excel_files/FEDEX_2026B_SD.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-4cef146912dcb82e",
	// 		carrier: "ontrac",
	// 		name: "ONTRAC_RATE_A",
	// 		fileName: "ONTRAC_RATE_A.xlsx",
	// 		url: new URL(
	// 			"excel_files/ONTRAC_RATE_A.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-0b8367f3a312a67f",
	// 		carrier: "fedex",
	// 		name: "Fedex_2026D",
	// 		fileName: "Fedex_2026D.xlsx",
	// 		url: new URL(
	// 			"excel_files/Fedex_2026D.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-63998541a44346aa",
	// 		carrier: "ontrac",
	// 		name: "OnTrac_2026B",
	// 		fileName: "OnTrac_2026B.xlsx",
	// 		url: new URL(
	// 			"excel_files/OnTrac_2026B.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-5afa7317ba03c48d",
	// 		carrier: "ontrac",
	// 		name: "ONTRAC_RATE_B",
	// 		fileName: "ONTRAC_RATE_B.xlsx",
	// 		url: new URL(
	// 			"excel_files/ONTRAC_RATE_B.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-a96f50d9bf6378bf",
	// 		carrier: "fedex",
	// 		name: "FEDEX_2026B",
	// 		fileName: "FEDEX_2026B.xlsx",
	// 		url: new URL(
	// 			"excel_files/FEDEX_2026B.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// 	{
	// 		id: "fixed-98351b308d9ba6e3",
	// 		carrier: "fedex",
	// 		name: "Fedex_2026C",
	// 		fileName: "Fedex_2026C.xlsx",
	// 		url: new URL(
	// 			"excel_files/Fedex_2026C.xlsx",
	// 			(root.ShipGridModuleConfig.serverBase || location.origin) + "/",
	// 		).href,
	// 		source: "fixed-link",
	// 	},
	// ];
	const names = [];
	const fixed = [];
	const settingsKey = "ShipGridSharedSettingsV1";
	let saved = {};
	try {
		saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
	} catch {}
	const state = Vue.reactive({
		// mode: saved.mode || (saved.enabled ? "shared" : "local"),
		mode: "files",
		enabled: !!saved.enabled,
		fileApi: saved.fileApi || "http://121.43.236.24/api/excel/files",
		base:
			saved.base ||
			(location.protocol === "http:" || location.protocol === "https:"
				? location.origin
				: "http://121.43.236.24"),
		// token: localStorage.getItem("rbac_token") || "",
		token:
			"eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJJZCI6MSwiaWF0IjoxNzk0Mzc1NzE0LCJleHAiOjE3OTQzODI5MTR9.H96SODM0dSS5zTI6V9LiSOJQ0rUbyJxlnpq16j25a1H2PH9XSMSUoxjeVm5aMOJ5YbaQJZf2xQ6pv7hKlb3crQ",
		revision: null,
		connected: false,
		busy: false,
		message: "",
		error: "",
		statuses: {},
		listLoaded: false,
	});
	const applied = {
		mode: state.mode,
		enabled: state.mode === "shared",
		fileApi: state.fileApi,
		base: state.base,
		token: state.token,
	};
	let snapshot = null;
	const to64 = (data) => {
		let s = "";
		const b = new Uint8Array(data);
		for (let i = 0; i < b.length; i += 32768)
			s += String.fromCharCode(...b.subarray(i, i + 32768));
		return btoa(s);
	};
	const wire = (q) => {
		if (q.source === "fixed-link" && q.url) {
			const { data, hasData, ...meta } = q;
			return meta;
		}
		return q.data instanceof ArrayBuffer || ArrayBuffer.isView(q.data)
			? { ...q, data: to64(q.data) }
			: { ...q };
	};
	function url(path) {
		return applied.base.replace(/\/$/, "") + "/api/shared" + path;
	}
	async function request(path, options = {}) {
		if (location.protocol === "https:" && applied.base.startsWith("http:"))
			throw Error("当前为HTTPS页面，请使用HTTPS共享接口，或从公司同源页面打开");
		const ctrl = new AbortController(),
			timer = setTimeout(() => ctrl.abort(), 45000);
		try {
			const response = await fetch(url(path), {
				...options,
				headers: {
					Authorization: "Bearer " + applied.token,
					...(options.body ? { "Content-Type": "application/json" } : {}),
					...(options.method && options.method !== "GET"
						? { "If-Match": String(state.revision) }
						: {}),
					...options.headers,
				},
				cache: "no-store",
				signal: ctrl.signal,
			});
			if (!response.ok) {
				let data = {};
				try {
					data = await response.json();
				} catch {}
				throw Error(data.error || "接口返回HTTP " + response.status);
			}
			return options.binary
				? await response.arrayBuffer()
				: await response.json();
		} catch (e) {
			if (e.name === "AbortError")
				throw Error("共享接口响应超时，未自动改用本地数据");
			if (e instanceof TypeError)
				throw Error("无法连接共享接口，请检查服务地址、网络和跨域配置");
			throw e;
		} finally {
			clearTimeout(timer);
		}
	}
	function accept(d) {
		snapshot = d;
		state.revision = d.revision;
		state.connected = true;
		state.error = "";
		return d;
	}
	async function refresh() {
		return accept(await request("/catalog"));
	}
	async function loadFileList() {
		if (applied.mode !== "files") return;
		const api = new URL(applied.fileApi);
		if (!["http:", "https:"].includes(api.protocol))
			throw Error("文件列表接口必须为HTTP/HTTPS");
		if (location.protocol === "https:" && api.protocol === "http:")
			throw Error("HTTPS页面不能读取HTTP文件接口，请使用同源页面或HTTPS接口");
		const ctrl = new AbortController(),
			timer = setTimeout(() => ctrl.abort(), 30000);
		try {
			const r = await fetch(api.href, {
				headers: {
					Authorization: "Bearer " + applied.token,
					Accept: "application/json",
				},
				cache: "no-store",
				signal: ctrl.signal,
			});
			if (!r.ok) throw Error("文件列表接口返回HTTP " + r.status);
			const result = await r.json();
			let list;
			if (Array.isArray(result)) list = result;
			else if (result && result.code === 200 && Array.isArray(result.data))
				list = result.data;
			else
				throw Error(
					result?.msg ||
						"文件接口返回结构不正确，应为{code:200,data:[文件]}或直接数组",
				);
			const seen = new Set(),
				next = [];
			for (const item of list) {
				let raw;
				if (typeof item === "string") raw = item;
				else if (item && typeof item.fileUrl === "string") raw = item.fileUrl;
				else throw Error("文件列表含非URL条目");
				raw = String(raw)
					.replace(/^`+|`+$/g, "")
					.trim();
				if (!raw) throw Error("文件列表含空URL条目");
				const u = new URL(raw, api.origin);
				if (
					u.origin !== api.origin ||
					!u.pathname.includes("/excel_files/") ||
					!u.pathname.toLowerCase().endsWith(".xlsx")
				)
					throw Error("返回文件地址不属于本服务器Excel目录");
				if (seen.has(u.href)) continue;
				seen.add(u.href);
				const filename = decodeURIComponent(u.pathname.split("/").pop()),
					carrier = /ontrac/i.test(filename)
						? "ontrac"
						: /fedex/i.test(filename)
							? "fedex"
							: /ups/i.test(filename)
								? "ups"
								: null;
				if (!carrier) continue;
				const existing = fixed.find((q) => q.url === u.pathname);
				let hash = 2166136261;
				for (const c of u.href)
					hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
				next.push({
					id: existing?.id || "api-file-" + hash.toString(16),
					carrier,
					name: filename.replace(/\.xlsx$/i, ""),
					fileName: filename,
					url: u.pathname,
					source: "fixed-link",
				});
			}
			fixed.splice(0, fixed.length, ...next);
			state.connected = true;
			state.listLoaded = true;
			state.error = "";
			return next;
		} catch (e) {
			state.connected = false;
			state.listLoaded = false;
			throw Error(
				e instanceof TypeError
					? "文件接口连接失败，请检查登录令牌、网络及跨域配置"
					: e.name === "AbortError"
						? "文件列表接口超时"
						: e.message,
			);
		} finally {
			clearTimeout(timer);
		}
	}
	async function remoteRead(name, key) {
		if (!snapshot) await refresh();
		const list = snapshot[name] || [];
		if (key === undefined) return list.map((x) => ({ ...x }));
		const item = list.find((x) => x.id === key);
		if (!item) return undefined;
		if (name !== "quotes") return { ...item };
		try {
			const data = await request(
				"/quotes/" + encodeURIComponent(key) + "/file",
				{ binary: true },
			);
			state.statuses[key] = "已读取";
			return { ...item, data };
		} catch (e) {
			state.statuses[key] = "读取失败：" + e.message;
			throw Error(item.fileName + "：" + e.message);
		}
	}
	async function remoteWrite(name, value, remove = false) {
		if (state.revision === null) await refresh();
		let result;
		if (name === "quotes") {
			const exists = snapshot.quotes.some(
				(q) => q.id === (remove ? value : value.id),
			);
			const path =
				"/quotes" +
				(exists || remove
					? "/" + encodeURIComponent(remove ? value : value.id)
					: "");
			result = await request(path, {
				method: remove ? "DELETE" : exists ? "PUT" : "POST",
				...(remove ? {} : { body: JSON.stringify(wire(value)) }),
			});
		} else {
			const rows = snapshot[name].filter(
				(x) => x.id !== (remove ? value : value.id),
			);
			if (!remove) rows.push(value);
			result = await request("/datasets", {
				method: "PUT",
				body: JSON.stringify({ [name]: rows }),
			});
		}
		accept(result);
	}
	async function remoteReplace(values) {
		if (state.revision === null) await refresh();
		const data = { ...values };
		if (data.quotes) data.quotes = data.quotes.map(wire);
		accept(
			await request("/datasets", { method: "PUT", body: JSON.stringify(data) }),
		);
	}
	async function fixedRead(q) {
		const ctrl = new AbortController(),
			timer = setTimeout(() => ctrl.abort(), 30000);
		try {
			const r = await fetch(q.url, {
				cache: "no-store",
				signal: ctrl.signal,
				credentials: "include",
				headers: {
					Authorization: "Bearer " + applied.token,
				},
			});
			if (!r.ok) throw Error("HTTP " + r.status);
			const data = await r.arrayBuffer();
			if (data.byteLength > 20 * 1024 * 1024) throw Error("文件超过20MB");
			state.statuses[q.id] = "已读取";
			return { ...q, data };
		} catch (e) {
			const message =
				"固定文件读取失败。请连接共享服务器，或由服务器为文件目录配置跨域访问。";
			state.statuses[q.id] = message;
			throw Error(q.fileName + "：" + message);
		} finally {
			clearTimeout(timer);
		}
	}
	async function guarded(fn) {
		if (state.busy) return;
		state.busy = true;
		state.error = "";
		state.message = "";
		try {
			await fn();
		} catch (e) {
			state.error = e.message;
		} finally {
			state.busy = false;
		}
	}
	async function apply() {
		return guarded(async () => {
			if (!/^https?:\/\//i.test(state.base))
				throw Error("服务器地址必须以http://或https://开头");
			const old = { ...applied };
			Object.assign(applied, {
				mode: "files",
				enabled: false,
				fileApi: state.fileApi,
				base: state.base.replace(/\/$/, ""),
				token: state.token,
			});
			state.mode = "files";
			snapshot = null;
			state.connected = false;
			try {
				await loadFileList();
			} catch (e) {
				Object.assign(applied, old);
				snapshot = null;
				state.mode = old.mode;
				state.enabled = old.enabled;
				throw e;
			}
			state.enabled = false;
			localStorage.setItem(
				settingsKey,
				JSON.stringify({
					mode: "files",
					fileApi: applied.fileApi,
					enabled: false,
					base: applied.base,
				}),
			);
			sessionStorage.setItem("ShipGridSharedToken", applied.token);
			await root.ShipGridQuoteManager.refresh();
			state.message =
				"已接入现有文件接口。价表从服务器读取；客户与匹配仍保存在本机。";
		});
	}
	async function reload() {
		return guarded(async () => {
			await root.ShipGridQuoteManager.refresh();
			state.message = "列表已刷新；生成账单时也会重新读取共享配置及价表。";
		});
	}
	async function downloadOriginal(q) {
		return guarded(async () => {
			const full = await root.ShipGridQuoteManager.readQuote(q.id);
			if (!full?.data) throw Error("没有可下载的文件");
			const link = document.createElement("a"),
				u = URL.createObjectURL(new Blob([full.data]));
			link.href = u;
			link.download = q.fileName || q.name + ".xlsx";
			link.click();
			setTimeout(() => URL.revokeObjectURL(u), 1000);
		});
	}
	async function migrate() {
		return guarded(async () => {
			if (!applied.enabled) throw Error("请先连接共享服务器");
			const local = await root.ShipGridQuoteManager.localSnapshot();
			await refresh();
			const next = {};
			for (const name of ["quotes", "customers", "rules"]) {
				const existing = snapshot[name];
				const ids = new Set(existing.map((x) => x.id));
				if (local[name].some((x) => ids.has(x.id)))
					throw Error(
						"本地与服务器存在相同记录ID。为避免覆盖，请先导出备份，由管理员核对。",
					);
				// Server retains existing binary data when a metadata-only record has the same ID.
				next[name] = existing;
				next[name] = next[name].concat(local[name]);
			}
			await remoteReplace(next);
			await root.ShipGridQuoteManager.refresh();
			state.message =
				"本地报价、客户及匹配关系已上传共享服务器；本地副本仍保留。";
		});
	}
	root.ShipGridShared = {
		state,
		fixed,
		isRemote: () => applied.enabled,
		isFiles: () => applied.mode === "files",
		loadFileList,
		refresh,
		read: remoteRead,
		write: remoteWrite,
		replace: remoteReplace,
		fixedRead,
		wire,
	};
	const mount = document.createElement("div");
	mount.id = "shipgrid-shared";
	document.body.appendChild(mount);
	mount.innerHTML = `<div class="shared-toggle"><button @click="opened=!opened">公司共享资料 · {{cfg.connected&&cfg.enabled?'已连接':'设置 / 固定价表'}}</button></div><div v-if="opened" class="quote-overlay"><section class="quote-window"><div class="section-heading"><h2>公司共享资料与固定价表</h2><button @click="opened=false">关闭</button></div><p>共享报价、客户ID／名称及客户匹配。账单原始文件仍在本机处理。</p><div class="select-grid"><label>资料来源<select v-model="cfg.mode"><option value="local">本地浏览器（含固定链接）</option><option value="files">现有文件接口（服务器价表）</option><option value="shared">完整共享接口（报价＋客户匹配）</option></select></label><label v-if="cfg.mode==='files'">文件列表接口<input v-model="cfg.fileApi"></label><label>共享服务器地址<input v-model="cfg.base" placeholder="http://121.43.236.24"></label><label>共享访问凭证<input type="password" autocomplete="off" v-model="cfg.token" placeholder="由管理员提供，仅本次浏览器会话保存"></label></div><div class="action-row"><button class="primary" @click="apply" :disabled="cfg.busy">连接 / 保存设置</button><button @click="reload" :disabled="cfg.busy">刷新共享列表</button><button @click="migrate" :disabled="cfg.busy||!cfg.connected">将本地资料合并上传服务器</button></div><p v-if="cfg.message" class="notice">{{cfg.message}}</p><p v-if="cfg.error" class="error">{{cfg.error}}</p><p><span v-if="cfg.mode==='files'">现有文件接口只读取报价；客户资料和匹配关系仍为本机保存。</span><span v-else>共享版本：{{cfg.revision??'尚未连接'}}。只读凭证可读取；管理凭证可上传、修改及导入。</span></p><h3>固定文件清单</h3><p>默认登记你提供的12份文件。未读取不代表已校验；生成账单时会下载并按承运商检查价表。客户匹配须在“固定报价与客户匹配管理”中配置。</p><div class="table-scroll"><table><thead><tr><th>承运商</th><th>文件</th><th>读取状态</th><th>操作</th></tr></thead><tbody><tr v-for="q in catalog" :key="q.id"><td>{{q.carrier}}</td><td>{{q.fileName}}</td><td>{{cfg.statuses[q.id]||'尚未读取'}}</td><td><button @click="downloadOriginal(q)" :disabled="cfg.busy">下载原始文件</button></td></tr></tbody></table></div><button @click="manager" :disabled="cfg.busy">打开固定报价与客户匹配管理</button></section></div>`;
	Vue.createApp({
		setup() {
			const opened = Vue.ref(false),
				catalog = Vue.computed(
					() => root.ShipGridQuoteManager?.state.quotes || fixed,
				);
			return {
				opened,
				cfg: state,
				catalog,
				apply,
				reload,
				migrate,
				downloadOriginal,
				manager: () => {
					opened.value = false;
					root.openQuoteManager("ontrac");
				},
			};
		},
	}).mount(mount);
})(globalThis);

(function (root) {
	"use strict";
	const norm = (v) =>
			String(v ?? "")
				.normalize("NFKC")
				.trim()
				.toLowerCase(),
		identity = (g) => ({
			id: String(g["客户ID"] ?? g["Customer ID"] ?? "").trim(),
			name: String(
				g["客户名称"] || g["客户名"] || g["Customer Name"] || g["客服"] || "",
			).trim(),
		});
	function match(rules, carrier, g) {
		const c = identity(g),
			scope = rules.filter((r) => r.carrier === carrier),
			ids = c.id
				? scope.filter((r) => r.customerId && norm(r.customerId) === norm(c.id))
				: [],
			names = c.name
				? scope.filter(
						(r) => r.customerName && norm(r.customerName) === norm(c.name),
					)
				: [];
		if (ids.length > 1 || names.length > 1)
			throw Error("客户报价匹配规则重复：" + c.id + " / " + c.name);
		if (ids.length && names.length && ids[0].quoteId !== names[0].quoteId)
			throw Error("客户ID与名称匹配到不同报价，请修正规则");
		const r = ids[0] || names[0];
		if (!r) throw Error("未配置客户报价：" + c.id + " / " + c.name);
		return r;
	}
	const seeds = [];
	const CustomerData = root.ShipGridCustomerData;
	const state = Vue.reactive({
		quotes: [],
		rules: [],
		customers: [],
		loaded: false,
		error: "",
	});
	let dbPromise;
	function db() {
		if (!dbPromise) {
			const attempt = new Promise((resolve, reject) => {
				if (!root.indexedDB)
					return reject(
						Error(
							"浏览器未开放本地数据库，请使用Chrome普通窗口；特殊报价仍可单次上传",
						),
					);
				let settled = false;
				const request = indexedDB.open("ShipGridCustomerQuotes", 2);
				const fail = (message) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					reject(Error(message));
				};
				const timer = setTimeout(
					() =>
						fail(
							"本地数据库响应超时，请关闭其他版本的账单页面，再重新上传；不要清除浏览器数据",
						),
					15000,
				);
				request.onblocked = () =>
					fail(
						"旧版账单页面正在占用本地数据库。请关闭其他版本的账单页面，再重新上传；已保存的报价不会被删除",
					);
				request.onupgradeneeded = () => {
					if (settled) {
						request.transaction.abort();
						return;
					}
					for (const name of ["quotes", "rules", "customers"])
						if (!request.result.objectStoreNames.contains(name))
							request.result.createObjectStore(name, { keyPath: "id" });
				};
				request.onsuccess = () => {
					if (settled) {
						request.result.close();
						return;
					}
					settled = true;
					clearTimeout(timer);
					const d = request.result;
					d.onversionchange = () => {
						d.close();
						dbPromise = undefined;
						state.loaded = false;
						state.error = "数据库已由其他页面更新，请重新打开当前页面";
					};
					state.error = "";
					resolve(d);
				};
				request.onerror = () =>
					fail(
						"固定报价保存失败：" +
							(request.error?.message || "本地数据库无法打开"),
					);
			});
			dbPromise = attempt;
			attempt.catch(() => {
				if (dbPromise === attempt) dbPromise = undefined;
			});
		}
		return dbPromise;
	}
	async function localRead(name, key) {
		const d = await db();
		return new Promise((resolve, reject) => {
			const req = d
				.transaction(name)
				.objectStore(name)
				[key === undefined ? "getAll" : "get"](key);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
	async function read(name, key) {
		if (name === "quotes") {
			if (key !== undefined) {
				const q = root.ShipGridShared.fixed.find((q) => q.id === key);
				return q ? root.ShipGridShared.fixedRead(q) : undefined;
			}
			return root.ShipGridShared.fixed.map((q) => ({ ...q }));
		}
		return localRead(name, key);
	}
	async function write(name, value, remove = false) {
		if (name === "quotes")
			throw Error("当前模式下报价来自服务器文件接口，无法在本地上传或修改");
		const d = await db();
		await new Promise((resolve, reject) => {
			const tx = d.transaction(name, "readwrite");
			tx.objectStore(name)[remove ? "delete" : "put"](value);
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error || Error("保存中断"));
		});
		await refresh();
	}
	async function refresh() {
		if (root.ShipGridShared.isRemote()) await root.ShipGridShared.refresh();
		if (root.ShipGridShared.isFiles()) await root.ShipGridShared.loadFileList();
		const [quotes, rules, customers] = await Promise.all([
			read("quotes"),
			read("rules"),
			read("customers"),
		]);
		state.customers = customers;
		state.quotes = quotes.map(({ data, ...q }) => ({
			...q,
			hasData: !!(data || q.url || q.hasData),
		}));
		state.rules = rules;
		state.loaded = true;
		root.dispatchEvent(new Event("customer-quotes-updated"));
	}
	async function init() {
		try {
			await refresh();
			const existing = await read("customers");
			if (!existing.length) {
				const migrated = CustomerData.legacy(
					await read("rules"),
					() => root.crypto?.randomUUID?.() || Date.now() + "-" + Math.random(),
				);
				if (migrated.length) await replaceSets({ customers: migrated });
			}
		} catch (e) {
			state.error = e.message;
		}
	}
	async function replaceSets(values) {
		if (values.quotes)
			throw Error("当前模式下报价来自服务器文件接口，无法在本地替换");
		const d = await db();
		await new Promise((resolve, reject) => {
			const tx = d.transaction(Object.keys(values), "readwrite");
			for (const [name, rows] of Object.entries(values)) {
				const s = tx.objectStore(name);
				s.clear();
				for (const r of rows) s.put({ ...r });
			}
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error || Error("保存中断"));
		});
		await refresh();
	}
	function validateQuote(wb, carrier) {
		const fn = root.ShipGridQuoteValidators[carrier];
		if (!fn) throw Error("未知承运商");
		fn(wb);
	}
	function validateRule(rule, others) {
		if (rule.carrier === "fedex") root.ShipGridFedExCustomerPolicy.policy(rule);
		if (!rule.customerId && !rule.customerName)
			throw Error("客户ID或客户名称至少填写一项");
		if (!rule.quoteId) throw Error("请选择已上传报价");
		for (const r of others)
			if (
				r.id !== rule.id &&
				r.carrier === rule.carrier &&
				((rule.customerId &&
					r.customerId &&
					norm(rule.customerId) === norm(r.customerId)) ||
					(rule.customerName &&
						r.customerName &&
						norm(rule.customerName) === norm(r.customerName)))
			)
				throw Error("该承运商已有同客户ID或名称规则，请编辑已有规则");
	}
	function use(carrier, clear) {
		const mode = Vue.ref("auto"),
			selected = Vue.ref("");
		const choices = Vue.computed(() =>
			state.quotes.filter((q) => q.carrier === carrier && q.hasData),
		);
		Vue.watch([mode, selected], clear);
		root.addEventListener("customer-quotes-updated", clear);
		const ready = (file) =>
			mode.value === "upload"
				? !!file
				: mode.value === "fixed"
					? choices.value.some((q) => q.id === selected.value)
					: state.loaded &&
						state.rules.some((r) => r.carrier === carrier) &&
						choices.value.length > 0;
		async function prepare(file) {
			if (root.ShipGridShared.isRemote() || root.ShipGridShared.isFiles())
				await refresh();
			if (mode.value === "upload") {
				if (!file) throw Error("请上传本次特殊报价");
				return {
					value: (g) => ({
						wb: file.wb,
						name: file.name,
						customerId: identity(g).id,
						customerName: identity(g).name,
						billingPolicy:
							carrier === "fedex"
								? root.ShipGridFedExCustomerPolicy.resolve(state.rules, g)
								: null,
					}),
					name: file.name,
				};
			}
			const configured = state.rules.map((r) => ({ ...r }));
			const ids =
				mode.value === "fixed"
					? [selected.value]
					: [
							...new Set(
								configured
									.filter((r) => r.carrier === carrier)
									.map((r) => r.quoteId),
							),
						];
			if (!ids.length || !ids[0])
				throw Error("请先保存固定报价并配置客户匹配规则");
			const entries = new Map();
			for (const id of ids) {
				const q = await read("quotes", id);
				if (!q || q.carrier !== carrier || !q.data) continue;
				const parsed = XLSX.read(q.data, {
					type: "array",
					cellDates: false,
					dense: true,
				});
				validateQuote(parsed, carrier);
				entries.set(id, { ...q, wb: Vue.markRaw(parsed) });
			}
			return {
				value: (g) => {
					const c = identity(g),
						r = mode.value === "auto" ? match(configured, carrier, g) : null,
						q = entries.get(r ? r.quoteId : selected.value);
					if (!q) throw Error("客户指定报价尚未上传或已失效");
					return {
						wb: q.wb,
						name: q.name,
						customerId: c.id || r?.customerId || "",
						customerName: r?.customerName || c.name,
						billingPolicy:
							carrier === "fedex"
								? root.ShipGridFedExCustomerPolicy.resolve(configured, g)
								: null,
					};
				},
				name:
					mode.value === "auto"
						? "按客户自动匹配固定报价"
						: entries.get(selected.value)?.name || "固定报价",
			};
		}
		async function downloadQuoteTemplate(file) {
			try {
				let wb = file?.wb;
				if (mode.value === "fixed" && selected.value) {
					const q = await read("quotes", selected.value);
					if (q?.data) wb = XLSX.read(q.data, { type: "array", dense: true });
				}
				root.ShipGridStandardQuotes.download(carrier, wb);
				state.error = "";
			} catch (e) {
				state.error = "下载标准价表失败：" + e.message;
			}
		}
		function downloadStandardDefault() {
			try {
				root.ShipGridStandardQuotes.download(carrier);
				state.error = "";
			} catch (e) {
				state.error = "下载标准价表失败：" + e.message;
			}
		}
		return {
			downloadStandardDefault,
			downloadQuoteTemplate,
			pricingMode: mode,
			selectedQuote: selected,
			quoteChoices: choices,
			quoteStore: state,
			pricingReady: ready,
			preparePricing: prepare,
			openQuoteManager: () => root.openQuoteManager(carrier),
			uploadFixedQuotes: (e) => root.uploadFixedQuoteFiles(carrier, e),
		};
	}
	const host = document.createElement("div");
	host.id = "quote-manager";
	document.body.appendChild(host);
	host.innerHTML = `<div v-if="opened" class="quote-overlay" @click="opened=false"><section class="quote-window" @click.stop role="dialog" aria-modal="true" aria-label="固定报价与客户匹配管理"><div class="section-heading"><h2>固定报价与客户匹配管理</h2><button @click="opened=false">关闭</button></div><p>支持公司服务器共享或本地浏览器保存。共享模式下上传报价、客户资料及匹配关系会同步保存到服务器；生成账单前自动刷新。</p><div class="action-row"><button @click="backup" :disabled="busy">导出报价与规则备份</button><label class="text-button">恢复备份<input type="file" accept=".json" @change="restore" :disabled="busy"></label></div><p v-if="message" class="notice">{{message}}</p><p v-if="error||store.error" class="error">{{error||store.error}}</p><p class="notice">当前保存位置：{{sharing.enabled?'公司共享服务器':sharing.mode==='files'?'客户与匹配保存在本机；固定价表来自文件接口':'本机浏览器'}}。共享服务器单份报价上限20MB；本地上限200MB。</p><h3>客户资料（录入后可下拉选择）</h3><div class="select-grid"><label>客户ID<input v-model="customerForm.customerId" placeholder="与GTS客户ID一致，保留开头的0" :disabled="busy"></label><label>客户名称<input v-model="customerForm.customerName" placeholder="真实客户名称" :disabled="busy"></label></div><button @click="saveCustomer" :disabled="busy">{{customerForm.id?'保存客户修改':'保存客户资料'}}</button><button v-if="customerForm.id" @click="resetCustomer" :disabled="busy">取消编辑</button><div class="table-scroll"><table><thead><tr><th>客户ID</th><th>客户名称</th><th>操作</th></tr></thead><tbody><tr v-for="c in store.customers" :key="c.id"><td>{{c.customerId}}</td><td>{{c.customerName}}</td><td><button @click="editCustomer(c)" :disabled="busy">编辑客户</button></td></tr></tbody></table></div>
<h3>Excel批量导入客户与报价匹配</h3><div class="action-row"><button @click="downloadMappingTemplate" :disabled="busy">下载Excel匹配模板</button><label class="text-button">导入Excel匹配表<input type="file" accept=".xlsx,.xls" @change="importMappings" :disabled="busy"></label></div><p>先上传报价，再填写承运商、客户ID、客户名称、报价名称。导入会保存新客户、更新相同客户的匹配；任何一行有错均不写入。</p><h3>上传固定报价表（数量不限）</h3><p><button @click="downloadStandard" :disabled="busy">下载所选承运商标准价表</button> 已保存报价可逐份下载为标准格式，再修改后替换上传。</p><div class="quote-direct-upload"><div class="select-grid"><label>承运商<select v-model="newCarrier" :disabled="busy"><option value="ontrac">OnTrac</option><option value="fedex">FedEx</option><option value="ups">UPS</option></select></label><label>上传后绑定客户（可选，仅单份报价）<select v-model="uploadCustomer" :disabled="busy"><option value="">仅保存报价，稍后匹配客户</option><option v-for="c in store.customers" :value="c.id">{{c.customerId}} · {{c.customerName}}</option></select></label><label>报价名称（可选，单份上传时使用）<input v-model="newName" :disabled="busy" placeholder="不填则使用文件名"></label></div><button class="primary" @click="$refs.fixedQuoteUpload.click()" :disabled="busy">{{busy?'正在校验并保存…':'＋ 选择并上传报价表（可多选）'}}</button><input ref="fixedQuoteUpload" class="quote-upload-file" type="file" accept=".xlsx,.xls" multiple @change="uploadNew" :disabled="busy"><p>选择承运商后可一次选择多份Excel，自动校验并保存。OnTrac、FedEx和UPS均不限制报价表数量，单个文件上限200MB。</p></div><h3>已保存报价 · UPS {{store.quotes.filter(q=>q.carrier==='ups'&&q.hasData).length}}份 / OnTrac {{store.quotes.filter(q=>q.carrier==='ontrac'&&q.hasData).length}}份 / FedEx {{store.quotes.filter(q=>q.carrier==='fedex'&&q.hasData).length}}份</h3><div class="table-scroll"><table><thead><tr><th>承运商</th><th>报价名称</th><th>文件</th><th>操作</th></tr></thead><tbody><tr v-for="q in store.quotes.filter(q=>q.hasData)" :key="q.id"><td>{{q.carrier==='ontrac'?'OnTrac':q.carrier==='ups'?'UPS':'FedEx'}}</td><td><input :value="q.name" @change="rename(q,$event.target.value)" :disabled="busy"></td><td>{{q.fileName||'尚未上传'}}<small v-if="q.updatedAt"> · {{q.updatedAt.slice(0,10)}}</small></td><td><button @click="downloadStandard(q)" :disabled="busy">下载标准价表</button><label class="text-button">{{q.hasData?'替换报价':'上传报价'}}<input type="file" accept=".xlsx,.xls" @change="upload(q,$event)" :disabled="busy"></label></td></tr></tbody></table></div><p v-if="!store.quotes.some(q=>q.hasData)" class="notice">还没有上传固定报价，请使用上方“选择并上传报价表”按钮。</p><h3>客户ID／名称 → 报价表</h3><p>同一客户可分别设置OnTrac、FedEx与UPS报价。ID优先、名称精确匹配；ID与名称指向不同报价时停止该订单出账。可填写真实客户名称，避免把“客服”列当作客户名称。</p><div class="select-grid"><label>选择已保存客户<select v-model="selectedCustomer" @change="selectCustomer"><option value="">选择客户自动填入ID和名称</option><option v-for="c in store.customers" :value="c.id">{{c.customerId}} · {{c.customerName}}</option></select></label><label>承运商<select v-model="rule.carrier"><option value="ontrac">OnTrac</option><option value="fedex">FedEx</option><option value="ups">UPS</option></select></label><label>客户ID<input v-model="rule.customerId" placeholder="与GTS客户ID一致"></label><label>客户名称<input v-model="rule.customerName" placeholder="例如 江苏虫洞-SG、NJSD-SG"></label><label>对应报价<select v-model="rule.quoteId"><option value="">请选择</option><option v-for="q in store.quotes.filter(q=>q.carrier===rule.carrier&&q.hasData)" :value="q.id">{{q.name}}</option></select></label><template v-if="rule.carrier==='fedex'"><label>分区来源<select v-model="rule.fedexZone"><option value="spGtsOtherMax">SmartPost按GTS，其他取大（默认）</option><option value="spGtsOtherRaw">SmartPost按GTS，其他按原始</option><option value="raw">全部按原始</option><option value="gts">全部按GTS</option><option value="max">全部原始/GTS取大</option></select></label><label>重量来源<select v-model="rule.fedexWeight"><option value="maximum">原始计费重、GTS实重、GTS体积重取大</option><option value="raw">原始账单计费重</option></select></label><label>GTS实重进位规则<select v-model="rule.fedexPrecision"><option value="ceil">直接向上取整磅</option><option value="two">截取两位小数后向上取整磅</option></select></label></template></div><p v-if="rule.carrier==='fedex'">分区固定取子单账单的分区代码；历史GTS/原始分区规则不再用于出账。重量与精度规则仍按客户配置。</p><button @click="saveRule" :disabled="busy">{{rule.id?'保存修改':'保存客户匹配'}}</button><button v-if="rule.id" @click="resetRule">取消编辑</button><div class="table-scroll"><table><thead><tr><th>承运商</th><th>客户ID</th><th>客户名称</th><th>报价</th><th>操作</th></tr></thead><tbody><tr v-for="r in store.rules" :key="r.id"><td>{{r.carrier}}</td><td>{{r.customerId}}</td><td>{{r.customerName}}</td><td>{{quoteName(r.quoteId)}}<small v-if="r.carrier==='fedex'"> · {{policyDescription(r)}}</small></td><td><button @click="edit(r)" :disabled="busy">编辑</button><button @click="remove(r)" :disabled="busy">删除规则</button></td></tr></tbody></table></div></section></div>`;
	Vue.createApp({
		setup() {
			const opened = Vue.ref(false),
				busy = Vue.ref(false),
				error = Vue.ref(""),
				message = Vue.ref(""),
				newName = Vue.ref(""),
				newCarrier = Vue.ref("ontrac"),
				uploadCustomer = Vue.ref(""),
				selectedCustomer = Vue.ref(""),
				customerForm = Vue.reactive({
					id: "",
					customerId: "",
					customerName: "",
				}),
				rule = Vue.reactive({
					id: "",
					carrier: "ontrac",
					customerId: "",
					customerName: "",
					quoteId: "",
					fedexZone: "spGtsOtherMax",
					fedexWeight: "maximum",
					fedexPrecision: "ceil",
				});
			root.openQuoteManager = (carrier) => {
				if (["ontrac", "fedex", "ups"].includes(carrier)) {
					newCarrier.value = carrier;
					if (!rule.id) rule.carrier = carrier;
				}
				opened.value = true;
			};
			root.uploadFixedQuoteFiles = async (carrier, e) => {
				root.openQuoteManager(carrier);
				await uploadNew(e);
			};
			const resetRule = () => {
				selectedCustomer.value = "";
				return Object.assign(rule, {
					id: "",
					carrier: "ontrac",
					customerId: "",
					customerName: "",
					quoteId: "",
					fedexZone: "spGtsOtherMax",
					fedexWeight: "maximum",
					fedexPrecision: "ceil",
				});
			};
			const id = () =>
				root.crypto?.randomUUID?.() || Date.now() + "-" + Math.random();
			async function action(fn) {
				if (busy.value) return;
				busy.value = true;
				error.value = "";
				message.value = "";
				try {
					if (!root.ShipGridShared.isRemote()) await db();
					message.value = (await fn()) || "已保存";
				} catch (e) {
					error.value = e.message;
				} finally {
					busy.value = false;
				}
			}

			const resetCustomer = () =>
				Object.assign(customerForm, {
					id: "",
					customerId: "",
					customerName: "",
				});
			const editCustomer = (c) => Object.assign(customerForm, c);
			const selectCustomer = () => {
				const c = state.customers.find((c) => c.id === selectedCustomer.value);
				if (c) {
					const existing = state.rules.find(
						(r) =>
							r.carrier === rule.carrier &&
							((r.customerId && norm(r.customerId) === norm(c.customerId)) ||
								(r.customerName &&
									norm(r.customerName) === norm(c.customerName))),
					);
					Object.assign(
						rule,
						root.ShipGridFedExCustomerPolicy.defaults,
						{ id: "", quoteId: "" },
						existing || {},
						{ customerId: c.customerId, customerName: c.customerName },
					);
				}
			};
			const saveCustomer = () =>
				action(async () => {
					const c = CustomerData.customer(
							{ ...customerForm, id: customerForm.id || id() },
							state.customers,
						),
						old = state.customers.find((x) => x.id === c.id);
					const customers = state.customers
							.filter((x) => x.id !== c.id)
							.concat(c),
						rules = state.rules.map((r) =>
							old &&
							((old.customerId &&
								norm(old.customerId) === norm(r.customerId)) ||
								(old.customerName &&
									norm(old.customerName) === norm(r.customerName)))
								? {
										...r,
										customerId: c.customerId,
										customerName: c.customerName,
									}
								: { ...r },
						);
					for (const r of rules) validateRule(r, rules);
					await replaceSets({ customers, rules });
					resetCustomer();
					return "客户资料已保存，可在下拉菜单选择";
				});
			const downloadMappingTemplate = () =>
				action(async () => {
					XLSX.writeFile(
						CustomerData.template(state.quotes),
						"ShipGrid_客户报价匹配导入模板.xlsx",
					);
					return "模板已下载，请填写第一张“客户报价匹配”工作表";
				});
			const importMappings = async (e) => {
				const file = e.target.files[0];
				if (!file) return;
				await action(async () => {
					if (file.size > 200 * 1024 * 1024) throw Error("单文件最大200MB");
					if (!/\.xlsx?$/i.test(file.name)) throw Error("请上传Excel匹配表");
					const wb = XLSX.read(await file.arrayBuffer(), {
							type: "array",
							dense: true,
						}),
						rows = CustomerData.parse(wb),
						next = CustomerData.stage(rows, state, id, validateRule);
					await replaceSets({ customers: next.customers, rules: next.rules });
					return (
						"导入完成：新增匹配" +
						next.created +
						"条，更新匹配" +
						next.updated +
						"条；客户资料已同步保存"
					);
				});
				e.target.value = "";
			};
			const downloadStandard = (q) =>
				action(async () => {
					if (q?.id) {
						const saved = await read("quotes", q.id);
						root.ShipGridStandardQuotes.download(
							q.carrier,
							XLSX.read(saved.data, { type: "array", dense: true }),
						);
					} else root.ShipGridStandardQuotes.download(newCarrier.value);
					return "标准价表已下载，空白字段请按实际报价填写";
				});
			async function bindQuote(quote) {
				if (!uploadCustomer.value) return;
				const c = state.customers.find((c) => c.id === uploadCustomer.value);
				if (!c) throw Error("绑定客户不存在，请重新选择");
				const existing = state.rules.find(
					(r) =>
						r.carrier === quote.carrier &&
						((r.customerId && norm(r.customerId) === norm(c.customerId)) ||
							(r.customerName &&
								norm(r.customerName) === norm(c.customerName))),
				);
				const r = {
					id: existing?.id || id(),
					carrier: quote.carrier,
					customerId: c.customerId,
					customerName: c.customerName,
					quoteId: quote.id,
					...(existing
						? {
								fedexZone: existing.fedexZone,
								fedexWeight: existing.fedexWeight,
								fedexPrecision: existing.fedexPrecision,
							}
						: {}),
				};
				validateRule(r, state.rules);
				await write("rules", r);
			}
			async function upload(q, e) {
				const file = e.target.files[0];
				if (!file) return;
				await action(async () => {
					if (file.size > 200 * 1024 * 1024) throw Error("单文件最大200MB");
					if (!/\.xlsx?$/i.test(file.name)) throw Error("请上传Excel报价");
					const data = await file.arrayBuffer(),
						wb = XLSX.read(data, {
							type: "array",
							cellDates: false,
							dense: true,
						});
					validateQuote(wb, q.carrier);
					await write("quotes", {
						id: q.id,
						carrier: q.carrier,
						name: q.name,
						fileName: file.name,
						updatedAt: new Date().toISOString(),
						data,
					});
				});
				e.target.value = "";
			}
			async function uploadNew(e) {
				const files = Array.from(e.target.files || []);
				if (!files.length) return;
				const carrier = newCarrier.value,
					label = newName.value.trim();
				await action(async () => {
					if (uploadCustomer.value && files.length !== 1)
						throw Error(
							"绑定客户时请一次上传一份报价，批量匹配请使用Excel导入",
						);
					let count = 0;
					const failed = [];
					for (const file of files) {
						try {
							if (file.size > 200 * 1024 * 1024) throw Error("单文件超过200MB");
							if (!/\.xlsx?$/i.test(file.name)) throw Error("仅支持Excel报价");
							const data = await file.arrayBuffer(),
								wb = XLSX.read(data, {
									type: "array",
									cellDates: false,
									dense: true,
								});
							validateQuote(wb, carrier);
							const saved = {
								id: id(),
								carrier,
								name:
									files.length === 1 && label
										? label
										: file.name.replace(/\.xlsx?$/i, ""),
								fileName: file.name,
								updatedAt: new Date().toISOString(),
								data,
							};
							await write("quotes", saved);
							await bindQuote(saved);
							count++;
						} catch (err) {
							failed.push(file.name + "：" + err.message);
						}
					}
					if (failed.length) error.value = failed.join("；");
					if (count) newName.value = "";
					return (
						"已保存" +
						count +
						"份报价" +
						(failed.length ? "；" + failed.length + "份未保存，请查看原因" : "")
					);
				});
				e.target.value = "";
			}
			const rename = (q, name) =>
				action(async () => {
					if (!name.trim()) throw Error("报价名称不能为空");
					const full = await read("quotes", q.id);
					await write("quotes", { ...full, name: name.trim() });
				});
			const addQuote = () =>
				action(async () => {
					if (!newName.value.trim()) throw Error("请输入报价名称");
					await write("quotes", {
						id: id(),
						carrier: newCarrier.value,
						name: newName.value.trim(),
						fileName: "",
						updatedAt: "",
					});
					newName.value = "";
				});
			const saveRule = () =>
				action(async () => {
					const r = {
						...rule,
						id: rule.id || id(),
						customerId: rule.customerId.trim(),
						customerName: rule.customerName.trim(),
					};
					validateRule(r, state.rules);
					const q = state.quotes.find(
						(q) => q.id === r.quoteId && q.carrier === r.carrier && q.hasData,
					);
					if (!q) throw Error("请选择本承运商已上传的报价");
					const customers = state.customers.map((c) => ({ ...c }));
					if (r.customerId && r.customerName) {
						const found = customers.find(
							(c) =>
								norm(c.customerId) === norm(r.customerId) ||
								norm(c.customerName) === norm(r.customerName),
						);
						if (
							found &&
							(norm(found.customerId) !== norm(r.customerId) ||
								norm(found.customerName) !== norm(r.customerName))
						)
							throw Error("客户ID与名称不一致，请先编辑客户资料");
						if (!found)
							customers.push(
								CustomerData.customer(
									{
										id: id(),
										customerId: r.customerId,
										customerName: r.customerName,
									},
									customers,
								),
							);
					}
					await replaceSets({
						customers,
						rules: state.rules.filter((x) => x.id !== r.id).concat(r),
					});
					resetRule();
				});
			const edit = (r) => {
					Object.assign(rule, root.ShipGridFedExCustomerPolicy.defaults, r);
					selectedCustomer.value =
						state.customers.find(
							(c) =>
								norm(c.customerId) === norm(r.customerId) &&
								norm(c.customerName) === norm(r.customerName),
						)?.id || "";
				},
				remove = (r) => action(() => write("rules", r.id, true)),
				quoteName = (id) =>
					state.quotes.find((q) => q.id === id)?.name || "报价不存在";
			function saveJSON(data, name) {
				const url = URL.createObjectURL(
						new Blob([JSON.stringify(data)], { type: "application/json" }),
					),
					a = document.createElement("a");
				a.href = url;
				a.download = name;
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			}
			const backup = () =>
				action(async () => {
					const q = await read("quotes");
					const quotes = q.map((x) => {
						if (!x.data) return x;
						let s = "";
						for (const b of new Uint8Array(x.data)) s += String.fromCharCode(b);
						return { ...x, data: btoa(s) };
					});
					saveJSON(
						{
							version: 2,
							quotes,
							rules: await read("rules"),
							customers: await read("customers"),
						},
						"ShipGrid_固定报价与客户匹配备份.json",
					);
					message.value = "备份已导出";
				});
			const restore = (e) =>
				action(async () => {
					const file = e.target.files[0];
					if (!file) return;
					if (file.size > 200 * 1024 * 1024) throw Error("备份超过200MB");
					const data = JSON.parse(await file.text());
					if (
						![1, 2].includes(data.version) ||
						!Array.isArray(data.quotes) ||
						!Array.isArray(data.rules)
					)
						throw Error("备份格式不正确");
					const seen = new Set();
					for (const q of data.quotes) {
						if (
							!q.id ||
							!q.name ||
							!["ontrac", "fedex", "ups"].includes(q.carrier) ||
							seen.has(q.id)
						)
							throw Error("备份报价信息无效或重复");
						seen.add(q.id);
						if (q.data) {
							const decoded = Uint8Array.from(atob(q.data), (c) =>
								c.charCodeAt(0),
							);
							q.data = decoded.buffer;
							validateQuote(
								XLSX.read(q.data, { type: "array", dense: true }),
								q.carrier,
							);
						}
					}
					if (data.version === 1)
						data.customers = CustomerData.legacy(data.rules, id);
					if (!Array.isArray(data.customers)) throw Error("备份缺少客户资料");
					const customerIds = new Set();
					for (const c of data.customers) {
						if (!c.id || customerIds.has(c.id))
							throw Error("备份客户ID重复或缺失");
						customerIds.add(c.id);
						CustomerData.customer(c, data.customers);
					}
					const ruleIds = new Set();
					for (const r of data.rules) {
						if (
							!r.id ||
							ruleIds.has(r.id) ||
							!["ontrac", "fedex", "ups"].includes(r.carrier)
						)
							throw Error("备份规则ID或承运商无效");
						ruleIds.add(r.id);
						validateRule(r, data.rules);
						if (
							!data.quotes.some(
								(q) => q.id === r.quoteId && q.carrier === r.carrier && q.data,
							)
						)
							throw Error("备份规则引用了不存在的报价");
					}
					if (root.ShipGridShared.isRemote()) {
						await replaceSets({
							quotes: data.quotes,
							rules: data.rules,
							customers: data.customers,
						});
						return "备份已恢复到共享服务器";
					}
					const d = await db();
					await new Promise((resolve, reject) => {
						const tx = d.transaction(["rules", "customers"], "readwrite");
						for (const k of ["rules", "customers"]) {
							const s = tx.objectStore(k);
							s.clear();
							for (const r of data[k]) s.put(r);
						}
						tx.oncomplete = resolve;
						tx.onerror = () => reject(tx.error);
						tx.onabort = () => reject(tx.error || Error("恢复失败"));
					});
					await refresh();
				});
			return {
				policyDescription: (r) =>
					root.ShipGridFedExCustomerPolicy.describe(
						root.ShipGridFedExCustomerPolicy.policy(r),
					),
				sharing: root.ShipGridShared.state,
				downloadStandard,
				opened,
				busy,
				error,
				message,
				store: state,
				customerForm,
				saveCustomer,
				resetCustomer,
				editCustomer,
				selectedCustomer,
				selectCustomer,
				uploadCustomer,
				downloadMappingTemplate,
				importMappings,
				newName,
				newCarrier,
				rule,
				upload,
				uploadNew,
				rename,
				addQuote,
				saveRule,
				resetRule,
				edit,
				remove,
				quoteName,
				backup,
				restore,
			};
		},
	}).mount(host);
	root.ShipGridQuoteManager = {
		state,
		use,
		match,
		identity,
		validateRule,
		refresh,
		readQuote: (id) => read("quotes", id),
		localSnapshot: async () => ({
			quotes: await localRead("quotes"),
			customers: await localRead("customers"),
			rules: await localRead("rules"),
		}),
	};
	init();
})(globalThis);