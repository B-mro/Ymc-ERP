/**
 * ontrac-billing/shared/child-invoice.js —— 子单账单匹配引擎
 *
 * 本模块处理 **子单（Child Invoice）账单文件** 的识别与匹配。
 *
 * 什么是子单？
 *   - 某些大客户（如亚马逊、Target）会将多个运单合并为一张"父账单"，
 *     但 OnTrac/FedEx 同时提供一张"子单明细表"，列出每票运单的详细费用拆分
 *   - 引擎需要将子单明细逐票匹配回原始运单，提取住宅/偏远费等证据链
 *   - 没有子单匹配时，引擎只能拿到父账单的汇总数（无法逐票核对附加费）
 *
 * 核心数据结构：
 *   trackingNames[]  : 多语言运单名列（运单号 / Waybill# / Tracking Number / 转单号 等）
 *   feeNames[]       : 住宅费多语言名（Residential Fee / 住宅附加费 等）
 *   zoneNames[]      : Zone 列多语言名（分区代码 / Zone Code）
 *   areaNames{}      : 偏远/超偏远/Remote 多语言名映射（das / edas / remote / dasR / dasC / ...）
 *   每个键 → 中英双语同义词数组，匹配时用 includes 做大小写不敏感模糊匹配
 *
 * 匹配流程：
 *   1. readChildInvoice(wb) : 从子单 Excel 读取所有行 → 标准化列名
 *   2. 建立索引：按 tracking number 为 key 建立 Map → 子单行
 *   3. 对每票原始运单：
 *      - 查 Map 是否有匹配的子单行
 *      - 有 → 提取 residentialFee / dasFee / zone / weight 等字段
 *      - 无 → 标记 "无子单匹配"，引擎只用父账单汇总数据
 *   4. 住宅/偏远费证据链：若子单行有这些字段 → 作为 claim 的 evidence 引用
 *
 * OnTrac 特有处理：
 *   - OnTrac 子单很少出现 Residential Fee（OnTrac 通常统一 Commercial 计费）
 *   - 重点匹配 DAS / EDAS / Remote 偏远费证据
 *   - 若子单 Zone 与 GTS Zone 不一致 → 子单优先（是最终计费依据）
 *
 * 为什么跨模块共享？
 *   - FedEx 和 OnTrac 都有子单账单机制，UPS 相对较少但结构相同
 *   - 多语言匹配表是通用资产（添加新承运商只需在数组中追加同义词）
 *   - 匹配逻辑与计费逻辑解耦 → 子单不匹配时引擎不会崩，只是精度降低
 *
 * 对外暴露：root.ShipGridChildInvoice = { readChildInvoice, match, trackingNames, feeNames, zoneNames, areaNames }
 *
 * 依赖：XLSX（Excel 读取）
 */
/*SG-AUDIT:finance-10.js*/ (function (root) {
	"use strict";
	const norm = (v) =>
			String(v ?? "")
				.trim()
				.replace(/\s+/g, "")
				.toLowerCase(),
		id = (v) =>
			String(v ?? "")
				.trim()
				.toUpperCase();
	const trackingNames = [
		"运单号",
		"物流单号",
		"Waybill#/tracking#",
		"Express or Ground Tracking ID",
		"Tracking Number",
		"转单号",
		"子单号",
	];
	const feeNames = [
		"住宅地址附加费",
		"住宅附加费",
		"住宅费",
		"Residential Fee",
		"Residential Delivery",
		"Residential Surcharge",
	];
	const zoneNames = ["分区代码", "Zone Code"],
		areaNames = {
			das: [
				"偏远费",
				"偏远附加费",
				"DAS",
				"Delivery Area Fee",
				"Delivery Area Surcharge",
			],
			edas: [
				"超偏远费",
				"超偏远附加费",
				"EDAS",
				"Extended Area Fee",
				"Delivery Area Surcharge - Extended",
				"Delivery Area Surcharge Extended",
			],
			remote: ["Remote偏远费", "Remote", "Delivery Area Surcharge - Remote"],
			dasR: ["DAS住宅偏远费", "DAS Residential"],
			dasC: ["DAS商业偏远费", "DAS Commercial"],
			edasR: ["EDAS住宅超偏远费", "DAS Extended Residential"],
			edasC: ["EDAS商业超偏远费", "DAS Extended Commercial"],
			remoteR: ["Remote住宅偏远费", "DAS Remote Residential"],
			remoteC: ["Remote商业偏远费", "DAS Remote Comm"],
		};
	const orderNames = ["订单号", "系统订单号"],
		referenceNames = ["客户单号", "客户参考号"];
	const named = (n) => /子单.*账单|child[ _-]*(invoice|bill)/i.test(n);
	function matrix(wb, name) {
		return XLSX.utils.sheet_to_json(wb.Sheets[name], {
			header: 1,
			raw: true,
			defval: null,
			range: 0,
		});
	}
	function layout(wb, name) {
		const a = matrix(wb, name);
		for (let hi = 0; hi < Math.min(a.length, 20); hi++) {
			const hs = a[hi].map(norm),
				col = (names) => hs.findIndex((h) => names.some((n) => norm(n) === h)),
				fee = col(feeNames),
				tracking = col(trackingNames),
				order = col(orderNames),
				reference = col(referenceNames),
				zone = col(zoneNames),
				areas = Object.fromEntries(
					Object.entries(areaNames).map(([k, v]) => [k, col(v)]),
				);
			if (
				(fee >= 0 || zone >= 0 || Object.values(areas).some((v) => v >= 0)) &&
				(tracking >= 0 || order >= 0 || reference >= 0)
			)
				return {
					a,
					hi,
					fee,
					tracking,
					order,
					reference,
					zone,
					areas,
					currency: col(["币种", "Currency", "Transaction Currency Code"]),
				};
		}
		return null;
	}
	function select(files) {
		for (const [key, label] of [
			["invoice", "原始账单文件"],
			["gts", "GTS文件"],
		]) {
			const f = files[key];
			if (!f) continue;
			const names = f.wb.SheetNames.filter(named);
			if (names.length > 1)
				throw Error(label + "包含多个子单账单工作表，请合并为一张后使用");
			if (names.length)
				return {
					wb: f.wb,
					name: names[0],
					source: f.name + " / " + names[0],
					embedded: true,
				};
		}
		if (files.child) {
			const f = files.child,
				names = f.wb.SheetNames.filter(named),
				candidates = names.length
					? names
					: f.wb.SheetNames.filter((n) => layout(f.wb, n));
			if (candidates.length !== 1)
				throw Error("子单账单需有一张可识别的运单号及分区代码/附加费工作表");
			return {
				wb: f.wb,
				name: candidates[0],
				source: f.name + " / " + candidates[0],
				embedded: false,
			};
		}
		return null;
	}
	function describe(files) {
		try {
			const s = select(files);
			return s
				? "已识别子单账单：" +
						s.source +
						(s.embedded ? "（内嵌，优先使用，无需另传）" : "（单独上传）")
				: "客户出账需要子单分区代码；原始或GTS文件含「子单账单」工作表时自动读取";
		} catch (e) {
			return e.message;
		}
	}
	function build(spec) {
		const tracks = new Map(),
			orders = new Map(),
			refs = new Map();
		let count = 0;
		if (!spec)
			return {
				match: () => ({
					matched: false,
					amount: 0,
					status: "未提供子单账单",
					source: "",
				}),
				count: 0,
				source: "",
			};
		const l = layout(spec.wb, spec.name);
		if (!l) throw Error("子单账单缺少运单号/订单号与分区代码/附加费表头");
		const put = (m, k, v) => {
			if (k) {
				if (!m.has(k)) m.set(k, new Set());
				m.get(k).add(v);
			}
		};
		for (let i = l.hi + 1; i < l.a.length; i++) {
			const a = l.a[i],
				tracking = l.tracking >= 0 ? id(a[l.tracking]) : "",
				order = l.order >= 0 ? id(a[l.order]) : "",
				reference = l.reference >= 0 ? id(a[l.reference]) : "";
			if (!tracking && !order && !reference) continue;
			const raw = l.fee >= 0 ? a[l.fee] : null,
				amount =
					raw === null || raw === undefined || String(raw).trim() === ""
						? 0
						: Number(String(raw).replace(/[$,\s]/g, ""));
			const parse = (v) =>
				v == null || String(v).trim() === ""
					? 0
					: Number(String(v).replace(/[$,\s]/g, ""));
			const r = {
				tracking,
				order,
				reference,
				amount,
				zone: l.zone >= 0 ? a[l.zone] : null,
				areas: Object.fromEntries(
					Object.entries(l.areas).map(([k, i]) => [k, i < 0 ? 0 : parse(a[i])]),
				),
				currency: l.currency >= 0 ? id(a[l.currency]) : "",
				row: i + 1,
			};
			put(tracks, tracking, r);
			if (/^96\d{18,}$/.test(tracking)) put(tracks, tracking.slice(-12), r);
			put(orders, order, r);
			put(refs, reference, r);
			count++;
		}
		function match(tracking, g = {}) {
			let hits = tracks.get(id(tracking)),
				method = "运单号";
			if (!hits?.size) {
				const aliases = [g["转单号"], g["主单号"], g["子单号"]]
					.map(id)
					.filter(Boolean);
				hits = new Set(aliases.flatMap((k) => [...(tracks.get(k) || [])]));
			}
			if (!hits?.size) {
				hits = orders.get(id(g["订单号"]));
				method = "系统订单号";
			}
			if (!hits?.size) {
				hits = refs.get(id(g["客户单号"]));
				method = "客户单号";
			}
			if (!hits?.size)
				return {
					matched: false,
					amount: 0,
					status: "未匹配",
					source: spec.source,
				};
			if (hits.size !== 1)
				throw Error(
					"子单账单" + method + "匹配重复（" + hits.size + "行），住宅费需核实",
				);
			const r = [...hits][0];
			if (
				r.tracking &&
				r.tracking !== id(tracking) &&
				!["转单号", "主单号", "子单号"].some((k) => id(g[k]) === r.tracking) &&
				!(r.tracking.startsWith("96") && r.tracking.slice(-12) === id(tracking))
			)
				throw Error("子单账单订单匹配但运单号冲突，第" + r.row + "行");
			if (
				[r.amount, ...Object.values(r.areas)].some(
					(v) => !Number.isFinite(v) || v < 0,
				)
			)
				throw Error("子单附加费无效或为退款，第" + r.row + "行");
			if (
				[r.amount, ...Object.values(r.areas)].some((v) => v > 0) &&
				r.currency &&
				!["USD", "US$", "$", "美元"].includes(r.currency)
			)
				throw Error("子单附加费不是USD，第" + r.row + "行");
			return {
				matched: true,
				amount: r.amount,
				zone: r.zone,
				areas: r.areas,
				status: method + "匹配，第" + r.row + "行",
				source: spec.source,
			};
		}
		return { match, count, source: spec.source };
	}
	function evidence(index, tracking, g, original) {
		const c = index.match(tracking, g);
		return {
			...c,
			original: !!original,
			added: !original && c.amount > 0,
			decision: original
				? "原始住宅收费或住宅服务"
				: c.amount > 0
					? "子单账单住宅收费"
					: "未触发住宅费",
		};
	}
	function zoneFor(c) {
		if (!c.matched) throw Error("子单账单未匹配：无法取得分区代码");
		const m = String(c.zone ?? "")
			.trim()
			.match(/^(?:Zone\s*)?0*([2-8])$/i);
		if (!m) throw Error("子单账单分区代码缺失或无效：" + String(c.zone ?? ""));
		return +m[1];
	}
	function pieces(g) {
		const n = Number(g["件数"]);
		if (!Number.isInteger(n) || n < 1) throw Error("GTS件数缺失或无效");
		return n;
	}
	function areas(c, original, resi, eco = false) {
		const out = new Set(),
			a = c.areas || {},
			kinds = [
				["das", "dasR", "dasC"],
				["edas", "edasR", "edasC"],
				["remote", "remoteR", "remoteC"],
			];
		for (const [generic, r, b] of kinds) {
			const inRaw = original.has(generic);
			const child = a[generic] > 0 || a[r] > 0 || a[b] > 0;
			if (a[r] > 0 && a[b] > 0)
				throw Error("子单账单同项同时存在商业和住宅偏远费，需核实");
			if (child && !inRaw) {
				if (!eco && ((a[r] > 0 && !resi) || (a[b] > 0 && resi)))
					throw Error("子单偏远费商业/住宅类型与订单不一致，需核实");
				out.add(generic);
			}
		}
		const all = new Set([...original, ...out]);
		if (all.size > 1)
			throw Error("原始/子单偏远类型冲突（DAS/EDAS/Remote），需核对后出账");
		if (eco && all.has("remote"))
			throw Error("Ground Economy报价没有Remote偏远费项目");
		return { types: all, added: [...out] };
	}
	function finalize(result, index) {
		const hs = [
			"子单账单来源",
			"子单匹配状态",
			"子单住宅费原金额USD",
			"住宅费判定来源",
			"是否由子单补收住宅费",
			"子单分区代码",
			"分区计费来源",
			"GTS件数",
			"多件判定",
			"子单偏远费证据",
			"子单补入偏远类型",
			"保护前计价重量LB",
		];
		result.headers = [...result.headers, ...hs];
		if (result.top) result.top.push(...hs.map(() => null));
		for (const r of result.rows) {
			const c = r.childResidential || {};
			r.data.push(
				c.source || "",
				c.status || "",
				c.matched ? c.amount : null,
				c.decision || "",
				c.added ? "是" : "否",
				c.zone ?? "",
				r.zoneSource || "",
				r.gtsPieces ?? null,
				r.gtsPieces > 1
					? "一票多件（GTS）"
					: r.gtsPieces === 1
						? "单件（GTS）"
						: "",
				JSON.stringify(c.areas || {}),
				(r.areaAdded || []).join("/"),
				r.ratingOriginalWeight ?? r.billed ?? null,
			);
		}
		result.summary.childMatched = result.rows.filter(
			(r) => r.childResidential?.matched,
		).length;
		result.summary.childAdded = result.rows.filter(
			(r) => r.childResidential?.added,
		).length;
		result.childInvoice = { source: index.source, rows: index.count };
		return result;
	}
	function rawName(wb) {
		return (
			wb.SheetNames.find((n) => n.trim() === "原始") ||
			wb.SheetNames.find((n) => /^原始/.test(n.trim())) ||
			wb.SheetNames[0]
		);
	}
	root.ShipGridChildInvoice = {
		select,
		describe,
		build,
		evidence,
		finalize,
		rawName,
		zoneFor,
		pieces,
		areas,
	};
})(globalThis);
