<template>
	<div class="system-page">
		<!-- 查询 -->
		<el-card shadow="never" class="search-bar">
			<el-input
				v-model="queryParams.roleName"
				placeholder="请输入角色名称"
				clearable
				style="width: 220px"
				@keyup.enter="handleQuery"
			/>
			<el-button type="primary" :icon="Search" @click="handleQuery"
				>查询</el-button
			>
			<el-button :icon="Refresh" @click="resetQuery">重置</el-button>
			<el-button
				v-hasPermi="['system:role:add']"
				type="primary"
				:icon="Plus"
				@click="openDialog()"
			>
				新增角色
			</el-button>
		</el-card>

		<!-- 列表 -->
		<el-card shadow="never" class="table-card">
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
				<el-table-column
					type="index"
					label="序号"
					width="70"
					align="center"
					:index="indexMethod"
				/>
				<el-table-column  v-if="false" prop="id" label="ID" width="70" align="center" />

				<el-table-column prop="roleName" label="角色名称" min-width="130" />
				<el-table-column prop="roleCode" label="角色编码" min-width="130">
					<template #default="{ row }">
						<el-tag
							:type="row.roleCode === 'admin' ? 'danger' : 'info'"
							size="small"
						>
							{{ row.roleCode }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="状态" width="90" align="center">
					<template #default="{ row }">
						<el-tag
							:type="row.status === '0' ? 'success' : 'info'"
							size="small"
						>
							{{ row.status === "0" ? "正常" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					prop="remark"
					label="备注"
					min-width="180"
					show-overflow-tooltip
				/>
				<el-table-column prop="createTime" label="创建时间" min-width="160" />
				<el-table-column label="操作" width="300" fixed="right" align="center">
					<template #default="{ row }">
						<el-button
							v-hasPermi="['system:role:edit']"
							type="primary"
							link
							@click="openDialog(row)"
						>
							修改
						</el-button>
						<el-button
							v-hasPermi="['system:role:assignMenu']"
							type="success"
							link
							@click="openMenuDialog(row)"
						>
							分配菜单
						</el-button>
						<el-button
							v-hasPermi="['system:role:assignPermission']"
							type="warning"
							link
							@click="openPermDialog(row)"
						>
							分配权限
						</el-button>
						<el-button
							v-hasPermi="['system:role:remove']"
							type="danger"
							link
							@click="handleDelete(row)"
						>
							删除
						</el-button>
					</template>
				</el-table-column>
				</el-table>
			</div>

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

		<!-- 新增 / 修改 -->
		<el-dialog v-model="dialogVisible" :close-on-click-modal="false" :title="dialogTitle" width="480px">
			<el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
				<el-form-item label="角色名称" prop="roleName">
					<el-input v-model="form.roleName" placeholder="请输入角色名称" />
				</el-form-item>
				<el-form-item label="角色编码" prop="roleCode">
					<el-input v-model="form.roleCode" placeholder="如 admin / user" />
				</el-form-item>
				<el-form-item label="状态">
					<el-radio-group v-model="form.status">
						<el-radio value="0">正常</el-radio>
						<el-radio value="1">停用</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item label="备注">
					<el-input
						v-model="form.remark"
						type="textarea"
						:rows="3"
						placeholder="请输入备注"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible = false">取消</el-button>
				<el-button type="primary" :loading="submitLoading" @click="handleSubmit"
					>确定</el-button
				>
			</template>
		</el-dialog>

		<!-- 分配菜单 -->
		<el-dialog v-model="menuDialogVisible" title="分配菜单" width="480px">
			<div class="dialog-tip">
				勾选目录/菜单/按钮后保存，系统会自动包含半选的父级菜单
			</div>
			<el-tree
				ref="menuTreeRef"
				:data="menuTreeData"
				:props="{ label: 'menuName', children: 'children' }"
				node-key="id"
				show-checkbox
				default-expand-all
			>
				<template #default="{ data }">
					<span>{{ data.menuName }}</span>
					<el-tag
						size="small"
						class="menu-type-tag"
						:type="typeTag(data.menuType)"
					>
						{{ typeLabel(data.menuType) }}
					</el-tag>
					<span v-if="data.perms" class="menu-perms">{{ data.perms }}</span>
				</template>
			</el-tree>
			<template #footer>
				<el-button @click="menuDialogVisible = false">取消</el-button>
				<el-button
					type="primary"
					:loading="menuSubmit"
					@click="handleAssignMenus"
					>保存</el-button
				>
			</template>
		</el-dialog>

		<!-- 分配权限 -->
		<el-dialog v-model="permDialogVisible" title="分配权限" width="680px">
			<el-transfer
				v-model="permissionKeys"
				:data="permissionData"
				:titles="['未拥有', '已拥有']"
				:props="{ key: 'key', label: 'label' }"
				filterable
				filter-placeholder="搜索权限"
			/>
			<template #footer>
				<el-button @click="permDialogVisible = false">取消</el-button>
				<el-button
					type="primary"
					:loading="permSubmit"
					@click="handleAssignPermissions"
				>
					保存
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: "SystemRoleView" });
import { onMounted, reactive, ref } from "vue";
import {
	ElMessage,
	ElMessageBox,
	type FormInstance,
	type FormRules,
} from "element-plus";
import type { ElTree } from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import {
	addRole,
	assignRoleMenus,
	assignRolePermissions,
	deleteRoles,
	getRole,
	pageRoles,
	updateRole,
} from "@/api/role";
import { treeMenus } from "@/api/menu";
import { listPermissions } from "@/api/permission";
import type { SysMenu, SysPermission, SysRole } from "@/types";

const loading = ref(false);
const tableData = ref<SysRole[]>([]);
const total = ref(0);

const queryParams = reactive({
	pageNum: 1,
	pageSize: 10,
	roleName: "",
});

// 新增 / 修改
const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const dialogTitle = ref("新增角色");
const formRef = ref<FormInstance>();

const form = reactive<SysRole>({
	id: undefined,
	roleName: "",
	roleCode: "",
	status: "0",
	remark: "",
});

const rules: FormRules = {
	roleName: [{ required: true, message: "请输入角色名称", trigger: "blur" }],
	roleCode: [{ required: true, message: "请输入角色编码", trigger: "blur" }],
};

// 分配菜单
const menuDialogVisible = ref(false);
const menuSubmit = ref(false);
const menuTreeRef = ref<InstanceType<typeof ElTree>>();
const menuTreeData = ref<SysMenu[]>([]);
let currentRoleId = 0;

// 分配权限
const permDialogVisible = ref(false);
const permSubmit = ref(false);
const permissionKeys = ref<number[]>([]);
const permissionData = ref<{ key: number; label: string }[]>([]);

async function loadData() {
	loading.value = true;
	try {
		const res = await pageRoles(queryParams);
		tableData.value = res.list;
		total.value = res.total;
	} finally {
		loading.value = false;
	}
}

function handleQuery() {
	queryParams.pageNum = 1;
	loadData();
}

function resetQuery() {
	queryParams.roleName = "";
	handleQuery();
}

function openDialog(row?: SysRole) {
	isEdit.value = !!row;
	dialogTitle.value = isEdit.value ? "修改角色" : "新增角色";
	if (row) {
		Object.assign(form, {
			id: row.id,
			roleName: row.roleName,
			roleCode: row.roleCode,
			status: row.status,
			remark: row.remark,
		});
	} else {
		Object.assign(form, {
			id: undefined,
			roleName: "",
			roleCode: "",
			status: "0",
			remark: "",
		});
	}
	dialogVisible.value = true;
}

async function handleSubmit() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		submitLoading.value = true;
		try {
			if (isEdit.value) {
				await updateRole({ ...form });
			} else {
				await addRole({ ...form });
			}
			ElMessage.success(isEdit.value ? "修改成功" : "新增成功");
			dialogVisible.value = false;
			loadData();
		} finally {
			submitLoading.value = false;
		}
	});
}

async function openMenuDialog(row: SysRole) {
	currentRoleId = row.id!;
	const [detail, tree] = await Promise.all([getRole(row.id!), treeMenus()]);
	menuTreeData.value = tree;
	menuDialogVisible.value = true;
	// 等待树渲染后回填选中
	setTimeout(() => {
		menuTreeRef.value?.setCheckedKeys(detail.menuIds || []);
	}, 50);
}

async function handleAssignMenus() {
	if (!menuTreeRef.value) return;
	const checked = menuTreeRef.value.getCheckedKeys() as number[];
	const halfChecked = menuTreeRef.value.getHalfCheckedKeys() as number[];
	const menuIds = Array.from(new Set([...checked, ...halfChecked]));
	menuSubmit.value = true;
	try {
		await assignRoleMenus(currentRoleId, menuIds);
		ElMessage.success("菜单分配成功");
		menuDialogVisible.value = false;
	} finally {
		menuSubmit.value = false;
	}
}

async function openPermDialog(row: SysRole) {
	currentRoleId = row.id!;
	const [detail, perms] = await Promise.all([
		getRole(row.id!),
		listPermissions(),
	]);
	permissionData.value = perms.map((p) => ({
		key: p.id!,
		label: `${p.permissionName}（${p.permissionCode}）`,
	}));
	permissionKeys.value = detail.permissionIds || [];
	permDialogVisible.value = true;
}

async function handleAssignPermissions() {
	permSubmit.value = true;
	try {
		await assignRolePermissions(currentRoleId, permissionKeys.value);
		ElMessage.success("权限分配成功");
		permDialogVisible.value = false;
	} finally {
		permSubmit.value = false;
	}
}

async function handleDelete(row: SysRole) {
	await ElMessageBox.confirm(
		`确定删除角色「${row.roleName}」吗？关联的用户/菜单/权限关系将一并解除。`,
		"提示",
		{ type: "warning" },
	);
	await deleteRoles([row.id!]);
	ElMessage.success("删除成功");
	loadData();
}

function typeLabel(type: string) {
	return { M: "目录", C: "菜单", F: "按钮" }[type] || type;
}

function typeTag(type: string) {
	return (
		({ M: "primary", C: "success", F: "warning" } as Record<string, string>)[
			type
		] || "info"
	);
}

function indexMethod(index: number) {
	return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1;
}

onMounted(loadData);
</script>

<style scoped>
.menu-type-tag {
	margin-left: 8px;
}

.menu-perms {
	margin-left: 8px;
	font-size: 12px;
	color: #909399;
}

.dialog-tip {
	font-size: 12px;
	color: #909399;
	margin-bottom: 12px;
}

/* ===== 页面整体：纵向 flex，撑满内容区高度 ===== */
.system-page {
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
	padding: 8px 12px;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
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
	height: 30px;
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
}

/* 表格容器：撑满剩余空间 */
.table-wrapper {
	flex: 1;
	min-height: 0;
}

/* 固定行高 38px，内容垂直居中 */
.table-wrapper :deep(.el-table .cell) {
	line-height: 35px;
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
</style>
