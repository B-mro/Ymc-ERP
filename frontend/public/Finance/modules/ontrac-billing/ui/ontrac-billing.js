/**
 * OnTrac 账单 UI 层。
 * 与 FedEx/UPS 的 UI 层职责一致：
 *   - 上传账单、报价、GTS、燃油、覆盖表
 *   - 管理模块级运行时状态（module-runtime）
 *   - 调用核心引擎执行 A/B 方案测算
 *   - 分页浏览结果、下载多 Sheet Excel
 *
 * 相比 FedEx UI 层，OnTrac 专属差异：
 *   - 分区来源不是 GTS zone，而是账单自带 zone 字段或 overrides
 *   - 附加费类型（residential / rural / oversized / handling / peak）与 FedEx 略有区别
 */
import { reactive, computed, toRefs, watch } from "vue";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import * as engine from "../engine/ontrac-billing.js";
import { createModuleRuntime } from "../shared/module-runtime.js";
import { defaultPeak } from "../data/peak-defaults.js";
import { fuelRates as ontracFuelDefault } from "../data/ontrac-fuel.js";

/** 解析任意 Excel 文件成 JSON 行数组 */
function parseWorkbook(file) {
	return new Promise((resolve, reject) => {
		if (!file) return resolve([]);
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = new Uint8Array(e.target.result);
				const wb = XLSX.read(data, { type: "array" });
				const rows = [];
				for (const sheetName of wb.SheetNames) {
					rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[sheetName]));
				}
				resolve(rows);
			} catch (err) {
				reject(err);
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

/** 模块级 reactive 状态初始化 */
function initState() {
	return {
		runtime: createModuleRuntime({ moduleId: "ontrac-billing" }),
		billFile: null,
		quoteFile: null,
		gtsFile: null,
		fuelFile: null,
		overridesFile: null,
		defaultRatesFile: null,

		billRows: [],
		quoteRows: [],
		gtsMap: null,
		overrides: [],
		defaultRates: null,

		policy: {
			flatFee: 0,
			percentFee: 0,
			dimDivisor: 139,
			weightSource: "raw",
			precision: 1,
			defaultZone: 0,
		},
		fuelPercent: 0,
		results: [],
		totals: null,
		loading: false,
		error: null,

		page: 1,
		pageSize: 50,
	};
}

/** 将 GTS 文件行按 trackingNo 建立 Map 以便快速匹配 */
function buildGtsMap(rows) {
	const map = new Map();
	for (const row of rows) {
		const t = String(
			row.trackingNo || row.TrackingNo || row.TrackingNumber || "",
		).trim();
		if (t) map.set(t, row);
	}
	return map;
}

/** 从覆盖表文件行中解析 overrides 列表 */
function buildOverrides(rows) {
	return rows
		.map((r) => ({
			customerId: String(
				r.customerId ?? r.CustomerID ?? r.CustomerId ?? r.Account ?? "",
			).trim(),
			trackingNo: String(
				r.trackingNo ?? r.TrackingNo ?? r.Tracking ?? "",
			).trim(),
			zone: r.zone ?? r.Zone,
			weight: r.weight ?? r.Weight,
			service: r.service ?? r.Service ?? r.mode ?? r.Mode ?? "",
		}))
		.filter((o) => o.customerId && o.trackingNo);
}

/** 匹配优先级：先按 customerId + trackingNo，再按 trackingNo 单键 */
function findOverride(overrides, row) {
	const trackingNo = String(
		row.trackingNo || row.TrackingNo || row.Tracking || "",
	).trim();
	const customerId = String(
		row.customerId || row.CustomerID || row.CustomerId || row.Account || "",
	).trim();
	if (!trackingNo) return null;
	const exact = overrides.find(
		(o) => o.customerId === customerId && o.trackingNo === trackingNo,
	);
	if (exact) return exact;
	return overrides.find((o) => o.trackingNo === trackingNo) || null;
}

/** 将默认费率表（DefaultRates.xlsx）按 service → zone 展开 */
function buildDefaultRates(rows) {
	const table = {};
	for (const row of rows) {
		const svc = (row.service || row.Service || row.mode || "Ground")
			.toString()
			.trim();
		if (!table[svc]) table[svc] = {};
		for (const key of Object.keys(row)) {
			if (/zone/i.test(key)) {
				const zoneNum = Number(String(key).replace(/[^\d]/g, ""));
				if (Number.isFinite(zoneNum)) {
					table[svc][zoneNum] = Number(row[key]) || 0;
				}
			}
		}
	}
	return table;
}

/** 创建并返回 OnTrac 账单模块的 Vue 3 组合式 API 模块对象 */
export function createOnTracBilling() {
	const state = reactive(initState());

	const totalPages = computed(() =>
		Math.max(1, Math.ceil(state.results.length / state.pageSize)),
	);
	const pagedResults = computed(() => {
		const start = (state.page - 1) * state.pageSize;
		return state.results.slice(start, start + state.pageSize);
	});

	watch(
		() => state.results.length,
		() => {
			state.page = 1;
		},
	);

	/** 上传账单文件，解析为 JSON 行 */
	async function onBillUpload(file) {
		state.billFile = file;
		state.billRows = await parseWorkbook(file);
	}

	/** 上传报价文件 */
	async function onQuoteUpload(file) {
		state.quoteFile = file;
		state.quoteRows = await parseWorkbook(file);
	}

	/** 上传 GTS 尺寸重量文件 */
	async function onGtsUpload(file) {
		state.gtsFile = file;
		const rows = await parseWorkbook(file);
		state.gtsMap = buildGtsMap(rows);
	}

	/** 上传燃油费率文件 */
	async function onFuelUpload(file) {
		state.fuelFile = file;
		const rows = await parseWorkbook(file);
		if (rows.length > 0) {
			state.fuelPercent =
				Number(
					rows[0].fuelPercent ?? rows[0].FuelPercent ?? rows[0].fuel ?? 0,
				) || 0;
		}
	}

	/** 上传逐单覆盖表 */
	async function onOverridesUpload(file) {
		state.overridesFile = file;
		const rows = await parseWorkbook(file);
		state.overrides = buildOverrides(rows);
	}

	/** 上传默认费率表（DefaultRates.xlsx） */
	async function onDefaultRatesUpload(file) {
		state.defaultRatesFile = file;
		const rows = await parseWorkbook(file);
		state.defaultRates = buildDefaultRates(rows);
	}

	/** 一键应用默认燃油率（ontrac-fuel.js 缓存） */
	function applyDefaultFuel() {
		const pct = Number(
			ontracFuelDefault?.Ground ?? ontracFuelDefault?.ground ?? 0,
		);
		state.fuelPercent = pct;
	}

	/** 主计算入口：调用引擎 calculate，附加 overrides 匹配和 fuel/surcharge/peak */
	async function run() {
		if (!state.billRows.length) {
			state.error = "请先上传 OnTrac 账单文件";
			return;
		}
		state.loading = true;
		state.error = null;
		try {
			const opts = {
				policy: { ...state.policy },
				gtsMap: state.gtsMap,
				overrides: state.overrides,
				defaultZone: state.policy.defaultZone || 0,
				fuelTable: { Ground: state.fuelPercent },
				surchargeTable: null,
				peakTable: defaultPeak.ontrac || null,
				defaultRates: state.defaultRates,
			};
			const result = await engine.calculate(
				state.billRows,
				state.quoteFile,
				opts,
			);
			state.results = result.results;
			state.totals = result.totals;
		} catch (err) {
			state.error = err?.message || String(err);
		} finally {
			state.loading = false;
		}
	}

	/** 下载完整 A/B 方案 Excel 工作簿 */
	function download() {
		if (!state.results.length) return;
		const wb = engine.workbook(state.results, state.totals || {}, {});
		const buf = engine.bytes(wb);
		const blob = new Blob([buf], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});
		saveAs(
			blob,
			`ontrac-billing-${new Date().toISOString().slice(0, 10)}.xlsx`,
		);
	}

	/** 重置所有状态字段 */
	function reset() {
		Object.assign(state, initState());
	}

	return {
		...toRefs(state),
		totalPages,
		pagedResults,
		onBillUpload,
		onQuoteUpload,
		onGtsUpload,
		onFuelUpload,
		onOverridesUpload,
		onDefaultRatesUpload,
		applyDefaultFuel,
		run,
		download,
		reset,
	};
}
