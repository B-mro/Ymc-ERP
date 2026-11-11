/*SG-AUDIT:finance-17.js*/ const FedExApp = ShipGridModule.createApp({
	setup() {
		const files = Vue.reactive({
				invoice: null,
				gts: null,
				child: null,
				quote: null,
				override: null,
			}),
			result = Vue.shallowRef(null),
			busy = Vue.ref(false),
			error = Vue.ref(""),
			search = Vue.ref(""),
			customer = Vue.ref("all"),
			page = Vue.ref(1),
			showAll = Vue.ref(false),
			fuelMessage = Vue.ref(""),
			fuelRefreshing = Vue.ref(false);
		const slots = [
			{
				key: "invoice",
				title: "FedEx原始账单",
				hint: "可包含原始账单及GTS工作表，附加费按中文名称固定列示",
			},
			{
				key: "gts",
				title: "GTS系统数据（可选）",
				hint: "账单文件已有GTS时无需上传；重量KG，尺寸CM",
			},
			{
				key: "child",
				title: "子单账单",
				hint: "原始或GTS文件已有子单账单时自动读取；提供分区代码及住宅、偏远/超偏远收费依据",
			},
			{
				key: "override",
				title: "重量／分区覆盖表（可选）",
				hint: "客户ID＋文本运单号匹配；计费重量、重量单位LB/KG、分区可分别填写；支持Excel/CSV",
			},
			{
				key: "quote",
				title: "客户报价Excel",
				hint: "上传完整报价，如FEDEX 2026B.xlsx",
			},
		];
		const settings = Vue.reactive({ originalFuelFactor: 0.7 });
		const processing = Vue.ref("");
		const ready = Vue.computed(
			() =>
				!!files.invoice &&
				pricing.pricingReady(files.quote) &&
				(!!files.gts ||
					files.invoice.wb.SheetNames.some(
						(n) => n.trim().toUpperCase() === "GTS",
					)),
		);
		Vue.watch(settings, clear, { deep: true });
		function clear() {
			result.value = null;
			error.value = "";
			page.value = 1;
		}
		const pricing = ShipGridQuoteManager.use("fedex", clear);
		window.addEventListener("fedex-fuel-updated", clear);
		async function upload(file, key) {
			if (!file || busy.value) return;
			clear();
			files[key] = null;
			processing.value = "正在读取" + file.name + "…";
			await new Promise((r) => setTimeout(r, 30));
			try {
				if (!/\.(xlsx|xls|csv)$/i.test(file.name))
					throw Error("请选择Excel文件");
				if (file.size > 200 * 1024 * 1024) throw Error("文件不能超过200MB");
				files[key] = {
					name: file.name,
					wb: Vue.markRaw(
						XLSX.read(await file.arrayBuffer(), {
							type: "array",
							cellDates: false,
							dense: true,
							raw: key === "override",
						}),
					),
				};
			} catch (e) {
				error.value = "读取失败：" + e.message;
			} finally {
				processing.value = "";
			}
		}
		async function refreshFuel() {
			fuelRefreshing.value = true;
			try {
				if (location.protocol === "file:")
					throw Error(
						"单文件使用内置历史费率；联网更新需运行源码包中的fuel_server.py或对接公司后端",
					);
				const response = await fetch("/api/fedex/surcharge/weekly", {
					method: "GET",
				});
				const raw = await response.json();
				if (!response.ok) throw Error(raw.msg || raw.error || "官网更新失败");
				const data = raw.data;
				if (
					!Array.isArray(data.rates) ||
					!data.rates.length ||
					data.source !==
						"https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html"
				)
					throw Error("官方数据校验失败");
				globalThis.FedExFuel = data;
				window.dispatchEvent(new Event("fedex-fuel-updated"));
				fuelMessage.value = "FedEx官网历史费率已更新，请重新计算";
			} catch (e) {
				fuelMessage.value = e.message;
			} finally {
				fuelRefreshing.value = false;
			}
		}
		async function run() {
			busy.value = true;
			clear();
			try {
				await new Promise((r) => setTimeout(r, 30));
				if (
					!Number.isFinite(Number(settings.originalFuelFactor)) ||
					settings.originalFuelFactor <= 0 ||
					settings.originalFuelFactor > 1
				)
					throw Error("原始账户燃油支付比例须在0–1之间");
				const gtsSource = files.gts?.wb || files.invoice.wb;
				const gtsName =
					gtsSource.SheetNames.find((n) => n.trim().toUpperCase() === "GTS") ||
					(files.gts ? gtsSource.SheetNames[0] : null);
				if (!gtsName) throw Error("账单文件没有GTS工作表，请单独上传GTS数据");
				const gtsInput = {
					SheetNames: ["GTS"],
					Sheets: { GTS: gtsSource.Sheets[gtsName] },
				};
				const selection = await pricing.preparePricing(files.quote);
				result.value = FedExBilling.calculate(
					files.invoice.wb,
					gtsInput,
					selection.value,
					{
						...settings,
						childInvoice: ShipGridChildInvoice.select(files),
						overrideWb: files.override?.wb,
						overrideName: files.override?.name,
					},
				);
				result.value.quoteName = selection.name;
				customer.value = "all";
				search.value = "";
				page.value = 1;
			} catch (e) {
				error.value = e.message;
			} finally {
				busy.value = false;
			}
		}
		const filtered = Vue.computed(() => {
			if (!result.value) return [];
			return result.value.rows.filter(
				(r) =>
					(customer.value === "all" || r.customerId === customer.value) &&
					[r.tracking, r.order].some((x) =>
						String(x ?? "")
							.toLowerCase()
							.includes(search.value.toLowerCase()),
					),
			);
		});
		const pages = Vue.computed(() =>
				Math.max(1, Math.ceil(filtered.value.length / 20)),
			),
			visible = Vue.computed(() =>
				filtered.value.slice((page.value - 1) * 20, page.value * 20),
			);
		Vue.watch([customer, search], () => (page.value = 1));
		const columns = Vue.computed(() => {
			if (!result.value) return [];
			const hs = result.value.headers;
			const keys = [
				"客户ID",
				"客户名称",
				"采用报价表",
				"Express or Ground Tracking ID",
				"Service Type",
				"Actual Weight Amount",
				"Rated Weight Amount",
				"Dim Length",
				"Dim Width",
				"Dim Height",
				"尺寸来源",
				"实重来源",
				"已有计费重来源",
				"Zone Code",
				"Transportation Charge Amount",
				...(result.value?.feeColumns ||
					hs.filter((h) => h.startsWith("费用："))),
				"Net Charge Amount",
				"取值来源",
				"警示",
			];
			return showAll.value
				? hs.map((h, i) => ({
						h: result.value.feeColumns?.includes(h)
							? result.value.top[i] || h
							: h,
						i,
					}))
				: keys
						.map((k) => {
							const i = hs.findIndex((h) => String(h ?? "").trim() === k);
							return {
								h: result.value.feeColumns?.includes(k)
									? result.value.top[i] || k
									: k,
								i,
							};
						})
						.filter((x) => x.i >= 0);
		});
		const selectionTotal = Vue.computed(
			() =>
				Math.round(filtered.value.reduce((s, r) => s + r.total, 0) * 100) / 100,
		);
		async function download() {
			if (!result.value) return;
			busy.value = true;
			try {
				const bytes = FedExBilling.bytes(result.value, customer.value);
				const blob = new Blob([bytes], {
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}),
					a = document.createElement("a"),
					url = URL.createObjectURL(blob);
				a.href = url;
				a.download =
					"FedEx_客户账单_" +
					(customer.value === "all" ? "全部客户" : customer.value) +
					"_V3_59" +
					"（" +
					String(files.invoice?.name || "原始数据").replace(/\.xlsx?$/i, "") +
					"）.xlsx";
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			} catch (e) {
				error.value = "导出失败：" + e.message;
			} finally {
				busy.value = false;
			}
		}
		function removeOverride() {
			files.override = null;
			clear();
		}
		function overrideTemplate() {
			const csv = "\uFEFF承运商,客户ID,运单号,计费重量,重量单位,分区,备注\r\n";
			const url = URL.createObjectURL(
					new Blob([csv], { type: "text/csv;charset=utf-8" }),
				),
				a = document.createElement("a");
			a.href = url;
			a.download = "FedEx_重量分区覆盖模板.csv";
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
		const childStatus = Vue.computed(() =>
			ShipGridChildInvoice.describe(files),
		);
		function removeChild() {
			files.child = null;
			clear();
		}
		return {
			...pricing,
			removeOverride,
			overrideTemplate,
			childStatus,
			removeChild,
			processing,
			fuelMessage,
			fuelRefreshing,
			refreshFuel,
			settings,
			slots,
			files,
			result,
			busy,
			error,
			search,
			customer,
			page,
			pages,
			visible,
			filtered,
			ready,
			run,
			download,
			columns,
			showAll,
			selectionTotal,
			money: (v) =>
				Number(v).toLocaleString("en-US", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}),
			input: (e, k) => upload(e.target.files[0], k),
			drop: (e, k) => upload(e.dataTransfer.files[0], k),
			display: (v) =>
				typeof v === "number"
					? Number.isInteger(v)
						? String(v)
						: String(+v.toFixed(6))
					: String(v ?? ""),
		};
	},
}).mount("#fedex-app");
