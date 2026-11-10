const fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	assert = require("assert");
const base = path.resolve(__dirname, "../modules");
const reports = [];
for (const mid of fs.readdirSync(base)) {
	const dir = path.join(base, mid),
		manifest = JSON.parse(
			fs.readFileSync(path.join(dir, "module.json"), "utf8"),
		),
		html = fs.readFileSync(path.join(dir, "index.html"), "utf8"),
		nodes = new Map(),
		mounts = [],
		handlers = {};
	function element(tag = "div") {
		return {
			tagName: tag.toUpperCase(),
			style: {},
			classList: { add() {}, remove() {}, toggle() {} },
			innerHTML: "",
			get textContent() {
				return this.innerHTML
					.replace(/<[^>]*>/g, "")
					.replaceAll("&gt;", ">")
					.replaceAll("&lt;", "<")
					.replaceAll("&amp;", "&");
			},
			set textContent(v) {
				this.innerHTML = v;
			},
			appendChild(e) {
				if (e.id) nodes.set(e.id, e);
				return e;
			},
			querySelector() {
				return null;
			},
			querySelectorAll() {
				return [];
			},
			addEventListener() {},
			setAttribute() {},
			removeAttribute() {},
			insertBefore(e) {
				return e;
			},
			remove() {},
			click() {},
		};
	}
	for (const m of html.matchAll(/id="([^"]+)"/g)) {
		const e = element();
		e.id = m[1];
		nodes.set(e.id, e);
	}
	const document = {
		createElement: element,
		createElementNS: (_, tag) => element(tag),
		getElementById: (id) => nodes.get(id) || null,
		querySelector: (q) => (q === ".module-switch" ? nav : null),
		querySelectorAll: () => [],
		body: element("body"),
		documentElement: element("html"),
		addEventListener() {},
		referrer: "",
	};
	const nav = element("nav");
	const store = new Map(),
		storage = {
			getItem: (k) => store.get(k) || null,
			setItem: (k, v) => store.set(k, v),
			removeItem: (k) => store.delete(k),
		};
	const ctx = {
		console,
		TextEncoder,
		TextDecoder,
		Uint8Array,
		ArrayBuffer,
		Blob,
		URL,
		URLSearchParams,
		Date,
		Promise,
		Map,
		Set,
		WeakSet,
		structuredClone,
		atob,
		btoa,
		crypto: require("crypto").webcrypto,
		localStorage: storage,
		sessionStorage: storage,
		location: new URL("https://shipgrid.test/modules/" + mid + "/index.html"),
		document,
		addEventListener: (k, f) => {
			(handlers[k] ||= []).push(f);
		},
		dispatchEvent() {},
		Event: class {},
		setTimeout: (f, t) => {
			if (t < 100) return 0;
			return 0;
		},
		clearTimeout() {},
		setInterval() {},
		clearInterval() {},
		navigator: { userAgent: "node-test" },
		fetch: async () => {
			throw Error("Network not used in dependency test");
		},
	};
	ctx.window = ctx;
	ctx.globalThis = ctx;
	ctx.parent = ctx;
	vm.createContext(ctx);
	let count = 0;
	for (const rel of manifest.loadOrder) {
		const p = path.resolve(dir, rel);
		assert(p.startsWith(dir + path.sep));
		assert(fs.existsSync(p), rel);
		const c = fs.readFileSync(p, "utf8");
		new vm.Script(c, { filename: mid + "/" + rel });
		vm.runInContext(c, ctx, { filename: mid + "/" + rel });
		count++;
		if (rel === "vendor/vue.global.prod.js") {
			const vue = ctx.Vue;
			vue.createApp = (opts) => ({
				mount(target) {
					const result = opts.setup ? opts.setup() : {};
					mounts.push({ target, state: result });
					return result;
				},
				unmount() {},
			});
		}
	}
	assert(ctx[manifest.engineGlobal], manifest.engineGlobal);
	assert(ctx.ShipGridModule.getStatus().ready, mid + " main setup not reached");
	assert.equal(ctx.ShipGridModule.getStatus().moduleId, mid);
	const errors = [];
	for (const e of [html, ...nodes.values()].flatMap((x) =>
		typeof x === "string" ? [x] : x.innerHTML ? [x.innerHTML] : [],
	)) {
		for (const t of e.startsWith("<!doctype")
			? [...e.matchAll(/<main\b[\s\S]*?<\/main>/g)]
			: [[e]]) {
			try {
				ctx.Vue.compile(t[0], {
					decodeEntities: (v) =>
						v
							.replaceAll("&gt;", ">")
							.replaceAll("&lt;", "<")
							.replaceAll("&amp;", "&")
							.replaceAll("&quot;", '\"'),
					onError: (err) => errors.push(err.message),
				});
			} catch (err) {
				errors.push(err.stack);
			}
		}
	}
	assert.deepEqual(errors, []);
	const messages = [];
	ctx.parent = { postMessage: (...args) => messages.push(args) };
	document.referrer = "https://shipgrid.test/finance";
	for (const h of handlers.message || []) {
		h({
			source: ctx.parent,
			origin: "https://evil.test",
			data: {
				channel: "shipgrid-finance-v1",
				moduleId: mid,
				type: "get-status",
			},
		});
		assert.equal(messages.length, 0);
		h({
			source: ctx.parent,
			origin: "https://shipgrid.test",
			data: {
				channel: "shipgrid-finance-v1",
				moduleId: mid,
				type: "get-status",
				requestId: "test",
			},
		});
	}
	assert.equal(messages.length, 1);
	assert.equal(messages[0][0].type, "status");
	assert.equal(messages[0][1], "https://shipgrid.test");
	reports.push({
		module: mid,
		scripts: count,
		mounts: mounts.length,
		mainReady: true,
		templateErrors: errors.length,
	});
}
console.log(JSON.stringify(reports, null, 2));
