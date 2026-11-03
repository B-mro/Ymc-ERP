<template>
	<el-dialog
		v-model="innerVisible"
		title="新增分类"
		width="440px"
		@closed="resetForm"
		:close-on-click-modal="false"
	>
		<!--
			【使用方式】
			<CategoryDialog
				v-model:visible="categoryDialogVisible"
				:tree-data="treeData"
				:default-parent-id="queryParams.categoryId"
				@success="handleCategorySuccess"
			/>

			【Props】
			- visible:          控制弹窗显隐 (v-model:visible)
			- tree-data:        完整树数据(给 el-tree-select 用)
			- default-parent-id: 新增时默认选中的父节点

			【Events】
			- success: 提交成功后触发, 父组件应重新拉树 loadTree()

			【对接 API】
			handleSubmit() 里有 TODO, 替换为真实 API, 成功后 emit('success')
		-->

		<el-form
			ref="formRef"
			:model="form"
			:rules="rules"
			label-width="90px"
		>
			<el-form-item label="上级分类">
				<el-tree-select
					v-model="form.parentId"
					:data="treeData"
					:props="{ label: 'label', value: 'id', children: 'children' }"
					placeholder="请选择上级分类(不选则为根节点)"
					check-strictly
					clearable
					style="width: 100%"
				/>
			</el-form-item>
			<el-form-item label="分类名称" prop="label">
				<el-input v-model="form.label" placeholder="请输入分类名称" />
			</el-form-item>
			<el-form-item label="排序">
				<el-input-number v-model="form.sort" :min="0" :max="999" />
			</el-form-item>
		</el-form>

		<template #footer>
			<el-button @click="innerVisible = false">取消</el-button>
			<el-button type="primary" :loading="submitLoading" @click="handleSubmit">
				确定
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { addCategory, updateCategory } from "@/api/dynamicInterface";
import type { CategoryForm } from "@/api/dynamicInterface";


/** 树节点结构(与 TreePanel / 父页面保持一致) */
export interface TreeNode {
	id: number | string;
	label?: string;
	children?: TreeNode[];
	[key: string]: any;
}

// ========== Props & Emits ==========
defineProps<{
	/** 完整树数据(给 el-tree-select 用) */
	treeData?: TreeNode[];
	/** 新增时默认选中的父节点 id */
	defaultParentId?: number | string;
}>();

const emit = defineEmits<{
	/** 提交成功 */
	(e: "success"): void;
	/** 显隐变化 (v-model:visible) */
	(e: "update:visible", val: boolean): void;
}>();

// ========== 显隐控制 ==========
const visible = defineModel<boolean>("visible", { default: false });
const innerVisible = computed({
	get: () => visible.value,
	set: (v) => (visible.value = v),
});

// ========== 表单 ==========
const formRef = ref<FormInstance>();
const submitLoading = ref(false);

interface CategoryForm {
	parentId?: number | string;
	label: string;
	sort: number;
}

const form = reactive<CategoryForm>({
	parentId: undefined,
	label: "",
	sort: 0,
});

const rules: FormRules<CategoryForm> = {
	label: [{ required: true, message: "请输入分类名称", trigger: "blur" }],
};

// 每次打开弹窗重置表单
watch(visible, (val) => {
	if (val) {
		form.label = "";
		form.sort = 0;
	}
});

// ========== 方法 ==========
function resetForm() {
	formRef.value?.resetFields();
}

async function handleSubmit() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		submitLoading.value = true;
		try {
			await addCategory({
				parentId: form.parentId || 0,
				name: form.label,
				orderNum: form.sort,
			});

			ElMessage.success("分类新增成功");
			innerVisible.value = false;
			emit("success");
		} finally {
			submitLoading.value = false;
		}
	});
}
</script>