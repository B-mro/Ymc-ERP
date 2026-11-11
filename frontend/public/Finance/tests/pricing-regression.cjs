const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const ctx = {
	console,
	TextEncoder,
	TextDecoder,
	setTimeout,
	clearTimeout,
	Uint8Array,
	ArrayBuffer,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const path = require("path"),
	root = path.resolve(__dirname, "..");
for (const name of [
	"shared/billing-weight-policy.js",
	"vendor/xlsx.full.min.js",
	"shared/child-invoice.js",
	"shared/fedex-customer-policy.js",
	"data/fedex-fuel.js",
	"shared/fedex-overrides.js",
	"engine/fedex-billing.js",
])
	vm.runInContext(
		fs.readFileSync(path.join(root, "modules/fedex-billing", name), "utf8"),
		ctx,
	);
const X = ctx.XLSX,
	wb = (name, data) => ({
		SheetNames: [name],
		Sheets: { [name]: X.utils.aoa_to_sheet(data) },
	});
const base = {};
for (let w = 1; w <= 150; w++)
	for (let z = 2; z <= 8; z++) base[w + "|" + z] = w + z / 100;
base["58|8"] = 21.09;
base["60|8"] = 22.44;
const tariff = {
	ngbase: base,
	spbase: base,
	dim: 139,
	factor: 0.7,
	resi: 4,
	dasR: 5,
	dasC: 4,
	edasR: 8,
	edasC: 7,
	remoteR: 12,
	remoteC: 11,
	ahsD: [2, 2, 2, 2],
	ahsW: [3, 3, 3, 3],
	ahsP: [2, 2, 2, 2],
	os: [20, 20, 20, 20],
	demand: [],
	resiDemand: [],
	sp: { dim: 139, fuel: 0.7, das: 3, edas: 5, demand: [] },
};
ctx.ShipGridStandardQuotes = { is: () => true, parse: () => tariff };
const rawHead = [
	"Payer",
	"Express or Ground Tracking ID",
	"Service Type",
	"Number of Pieces",
	"Net Charge Amount",
	"Transportation Charge Amount",
	"Actual Weight Units",
	"Rated Weight Units",
	"Dim Unit",
	"Actual Weight Amount",
	"Rated Weight Amount",
	"Dim Length",
	"Dim Width",
	"Dim Height",
	"Zone Code",
	"Tendered Date",
	"Shipment Date",
];
for (let i = 0; i < 10; i++)
	rawHead.push("Tracking ID Charge Description", "Tracking ID Charge Amount");
const fueldate = ctx.FedExFuel.rates[0].start;
function run({
	pieces = 1,
	zone = 8,
	fee = 0,
	rawFee = null,
	duplicate = false,
	rawPieces = 1,
	original = 22.44,
} = {}) {
	const row = [
		"A",
		"T1",
		"Ground",
		rawPieces,
		original + (rawFee ? 7 : 0),
		original,
		"lbs",
		"lbs",
		"I",
		58,
		58,
		10,
		10,
		10,
		4,
		fueldate,
		fueldate,
	];
	for (let i = 0; i < 10; i++)
		row.push(i === 0 && rawFee ? rawFee : null, i === 0 && rawFee ? 7 : null);
	const g = wb("GTS", [
		[
			"订单ID",
			"订单号",
			"客户ID",
			"转单号",
			"件数",
			"分区",
			"下单实重",
			"重量单位",
			"下单长",
			"下单宽",
			"下单高",
			"尺寸单位",
		],
		["G1", "O1", "C1", "T1", pieces, "", 58, "lb", 10, 10, 10, "in"],
	]);
	const child = wb("子单账单", [
		["运单号", "分区代码", "超偏远费"],
		["T1", zone, fee],
		...(duplicate ? [["T1", zone, fee]] : []),
	]);
	return ctx.FedExBilling.calculate(
		wb("原始", [rawHead, row]),
		g,
		{},
		{
			originalFuelFactor: 0.7,
			childInvoice: { wb: child, name: "子单账单", source: "child" },
		},
	);
}
let n = 0;
function test(name, f) {
	f();
	n++;
	console.log("PASS", name);
}
test("child zone wins, GTS blank, raw zone differs; higher Excel price retains corresponding 60LB", () => {
	const r = run();
	assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
	const a = r.rows[0];
	assert.equal(a.zone, 8);
	assert.equal(a.billed, 60);
	assert.equal(a.base, 22.44);
	assert.equal(a.actual, 58);
	assert.equal(a.ratingOriginalWeight, 58);
	assert.equal(a.data[r.headers.indexOf("Rated Weight Amount")], 60);
});
test("child-only EDAS uses customer rate and fuel", () => {
	let a = run({ fee: 99 }).rows[0];
	assert.equal(a.fees["DAS Extended Commercial"], 7);
	assert.deepEqual(Array.from(a.areaAdded), ["edas"]);
	let b = run().rows[0];
	assert(a.fuel > b.fuel);
});
test("same EDAS both sources not doubled", () => {
	const a = run({ fee: 99, rawFee: "DAS Extended Commercial" }).rows[0];
	assert.equal(a.fees["DAS Extended Commercial"], 7);
	assert.equal(a.areaAdded.length, 0);
});
test("DAS vs EDAS conflict held", () =>
	assert.match(
		run({ fee: 1, rawFee: "DAS Commercial" }).errors[0].reason,
		/类型冲突/,
	));
test("missing child zone held", () =>
	assert.match(run({ zone: "" }).errors[0].reason, /分区代码缺失/));
test("duplicate child match held", () =>
	assert.match(run({ duplicate: true }).errors[0].reason, /匹配重复/));
test("GTS multiple recognized despite carrier pieces1", () =>
	assert.match(run({ pieces: 3 }).errors[0].reason, /一票多件（3件）/));
test("carrier pieces does not override GTS determination", () =>
	assert.equal(run({ rawPieces: 2 }).rows.length, 1));
test("price ambiguity held", () => {
	base["61|8"] = 22.44;
	assert.match(run().errors[0].reason, /匹配多个重量/);
	delete base["61|8"];
});
test("unmatched retained price held", () =>
	assert.match(run({ original: 22.45 }).errors[0].reason, /没有匹配重量/));
test("exact original measurement remains intact", () => {
	const a = run().rows[0],
		r = run();
	assert.equal(a.data[r.headers.indexOf("原始计费重量LB")], 58);
	assert.equal(a.data[r.headers.indexOf("原始分区")], 4);
});
test("actual xlsx export roundtrip", () => {
	const r = run({ fee: 99 }),
		b = ctx.FedExBilling.bytes(r),
		w = X.read(b, { type: "array" });
	assert(w.SheetNames.includes("异常清单"));
	const rows = X.utils.sheet_to_json(w.Sheets["FedEx客户账单"], { header: 1 });
	assert.equal(rows[2][rows[1].indexOf("Rated Weight Amount")], 60);
});
for (const name of [
	"data/ontrac-default-rates.js",
	"data/ontrac-fuel.js",
	"engine/ontrac-cost.js",
	"engine/ontrac-billing.js",
])
	vm.runInContext(
		fs.readFileSync(path.join(root, "modules/ontrac-billing", name), "utf8"),
		ctx,
	);
vm.runInContext(
	fs.readFileSync(
		path.join(root, "modules/ups-billing/engine/ups-billing.js"),
		"utf8",
	),
	ctx,
);
const t = {
	base,
	factor: 0.7,
	dim: 139,
	resi: 4,
	das: 4,
	edas: 7,
	ahs: [3, 3, 3, 3],
	os: [20, 20, 20, 20],
	demand: { start: "2000-01-01", end: "2000-01-02", ahs: 0, os: 0 },
	resiDemand: { start: "2000-01-01", end: "2000-01-02", fee: 0 },
};
const gh = [
		"订单ID",
		"订单号",
		"客户ID",
		"转单号",
		"件数",
		"分区",
		"下单实重",
		"重量单位",
		"下单长",
		"下单宽",
		"下单高",
		"尺寸单位",
	],
	gr = ["G1", "O1", "C1", "T1", 1, "", 58, "lb", 10, 10, 10, "in"];
const child = wb("子单账单", [
		["运单号", "分区代码", "超偏远费"],
		["T1", 8, 99],
	]),
	childSpec = { wb: child, name: "子单账单", source: "child" };
test("OnTrac integration price tuple, child zone and EDAS, preserved raw input", () => {
	ctx.ShipGridStandardQuotes.parse = () => t;
	const raw = {
		"Waybill#/tracking#": "T1",
		Weight: 58,
		"Cust Lbs": 58,
		DIML: 10,
		DIMW: 10,
		DIMH: 10,
		Zone: 4,
		ServiceCharge: 22.44,
		"Fuel Surcharge": 0,
		TotalCharge: 22.44,
		"Ship date": ctx.ShipGridFuelRates.rates[0].start,
	};
	const w = wb("原始", [Object.keys(raw), Object.values(raw)]);
	w.SheetNames.push("GTS");
	w.Sheets.GTS = X.utils.aoa_to_sheet([gh, gr]);
	const before = JSON.stringify(w);
	const r = ctx.OnTracBilling.calculate(w, {}, { childInvoice: childSpec });
	assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
	assert.equal(r.rows[0].billed, 60);
	assert.equal(r.rows[0].zone, 8);
	assert.equal(r.rows[0].base, 22.44);
	assert.equal(r.rows[0].data[r.headers.indexOf("Extended Area Fee")], 7);
	assert.equal(JSON.stringify(w), before);
});
test("UPS generator integration child-only EDAS + same zone and price tuple", () => {
	const tu = { base, factor: 0.6, dim: 139, demand: [], resiDemand: [] };
	for (const k of [
		"resi",
		"dasR",
		"dasC",
		"edasR",
		"edasC",
		"remoteR",
		"remoteC",
		"ahsD",
		"ahsW",
		"ahsP",
		"os",
	])
		tu[k] = [7, 7, 7, 7];
	ctx.ShipGridStandardQuotes.parse = () => ({ comm: tu, resi: tu });
	ctx.UPSInvoiceFuel = { lookup: () => ({ rate: 0.2 }), eligible: () => true };
	const raw = {
		"Tracking Number": "T1",
		"Net Amount": 22.44,
		"Charge Category Code": "SHP",
		"Charge Classification Code": "FRT",
		"Charge Description": "Ground Commercial",
		"Account Number": "A1",
		"Invoice Number": "I1",
		"Transaction Date": "2026-10-01",
		"Shipment Date": "2026-10-01",
		"Transaction Currency Code": "USD",
		"Package Dimensions": "10x10x10",
		"Package Dimension Unit Of Measure": "I",
		"Entered Weight": 58,
		"Entered Weight Unit of Measure": "L",
		"Billed Weight": 58,
		"Billed Weight Unit of Measure": "L",
		Zone: 4,
	};
	const r = ctx.UPSBilling.calculate(
		wb("原始", [Object.keys(raw), Object.values(raw)]),
		wb("GTS", [gh, gr]),
		{},
		{ childInvoice: childSpec },
	);
	assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
	assert.equal(r.rows[0].zone, 8);
	assert.equal(r.rows[0].billed, 60);
	assert.equal(r.rows[0].base, 22.44);
	assert.equal(r.rows[0].fees["Delivery Area Surcharge - Extended"], 7);
});
console.log("FINAL TOTAL", n);
