<template>
	<div class="system-page">
		<!-- 查询 -->
		<el-card shadow="never" class="search-bar">
			<el-input
				v-model="queryParams.username"
				placeholder="请输入用户名"
				clearable
				style="width: 220px"
				@keyup.enter="handleQuery"
			/>
			<el-button type="primary" :icon="Search" @click="handleQuery"
				>查询</el-button
			>
			<el-button :icon="Refresh" @click="resetQuery">重置</el-button>
			<el-button
				v-hasPermi="['system:user:add']"
				type="primary"
				:icon="Plus"
				@click="openDialog()"
			>
				新增用户
			</el-button>
			<el-button @click="getFiles()"> 查询文件 </el-button>
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
					v-if="false"
					prop="id"
					label="ID"
					width="70"
					align="center"
				/>
				<el-table-column
					type="index"
					label="序号"
					width="70"
					align="center"
					:index="indexMethod"
				/>
				<el-table-column prop="username" label="用户名" min-width="110" />
				<el-table-column prop="nickname" label="昵称" min-width="110" />
				<el-table-column label="角色" min-width="140">
					<template #default="{ row }">
						<el-tag
							v-for="rid in row.roleIds || []"
							:key="rid"
							size="small"
							class="role-tag"
							:type="roleCodeOf(rid) === 'admin' ? 'danger' : 'info'"
						>
							{{ roleNameOf(rid) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="phone" label="手机号" min-width="120" />
				<el-table-column prop="email" label="邮箱" min-width="170" />
				<el-table-column label="状态" width="90" align="center">
					<template #default="{ row }">
						<el-switch
							v-model="row.status"
							active-value="0"
							inactive-value="1"
							@change="handleStatusChange(row)"
						/>
					</template>
				</el-table-column>
				<el-table-column prop="createTime" label="创建时间" min-width="160" />
				<el-table-column label="操作" width="230" fixed="right" align="center">
					<template #default="{ row }">
						<el-button
							v-hasPermi="['system:user:edit']"
							type="primary"
							link
							@click="openDialog(row)"
						>
							修改
						</el-button>
						<el-button
							v-hasPermi="['system:user:assignRole']"
							type="warning"
							link
							@click="openDialog(row, true)"
						>
							分配角色
						</el-button>
						<el-button
							v-hasPermi="['system:user:remove']"
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

		<!-- 新增 / 修改 / 分配角色 -->
		<el-dialog
			v-model="dialogVisible"
			:title="dialogTitle"
			width="520px"
			:close-on-click-modal="false"
			@closed="resetForm"
		>
			<el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
				<el-form-item label="用户名" prop="username">
					<el-input
						v-model="form.username"
						:disabled="isEdit"
						placeholder="登录账号"
					/>
				</el-form-item>
				<el-form-item v-if="!assignOnly" label="昵称" prop="nickname">
					<el-input v-model="form.nickname" placeholder="请输入昵称" />
				</el-form-item>
				<el-form-item v-if="!assignOnly" label="密码">
					<el-input
						v-model="form.password"
						type="password"
						show-password
						:placeholder="isEdit ? '留空则不修改密码' : '请输入初始密码'"
					/>
				</el-form-item>
				<el-form-item label="角色" prop="roleIds">
					<el-select
						v-model="form.roleIds"
						multiple
						collapse-tags
						placeholder="请选择角色"
						style="width: 100%"
					>
						<el-option
							v-for="role in roleOptions"
							:key="role.id"
							:label="role.roleName"
							:value="role.id!"
						/>
					</el-select>
				</el-form-item>
				<template v-if="!assignOnly">
					<el-form-item label="手机号">
						<el-input v-model="form.phone" placeholder="请输入手机号" />
					</el-form-item>
					<el-form-item label="邮箱">
						<el-input v-model="form.email" placeholder="请输入邮箱" />
					</el-form-item>
					<el-form-item label="状态">
						<el-radio-group v-model="form.status">
							<el-radio value="0">正常</el-radio>
							<el-radio value="1">停用</el-radio>
						</el-radio-group>
					</el-form-item>
				</template>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible = false">取消</el-button>
				<el-button type="primary" :loading="submitLoading" @click="handleSubmit"
					>确定</el-button
				>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: "SystemUserView" });
import { onMounted, reactive, ref } from "vue";
import {
	ElMessage,
	ElMessageBox,
	type FormInstance,
	type FormRules,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import {
	addUser,
	deleteUsers,
	pageUsers,
	updateUser,
	getFileschange,
} from "@/api/user";
import { listRoles } from "@/api/role";
import type { SysRole, SysUser } from "@/types";

const loading = ref(false);
const tableData = ref<SysUser[]>([]);
const total = ref(0);
const roleOptions = ref<SysRole[]>([]);

const queryParams = reactive({
	pageNum: 1,
	pageSize: 10,
	username: "",
});

const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const assignOnly = ref(false);
const formRef = ref<FormInstance>();

const form = reactive<SysUser>({
	id: undefined,
	username: "",
	password: "",
	nickname: "",
	phone: "",
	email: "",
	status: "0",
	roleIds: [],
});

const rules: FormRules = {
	username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
	nickname: [{ required: true, message: "请输入昵称", trigger: "blur" }],
	password: [
		{
			validator: (_rule, value: string, callback) => {
				if (!isEdit.value && !value) {
					callback(new Error("请输入初始密码"));
				} else if (value && value.length < 6) {
					callback(new Error("密码长度不能少于 6 位"));
				} else {
					callback();
				}
			},
			trigger: "blur",
		},
	],
	roleIds: [
		{ required: true, type: "array", message: "请选择角色", trigger: "change" },
	],
};

const dialogTitle = ref("新增用户");

async function loadData() {
	loading.value = true;
	try {
		const res = await pageUsers(queryParams);
		tableData.value = res.list;
		total.value = res.total;
	} finally {
		loading.value = false;
	}
}

async function loadRoles() {
	roleOptions.value = await listRoles();
}

function roleNameOf(id: number) {
	return roleOptions.value.find((r) => r.id === id)?.roleName || `角色${id}`;
}

function roleCodeOf(id: number) {
	return roleOptions.value.find((r) => r.id === id)?.roleCode || "";
}

function indexMethod(index: number) {
	return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1;
}

function handleQuery() {
	queryParams.pageNum = 1;
	loadData();
}

function resetQuery() {
	queryParams.username = "";
	handleQuery();
}

function openDialog(row?: SysUser, onlyAssign = false) {
	assignOnly.value = onlyAssign;
	isEdit.value = !!row;
	dialogTitle.value = onlyAssign
		? "分配角色"
		: isEdit.value
			? "修改用户"
			: "新增用户";
	if (row) {
		Object.assign(form, {
			id: row.id,
			username: row.username,
			password: "",
			nickname: row.nickname,
			phone: row.phone,
			email: row.email,
			status: row.status,
			roleIds: [...(row.roleIds || [])],
		});
	} else {
		Object.assign(form, {
			id: undefined,
			username: "",
			password: "",
			nickname: "",
			phone: "",
			email: "",
			status: "0",
			roleIds: [],
		});
	}
	dialogVisible.value = true;
}

function resetForm() {
	formRef.value?.resetFields();
	Object.assign(form, { roleIds: [], password: "" });
}

async function handleSubmit() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		submitLoading.value = true;
		try {
			if (assignOnly.value) {
				await updateUser({ id: form.id, roleIds: form.roleIds });
				ElMessage.success("角色分配成功");
			} else if (isEdit.value) {
				await updateUser({ ...form });
				ElMessage.success("修改成功");
			} else {
				await addUser({ ...form });
				ElMessage.success("新增成功");
			}
			dialogVisible.value = false;
			loadData();
		} finally {
			submitLoading.value = false;
		}
	});
}

async function handleStatusChange(row: SysUser) {
	try {
		await updateUser({ id: row.id, status: row.status });
		ElMessage.success("状态已更新");
	} catch (e) {
		row.status = row.status === "0" ? "1" : "0";
	}
}

async function handleDelete(row: SysUser) {
	await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？`, "提示", {
		type: "warning",
	});
	await deleteUsers([row.id!]);
	ElMessage.success("删除成功");
	loadData();
}

async function getFiles() {
  try{
    const res = await getFileschange();
    console.log('获取文件列表成功', res)

  }catch(e){
    console.log('获取文件列表失败')
  }

}

onMounted(() => {
	loadRoles();
	loadData();
});
</script>

<style scoped>
.role-tag {
	margin-right: 4px;
	margin-bottom: 2px;
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
