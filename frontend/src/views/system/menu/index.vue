<template>
	<div>
		<el-card shadow="never" class="search-bar">
			<el-input
				v-model="menuName"
				placeholder="请输入菜单名称"
				clearable
				style="width: 220px"
				@keyup.enter="loadData"
			/>
			<el-button type="primary" :icon="Search" @click="loadData"
				>查询</el-button
			>
			<el-button :icon="Refresh" @click="resetSearch">重置</el-button>
			<el-button
				v-hasPermi="['system:menu:add']"
				type="primary"
				:icon="Plus"
				@click="openDialog()"
			>
				新增菜单
			</el-button>
		</el-card>

		<el-card shadow="never">
			<el-table
				v-loading="loading"
				:data="tableData"
				row-key="id"
				border
				default-expand-all
				:tree-props="{ children: 'children' }"
			>
				<el-table-column prop="menuName" label="菜单名称" min-width="200">
					<template #default="{ row }">
						<el-icon v-if="row.icon" class="menu-name-icon">
							<component :is="row.icon" />
						</el-icon>
						{{ row.menuName }}
					</template>
				</el-table-column>
				<el-table-column label="类型" width="80" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="typeTag(row.menuType)">{{
							typeLabel(row.menuType)
						}}</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="perms" label="权限标识" min-width="200" />
				<el-table-column prop="path" label="路由地址" min-width="120" />
				<el-table-column prop="component" label="组件路径" min-width="170" />
				<el-table-column
					prop="orderNum"
					label="排序"
					width="70"
					align="center"
				/>
				<el-table-column label="可见" width="70" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="row.visible === '0' ? '' : 'info'">
							{{ row.visible === "0" ? "显示" : "隐藏" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="状态" width="70" align="center">
					<template #default="{ row }">
						<el-tag
							size="small"
							:type="row.status === '0' ? 'success' : 'danger'"
						>
							{{ row.status === "0" ? "正常" : "停用" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="操作" width="220" fixed="right" align="center">
					<template #default="{ row }">
						<el-button
							v-if="row.menuType !== 'F'"
							v-hasPermi="['system:menu:add']"
							type="success"
							link
							@click="openDialog(undefined, row)"
						>
							新增子项
						</el-button>
						<el-button
							v-hasPermi="['system:menu:edit']"
							type="primary"
							link
							@click="openDialog(row)"
						>
							修改
						</el-button>
						<el-button
							v-hasPermi="['system:menu:remove']"
							type="danger"
							link
							@click="handleDelete(row)"
						>
							删除
						</el-button>
					</template>
				</el-table-column>
			</el-table>
		</el-card>

		<!-- 新增 / 修改 -->
		<el-dialog
			v-model="dialogVisible"
			:title="dialogTitle"
			width="560px"
			@closed="resetForm"
			:close-on-click-modal="false"
		>
			<el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
				<el-form-item label="上级菜单">
					<el-select
						v-model="form.parentId"
						placeholder="请选择上级菜单"
						style="width: 100%"
					>
						<el-option :value="0" label="顶级目录" />
						<el-option
							v-for="opt in parentOptions"
							:key="opt.id"
							:value="opt.id"
							:label="opt.label"
						/>
					</el-select>
				</el-form-item>
				<el-form-item label="菜单类型" prop="menuType">
					<el-radio-group v-model="form.menuType" @change="handleTypeChange">
						<el-radio value="M">目录</el-radio>
						<el-radio value="C">菜单</el-radio>
						<el-radio value="F">按钮</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item label="菜单名称" prop="menuName">
					<el-input v-model="form.menuName" placeholder="请输入菜单名称" />
				</el-form-item>
				<el-form-item v-if="form.menuType !== 'F'" label="路由地址" prop="path">
					<el-input
						v-model="form.path"
						:placeholder="form.menuType === 'M' ? '如 /system' : '如 user'"
					/>
				</el-form-item>
				<el-form-item v-if="form.menuType !== 'F'" label="组件路径">
					<el-input
						v-model="form.component"
						:placeholder="
							form.menuType === 'M'
								? '目录固定为 Layout'
								: '如 system/user/index'
						"
					/>
				</el-form-item>
				<el-form-item
					label="权限标识"
					:prop="form.menuType === 'F' ? 'perms' : undefined"
				>
					<el-input v-model="form.perms" placeholder="如 system:user:list" />
				</el-form-item>
				<el-form-item v-if="form.menuType !== 'F'" label="图标">
					<el-select
						v-model="form.icon"
						filterable
						allow-create
						default-first-option
						clearable
						placeholder="选择或输入图标名"
						style="width: 100%"
					>
						<el-option
							v-for="icon in iconOptions"
							:key="icon"
							:value="icon"
							:label="icon"
						>
							<el-icon><component :is="icon" /></el-icon>
							<span style="margin-left: 8px">{{ icon }}</span>
						</el-option>
					</el-select>
				</el-form-item>
				<el-form-item v-if="form.menuType !== 'F'" label="显示排序">
					<el-input-number v-model="form.orderNum" :min="0" :max="999" />
				</el-form-item>
				<el-form-item v-if="form.menuType !== 'F'" label="是否可见">
					<el-radio-group v-model="form.visible">
						<el-radio value="0">显示</el-radio>
						<el-radio value="1">隐藏</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item label="状态">
					<el-radio-group v-model="form.status">
						<el-radio value="0">正常</el-radio>
						<el-radio value="1">停用</el-radio>
					</el-radio-group>
				</el-form-item>
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
defineOptions({ name: "SystemMenuView" });
import { onMounted, reactive, ref } from "vue";
import {
	ElMessage,
	ElMessageBox,
	type FormInstance,
	type FormRules,
} from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import { addMenu, deleteMenu, treeMenus, updateMenu } from "@/api/menu";
import type { SysMenu } from "@/types";

const loading = ref(false);
const menuName = ref("");
const tableData = ref<SysMenu[]>([]);

const dialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const dialogTitle = ref("新增菜单");
const formRef = ref<FormInstance>();

const iconOptions = [
	"Setting",
	"User",
	"UserFilled",
	"Menu",
	"Key",
	"HomeFilled",
	"Tools",
	"Document",
	"Files",
	"Location",
	"Bell",
	"Monitor",
	"DataAnalysis",
];

const defaultForm = (): SysMenu => ({
	parentId: 0,
	menuName: "",
	menuType: "M",
	path: "",
	component: "Layout",
	perms: "",
	icon: "",
	orderNum: 0,
	visible: "0",
	status: "0",
});

const form = reactive<SysMenu>(defaultForm());

const rules: FormRules = {
	menuName: [{ required: true, message: "请输入菜单名称", trigger: "blur" }],
	menuType: [{ required: true, message: "请选择菜单类型", trigger: "change" }],
	path: [{ required: true, message: "请输入路由地址", trigger: "blur" }],
	perms: [{ required: true, message: "按钮必须填写权限标识", trigger: "blur" }],
};

// 上级菜单下拉（拍平树，仅目录/菜单）
const parentOptions = ref<{ id: number; label: string }[]>([]);

function buildParentOptions(list: SysMenu[], depth = 0) {
	for (const item of list) {
		if (item.menuType !== "F") {
			parentOptions.value.push({
				id: item.id!,
				label: `${"├ ".repeat(depth)}${item.menuName}`,
			});
		}
		if (item.children?.length) {
			buildParentOptions(item.children, depth + 1);
		}
	}
}

async function loadData() {
	loading.value = true;
	try {
		tableData.value = await treeMenus(menuName.value || undefined);
		parentOptions.value = [];
		buildParentOptions(tableData.value);
	} finally {
		loading.value = false;
	}
}

function resetSearch() {
	menuName.value = "";
	loadData();
}

function openDialog(row?: SysMenu, parent?: SysMenu) {
	isEdit.value = !!row;
	Object.assign(form, defaultForm());
	if (row) {
		dialogTitle.value = "修改菜单";
		Object.assign(form, JSON.parse(JSON.stringify(row)));
		delete form.children;
	} else {
		dialogTitle.value = "新增菜单";
		if (parent) {
			form.parentId = parent.id;
			// 目录下默认新增菜单，菜单下默认新增按钮
			form.menuType = parent.menuType === "M" ? "C" : "F";
			form.component = "";
		}
	}
	dialogVisible.value = true;
}

function handleTypeChange(type: string | number | boolean | undefined) {
	if (type === "M") {
		form.component = "Layout";
		form.perms = "";
	} else if (type === "C") {
		if (form.component === "Layout") form.component = "";
	} else if (type === "F") {
		form.path = "";
		form.component = "";
	}
}

function resetForm() {
	formRef.value?.resetFields();
	Object.assign(form, defaultForm());
}

async function handleSubmit() {
	if (!formRef.value) return;
	// 按钮不校验 path
	const valid = await formRef.value.validate().catch(() => false);
	if (!valid) return;

	const payload: SysMenu = { ...form };
	if (payload.menuType === "M") {
		payload.component = "Layout";
		payload.perms = "";
	} else if (payload.menuType === "F") {
		payload.path = "";
		payload.component = "";
	}
	submitLoading.value = true;
	try {
		if (isEdit.value) {
			await updateMenu(payload);
			ElMessage.success("修改成功");
		} else {
			delete payload.id;
			await addMenu(payload);
			ElMessage.success("新增成功");
		}
		dialogVisible.value = false;
		loadData();
	} finally {
		submitLoading.value = false;
	}
}

async function handleDelete(row: SysMenu) {
	await ElMessageBox.confirm(`确定删除菜单「${row.menuName}」吗？`, "提示", {
		type: "warning",
	});
	await deleteMenu(row.id!);
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

onMounted(loadData);
</script>

<style scoped>
.menu-name-icon {
	vertical-align: -2px;
	margin-right: 4px;
	color: #409eff;
}
</style>
