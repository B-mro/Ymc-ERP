/* ============================================================================
 * ShipGrid UPS Billing — 财务账单模块 UI 入口
 * 文件: ui/ups-billing.js
 * ----------------------------------------------------------------------------
 * 本文件是 UPS Ground 客户账单生成工具的前端交互入口，基于 Vue 3 组合式 API
 * （setup 风格）构建，通过 ShipGridModule.createApp 挂载到宿主页面。
 *
 * 整体职责分层：
 *   1. 文件上传槽管理（files reactive 对象）
 *      - invoice : UPS 原始账单 Excel/CSV（必填）
 *      - gts     : GTS 系统导出的尺寸/重量数据（可选；若原始账单内已含 GTS
 *                 工作表则无需单独上传）
 *      - child   : 子单账单（可选；提供分区代码、住宅/偏远费的收费依据）
 *      - quote   : 客户报价 Excel（必填；兼容 RATEHF、DKH、UPS 标准价表）
 *
 *   2. 核心计算流程
 *      - run()    : 汇总文件 → 调用 ShipGridQuoteManager.preparePricing 准备
 *                  报价表 → 调用 UPSBilling.calculate() 引擎逐单计费
 *
 *   3. 结果展示与交互
 *      - filtered / visible / pages : 按客户筛选 + 分页
 *      - columns  : 控制表头显隐（showAll 切换全部列 / 精简关键列）
 *      - selectionTotal : 选中筛选结果的合计金额
 *
 *   4. Excel 导出
 *      - download() : 调用 UPSBilling.bytes() 生成 xlsx Blob 并触发下载
 *
 *   5. 燃油费率
 *      - refreshFuel() : 从 UPS 官网抓取最新历史燃油费率并更新本地快照
 *      - 监听 window "ups-fuel-updated" 事件，费率更新后自动清空旧结果
 *
 * 依赖全局对象：
 *   Vue                 — Vue 3 运行时（prod 版）
 *   XLSX                — SheetJS 库，用于 Excel/CSV 读取与写出
 *   ShipGridModule      — 宿主平台暴露的模块加载器
 *   ShipGridQuoteManager— 报价管理器（跨承运商共享）
 *   ShipGridChildInvoice— 子单账单匹配器（跨承运商共享）
 *   UPSBilling          — engine/ups-billing.js 导出的主计费引擎
 *   UPSInvoiceFuel      — UPS 燃油费率抓取器
 * ============================================================================
 */

/*SG-AUDIT:finance-34.js*/ const UPSBillingApp = ShipGridModule.createApp({
	setup() {
		/* ---------- 响应式文件槽：四个上传位 ---------- */
		const files = Vue.reactive({
				invoice: null, // UPS 原始账单（必填）
				gts: null, // GTS 尺寸数据（可选）
				child: null, // 子单账单（可选）
				quote: null, // 客户报价（必填）
			}),
			result = Vue.shallowRef(null), // 主引擎计算结果（浅引用，内含 rows/headers/errors/bytes）
			busy = Vue.ref(false), // 全局忙碌锁：上传/计算/导出期间禁用按钮
			error = Vue.ref(""), // 顶部错误提示
			search = Vue.ref(""), // Tracking/订单号搜索关键字
			customer = Vue.ref("all"), // 当前筛选的客户ID，"all" 表示全部
			page = Vue.ref(1), // 主结果分页（每页 20 行）
			showAll = Vue.ref(false), // 是否显示全部表头列（false 时只显示关键 24 列）
			fuelMessage = Vue.ref(""), // 燃油费率刷新结果提示
			fuelRefreshing = Vue.ref(false); // 燃油费率刷新中的 loading 状态

		/* ---------- 上传槽 UI 元数据（标题、提示文案） ---------- */
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

		const settings = Vue.reactive({}); // 预留设置对象（当前未使用，用于未来扩展）
		const processing = Vue.ref(""), // 当前处理进度文字提示
			errorPage = Vue.ref(1); // 错误列表分页（每页 50 条）

		/* ---------- 错误列表分页 computed ---------- */
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

		/* ---------- 就绪条件：原始账单已上传 + 报价已准备好 ---------- */
		const ready = Vue.computed(
			() => !!files.invoice && pricing.pricingReady(files.quote),
		);

		/* 监听 settings 变化，清空旧计算结果（预留） */
		Vue.watch(settings, clear, { deep: true });

		/**
		 * clear —— 清空上一次计算结果
		 * 在文件变更、费率刷新、settings 变更时调用，防止 stale 数据误导用户。
		 */
		function clear() {
			result.value = null;
			error.value = "";
			page.value = 1;
			errorPage.value = 1;
		}

		/* 初始化报价管理器，绑定 ups 承运商 + 清空回调 */
		const pricing = ShipGridQuoteManager.use("ups", clear);

		/* 燃油费率更新事件：当后台抓取到新费率时自动清屏 */
		window.addEventListener("ups-fuel-updated", clear);

		/**
		 * upload —— 读取并解析单个上传文件
		 * @param {File}   file    —— 浏览器 <input type=file> 或 drop 事件的 File 对象
		 * @param {string} key     —— 目标槽位键名：invoice / gts / child / quote
		 *
		 * 流程：
		 *   1. 基础校验（扩展名 xlsx/xls/csv + 大小 ≤ 200MB）
		 *   2. XLSX.read 以 dense:true + raw:true 读取，保留原始数值便于引擎处理
		 *   3. cellDates:false 避免日期被序列化为 Date 对象（账单中日期多为文本）
		 *   4. workbook 用 Vue.markRaw 包裹，阻止 Vue 深度代理大型数组，提升性能
		 */
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

		/**
		 * refreshFuel —— 从 UPS 官网抓取最新燃油费率历史
		 * 成功后触发 window "ups-fuel-updated" 事件，clear() 会自动清空旧账单。
		 */
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

		/**
		 * run —— 主计算入口
		 *
		 * 步骤：
		 *   1. 确定 GTS 数据源：优先用 files.gts 上传的独立文件；否则在原始账单
		 *      的 SheetNames 中查找名为 "GTS" 的工作表；都没有则 gtsInput = null
		 *   2. ShipGridQuoteManager.preparePricing() 解析报价 Excel → 返回
		 *      { value: 报价查找表, name: 报价表文件名 }
		 *   3. ShipGridChildInvoice.select(files) 选择合适的子单账单来源
		 *   4. UPSBilling.calculate() 主引擎计算，生成逐单账单行 + 汇总
		 *   5. 将报价表名称挂到 result.quoteName，用于导出时标注来源
		 */
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

		/* ---------- 结果筛选：按客户 + Tracking/订单号关键字 ---------- */
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

		/* 筛选条件变化时重置到第 1 页 */
		Vue.watch([customer, search], () => (page.value = 1));

		/* ---------- 表头列控制 ---------- */
		/**
		 * columns computed
		 *   showAll=true  → 返回引擎 headers 全部列
		 *   showAll=false → 只返回 24 个关键业务列，按名称精确匹配引擎表头
		 */
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

		/* 当前筛选结果的合计金额（四舍五入到分） */
		const selectionTotal = Vue.computed(
			() =>
				Math.round(filtered.value.reduce((s, r) => s + r.total, 0) * 100) / 100,
		);

		/**
		 * download —— 导出账单 Excel
		 * 调用 UPSBilling.bytes() 生成 xlsx 二进制，以 Blob + a.click() 触发下载。
		 * 文件名包含版本号、客户ID、原始账单名称，便于归档追溯。
		 */
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

		/* ---------- 子单账单状态描述（用于 UI 展示来源说明） ---------- */
		const childStatus = Vue.computed(() =>
			ShipGridChildInvoice.describe(files),
		);

		/** removeChild —— 清除用户手动上传的子单账单 */
		function removeChild() {
			files.child = null;
			clear();
		}

		/* ---------- 暴露给模板的全部响应式状态与方法 ---------- */
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
