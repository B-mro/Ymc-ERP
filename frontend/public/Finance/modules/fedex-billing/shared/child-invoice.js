/**
 * child-invoice.js — 子单账单自动识别与多维度匹配
 * =====================================================
 * 职责：
 *   1. 从原始账单/GTS/独立文件中自动识别"子单账单"工作表
 *   2. 多维度匹配（运单号 → 转单号别名 → 订单号 → 客户单号）
 *   3. 提取住宅费、偏远费（DAS/EDAS/Remote）、分区代码证据
 *   4. 为最终输出表追加子单相关字段
 *
 * 背景：FedEx SmartPost/UPS Ground Economy 等服务由子承包商（如 USPS）
 *   完成末端派送，原始 GTS 订单不含子单的住宅费/偏远费/分区信息。
 *   子单账单模块负责从单独上传的子承包商账单中补全这些信息。
 *
 * 被谁依赖：fedex-billing.js（FedEx SmartPost 场景）、ups-billing.js（UPS Ground Economy）
 *
 * 对外接口：ShipGridChildInvoice = { select, describe, build, evidence, zoneFor, pieces, areas, finalize, rawName }
 */
(function (root) {
	("use strict");

	/** 标准化：去空格 + 小写，用于模糊匹配表头 */
	const norm = (v) =>
			String(v ?? "")
				.trim()
				.replace(/\s+/g, "")
				.toLowerCase(),
		/** 标准化：去空格 + 大写，用于运单号等精确匹配 */
		id = (v) =>
			String(v ?? "")
				.trim()
				.toUpperCase();

	/** 运单号字段可能的中英文表头名称 */
	const trackingNames = [
		"运单号",
		"物流单号",
		"Waybill#/tracking#",
		"Express or Ground Tracking ID",
		"Tracking Number",
		"转单号",
		"子单号",
	];

	/** 住宅费字段可能的中英文表头名称 */
	const feeNames = [
		"住宅地址附加费",
		"住宅附加费",
		"住宅费",
		"Residential Fee",
		"Residential Delivery",
		"Residential Surcharge",
	];

	const zoneNames = ["分区代码", "Zone Code"],
		/** 偏远费分类：generic(通用)/R(住宅)/C(商业) 三类 */
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

	/** 判断工作表名是否包含"子单账单"特征 */
	const named = (n) => /子单.*账单|child[ _-]*(invoice|bill)/i.test(n);

	/** 用 XLSX 把工作表转为二维数组（header:1, raw:true） */
	function matrix(wb, name) {
		return XLSX.utils.sheet_to_json(wb.Sheets[name], {
			header: 1,
			raw: true,
			defval: null,
			range: 0,
		});
	}

	/**
	 * layout — 自动探测子单账单工作表的表头结构
	 * 在前 20 行中寻找同时具备"至少一种费用/分区列"和"至少一种标识列（运单号/订单号/客户单号）"的行
	 * @param {object} wb — XLSX workbook
	 * @param {string} name — 工作表名
	 * @returns {object|null} 解析出的列索引映射，null 表示不是子单账单表
	 */
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

	/**
	 * select — 从多个上传文件中选出子单账单工作表
	 * 优先顺序：原始账单内嵌 → GTS 内嵌 → 独立上传文件
	 * @param {object} files — { invoice, gts, child } 各文件对象
	 * @returns {{wb, name, source, embedded}|null} 选中的工作表信息
	 */
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
	/**
	 * describe — 生成子单账单识别结果的人类可读描述
	 * @param {object} files — 同 select 的参数
	 * @returns {string} 描述文本，用于前端提示
	 */
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

	/**
	 * build — 把子单账单工作表解析为可查询的多维度索引
	 * @param {{wb, name, source, embedded}|null} spec — select() 返回值，null 表示无文件
	 * @returns {{
	 *   match(tracking, g), count, source
	 * }}
	 *   - match: 多维度匹配函数（见下）
	 *   - count: 子单账单总行数
	 *   - source: 文件来源字符串
	 *
	 * match(tracking, g) 匹配优先级：
	 *   1. 运单号精确匹配（含 96 开头 20 位长号 → 后 12 位别名）
	 *   2. 转单号/主单号/子单号别名匹配
	 *   3. GTS 系统订单号匹配
	 *   4. 客户单号匹配
	 *
	 * 返回值含：matched, amount(住宅费), zone, areas(各类偏远费金额), status, source
	 */
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
	/**
	 * evidence — 综合原始订单与子单账单的住宅费证据
	 * @param {object} index     — build() 返回的 match 索引
	 * @param {string} tracking  — 运单号
	 * @param {object} g         — GTS 订单行
	 * @param {boolean} original — GTS 原始订单是否已含住宅标记
	 * @returns {object} 住宅费决策：matched, amount, original, added(是否由子单补收), decision
	 */
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

	/**
	 * zoneFor — 从子单账单匹配结果提取分区代码（2-8 整数）
	 * 支持格式："Zone 5"、"5"、"05" 等
	 * @param {object} c — match() 返回值
	 * @returns {number} 2-8 的整数分区
	 * @throws 未匹配或分区无效时抛错
	 */
	function zoneFor(c) {
		if (!c.matched) throw Error("子单账单未匹配：无法取得分区代码");
		const m = String(c.zone ?? "")
			.trim()
			.match(/^(?:Zone\s*)?0*([2-8])$/i);
		if (!m) throw Error("子单账单分区代码缺失或无效：" + String(c.zone ?? ""));
		return +m[1];
	}

	/**
	 * pieces — 从 GTS 行提取件数并校验为正整数
	 * @param {object} g — GTS 订单行
	 * @returns {number} 件数
	 */
	function pieces(g) {
		const n = Number(g["件数"]);
		if (!Number.isInteger(n) || n < 1) throw Error("GTS件数缺失或无效");
		return n;
	}

	/**
	 * areas — 综合原始订单与子单账单的偏远费类型判定
	 * @param {object} c         — match() 返回值
	 * @param {Set<string>} original — 原始订单已有的偏远类型集合
	 * @param {boolean} resi     — 订单是否为住宅
	 * @param {boolean} eco      — 是否为 Ground Economy 服务（不支持 Remote）
	 * @returns {{types: Set, added: string[]}} types 为合并后的最终类型，added 为子单新增类型
	 * @throws 商业/住宅偏远费冲突、类型冲突、Remote 在 Economy 场景等抛错
	 */
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
	/**
	 * finalize — 把所有子单相关字段追加到最终结果对象（列头 + 数据行 + 汇总）
	 * @param {object} result — 主引擎已构建的 result 对象
	 * @param {{match, count, source}} index — build() 返回值
	 * @returns {object} 修改后的 result
	 *
	 * 追加的列：子单账单来源、匹配状态、住宅费金额、判定来源、补收标记、
	 *   子单分区代码、分区计费来源、GTS件数、多件判定、偏远费证据、补入类型、保护前重量
	 */
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

	/**
	 * rawName — 从 workbook 中找出"原始"账单工作表名
	 * 查找优先级：精确匹配 "原始" → 以"原始"开头 → 第一个工作表
	 * @param {object} wb — XLSX workbook
	 * @returns {string} 工作表名
	 */
	function rawName(wb) {
		return (
			wb.SheetNames.find((n) => n.trim() === "原始") ||
			wb.SheetNames.find((n) => /^原始/.test(n.trim())) ||
			wb.SheetNames[0]
		);
	}

	/** 对外暴露统一接口 */
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
