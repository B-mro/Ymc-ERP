/*SG-AUDIT:fedex-overrides.js*/ (function (root) {
	"use strict";
	const text = (v) => String(v ?? "").trim(),
		blank = (v) => v === null || v === undefined || text(v) === "";
	function parse(wb) {
		const map = new Map();
		if (!wb) return map;
		const rows = root.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
			defval: "",
			raw: true,
		});
		if (!rows.length) throw Error("覆盖表为空");
		for (const [i, r] of rows.entries()) {
			const line = i + 2;
			if (!Object.values(r).some((v) => !blank(v))) continue;
			const customer = text(r["客户ID"]),
				track = text(r["运单号"]);
			if (!customer || !track)
				throw Error(
					"覆盖表第" + line + "行缺少客户ID或运单号；运单号请按文本保存",
				);
			if (typeof r["运单号"] !== "string")
				throw Error(
					"覆盖表运单号必须为文本，避免长数字精度丢失（第" + line + "行）",
				);
			const carrier = text(r["承运商"]);
			if (carrier && carrier.toLowerCase() !== "fedex")
				throw Error("覆盖表只允许FedEx（第" + line + "行）");
			let weight = null,
				zone = null;
			const rawWeight = r["计费重量"];
			if (!blank(rawWeight)) {
				const value = Number(rawWeight),
					unit = text(r["重量单位"]).toUpperCase();
				if (
					!Number.isFinite(value) ||
					value <= 0 ||
					!["LB", "KG"].includes(unit)
				)
					throw Error("覆盖表重量须大于0，单位填LB或KG（第" + line + "行）");
				weight =
					Math.round(value * (unit === "KG" ? 2.2046226218487757 : 1) * 100) /
					100;
				if (weight <= 0 || weight > 150)
					throw Error("覆盖表重量须在0–150LB内（第" + line + "行）");
			}
			if (!blank(r["分区"])) {
				zone = Number(r["分区"]);
				if (!Number.isInteger(zone) || zone < 2 || zone > 8)
					throw Error("覆盖表分区须为2–8整数（第" + line + "行）");
			}
			if (weight === null && zone === null)
				throw Error("覆盖表须至少填写重量或分区（第" + line + "行）");
			const key = JSON.stringify([customer, track]);
			if (map.has(key))
				throw Error(
					"覆盖表客户ID＋运单号重复（第" + line + "行），请去重后上传",
				);
			map.set(key, {
				weight,
				zone,
				line,
				note: text(r["备注"]),
				rawWeight,
				unit: text(r["重量单位"]),
				customer,
				track,
				used: false,
			});
		}
		return map;
	}
	function match(map, customer, track) {
		const v = map.get(JSON.stringify([text(customer), text(track)]));
		if (v) v.used = true;
		return v;
	}
	root.ShipGridFedExOverrides = { parse, match };
})(globalThis);
