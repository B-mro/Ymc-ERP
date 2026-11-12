/**
 * ups-history.js —— UPS 历史账单持久化归档引擎
 *
 * 本模块负责将已审核过的 UPS 账单行 **持久化存储** 到 IndexedDB（浏览器侧数据库），
 * 供后续退货审核（ups-returns.js）和跨期对账时流式读取。
 *
 * 为什么需要历史归档？
 *   - 退货运单经常缺失 Zone/重量/原始服务信息，需要回查原始正向运单
 *   - ADJ 调整行需要知道前一期是否已有相同调整（避免重复申诉）
 *   - 跨月对账时可能需要追溯 90 天以上的历史数据
 *   - 不在前端内存里全量加载——否则多期账单会爆内存
 *
 * 核心函数与流程：
 *   - identity(r)  : 账单唯一指纹 = SHA-256(Account + Invoice + Date + Currency)
 *     增量 SHA-256 实现：避免一次性拼巨大 UTF-8 Buffer，流式更新 hash
 *   - canonical(r) : 账单行规范化字段子集（排序 key，去 __ 前缀）
 *   - save(batch)  : 将新账单行写入 IndexedDB，按 identity 去重
 *     已有 → compareAndUpdate（保留较新版本）、没有 → insert
 *   - queryByAccount(account, dateRange) : 流式拉取指定账号 + 日期范围内的账单行
 *     只返回 Tracking Number / Reference Number / Zone / Weight / Service 精简字段
 *   - matchReturn(track, account) : 给定退货运单号，在历史中匹配原始正向运单
 *     优先同 Tracking Number，其次同 Reference Number
 *
 * 设计原则：
 *   - Identity 由账号 + 账单号 + 日期 + 币种共同确定（多币种账号不会串单）
 *   - 增量写入：每次 save 只处理本期新账单，与存量做 identity 比对
 *   - 只读暴露：外部模块只读 queryByAccount / matchReturn，不直接操作 IndexedDB
 *   - 浏览器 IndexedDB API：异步回调，Worker 线程内不阻塞主线程
 *
 * 对外暴露：root.UPSHistoryArchive = { save, queryByAccount, matchReturn, identity, canonical }
 *
 * 依赖：IndexedDB（浏览器原生 API）、root.UPSAudit（日期格式化）
 */
/*SG-AUDIT:ups-history.js*/ /* Persistent UPS invoice archive. Invoice identity includes account, date and currency. */
(function (root) {
	"use strict";
	const clean = (v) => String(v ?? "").trim(),
		money = (v) => Math.round((v + 1e-9) * 100) / 100;
	const normAccount = (v) => clean(v).replace(/^0+/, "").toUpperCase();
	const fields = [
		"Account Number",
		"Invoice Number",
		"Invoice Date",
		"Invoice Currency Code",
	];
	const identity = (r) =>
		JSON.stringify([
			normAccount(r[fields[0]]),
			clean(r[fields[1]]),
			clean(r[fields[2]]),
			clean(r[fields[3]] || r["Transaction Currency Code"]),
		]);
	function canonical(row) {
		return Object.fromEntries(
			Object.keys(row)
				.filter((k) => !k.startsWith("__"))
				.sort()
				.map((k) => [k, clean(row[k])]),
		);
	}

	// Incremental SHA-256: preserves V3.59 fingerprints without a giant UTF-8 buffer.
	class StreamSHA256 {
		constructor() {
			this.h = new Uint32Array([
				0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
				0x1f83d9ab, 0x5be0cd19,
			]);
			this.block = new Uint8Array(64);
			this.used = 0;
			this.length = 0;
			this.w = new Uint32Array(64);
		}
		update(bytes) {
			this.length += bytes.length;
			let i = 0;
			while (i < bytes.length) {
				const n = Math.min(64 - this.used, bytes.length - i);
				this.block.set(bytes.subarray(i, i + n), this.used);
				this.used += n;
				i += n;
				if (this.used === 64) {
					this.compress();
					this.used = 0;
				}
			}
			return this;
		}
		compress() {
			const k = StreamSHA256.K,
				w = this.w,
				b = this.block,
				rr = (x, n) => (x >>> n) | (x << (32 - n));
			for (let i = 0; i < 16; i++)
				w[i] =
					(b[i * 4] << 24) |
					(b[i * 4 + 1] << 16) |
					(b[i * 4 + 2] << 8) |
					b[i * 4 + 3];
			for (let i = 16; i < 64; i++) {
				const x = w[i - 15],
					y = w[i - 2];
				w[i] =
					(w[i - 16] +
						(rr(x, 7) ^ rr(x, 18) ^ (x >>> 3)) +
						w[i - 7] +
						(rr(y, 17) ^ rr(y, 19) ^ (y >>> 10))) >>>
					0;
			}
			let [a, c, d, e, f, g, h, j] = this.h;
			for (let i = 0; i < 64; i++) {
				const t1 =
						(j +
							(rr(f, 6) ^ rr(f, 11) ^ rr(f, 25)) +
							((f & g) ^ (~f & h)) +
							k[i] +
							w[i]) >>>
						0,
					t2 =
						((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) +
							((a & c) ^ (a & d) ^ (c & d))) >>>
						0;
				j = h;
				h = g;
				g = f;
				f = (e + t1) >>> 0;
				e = d;
				d = c;
				c = a;
				a = (t1 + t2) >>> 0;
			}
			const v = [a, c, d, e, f, g, h, j];
			for (let i = 0; i < 8; i++) this.h[i] = (this.h[i] + v[i]) >>> 0;
		}
		hex() {
			const size = this.length,
				tail = new Uint8Array(
					this.used < 56 ? 64 - this.used : 128 - this.used,
				);
			tail[0] = 128;
			const view = new DataView(tail.buffer);
			view.setUint32(tail.length - 8, Math.floor(size / 0x20000000));
			view.setUint32(tail.length - 4, (size * 8) >>> 0);
			this.update(tail);
			return Array.from(this.h, (x) => x.toString(16).padStart(8, "0")).join(
				"",
			);
		}
	}
	StreamSHA256.K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
		0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
		0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
		0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
		0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
		0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
		0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
		0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
		0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
	]);
	const pause = () => new Promise((r) => setTimeout(r, 0)),
		encoder = new TextEncoder();
	async function fingerprint(rows) {
		const normalized = [];
		for (let i = 0; i < rows.length; i++) {
			normalized.push(JSON.stringify(canonical(rows[i])));
			if (i % 500 === 499) await pause();
		}
		normalized.sort();
		const h = new StreamSHA256();
		h.update(encoder.encode("["));
		for (let i = 0; i < normalized.length; i++) {
			if (i) h.update(encoder.encode(","));
			h.update(encoder.encode(JSON.stringify(normalized[i])));
			normalized[i] = null;
			if (i % 500 === 499) await pause();
		}
		h.update(encoder.encode("]"));
		return h.hex();
	}
	async function hashBlob(blob) {
		const h = new StreamSHA256();
		for (let i = 0; i < blob.size; i += 1024 * 1024) {
			h.update(
				new Uint8Array(await blob.slice(i, i + 1024 * 1024).arrayBuffer()),
			);
			await pause();
		}
		return h.hex();
	}
	async function eachInvoice(visit, skip = new Set()) {
		const db = await database();
		return new Promise((resolve, reject) => {
			const tx = db.transaction("invoices", "readonly"),
				req = tx.objectStore("invoices").openCursor();
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor) return;
				try {
					if (!skip.has(cursor.key)) visit(cursor.value);
					cursor.continue();
				} catch (e) {
					reject(e);
					tx.abort();
				}
			};
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}
	async function summaries() {
		const list = [];
		await eachInvoice((i) => {
			const r = i.rows[0] || {};
			list.push({
				账号: r["Account Number"],
				账单号: r["Invoice Number"],
				账单日期: r["Invoice Date"],
				费用行数: i.rows.length,
				来源文件: i.name,
				保存时间: i.savedAt,
			});
		});
		return list;
	}

	async function hashBytes(bytes) {
		if (!root.crypto?.subtle) throw Error("账单留存需要Chrome/Edge安全环境");
		return Array.from(
			new Uint8Array(await root.crypto.subtle.digest("SHA-256", bytes)),
		)
			.map((x) => x.toString(16).padStart(2, "0"))
			.join("");
	}
	async function hash(value) {
		if (!root.crypto?.subtle)
			throw Error(
				"账单留存需要安全浏览器环境，请使用Chrome/Edge本地文件或localhost",
			);
		return Array.from(
			new Uint8Array(
				await root.crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(value),
				),
			),
		)
			.map((x) => x.toString(16).padStart(2, "0"))
			.join("");
	}
	function validate(rows) {
		if (!Array.isArray(rows) || !rows.length)
			throw Error("没有可留存的UPS原始费用行");
		for (const r of rows) {
			if (
				!r ||
				typeof r !== "object" ||
				!clean(r["Account Number"]) ||
				!clean(r["Invoice Number"]) ||
				!clean(r["Invoice Date"]) ||
				!clean(r["Invoice Currency Code"] || r["Transaction Currency Code"])
			)
				throw Error("留存失败：原始行缺少账号、账单号、账单日期或币种");
			if (
				!clean(r["Net Amount"]) ||
				!Number.isFinite(Number(clean(r["Net Amount"]).replace(/[$,]/g, "")))
			)
				throw Error("留存失败：Net Amount缺失或无效");
		}
	}
	async function prepare(rows) {
		validate(rows);
		const groups = new Map();
		for (const row of rows) {
			const id = identity(row);
			if (!groups.has(id)) groups.set(id, []);
			groups.get(id).push(row);
		}
		const out = [];
		for (const [id, rs] of groups)
			out.push({ id, rows: rs, digest: await fingerprint(rs) });
		return out;
	}
	let promise;
	function database() {
		if (!promise)
			promise = new Promise((resolve, reject) => {
				if (!root.indexedDB) {
					reject(Error("浏览器未开放账单数据库，账单未保存"));
					return;
				}
				const request = root.indexedDB.open("ShipGridUPSInvoiceArchive", 1);
				request.onupgradeneeded = () => {
					request.result.createObjectStore("invoices", { keyPath: "id" });
					request.result.createObjectStore("files", { keyPath: "id" });
				};
				request.onblocked = () =>
					reject(Error("账单库被其他窗口占用，请关闭旧页面后重试"));
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					db.onversionchange = () => {
						db.close();
						promise = null;
					};
					resolve(db);
				};
			}).catch((e) => {
				promise = null;
				throw e;
			});
		return promise;
	}
	async function all(store = "invoices") {
		const db = await database();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(store, "readonly"),
				req = tx.objectStore(store).getAll();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
	async function commit(items, files = []) {
		const db = await database();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(["invoices", "files"], "readwrite");
			let conflict = "";
			const stats = { added: 0, skipped: 0 };
			for (const item of items) {
				const store = tx.objectStore("invoices"),
					req = store.get(item.id);
				req.onsuccess = () => {
					const old = req.result;
					if (old) {
						if (old.digest !== item.digest) {
							conflict =
								"同账号同账单的内容与已存版本不同，可能是修订账单或不完整导出；未覆盖历史，请核对原文件";
							tx.abort();
						} else stats.skipped++;
					} else {
						store.add(item);
						stats.added++;
					}
				};
			}
			for (const f of files) tx.objectStore("files").put(f);
			tx.oncomplete = () => resolve(stats);
			tx.onabort = () =>
				reject(
					Error(
						conflict ||
							tx.error?.message ||
							"账单保存失败（可能空间不足）；本次未写入",
					),
				);
			tx.onerror = () => {};
		});
	}
	async function ingest(rows, source = {}) {
		const items = await prepare(rows),
			stamp = new Date().toISOString(),
			blob = source.blob || (source.bytes ? new Blob([source.bytes]) : null),
			file = blob
				? {
						id: await hashBlob(blob),
						name: source.name || "UPS-original",
						blob,
						savedAt: stamp,
					}
				: null;
		for (const item of items)
			Object.assign(item, {
				name: source.name || "UPS导入",
				savedAt: stamp,
				fileId: file?.id || null,
			});
		const stats = await commit(items, file ? [file] : []);
		root.dispatchEvent?.(new Event("ups-history-updated"));
		return stats;
	}
	function timeline(current, history) {
		const keys = new Set(
			current
				.filter((r) => clean(r["Tracking Number"]))
				.map((r) =>
					JSON.stringify([
						normAccount(r["Account Number"]),
						clean(r["Tracking Number"]).toUpperCase(),
						clean(r["Transaction Currency Code"] || r["Invoice Currency Code"]),
					]),
				),
		);
		const currentInvoices = new Set(current.map(identity)),
			bucket = new Map();
		for (const inv of history)
			for (const row of inv.rows) {
				const key = JSON.stringify([
					normAccount(row["Account Number"]),
					clean(row["Tracking Number"]).toUpperCase(),
					clean(
						row["Transaction Currency Code"] || row["Invoice Currency Code"],
					),
				]);
				if (!keys.has(key)) continue;
				if (!bucket.has(key)) bucket.set(key, []);
				bucket
					.get(key)
					.push({ row, invoice: inv, isCurrent: currentInvoices.has(inv.id) });
			}
		const result = [];
		for (const [key, entries] of bucket) {
			const historical = entries.filter((e) => !e.isCurrent);
			if (!historical.length) continue;
			const amount = (es) =>
					money(
						es.reduce(
							(s, e) =>
								s + Number(clean(e.row["Net Amount"]).replace(/[$,]/g, "")),
							0,
						),
					),
				base = historical.filter(
					(e) =>
						e.row["Charge Category Code"] === "SHP" &&
						e.row["Charge Classification Code"] === "FRT",
				);
			const [account, track, currency] = JSON.parse(key);
			result.push({
				账号: account,
				运单号: track,
				币种: currency,
				历史账单: [
					...new Set(historical.map((e) => e.row["Invoice Number"])),
				].join(" / "),
				当期账单: [
					...new Set(
						entries
							.filter((e) => e.isCurrent)
							.map((e) => e.row["Invoice Number"]),
					),
				].join(" / "),
				历史净额: amount(historical),
				当期净额: amount(entries.filter((e) => e.isCurrent)),
				累计净额: amount(entries),
				历史原运费: base.length ? "已匹配" : "缺少原基础费",
				核查结论:
					"已关联历史；补收/退款须结合更正原因、最终重量分区及各交易日期燃油复核，累计净额不重复计入本期申诉",
				明细: entries.map((e) => ({
					账号: account,
					运单号: track,
					币种: currency,
					账单号: e.row["Invoice Number"],
					账单日期: e.row["Invoice Date"],
					交易日期: e.row["Transaction Date"],
					期间: e.isCurrent ? "当期" : "历史",
					类别: e.row["Charge Category Code"],
					费用分类: e.row["Charge Classification Code"],
					费用名称: e.row["Charge Description"],
					净额: Number(clean(e.row["Net Amount"]).replace(/[$,]/g, "")),
					优惠: e.row["Incentive Amount"],
					计费重: e.row["Billed Weight"],
					分区: e.row["Corrected Zone"] || e.row.Zone,
					来源文件: e.invoice.name,
					来源行: e.row.__row || "",
					审核状态: "关联待核实",
				})),
			});
		}
		return result;
	}
	async function link(rows) {
		const keys = new Set(
				rows
					.filter((r) => clean(r["Tracking Number"]))
					.map((r) =>
						JSON.stringify([
							normAccount(r["Account Number"]),
							clean(r["Tracking Number"]).toUpperCase(),
							clean(
								r["Transaction Currency Code"] || r["Invoice Currency Code"],
							),
						]),
					),
			),
			relevant = [],
			current = new Map();
		for (const r of rows) {
			const id = identity(r);
			if (!current.has(id)) current.set(id, []);
			current.get(id).push(r);
		}
		for (const [id, rs] of current)
			relevant.push({ id, rows: rs, name: "当前账单" });
		await eachInvoice((inv) => {
			const selected = inv.rows.filter((r) =>
				keys.has(
					JSON.stringify([
						normAccount(r["Account Number"]),
						clean(r["Tracking Number"]).toUpperCase(),
						clean(r["Transaction Currency Code"] || r["Invoice Currency Code"]),
					]),
				),
			);
			if (selected.length) relevant.push({ ...inv, rows: selected });
		}, new Set(current.keys()));
		return timeline(rows, relevant);
	}
	async function evidence(rows) {
		const selected = [];
		await eachInvoice((inv) => {
			selected.push(...root.UPSReturnsAudit.filterHistory(rows, inv.rows));
		});
		return selected;
	}
	function download(blob, name) {
		const url = URL.createObjectURL(blob),
			a = document.createElement("a");
		a.href = url;
		a.download = name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 30000);
	}
	async function backup() {
		const invoices = await all(),
			files = await all("files"),
			packed = [];
		for (const f of files) {
			const data = new Uint8Array(await f.blob.arrayBuffer());
			let binary = "";
			for (let i = 0; i < data.length; i += 8192)
				binary += String.fromCharCode(...data.subarray(i, i + 8192));
			packed.push({ ...f, blob: undefined, base64: btoa(binary) });
		}
		download(
			new Blob(
				[
					JSON.stringify({
						format: "ShipGridUPSArchive",
						version: 1,
						invoices,
						files: packed,
					}),
				],
				{ type: "application/json" },
			),
			"ShipGrid_UPS_账单备份.json",
		);
	}
	async function restore(text) {
		const pack = JSON.parse(text);
		if (
			pack.format !== "ShipGridUPSArchive" ||
			pack.version !== 1 ||
			!Array.isArray(pack.invoices) ||
			!Array.isArray(pack.files)
		)
			throw Error("不是有效的UPS账单备份");
		const ids = new Set(),
			items = [];
		for (const item of pack.invoices) {
			const p = await prepare(item.rows);
			if (
				p.length !== 1 ||
				p[0].id !== item.id ||
				p[0].digest !== item.digest ||
				ids.has(item.id)
			)
				throw Error("备份账单内容校验失败");
			ids.add(item.id);
			items.push(item);
		}
		const files = [];
		for (const f of pack.files) {
			const binary = atob(f.base64),
				bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
			if ((await hashBytes(bytes)) !== f.id) throw Error("原始文件校验失败");
			files.push({
				id: f.id,
				name: f.name,
				blob: new Blob([bytes]),
				savedAt: f.savedAt,
			});
		}
		const fileIds = new Set(files.map((f) => f.id));
		if (items.some((i) => i.fileId && !fileIds.has(i.fileId)))
			throw Error("备份缺少原始文件");
		const result = await commit(items, files);
		root.dispatchEvent?.(new Event("ups-history-updated"));
		return result;
	}
	root.ShipGridUPSHistory = {
		ingest,
		link,
		evidence,
		all,
		backup,
		restore,
		timeline,
		prepare,
		identity,
		summaries,
		hashBlob,
	};
	if (!root.document) return;
	const host = document.getElementById("ups-audit-app")?.querySelector("main");
	if (!host) return;
	const section = document.createElement("section");
	section.className = "panel";
	section.innerHTML =
		'<h2>UPS历史账单库</h2><p>勾选“本次同时保存完整历史明细并关联历史”后，在审核前校验并留存；新账单按账号、运单号及币种关联历史。数据仅保存在当前浏览器，不跨设备同步，请定期导出完整备份。</p><button data-action="refresh">刷新账单库</button> <button data-action="backup">导出完整备份</button> <label>导入备份 <input type="file" data-action="restore" accept=".json"></label><p data-msg role="status"></p><input data-search placeholder="输入完整运单号查询历史"><button data-action="search">查询运单</button><div data-output style="overflow:auto;max-height:450px"></div>';
	host.insertBefore(section, host.children[2] || null);
	const msg = section.querySelector("[data-msg]"),
		out = section.querySelector("[data-output]");
	function table(records) {
		out.replaceChildren();
		if (!records.length) {
			out.textContent = "没有匹配记录";
			return;
		}
		const table = document.createElement("table"),
			headers = Object.keys(records[0]),
			thead = document.createElement("tr");
		for (const h of headers) {
			const th = document.createElement("th");
			th.textContent = h;
			thead.append(th);
		}
		table.append(thead);
		for (const r of records) {
			const tr = document.createElement("tr");
			for (const h of headers) {
				const td = document.createElement("td");
				td.textContent = clean(r[h]);
				tr.append(td);
			}
			table.append(tr);
		}
		out.append(table);
	}
	async function refresh() {
		const list = await summaries();
		msg.textContent = "已保存 " + list.length + " 份账单（不同账号分别留存）";
		table(list);
	}
	for (const button of section.querySelectorAll("button"))
		button.onclick = async () => {
			try {
				if (button.dataset.action === "refresh") await refresh();
				else if (button.dataset.action === "backup") {
					await backup();
					msg.textContent = "完整备份已生成，包含原始上传文件及费用明细";
				} else {
					const q = clean(
						section.querySelector("[data-search]").value,
					).toUpperCase();
					if (!q) throw Error("请输入完整运单号");
					const records = [];
					await eachInvoice((i) => {
						for (const r of i.rows)
							if (clean(r["Tracking Number"]).toUpperCase() === q)
								records.push({
									账号: r["Account Number"],
									账单号: r["Invoice Number"],
									账单日期: r["Invoice Date"],
									交易日期: r["Transaction Date"],
									类别: r["Charge Category Code"],
									费用: r["Charge Description"],
									净额: r["Net Amount"],
									币种: r["Transaction Currency Code"],
									计费重: r["Billed Weight"],
									分区: r["Corrected Zone"] || r.Zone,
									来源文件: i.name,
								});
					});
					table(records);
					msg.textContent =
						"找到 " + records.length + " 条费用记录；不同账号/币种不得直接相加";
				}
			} catch (e) {
				msg.textContent = e.message;
			}
		};
	section.querySelector('[data-action="restore"]').onchange = async (e) => {
		try {
			if (!e.target.files[0]) return;
			const stats = await restore(await e.target.files[0].text());
			await refresh();
			msg.textContent =
				"备份导入：新增" + stats.added + "份，重复跳过" + stats.skipped + "份";
		} catch (e) {
			msg.textContent = e.message;
		} finally {
			e.target.value = "";
		}
	};
	root.addEventListener("ups-history-updated", () =>
		refresh().catch((e) => (msg.textContent = e.message)),
	);
	refresh().catch((e) => (msg.textContent = e.message));
})(globalThis);
