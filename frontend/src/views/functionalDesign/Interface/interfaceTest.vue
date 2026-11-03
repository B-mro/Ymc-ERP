<template>
	<div class="page-container interface-test-page" v-loading="pageLoading" element-loading-text="加载中...">
		<div class="page-layout">
			<div class="layout-sidebar">
				<TreePanel
					:tree-data="treeData"
					title="接口分类"
					@node-click="handleTreeClick"
				/>
			</div>

			<div class="layout-content">
				<div class="top-bar">
					<div class="top-meta">
						<el-button link :icon="ArrowLeft" @click="goBack">返回</el-button>
						<span class="mode-tag">接口测试</span>
						<span class="meta-sep">·</span>
						<span class="meta-text" v-if="form.name">{{ form.name }}</span>
						<span class="meta-text dim" v-else>未命名接口</span>
					</div>
				</div>

				<div class="content-card">
					<!-- 请求信息卡 -->
					<div class="step3-req-card">
						<div class="card-title-row">
							<div class="card-title">请求信息</div>
							<el-button
								type="success"
								:loading="callLoading"
								size="large"
								:icon="VideoPlay"
								@click="step3CallApi"
							>
								▶ 发送请求
							</el-button>
						</div>

						<div class="request-url">
							<el-tag
								:type="methodTagType(form.method)"
								size="large"
								effect="dark"
								>{{ form.method || "GET" }}</el-tag
							>
							<span class="ru-text">/dapi{{ form.path || "" }}</span>
							<el-tooltip content="复制完整路径">
								<el-button link :icon="CopyDocument" size="small" @click="copyFullPath" />
							</el-tooltip>
						</div>

						<el-tabs v-if="form.params.length > 0" class="param-tabs">
							<el-tab-pane label="参数列表" name="params">
								<div class="param-table">
									<div class="pt-head">
										<span>参数名</span><span>类型</span><span>位置</span><span>必填</span><span>默认值</span>
									</div>
									<div v-for="p in form.params" :key="p.paramName" class="pt-row">
										<span class="mono">{{ p.paramName }}</span>
										<span>{{ p.type }}</span>
										<span>{{ p.position }}</span>
										<span>{{ p.required ? "是" : "否" }}</span>
										<span class="mono dim">{{ p.defaultValue || "—" }}</span>
									</div>
								</div>
							</el-tab-pane>
							<el-tab-pane label="测试值" name="test">
								<div class="test-params">
									<div v-for="p in form.params" :key="p.paramName" class="test-row">
										<span class="tp-name">{{ p.paramName }}</span>
										<el-input
											v-model="previewParamValues[p.paramName]"
											size="default"
											:placeholder="p.defaultValue || `请输入 ${p.type} 类型值`"
										/>
									</div>
								</div>
							</el-tab-pane>
						</el-tabs>
						<el-empty v-else description="该接口无参数" :image-size="60" />
					</div>

					<!-- 响应结果卡 -->
					<div class="step3-res-card">
						<div class="card-title-row">
							<div class="card-title">响应结果</div>
							<div class="res-meta" v-if="callResult.status !== null">
								<el-tag :type="callResult.status >= 400 ? 'danger' : 'success'" size="small">
									HTTP {{ callResult.status }}
								</el-tag>
								<span class="res-time">{{ callResult.duration }} ms</span>
							</div>
						</div>
						<pre class="json-body" :class="{ empty: !callResult.body }"
							>{{ callResult.body || '点击上方「发送请求」查看响应结果' }}</pre
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: "InterfaceTestView" });

import { reactive, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowLeft, VideoPlay, Check, CopyDocument } from "@element-plus/icons-vue";
import TreePanel from "@/layout/components/TreePanel.vue";
import {
	getCategoryTree,
	getInterfaceDetail,
	executeDynamicApi,
	type DataInterface,
	type ParamItem,
	type TreeNode,
} from "@/api/dynamicInterface";

interface CallResult {
	status: number | null;
	duration: number | null;
	body: string;
}

const route = useRoute();
const router = useRouter();
const id = Number(route.query.id);

const pageLoading = ref(false);
const callLoading = ref(false);
const treeData = ref<TreeNode[]>([]);

const form = reactive<DataInterface & { params: ParamItem[] }>({
	id: undefined,
	name: "",
	path: "",
	method: "GET",
	categoryId: undefined,
	categoryName: "",
	description: "",
	sqlContent: "",
	resultType: "LIST",
	params: [],
});

const callResult = reactive<CallResult>({ status: null, duration: null, body: "" });
const previewParamValues = reactive<Record<string, string>>({});

const methodTagType = (m: string) =>
	({ GET: "success", POST: "primary", PUT: "warning", DELETE: "danger" } as Record<string, any>)[m] || "info";

function handleTreeClick(node: TreeNode) {
	/* 测试页不支持切换分类 */
	node;
}

async function step3CallApi() {
	callLoading.value = true;
	const start = Date.now();
	callResult.body = "";
	try {
		const params: Record<string, any> = {};
		form.params.forEach((p) => {
			const v =
				previewParamValues[p.paramName] !== undefined
					? previewParamValues[p.paramName]
					: p.defaultValue;
			if (v !== undefined && v !== "" && v !== null) {
				params[p.paramName] = v;
			}
		});
		const result = await executeDynamicApi(form.path || "", form.method || "GET", params);
		callResult.status = 200;
		callResult.duration = Date.now() - start;
		callResult.body = JSON.stringify({ code: 200, message: "success", data: result }, null, 2);
	} catch (e: any) {
		callResult.status = 500;
		callResult.duration = Date.now() - start;
		callResult.body = JSON.stringify(
			{ code: e?.response?.status || 500, message: e?.message || "调用失败" },
			null,
			2
		);
	} finally {
		callLoading.value = false;
	}
}

function copyFullPath() {
	const full = window.location.origin + "/dapi" + (form.path || "");
	navigator.clipboard.writeText(full).then(() => ElMessage.success("已复制完整路径"));
}

function goBack() {
	if (window.history.length > 1) {
		router.back();
	} else {
		router.push("/functionalDesign/Interface/dataInterface");
	}
}

async function loadTree() {
	treeData.value = await getCategoryTree();
}

async function loadDetail() {
	if (!id) return;
	pageLoading.value = true;
	try {
		const res = await getInterfaceDetail(id);
		Object.assign(form, {
			id: res.id,
			name: res.name,
			path: res.path,
			method: res.method,
			categoryId: res.categoryId,
			categoryName: res.categoryName,
			description: res.description,
			sqlContent: res.sqlContent,
			resultType: res.resultType || "LIST",
			params: (res.params || []).map((p: any) => ({
				paramName: p.paramName,
				fieldName: p.fieldName,
				type: p.type,
				position: p.position,
				required: p.required,
				defaultValue: p.defaultValue ?? "",
				description: p.description ?? "",
				desc: p.description ?? "",
			})),
		});
	} finally {
		pageLoading.value = false;
	}
}

onMounted(async () => {
	await Promise.all([loadTree(), loadDetail()]);
});
</script>

<style scoped>
/* ============ 页面整体: 全屏铺满 ============ */
.interface-test-page {
	height: 100%;
	padding: 0;
	font-size: 15px;
	background: var(--el-bg-color-page);
	overflow: hidden;
}

.page-layout {
	display: flex;
	gap: 16px;
	height: 100%;
	min-height: 0;
}

.layout-sidebar {
	width: 260px;
	flex-shrink: 0;
	height: 100%;
	display: flex;
	flex-direction: column;
}

.layout-content {
	flex: 1;
	min-width: 0;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

/* 统一加大页面内 Element 控件文字 */
.interface-test-page :deep(.el-form-item__label),
.interface-test-page :deep(.el-input__inner),
.interface-test-page :deep(.el-tabs__item),
.interface-test-page :deep(.el-tree-node__label),
.interface-test-page :deep(.el-button) {
	font-size: 15px;
}

.layout-sidebar :deep(.tree-panel) {
	flex: 1;
	min-height: 0;
}
.layout-sidebar :deep(.tree-title) {
	font-size: 16px;
}
.layout-sidebar :deep(.el-card__body) {
	overflow: hidden;
}
.layout-sidebar :deep(.tree-content) {
	height: 100%;
	overflow-y: auto;
}
.layout-sidebar :deep(.el-tree-node__content) {
	height: 34px;
}

/* ============ 顶部信息条 ============ */
.top-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	padding: 12px 20px;
	margin-bottom: 12px;
	flex-shrink: 0;
}

.top-meta {
	display: flex;
	align-items: center;
	gap: 10px;
}

.mode-tag {
	background: var(--el-color-success-light-9, #e1f3d8);
	color: var(--el-color-success);
	font-weight: 600;
	font-size: 15px;
	padding: 4px 12px;
	border-radius: 12px;
}

.meta-sep { color: var(--el-text-color-placeholder); font-size: 15px; }
.meta-text { font-weight: 600; font-size: 16px; color: var(--el-text-color-primary); }
.meta-text.dim { color: var(--el-text-color-secondary); font-style: italic; }

/* ============ 内容卡 ============ */
.content-card {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
}

.step3-req-card,
.step3-res-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 16px;
	display: flex;
	flex-direction: column;
	min-height: 0;
	overflow: hidden;
	background: var(--el-bg-color);
}

.card-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 14px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	margin-bottom: 14px;
	flex-shrink: 0;
}

.card-title {
	font-weight: 600;
	font-size: 17px;
	color: var(--el-text-color-primary);
}

.request-url {
	display: flex;
	align-items: center;
	gap: 10px;
	background: var(--el-fill-color-lighter);
	border-radius: 8px;
	padding: 14px 16px;
	margin-bottom: 14px;
	flex-shrink: 0;
}

.ru-text {
	font-family: Consolas, Menlo, monospace;
	font-size: 15px;
	color: var(--el-text-color-primary);
	font-weight: 500;
}

.param-tabs {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.param-tabs :deep(.el-tabs__content) {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
}

.param-table {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	overflow: hidden;
}

.pt-head,
.pt-row {
	display: grid;
	grid-template-columns: 1.5fr 1fr 1fr 0.8fr 1.2fr;
	gap: 8px;
	padding: 10px 14px;
	font-size: 14px;
	align-items: center;
}

.pt-head {
	background: var(--el-fill-color-lighter);
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.pt-row {
	border-top: 1px solid var(--el-border-color-lighter);
}

.pt-row .mono {
	font-family: Consolas, Menlo, monospace;
	color: var(--el-color-primary);
}

.pt-row .dim {
	color: var(--el-text-color-placeholder);
}

.test-params {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 4px 2px;
}

.test-row {
	display: flex;
	align-items: center;
	gap: 12px;
}

.tp-name {
	width: 150px;
	font-family: Consolas, Menlo, monospace;
	font-weight: 600;
	color: var(--el-color-primary);
	font-size: 15px;
	flex-shrink: 0;
}

.res-meta {
	display: flex;
	align-items: center;
	gap: 10px;
}

.res-time {
	font-size: 13px;
	color: var(--el-text-color-secondary);
}

.json-body {
	flex: 1;
	min-height: 0;
	margin: 0;
	padding: 16px;
	font-family: Consolas, Menlo, "Courier New", monospace;
	font-size: 14px;
	line-height: 1.6;
	color: var(--el-text-color-primary);
	background: var(--el-fill-color-lighter);
	border-radius: 6px;
	overflow: auto;
	white-space: pre-wrap;
	word-break: break-all;
}

.json-body.empty {
	color: var(--el-text-color-placeholder);
	font-style: italic;
	display: flex;
	align-items: center;
	justify-content: center;
}

@media (max-width: 1100px) {
	.content-card { grid-template-columns: 1fr; }
}
</style>
