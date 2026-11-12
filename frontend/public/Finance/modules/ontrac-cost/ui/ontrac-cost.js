// ============================================================================
// ui/ontrac-cost.js —— Vue 3 组件层（setup 风格）
// ----------------------------------------------------------------------------
// 整个页面就一个 Vue 组件，setup() 里声明所有状态和方法。
// 页面的所有交互——上传文件、调引擎、展示结果、下载——都在这个文件里。
//
// 状态声明（setup 开头）：
//   files       reactive 对象，存三个文件：
//                 invoice —— 用户上传的原始账单+GTS 工作簿
//                 A / B   —— 内置价表（ShipGridDefaultRates.A / .B）
//   slots       上传槽位配置数组（目前只有 invoice 一个）
//   settings    reactive，从 OnTracEngine.defaultSettings 深拷贝来的参数
//   settingsOpen ref，控制参数面板展开/收起
//   busy        ref，全局忙碌状态（上传/计算/下载中为 true，按钮会被禁用）
//   error       ref，显示红色错误条
//   result      shallowRef，引擎返回的完整计算结果
//   tab         ref，"details" 或 "errors"，控制显示哪个表格
//   search      ref，搜索框值
//   filter      ref，方案筛选 "all" / "A" / "B" / "warning"
//   page        ref，分页当前页
//
// 方法：
//   upload(file, key)      —— 读取用户选的 Excel，校验后存进 files[key]
//                              校验：扩展名 .xlsx/.xls、大小 ≤50MB、
//                              invoice 必须同时含「原始」和「GTS」两个 sheet
//   refreshFuel()          —— 调 /api/ontrac/surcharge/history 拉最新燃油费率
//   calculate()            —— 核心触发：
//                              1) 校验 settings 里旺季费用和日期格式/范围
//                              2) OnTracEngine.calculate(invoice.wb, A.wb, B.wb, settings)
//                              3) 结果赋给 result，重置 tab/search/filter/page
//   download()             —— OnTracEngine.workbook(result) 生成 XLSX 工作簿，
//                              XLSX.writeFile 直接触发浏览器下载
//
// computed：
//   ready        —— 三个文件都有值才返回 true（A/B 默认就有，等 invoice）
//   filtered     —— 根据 tab/filter/search 过滤 result.rows 或 result.errors
//   pages        —— filtered 除以 20 向上取整
//   visible      —— filtered 按 page 切片（每页 20 条）
//
// watch：
//   settings  deep=true —— 参数一改就 invalidate（清空 result 和 error）
//   [search, filter, tab] —— 切换 tab/筛选/搜索时 page 重置到 1
// ============================================================================
/*SG-AUDIT:finance-06.js*/ const { createApp, reactive, ref, computed, watch } =
	Vue;
ShipGridModule.createApp({
	setup() {
		const files = reactive({
			invoice: null,
			A: ShipGridDefaultRates.A,
			B: ShipGridDefaultRates.B,
		});
		const slots = [
			{
				key: "invoice",
				title: "原始账单 + GTS",
				hint: "同一工作簿需含「原始」「GTS」两个sheet；GTS重量KG、尺寸CM",
			},
		];
		const settings = reactive({ ...OnTracEngine.defaultSettings }),
			settingsOpen = ref(false),
			busy = ref(false),
			error = ref(""),
			result = Vue.shallowRef(null),
			tab = ref("details"),
			search = ref(""),
			filter = ref("all"),
			page = ref(1),
			fuelMessage = ref(""),
			fuelRefreshing = ref(false);
		const ready = computed(() => Object.values(files).every(Boolean));
		function invalidate() {
			result.value = null;
			page.value = 1;
			error.value = "";
		}
		watch(settings, invalidate, { deep: true });
		async function upload(file, key) {
			if (!file || busy.value) return;
			invalidate();
			files[key] = null;
			busy.value = true;
			try {
				if (!/\.(xlsx|xls)$/i.test(file.name))
					throw Error("请选择Excel文件（.xlsx或.xls）");
				if (file.size > 50 * 1024 * 1024) throw Error("单个文件不能超过50MB");
				const wb = Vue.markRaw(
					XLSX.read(await file.arrayBuffer(), {
						type: "array",
						cellDates: false,
					}),
				);
				if (key === "invoice" && (!wb.Sheets["原始"] || !wb.Sheets["GTS"]))
					throw Error("账单工作簿需要包含「原始」和「GTS」sheet");
				files[key] = { name: file.name, wb, sheets: wb.SheetNames };
			} catch (e) {
				error.value = e.message;
			} finally {
				busy.value = false;
			}
		}
		async function refreshFuel() {
			fuelRefreshing.value = true;
			try {
				if (location.protocol === "file:")
					throw Error(
						"单文件模式使用内置官方历史费率；自动抓取需运行源码包中的fuel_server.py或接入公司服务器接口",
					);
				const response = await fetch("/api/ontrac/surcharge/history", {
					method: "GET",
				});
				const raw = await response.json();
				if (!response.ok) throw Error(raw.msg || raw.error || "官网更新失败");
				const data = raw.data;
				if (
					!Array.isArray(data.rates) ||
					!data.rates.length ||
					data.source !== "https://www.ontrac.com/surchargesandrates/" ||
					data.rates.some(
						(x) =>
							!Number.isFinite(x.rate) ||
							x.rate <= 0 ||
							x.rate >= 1 ||
							x.start > x.end,
					)
				)
					throw Error("官方费率数据校验失败");
				globalThis.ShipGridFuelRates = data;
				window.dispatchEvent(new Event("fuel-rates-updated"));
				invalidate();
				fuelMessage.value =
					"官网费率已更新，共" + data.rates.length + "周；请重新计算";
			} catch (e) {
				fuelMessage.value = e.message;
			} finally {
				fuelRefreshing.value = false;
			}
		}
		async function calculate() {
			if (!ready.value || busy.value) return;
			busy.value = true;
			error.value = "";
			result.value = null;
			try {
				for (const k of [
					"peakAhs",
					"peakOs",
					"peakResi",
					"peakMax",
					"peakUnauthorized",
				])
					if (!Number.isFinite(Number(settings[k])) || settings[k] < 0)
						throw Error("旺季费用必须为非负数字");
				for (const k of ["demandStart", "demandEnd", "resiStart"])
					if (!/^\d{4}-\d{2}-\d{2}$/.test(settings[k]))
						throw Error("请填写完整旺季日期");
				if (
					settings.demandStart > settings.demandEnd ||
					settings.resiStart > settings.demandEnd
				)
					throw Error("旺季日期范围不正确");
				await new Promise((r) => setTimeout(r, 30));
				result.value = OnTracEngine.calculate(
					files.invoice.wb,
					files.A.wb,
					files.B.wb,
					{ ...settings, weightUnit: "kg", dimUnit: "cm" },
				);
				page.value = 1;
				tab.value = "details";
				search.value = "";
				filter.value = "all";
			} catch (e) {
				error.value = "计算失败：" + e.message;
			} finally {
				busy.value = false;
			}
		}
		const filtered = computed(() => {
			if (!result.value) return [];
			const query = search.value.toLowerCase();
			let rs = tab.value === "errors" ? result.value.errors : result.value.rows;
			if (tab.value === "details") {
				if (filter.value === "warning") rs = rs.filter((r) => r.warnings);
				else if (filter.value !== "all")
					rs = rs.filter((r) => r.chosen === filter.value);
			}
			return rs.filter((r) =>
				[r.order, r.tracking, r.customerOrder].some((v) =>
					String(v ?? "")
						.toLowerCase()
						.includes(query),
				),
			);
		});
		const pages = computed(() =>
			Math.max(1, Math.ceil(filtered.value.length / 20)),
		);
		const visible = computed(() =>
			filtered.value.slice((page.value - 1) * 20, page.value * 20),
		);
		watch([search, filter, tab], () => (page.value = 1));
		async function download() {
			if (!result.value) return;
			busy.value = true;
			error.value = "";
			try {
				await new Promise((r) => setTimeout(r, 20));
				XLSX.writeFile(
					OnTracEngine.workbook(result.value),
					"OnTrac_AB_最低成本_整套尺寸_V3_54" +
						"（" +
						String(files.invoice?.name || "原始数据").replace(/\.xlsx?$/i, "") +
						"）.xlsx",
					{ compression: true },
				);
			} catch (e) {
				error.value = "下载失败：" + e.message;
			} finally {
				busy.value = false;
			}
		}
		return {
			fuelMessage,
			fuelRefreshing,
			refreshFuel,
			slots,
			files,
			settings,
			settingsOpen,
			busy,
			error,
			result,
			ready,
			calculate,
			download,
			tab,
			search,
			filter,
			page,
			pages,
			filtered,
			visible,
			money: (v) =>
				Number(v).toLocaleString("en-US", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}),
			onInput: (e, k) => upload(e.target.files[0], k),
			onDrop: (e, k) => upload(e.dataTransfer.files[0], k),
		};
	},
}).mount("#app");
