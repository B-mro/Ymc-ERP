/*SG-AUDIT:finance-34.js*/ const UPSBillingApp = ShipGridModule.createApp({
	setup() {
		const files = Vue.reactive({
				invoice: null,
				gts: null,
				child: null,
				quote: null,
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
				title: "UPS原始账单",
				hint: "可包含原始账单及GTS工作表，保留原始费用列",
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
				key: "quote",
				title: "客户报价Excel",
				hint: "兼容RATEHF、DKH和UPS标准价表",
			},
		];
		const settings = Vue.reactive({});
		const processing = Vue.ref(""),
			errorPage = Vue.ref(1);
		const visibleErrors = Vue.computed(
				() =>
					result.value?.errors.slice(
						(errorPage.value - 1) * 50,
						errorPage.value * 50,
					) || [],
			),
			errorPages = Vue.computed(() =>
				Math.max(1, Math.ceil((result.value?.errors.length || 0) / 50)),
			);
		const ready = Vue.computed(
			() => !!files.invoice && pricing.pricingReady(files.quote),
		);
		Vue.watch(settings, clear, { deep: true });
		function clear() {
			result.value = null;
			error.value = "";
			page.value = 1;
			errorPage.value = 1;
		}
		const pricing = ShipGridQuoteManager.use("ups", clear);
		window.addEventListener("ups-fuel-updated", clear);
		async function upload(file, key) {
			if (!file || busy.value) return;
			clear();
			files[key] = null;
			busy.value = true;
			processing.value = "正在读取" + file.name + "…";
			await new Promise((r) => setTimeout(r, 30));
			try {
				if (!/\.(xlsx|xls|csv)$/i.test(file.name))
					throw Error("请选择Excel或CSV文件");
				if (file.size > 200 * 1024 * 1024) throw Error("文件不能超过200MB");
				files[key] = {
					name: file.name,
					wb: Vue.markRaw(
						XLSX.read(await file.arrayBuffer(), {
							type: "array",
							cellDates: false,
							dense: true,
							raw: true,
						}),
					),
				};
			} catch (e) {
				error.value = "读取失败：" + e.message;
			} finally {
				processing.value = "";
				busy.value = false;
			}
		}
		async function refreshFuel() {
			fuelRefreshing.value = true;
			try {
				const data = await UPSInvoiceFuel.refresh();
				fuelMessage.value = "UPS官网历史费率已更新，请重新生成";
				clear();
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
				const gtsSource = files.gts?.wb || files.invoice.wb;
				const gtsName =
					gtsSource.SheetNames.find((n) => n.trim().toUpperCase() === "GTS") ||
					(files.gts ? gtsSource.SheetNames[0] : null);
				const gtsInput = gtsName
					? { SheetNames: ["GTS"], Sheets: { GTS: gtsSource.Sheets[gtsName] } }
					: null;
				const selection = await pricing.preparePricing(files.quote);
				result.value = UPSBilling.calculate(
					files.invoice.wb,
					gtsInput,
					selection.value,
					{ childInvoice: ShipGridChildInvoice.select(files) },
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
				"Tracking Number",
				"订单号",
				"原始服务",
				"客户服务",
				"Transaction Date",
				"Zone",
				"Actual Weight LB",
				"Billed Weight LB",
				"Length IN",
				"Width IN",
				"Height IN",
				"尺寸重量来源",
				"Transportation Charge",
				"Residential Surcharge",
				"Delivery Area Surcharge",
				"Additional Handling - Dimension",
				"Additional Handling - Weight",
				"Large Package Surcharge",
				"Fuel Surcharge",
				"Total Charge",
				"警示",
			];
			return showAll.value
				? hs.map((h, i) => ({ h, i }))
				: keys
						.map((k) => ({
							h: k,
							i: hs.findIndex((h) => String(h ?? "").trim() === k),
						}))
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
				const bytes = UPSBilling.bytes(result.value, customer.value);
				const blob = new Blob([bytes], {
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}),
					a = document.createElement("a"),
					url = URL.createObjectURL(blob);
				a.href = url;
				a.download =
					"UPS_客户账单_" +
					(customer.value === "all" ? "全部客户" : customer.value) +
					"_V3_54" +
					"（" +
					String(files.invoice?.name || "原始数据").replace(
						/\.(xlsx?|csv)$/i,
						"",
					) +
					"）.xlsx";
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			} catch (e) {
				error.value = "导出失败：" + e.message;
			} finally {
				busy.value = false;
			}
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
			childStatus,
			removeChild,
			errorPage,
			errorPages,
			visibleErrors,
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
}).mount("#ups-billing-app");
