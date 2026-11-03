<template>
	<div class="fedex-claims">
		<!-- ========== 搜索区 ========== -->
		<el-card shadow="never" class="search-bar">
			<el-form :inline="true" :model="queryParams">
				<!-- 物流单号 -->
				<el-form-item label="物流单号">
					<el-input
						v-model="queryParams.logisticsNo"
						placeholder="请输入物流单号"
						clearable
						style="width: 200px"
						@keyup.enter="handleQuery"
					/>
				</el-form-item>
				<!-- 客户名称 --> 
				<el-form-item label="客户名称">
					<el-input
						v-model="queryParams.customerName"
						placeholder="请输入客户名称"
						clearable
						style="width: 200px"
						@keyup.enter="handleQuery"
					/>
				</el-form-item>
				<!-- 索赔类型（下拉，后期可改为接口字典） -->
				<el-form-item label="索赔类型">
					<el-select
						v-model="queryParams.type"
						placeholder="全部"
						clearable
						style="width: 160px"
					>
						<el-option
							v-for="item in claimsTypeOptions"
							:key="item.value"
							:label="item.label"
							:value="item.value"
						/>
					</el-select>
				</el-form-item>
				<el-form-item>
					<el-button type="primary" :icon="Search" @click="handleQuery"
						>查询</el-button
					>
					<el-button :icon="Refresh" @click="resetQuery">重置</el-button>
				</el-form-item>
			</el-form>
		</el-card>

		<!-- ========== 列表区 ========== -->
		<el-card shadow="never" class="table-card">
			<!-- 工具栏：新增按钮 -->
			<div class="table-toolbar">
				<el-button type="primary" :icon="Plus" @click="openDialog()">
					新增
				</el-button>
			</div>

			<!-- 表格容器 -->
			<div class="table-wrapper">
				<el-table
					v-loading="loading"
					:data="tableData"
					border
					stripe
					height="100%"
					:row-style="{ height: '38px' }"
					:header-cell-style="{ height: '38px' }"
				>
					<!-- 序号列 -->
					<el-table-column
						type="index"
						label="序号"
						width="70"
						align="center"
					/>
					<!-- 物流单号 -->
					<el-table-column
						prop="logisticsNo"
						label="物流单号"
						min-width="140"
						show-overflow-tooltip
					/>
					<!-- 客户名称 -->
					<el-table-column
						prop="customerName"
						label="客户名称"
						min-width="120"
						show-overflow-tooltip
					/>
					<!-- 索赔类型 -->
					<el-table-column label="索赔类型" width="110" align="center">
						<template #default="{ row }">
							<el-tag :type="dictTag(claimsTypeOptions, row.type, claimsTypeColors)" size="small">
								{{ dictLabel(claimsTypeOptions, row.type) }}
							</el-tag>
						</template>
					</el-table-column>
					<!-- 问题类型 -->
					<el-table-column
						label="问题类型"
						width="110"
						align="center"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							{{ typeLabel(row.type, row.issueType) }}
						</template>
					</el-table-column>
					 
					 
					<!-- 申请金额 -->
					<el-table-column
						label="申请金额"
						width="110"
						align="right"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							<span class="amount"
								>¥{{ Number(row.applyAmount || 0).toFixed(2) }}</span
							>
						</template>
					</el-table-column>
					<!-- 问题描述（超长省略，悬浮显示） -->
					<el-table-column
						prop="issueDesc"
						label="问题描述"
						min-width="180"
						show-overflow-tooltip
					/>
					<el-table-column label="工单状态" width="110" align="center">
						<template #default="{ row }">
							<el-tag :type="dictTag(statusOptions, row.status, statusColors)" size="small">
								{{ dictLabel(statusOptions, row.status) }}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column
						prop="createTime"
						label="创建时间"
						width="120"
						show-overflow-tooltip
					/>
					<!-- 操作列（固定在右侧） -->
					<el-table-column
						label="操作"
						width="200"
						fixed="right"
						align="center"
					>
						<template #default="{ row }">
							<el-button type="primary" link @click="openView(row)"
								>查看</el-button
							>
							<el-button
								type="warning"
								link
								@click="openDialog(row)"
								v-if="row.status === '1'"
								>修改</el-button
							>
							<el-button type="danger" link @click="handleDelete(row)"
								>删除</el-button
							>
						</template>
					</el-table-column>
				</el-table>
			</div>

			<!-- 分页（假数据前端分页） -->
			<el-pagination
				class="table-pagination"
				v-model:current-page="queryParams.pageNum"
				v-model:page-size="queryParams.pageSize"
				:page-sizes="[10, 20, 50]"
				:total="total"
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="loadData"
				@current-change="loadData"
			/>
		</el-card>

		<!-- ========== 新增 / 修改 / 查看 弹窗 ========== -->
		<el-dialog
			v-model="dialogVisible"
			:title="dialogTitle"
			width="720px"
			class="claim-dialog"
			destroy-on-close
			:close-on-click-modal="false"
		>
			<el-form
				ref="formRef"
				:model="form"
				:rules="rules"
				label-width="90px"
				:disabled="isView || isEdit"
				class="claim-form"
			>
				<!-- 顶部：索赔类型分段选择器（切换后展示不同字段） -->
				<div class="claim-type-switcher">
					<span class="switcher-label">索赔类型</span>
					<el-radio-group
						v-model="form.type"
						:disabled="isView || isEdit"
						@change="onClaimsTypeChange"
					>
						<el-radio-button
							v-for="item in claimsTypeOptions"
							:key="item.value"
							:value="item.value"
						>
							{{ item.label }}
						</el-radio-button>
					</el-radio-group>
				</div>

				<!-- 基础信息（三种类型都有） -->
				<el-divider content-position="left">基础信息</el-divider>
				<el-row :gutter="16">
					<el-col :span="12">
						<el-form-item label="物流单号" prop="logisticsNo">
							<el-input
								v-model="form.logisticsNo"
								placeholder="如 LT20250101001"
								:disabled="isView || isEdit"
								@blur="handleLogisticsNoBlur"
							/>
						</el-form-item>
					</el-col>
					<el-col :span="12">
						<el-form-item label="客户名称" prop="customerName">
							<el-input
								v-model="form.customerName"
								placeholder="请输入客户名称"
							/>
						</el-form-item>
					</el-col>
					<el-col :span="12">
						<el-form-item label="客户编号">
							<el-input v-model="form.customerNo" placeholder="选填" />
						</el-form-item>
					</el-col>
					<el-col :span="12">
						<el-form-item label="联系邮箱">
							<el-input v-model="form.contactEmail" placeholder="选填" />
						</el-form-item>
					</el-col>
				</el-row>

				<!-- ===== 异动查询专属字段 ===== -->
				<template v-if="form.type === '1'">
					<el-divider content-position="left">异动信息</el-divider>
					<el-row :gutter="16">
						<el-col :span="12">
							<el-form-item label="问题类型" prop="issueType">
								<el-select
									v-model="form.issueType"
									placeholder="请选择"
									style="width: 100%"
								>
									<el-option
										v-for="r in traceReasons"
										:key="r.value"
										:label="r.label"
										:value="r.value"
									/>
								</el-select>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="最后更新日期" prop="lastUpdateDate">
								<el-date-picker
									v-model="form.lastUpdateDate"
									type="date"
									value-format="YYYY-MM-DD"
									placeholder="选择日期"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
					</el-row>
				</template>

				<!-- ===== 包裹索赔专属字段 ===== -->
				<template v-if="form.type === '2'">
					<el-divider content-position="left">包裹信息</el-divider>
					<el-row :gutter="16">
						<el-col :span="12">
							<el-form-item label="问题类型" prop="issueType">
								<el-select
									v-model="form.issueType"
									placeholder="请选择"
									style="width: 100%"
								>
									<el-option
										v-for="r in packageReasons"
										:key="r.value"
										:label="r.label"
										:value="r.value"
									/>
								</el-select>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="发货日期" prop="shipDate">
								<el-date-picker
									v-model="form.shipDate"
									type="date"
									value-format="YYYY-MM-DD"
									placeholder="选择日期"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="服务类型">
								<el-input
									v-model="form.serviceType"
									placeholder="如 Ground / Express"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="申请金额" prop="applyAmount">
								<el-input-number
									v-model="form.applyAmount"
									:min="0"
									:precision="2"
									:step="1"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
					</el-row>
				</template>

				<!-- ===== 账单索赔专属字段 ===== -->
				<template v-if="form.type === '3'">
					<el-divider content-position="left">账单信息</el-divider>
					<el-row :gutter="16">
						<el-col :span="12">
							<el-form-item label="问题类型" prop="issueType">
								<el-select
									v-model="form.issueType"
									placeholder="请选择"
									style="width: 100%"
								>
									<el-option
										v-for="r in billingReasons"
										:key="r.value"
										:label="r.label"
										:value="r.value"
									/>
								</el-select>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="收费项目">
								<el-input
									v-model="form.chargeItem"
									placeholder="如 重量附加费"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="发票号" prop="invoiceNo">
								<el-input v-model="form.invoiceNo" placeholder="请输入发票号" />
							</el-form-item>
						</el-col>
						<el-col :span="12">
							<el-form-item label="发票日期" prop="invoiceDate">
								<el-date-picker
									v-model="form.invoiceDate"
									type="date"
									value-format="YYYY-MM-DD"
									placeholder="选择日期"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="8">
							<el-form-item label="账单金额">
								<el-input-number
									v-model="form.billAmount"
									:min="0"
									:precision="2"
									:step="1"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="8">
							<el-form-item label="应收金额">
								<el-input-number
									v-model="form.receivableAmount"
									:min="0"
									:precision="2"
									:step="1"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
						<el-col :span="8">
							<el-form-item label="争议金额" prop="applyAmount">
								<el-input-number
									v-model="form.applyAmount"
									:min="0"
									:precision="2"
									:step="1"
									style="width: 100%"
								/>
							</el-form-item>
						</el-col>
					</el-row>
				</template>

				<!-- 问题描述（三种类型都有，放最后） -->
				<el-divider content-position="left">补充说明</el-divider>
				<el-form-item label="问题描述" prop="issueDesc">
					<el-input
						v-model="form.issueDesc"
						type="textarea"
						:rows="3"
						placeholder="请填写事件经过或争议计算依据"
					/>
				</el-form-item>

				<!-- 工单回复：仅查看时显示，新增 / 修改时隐藏 -->
				<template v-if="isView">
					<el-divider content-position="left">工单回复</el-divider>
					<el-form-item label="回复" prop="answer">
						<el-input
							v-model="form.answer"
							type="textarea"
							:rows="3"
							placeholder="请填写事件经过或争议计算依据"
						/>
					</el-form-item>
				</template>
				<template v-if="isView && form.status === '3'">
					<!-- ===== 附件上传 ===== -->
					<el-divider content-position="left">附件上传</el-divider>
					<!-- 文件上传：Excel / Word / PDF，允许预览 -->
					<el-form-item label="文件附件">
						<FileUpload
							ref="fileUploadRef"
							v-model="form.fileUrl"
							:disabled="isView && form.status !== '3'"
						/>
					</el-form-item>
					<!-- 图片上传：jpg / png / jpeg，允许预览 -->
					<el-form-item label="图片附件">
						<ImageUpload
							ref="imageUploadRef"
							v-model="form.imgUrl"
							:disabled="isView && form.status !== '3'"
						/>
					</el-form-item>
				</template>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible = false">{{
					isView ? "关闭" : "取消"
				}}</el-button>
				<el-button
					type="primary"
					v-if="isView && form.status === '3'"
					:loading="submitLoading"
					@click="FileLoadSubmit"
					>确定</el-button
				>
				<el-button
					v-if="!isView && !isLogis"
					type="primary"
					:loading="submitLoading"
					@click="handleSubmit"
				>
					确定
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
	ElMessage,
	ElMessageBox,
	type FormInstance,
	type FormRules,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import FileUpload from "@/components/FileUpload.vue";
import ImageUpload from "@/components/ImageUpload.vue";
// 复用 @/types 里的 Claim 实体类型；后期接真实接口时直接替换 mockData 即可
import type { Claim } from "@/types";
import { getDictData } from "@/api/publicInterface";
import {
	listClaims,
	deleteClaims,
	saveClaim,
	updateClaim,
	checkClaimCount,
} from "@/api/customer";
import { useUserStore } from '@/stores/user'
// 字典标签辅助：统一处理「value → 中文 label + tag 颜色」
import { dictTag, dictLabel, type DictOption } from "@/utils/dict";
const userStore = useUserStore();

/* =========================================================================
 * 字典配置（后期可改为接口获取的字典）
 *   - claimsTypeOptions：三种索赔类型（弹窗顶部分段切换用）
 *   - traceReasons / packageReasons / billingReasons：各类型对应的问题类型
 * ========================================================================= */
// 索赔类型选项：通过数据字典接口获取（dictCode = claimsTypeOptions）
const claimsTypeOptions = ref<{ value: string; label: string }[]>([]);
// 账单异动的问题类型
const traceReasons = ref<{ value: string; label: string }[]>([]);
// 包裹索赔的问题类型
const packageReasons = ref<{ value: string; label: string }[]>([]);
// 账单索赔的问题类型
const billingReasons = ref<{ value: string; label: string }[]>([]);
// 工单状态
const statusOptions = ref<{ value: string; label: string }[]>([]);

/** 加载索赔类型字典 */
async function loadClaimsTypeOptions() {
	const claimsTypeOptionslist = await getDictData("claimsTypeOptions");
	// 接口返回 [{ id, dictCode, label, value }]，映射为选项 [{ value, label }]
	claimsTypeOptions.value = (claimsTypeOptionslist || []).map((item) => ({
		value: item?.value ?? "",
		label: item?.label ?? "",
	}));
	const traceReasonslist = await getDictData("traceReasons");
	// 接口返回 [{ id, dictCode, label, value }]，映射为选项 [{ value, label }]
	traceReasons.value = (traceReasonslist || []).map((item) => ({
		value: item?.value ?? "",
		label: item?.label ?? "",
	}));
	const packageReasonslist = await getDictData("packageReasons");
	// 接口返回 [{ id, dictCode, label, value }]，映射为选项 [{ value, label }]
	packageReasons.value = (packageReasonslist || []).map((item) => ({
		value: item?.value ?? "",
		label: item?.label ?? "",
	}));
	const billingReasonslist = await getDictData("billingReasons");
	// 接口返回 [{ id, dictCode, label, value }]，映射为选项 [{ value, label }]
	billingReasons.value = (billingReasonslist || []).map((item) => ({
		value: item?.value ?? "",
		label: item?.label ?? "",
	}));
	const statusOptionslist = await getDictData("claims_status");
	statusOptions.value = (statusOptionslist || []).map((item) => ({
		value: item?.value ?? "",
		label: item?.label ?? "",
	}));
}

/* =========================================================================
 * 字典标签颜色映射（value → el-tag type）
 * 以后新增字典字段，只需在此处加一个 colorMap，模板里用 dictTag/dictLabel 即可
 * ========================================================================= */
// 索赔类型：1 异动查询(info灰) / 2 包裹索赔(success绿) / 3 账单争议(warning橙)
const claimsTypeColors: Record<string, string> = {
	"1": "info",
	"2": "success",
	"3": "warning",
};
// 工单状态：根据实际字典 value 配置颜色（示例，按需调整）
const statusColors: Record<string, string> = {
	"0": "info",     // 待处理
	"1": "warning",  // 处理中
	"2": "success",  // 已完成
	"3": "danger",   // 已驳回
};

// 问题类型展示：根据所属索赔类型(type)去对应字典里查 issueType 的 label
function typeLabel(type?: string, issueType?: string) {
	const map: Record<string, DictOption[]> = {
		"1": traceReasons.value,
		"2": packageReasons.value,
		"3": billingReasons.value,
	};
	const list = map[type || ""] || [];
	return list.find((r) => r.value === issueType)?.label || issueType || "-";
}

 
/* =========================================================================
 * 列表状态
 * ========================================================================= */
const loading = ref(false);
const tableData = ref<Claim[]>([]);
const total = ref(0);

const queryParams = reactive({
	pageNum: 1,
	pageSize: 10,
	logisticsNo: "",
	customerName: "",
	type: "" as string, // 索赔类型筛选（1/2/3）
});

/** 加载列表：按承运商 claimsType=ONTRAC 过滤，索赔类型(type)由前端搜索筛选 */
async function loadData() {
	loading.value = true;
	// claimsType = 承运商编码，只查当前页面（OnTrac）的数据
	const list = await listClaims({ claimsType: "2" });
	const filtered = list.filter((item) => {
		if (
			queryParams.logisticsNo &&
			!item.logisticsNo?.includes(queryParams.logisticsNo)
		)
			return false;
		if (
			queryParams.customerName &&
			!item.customerName?.includes(queryParams.customerName)
		)
			return false;
		// type = 索赔类型（1/2/3）
		if (queryParams.type && item.type !== queryParams.type)
			return false;
		return true;
	});
	total.value = filtered.length;
	const start = (queryParams.pageNum - 1) * queryParams.pageSize;
	tableData.value = filtered.slice(start, start + queryParams.pageSize);
	loading.value = false;
}

function handleQuery() {
	queryParams.pageNum = 1;
	loadData();
}

function resetQuery() {
	queryParams.logisticsNo = "";
	queryParams.customerName = "";
	queryParams.type = "";
	handleQuery();
}

/* =========================================================================
 * 新增 / 修改 / 查看 弹窗
 * ========================================================================= */
const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const isView = ref(false);
const dialogTitle = ref("新增");
const formRef = ref<FormInstance>();
const fileUploadRef = ref<{ confirmUpload: () => Promise<string[]> }>();
const imageUploadRef = ref<{ confirmUpload: () => Promise<string[]> }>();

// 表单数据：claimsType=承运商(ONTRAC)，type=索赔类型(1/2/3)，issueType=问题类型
const form = reactive<Claim>({
	id: undefined,
	claimsType: "2", // 承运商，本页面固定为 OnTrac
	type: "1",           // 索赔类型，默认异动查询
	issueType: "1",      // 问题类型
	logisticsNo: "",
	customerName: "",
	customerNo: "",
	contactEmail: "",
	shipDate: "",
	serviceType: "",
	applyAmount: 0,
	lastUpdateDate: "",
	invoiceNo: "",
	invoiceDate: "",
	chargeItem: "",
	billAmount: 0,
	receivableAmount: 0,
	issueDesc: "",
	status:"1",
	answer:"",
	fileUrl: "",
	imgUrl: "",
});

// 表单校验规则
const rules: FormRules = {
	logisticsNo: [{ required: true, message: "请输入物流单号", trigger: "blur" }],
	customerName: [
		{ required: true, message: "请输入客户名称", trigger: "blur" },
	],
	type: [{ required: true, message: "请选择索赔类型", trigger: "change" }],
	issueType: [{ required: true, message: "请选择问题类型", trigger: "change" }],
	shipDate: [{ required: true, message: "请选择发货日期", trigger: "change" }],
	lastUpdateDate: [
		{ required: true, message: "请选择最后更新日期", trigger: "change" },
	],
	invoiceNo: [{ required: true, message: "请输入发票号", trigger: "blur" }],
	invoiceDate: [
		{ required: true, message: "请选择发票日期", trigger: "change" },
	],
	applyAmount: [
		{ required: true, message: "请输入金额", trigger: "blur" },
		{ type: "number", min: 0, message: "金额不能小于0", trigger: "blur" },
	],
};

/** 切换索赔类型(type)时，清空不通用的字段，避免脏数据 */
function onClaimsTypeChange(val: string) {
	form.logisticsNo = "";
	form.issueType = "";
	form.shipDate = "";
	form.serviceType = "";
	form.applyAmount = 0;
	form.lastUpdateDate = "";
	form.invoiceNo = "";
	form.invoiceDate = "";
	form.chargeItem = "";
	form.billAmount = 0;
	form.receivableAmount = 0;
	// 默认问题类型取各字典第一个
	const defaults: Record<string, string> = {
		"1": traceReasons.value[0]?.value || "",
		"2": packageReasons.value[0]?.value || "",
		"3": billingReasons.value[0]?.value || "",
	};
	form.issueType = defaults[val] || "";
	formRef.value?.clearValidate();
}

/** 重置表单为空白 */
function resetForm() {
	Object.assign(form, {
		id: undefined,
		claimsType: "2", // 承运商固定
		type: "1",           // 默认异动查询
		issueType: "",
		logisticsNo: "",
		customerName: "",
		customerNo: "",
		contactEmail: "",
		shipDate: "",
		serviceType: "",
		applyAmount: 0,
		lastUpdateDate: "",
		invoiceNo: "",
		invoiceDate: "",
		chargeItem: "",
		billAmount: 0,
		receivableAmount: 0,
		issueDesc: "",
		answer:"",
		fileUrl: "",
		imgUrl: "",
		createUser: userStore.userInfo.id,
	});
}

/** 打开新增 / 修改弹窗；传 row 表示修改 */
function openDialog(row?: Claim) {
	isView.value = false;
	isEdit.value = !!row;
	dialogTitle.value = isEdit.value ? "修改" : "新增";
	isLogis.value = false;
	if (row) {
		Object.assign(form, row);
	} else {
		resetForm();
	}
	dialogVisible.value = true;
	formRef.value?.clearValidate();
}

/** 打开查看弹窗（只读） */
function openView(row: Claim) {
	isView.value = true;
	isEdit.value = false;
	dialogTitle.value = "查看详情";
	Object.assign(form, row);
	dialogVisible.value = true;
}

/** 提交（新增 / 修改）：当前为前端 mock，后期接接口替换即可 */
async function handleSubmit() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		submitLoading.value = true;
		try {
			if (isEdit.value) {
				const res = await updateClaim({ ...form });
				ElMessage.success("修改成功");
			} else {
				const res = await saveClaim({ ...form });
				ElMessage.success("新增成功");
			}
			dialogVisible.value = false;
			loadData();
		} finally {
			submitLoading.value = false;
		}
	});
} 

/** 删除：当前为前端 mock */
async function handleDelete(row: Claim) {
	try {
		// confirm 点取消会 reject，必须 try/catch 吞掉取消操作
		await ElMessageBox.confirm(
			`确定删除物流单号「${row.logisticsNo}」的记录吗？`,
			"提示",
			{ type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" },
		);
		// 点确定才走到这里：执行删除
		const ids = [row.id as number];
		const res = await deleteClaims(ids);
		ElMessage.success("删除成功");
		loadData();
	} catch {
		// 点取消 / 关闭弹窗：什么都不做
	}
}
/** 查看：状态是资料不足，附件上传提交 */
async function FileLoadSubmit() {
	if (!form.id) return;
	submitLoading.value = true;
	try {
		const [fileUrls, imgUrls] = await Promise.all([
			fileUploadRef.value?.confirmUpload(),
			imageUploadRef.value?.confirmUpload(),
		]);
		if (typeof form.fileUrl === "string") {
			form.fileUrl = (fileUrls || []).join(",");
		}
		if (typeof form.imgUrl === "string") {
			form.imgUrl = (imgUrls || []).join(",");
		}
		await updateClaim({ ...form });
		ElMessage.success("提交成功");
		dialogVisible.value = false;
		loadData();
	} catch (e) {
		ElMessage.error("提交失败，请重试");
	} finally {
		submitLoading.value = false;
	}
}
const isLogis = ref(false);
/** 物流单号输入完成后触发打印（输入为空时不处理） */
async function handleLogisticsNoBlur() {
	const no = (form.logisticsNo || "").trim();
	isLogis.value = false;
	if (!no || form.type == "1") return;
	const params = {
		claimsType: form.claimsType,
		logisticsNo: no,
		type: form.type,
	};
	try {
		const res = await checkClaimCount(params);
		if (res[0].num == 3) {
			ElMessage.error("该物流单号已超过3次查询次数，不能继续查询");
			isLogis.value = true;
		}
	} catch (e) {
		console.log(e);
		isLogis.value = false;
	}
}

onMounted(() => {
	loadData();
	loadClaimsTypeOptions();
});
</script>

<style scoped>
/* 页面整体：纵向 flex，撑满内容区高度 */
.fedex-claims {
	display: flex;
	flex-direction: column;
	height: 100%;
	gap: 8px;
}

/* ===== 搜索栏压缩 ===== */
.search-bar {
	flex-shrink: 0;
}

.search-bar :deep(.el-card__body) {
	padding: 8px 12px 0;
}

.search-bar :deep(.el-form-item) {
	margin-bottom: 8px;
}

.search-bar :deep(.el-form-item__label) {
	padding-right: 6px;
}

.search-bar :deep(.el-input__wrapper),
.search-bar :deep(.el-select__wrapper) {
	height: 30px;
	padding: 0 8px;
}

.search-bar :deep(.el-button) {
	padding: 7px 14px;
}

/* ===== 列表卡片：占满剩余高度 ===== */
.table-card {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.table-card :deep(.el-card__body) {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	/* padding: 10px 12px; */
}

.table-toolbar {
	flex-shrink: 0;
	margin-bottom: 8px;
}

.table-toolbar :deep(.el-button) {
	padding: 7px 14px;
}

/* 表格容器：撑满剩余空间 */
.table-wrapper {
	flex: 1;
	min-height: 0;
}

/* 固定行高 38px，内容垂直居中 */
.table-wrapper :deep(.el-table .cell) {
	line-height: 35px;
	/* 强制不换行，超长省略由 show-overflow-tooltip 处理 */
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 分页高度压缩，把空间让给表格 */
.table-pagination {
	flex-shrink: 0;
	margin-top: 6px;
	justify-content: flex-end;
}

.table-pagination :deep(.el-pagination) {
	font-size: 12px;
}

.table-pagination :deep(.el-pagination button),
.table-pagination :deep(.el-pagination .el-pager li) {
	min-width: 24px;
	height: 24px;
	line-height: 24px;
	font-size: 12px;
}

.table-pagination :deep(.el-pagination .el-pagination__sizes .el-select) {
	height: 24px;
}

.table-pagination :deep(.el-pagination .el-select__wrapper) {
	height: 24px;
	min-height: 24px;
}

.amount {
	color: #f56c6c;
	font-weight: 600;
}

/* ===== 弹窗美化 ===== */
.claim-dialog :deep(.el-dialog__header) {
	background: linear-gradient(135deg, #3267d8 0%, #5b8def 100%);
	margin-right: 0;
	padding: 16px 20px;
}

.claim-dialog :deep(.el-dialog__title) {
	color: #fff;
	font-size: 16px;
	font-weight: 600;
}

.claim-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
	color: #fff;
	font-size: 18px;
}

.claim-dialog :deep(.el-dialog__body) {
	padding: 20px 24px 8px;
}

/* 索赔类型分段选择器 */
.claim-type-switcher {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 8px;
}

.claim-type-switcher .switcher-label {
	font-size: 13px;
	color: #606266;
	font-weight: 600;
}

.claim-form :deep(.el-divider__text) {
	color: #3267d8;
	font-weight: 600;
	font-size: 13px;
}

.claim-form :deep(.el-divider) {
	margin: 12px 0;
}
</style>