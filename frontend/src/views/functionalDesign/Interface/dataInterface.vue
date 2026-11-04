<template>
	<div class="page-container data-interface-page">
		<div class="page-layout">
			<div class="layout-sidebar">
				<TreePanel
					:tree-data="treeData"
					title="接口分类"
					@node-click="handleTreeClick"
				>
					<template #header-actions>
						<el-tooltip content="新增分类" placement="top">
							<el-button
								type="primary"
								link
								size="small"
								:icon="FolderAdd"
								@click="categoryDialogVisible = true"
							/>
						</el-tooltip>
					</template>
				</TreePanel>
			</div>

			<div class="layout-content">
				<div class="page-header">
					<div class="header-left">
						<h2 class="page-title">接口管理</h2>
						<span class="page-desc">
							{{ queryParams.categoryId ? `当前分类共 ${total} 个接口` : `全部 ${total} 个接口` }}
						</span>
					</div>
					<div class="header-right">
						<el-button type="primary" :icon="Plus" @click="openDialog()">
							新增接口
						</el-button>
					</div>
				</div>

				<div class="search-bar">
					<el-form :model="queryParams" inline @keyup.enter="handleQuery">
						<el-form-item label="接口名称">
							<el-input
								v-model="queryParams.name"
								placeholder="输入接口名称搜索"
								clearable
								style="width: 240px"
								:prefix-icon="Search"
							/>
						</el-form-item>
						<el-form-item label="请求方式">
							<el-select
								v-model="queryParams.method"
								placeholder="全部方式"
								clearable
								style="width: 140px"
							>
								<el-option label="GET" value="GET" />
								<el-option label="POST" value="POST" />
								<el-option label="PUT" value="PUT" />
								<el-option label="DELETE" value="DELETE" />
							</el-select>
						</el-form-item>
						<el-form-item>
							<el-button type="primary" @click="handleQuery">查询</el-button>
							<el-button @click="resetQuery">重置</el-button>
						</el-form-item>
					</el-form>
				</div>

				<div class="table-area">
					<el-table
						v-loading="loading" 
						:data="tableData"
						stripe
						height="100%"
						style="width: 100%"
						:row-class-name="tableRowClassName"
					>
						<el-table-column type="index" label="#" width="56" align="center" :index="indexMethod" />
						<el-table-column label="名称" min-width="180">
							<template #default="{ row }">
								<div class="iface-name-cell">
									<span class="name-text" @click="openDialog(row)">{{ row.name }}</span>
									<span class="desc-text" v-if="row.description">{{ row.description }}</span>
								</div>
							</template>
						</el-table-column>
						<el-table-column label="请求" width="260">
							<template #default="{ row }">
								<div class="request-cell">
									<el-tag :type="methodTagType(row.method)" size="small" effect="dark" class="method-tag">
										{{ row.method }}
									</el-tag>
									<span class="path-text">{{ row.path }}</span>
								</div>
							</template>
						</el-table-column>
						<el-table-column prop="categoryName" label="分类" width="140">
							<template #default="{ row }">
								<el-tag v-if="row.categoryName" type="info" effect="plain" size="small">{{ row.categoryName }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="状态" width="90" align="center">
							<template #default="{ row }">
								<el-tag :type="row.status === '1' ? 'info' : 'success'" size="small" effect="plain">
									{{ row.status === '1' ? '停用' : '启用' }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="createTime" label="创建时间" width="170" />
						<el-table-column label="操作" width="190" fixed="right" align="center">
							<template #default="{ row }">
								<el-button type="warning" link @click="openTest(row)">测试</el-button>
								<el-button type="primary" link @click="openDialog(row)">编辑</el-button>
								<el-button type="danger" link @click="handleDelete(row)">删除</el-button>
							</template>
						</el-table-column>
					</el-table>

					<el-pagination
						class="table-pagination"
						v-model:current-page="queryParams.pageNum"
						v-model:page-size="queryParams.pageSize"
						:page-sizes="[10, 20, 50]"
						:total="total"
						background
						layout="total, sizes, prev, pager, next, jumper"
						@size-change="loadData"
						@current-change="loadData"
					/>
				</div>
			</div>
		</div>

		<CategoryDialog
			v-model:visible="categoryDialogVisible"
			:tree-data="treeData"
			:default-parent-id="queryParams.categoryId"
			@success="handleCategorySuccess"
		/>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: "DataInterfaceView" });

import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Search, FolderAdd } from "@element-plus/icons-vue";
import TreePanel from "@/layout/components/TreePanel.vue";
import CategoryDialog from "./components/CategoryDialog.vue";
import {
	getCategoryTree,
	pageInterfaces,
	deleteInterface,
} from "@/api/dynamicInterface";
import type { DataInterface, TreeNode } from "@/api/dynamicInterface";

const router = useRouter();

const treeData = ref<TreeNode[]>([]);
const loading = ref(false);
const tableData = ref<DataInterface[]>([]);
const total = ref(0);
const categoryDialogVisible = ref(false);

const queryParams = reactive({
	pageNum: 1,
	pageSize: 10,
	name: "",
	method: "",
	categoryId: undefined as number | string | undefined,
});

async function loadData() {
	loading.value = true;
	try {
		const res = await pageInterfaces({
			pageNum: queryParams.pageNum,
			pageSize: queryParams.pageSize,
			name: queryParams.name || undefined,
			method: queryParams.method || undefined,
			categoryId: queryParams.categoryId as any,
		});
		tableData.value = res.list;
		total.value = res.total;
	} finally {
		loading.value = false;
	}
}

async function loadTree() {
	treeData.value = await getCategoryTree();
}

function handleTreeClick(node: TreeNode) {
	queryParams.categoryId = node.id;
	queryParams.pageNum = 1;
	loadData();
}

function handleQuery() {
	queryParams.pageNum = 1;
	loadData();
}

function resetQuery() {
	queryParams.name = "";
	queryParams.method = "";
	queryParams.categoryId = undefined;
	queryParams.pageNum = 1;
	loadData();
}

function indexMethod(index: number) {
	return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1;
}

function tableRowClassName({ rowIndex }: { rowIndex: number }) {
	return rowIndex % 2 === 0 ? "even-row" : "odd-row";
}

function methodTagType(method: string) {
	return (
		{ GET: "success", POST: "primary", PUT: "warning", DELETE: "danger" } as Record<
			string,
			"" | "success" | "primary" | "warning" | "danger"
		>
	)[method] || "info";
}

function openDialog(row?: DataInterface) {
	if (row?.id) {
		router.push({
			path: "/functionalDesign/Interface/interfaceForm",
			query: { mode: "edit", id: String(row.id) },
		});
	} else {
		router.push({
			path: "/functionalDesign/Interface/interfaceForm",
			query: queryParams.categoryId
				? { mode: "add", categoryId: String(queryParams.categoryId) }
				: { mode: "add" },
		});
	}
}

function openTest(row: DataInterface) {
	router.push({
		path: "/functionalDesign/Interface/interfaceTest",
		query: { id: String(row.id) },
	});
}

async function handleCategorySuccess() {
	await loadTree();
	loadData();
}

async function handleDelete(row: DataInterface) {
	await ElMessageBox.confirm(`确定删除接口「${row.name}」吗？`, "提示", {
		type: "warning",
	});
	await deleteInterface([row.id!]);
	ElMessage.success("删除成功");
	loadData();
}

onMounted(async () => {
	await loadTree();
	loadData();
});
</script>

<style scoped>
.data-interface-page {
	height: 100%;
	padding: 0;
	font-size: 15px;
	overflow: hidden;
}

.page-layout {
	display: flex;
	gap: 16px;
	height: 100%;
	min-height: 0;
}

/* 统一加大页面内 Element 控件文字 */
.data-interface-page :deep(.el-form-item__label),
.data-interface-page :deep(.el-input__inner),
.data-interface-page :deep(.el-select__placeholder),
.data-interface-page :deep(.el-select__selected-item),
.data-interface-page :deep(.el-tree-node__label),
.data-interface-page :deep(.el-table),
.data-interface-page :deep(.el-pagination) {
	font-size: 15px;
}

.data-interface-page :deep(.el-tree-node__content) {
	height: 34px;
}

.layout-sidebar {
	width: 260px;
	flex-shrink: 0;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.layout-content {
	flex: 1;
	min-width: 0;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

/* 让左侧树占满剩余高度 */
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

.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 0 16px;
	flex-shrink: 0;
}

.header-left {
	display: flex;
	align-items: baseline;
	gap: 12px;
}

.page-title {
	margin: 0;
	font-size: 24px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.page-desc {
	font-size: 15px;
	color: var(--el-text-color-secondary);
}

.search-bar {
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 14px 18px;
	margin-bottom: 12px;
	flex-shrink: 0;
}

.search-bar :deep(.el-form-item) {
	margin-bottom: 0;
}

.search-bar :deep(.el-input__wrapper),
.search-bar :deep(.el-select__wrapper) {
	height: 38px;
}

.search-bar :deep(.el-button) {
	font-size: 15px;
}

.table-area {
	flex: 1;
	min-height: 0;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 12px;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.table-area :deep(.el-table) {
	--el-table-border-color: var(--el-border-color-lighter);
	border-radius: 6px;
	flex: 1;
}

.table-area :deep(.el-table th.el-table__cell) {
	background: var(--el-fill-color-lighter);
	font-weight: 600;
	font-size: 15px;
	color: var(--el-text-color-primary);
}

.table-area :deep(.el-table .el-table__cell) {
	padding: 10px 0;
}

.iface-name-cell {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.name-text {
	font-weight: 600;
	font-size: 16px;
	color: var(--el-text-color-primary);
	cursor: pointer;
	transition: color 0.15s;
}

.name-text:hover {
	color: var(--el-color-primary);
}

.desc-text {
	font-size: 14px;
	color: var(--el-text-color-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 260px;
}

.request-cell {
	display: flex;
	align-items: center;
	gap: 8px;
}

.method-tag {
	font-weight: 700;
	font-size: 14px;
	min-width: 62px;
	text-align: center;
}

.path-text {
	font-family: "Consolas", "Menlo", "Courier New", monospace;
	font-size: 15px;
	color: var(--el-text-color-regular);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex: 1;
	min-width: 0;
}

.table-pagination {
	margin-top: 12px;
	display: flex;
	justify-content: flex-end;
	flex-shrink: 0;
}
</style>