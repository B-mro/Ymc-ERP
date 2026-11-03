<template>
	<el-dialog
		v-model="innerVisible"
		:title="isEdit ? '编辑接口' : '新增接口'"
		width="560px"
		@closed="resetForm"
		:close-on-click-modal="false"
	>
		<!--
			【使用方式】
			<InterfaceDialog
				v-model:visible="dialogVisible"
				:row="currentRow"
				:category-options="flatTreeOptions"
				@success="loadData"
			/>

			【Props】
			- visible:     控制弹窗显隐 (v-model:visible)
			- row:         编辑时传入行数据, 为空则是新增模式
			- category-options: 分类下拉选项 [{ id, label }]

			【Events】
			- success: 提交成功后触发, 父组件可以刷新列表

			【对接 API】
			handleSubmit() 里有 TODO, 替换为真实接口调用
		-->

		<el-form
			ref="formRef"
			:model="form"
			:rules="rules"
			label-width="100px"
		>
			<el-form-item label="接口名称" prop="name">
				<el-input v-model="form.name" placeholder="请输入接口名称" />
			</el-form-item>
			<el-form-item label="请求路径" prop="path">
				<el-input v-model="form.path" placeholder="例如 /api/user/list" />
			</el-form-item>
			<el-form-item label="请求方式" prop="method">
				<el-select v-model="form.method" placeholder="请选择" style="width: 100%">
					<el-option label="GET" value="GET" />
					<el-option label="POST" value="POST" />
					<el-option label="PUT" value="PUT" />
					<el-option label="DELETE" value="DELETE" />
				</el-select>
			</el-form-item>
			<el-form-item label="所属分类">
				<el-select
					v-model="form.categoryId"
					placeholder="请选择分类"
					style="width: 100%"
					clearable
				>
					<el-option
						v-for="c in categoryOptions"
						:key="c.id"
						:label="c.label"
						:value="c.id"
					/>
				</el-select>
			</el-form-item>
			<el-form-item label="描述">
				<el-input
					v-model="form.description"
					type="textarea"
					:rows="3"
					placeholder="请输入接口描述"
				/>
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
import { addInterface, updateInterface, type DataInterface } from "@/api/dynamicInterface";

interface CategoryOption {
	id: number | string;
	label: string;
}

// ========== Props & Emits ==========
const props = defineProps<{
	/** 编辑时传入行数据, 为空则是新增 */
	row?: DataInterface | null;
	/** 分类下拉选项 */
	categoryOptions?: CategoryOption[];
	/** 默认分类 id(新增时自动带入) */
	defaultCategoryId?: number | string;
}>();

const emit = defineEmits<{
	/** 提交成功 */
	(e: "success"): void;
	/** 显隐变化 (v-model:visible) */
	(e: "update:visible", val: boolean): void;
}>();

// ========== 显隐控制 ==========
/** 外部通过 v-model:visible 控制, 内部用 innerVisible 双向同步 */
const visible = defineModel<boolean>("visible", { default: false });
const innerVisible = computed({
	get: () => visible.value,
	set: (v) => (visible.value = v),
});

const isEdit = computed(() => !!props.row?.id);

// ========== 表单 ==========
const formRef = ref<FormInstance>();
const submitLoading = ref(false);

const form = reactive<DataInterface>({
	id: undefined,
	name: "",
	path: "",
	method: "GET",
	categoryId: undefined,
	categoryName: "",
	description: "",
});

const rules: FormRules<DataInterface> = {
	name: [{ required: true, message: "请输入接口名称", trigger: "blur" }],
	path: [{ required: true, message: "请输入请求路径", trigger: "blur" }],
	method: [{ required: true, message: "请选择请求方式", trigger: "change" }],
};

// ========== 监听外部 row 变化, 回填表单 ==========
watch(
	() => props.row,
	(row) => {
		if (row) {
			Object.assign(form, row);
		} else {
			Object.assign(form, {
				id: undefined,
				name: "",
				path: "",
				method: "GET",
				categoryId: props.defaultCategoryId,
				categoryName: "",
				description: "",
			});
		}
	},
	{ immediate: true }
);

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
			const payload: any = {
				id: form.id,
				name: form.name,
				path: form.path,
				method: form.method,
				categoryId: form.categoryId,
				description: form.description,
				sqlContent: "",
				resultType: "LIST",
				params: [],
			};
			if (isEdit.value) {
				await updateInterface(payload);
			} else {
				await addInterface(payload);
			}

			ElMessage.success(isEdit.value ? "修改成功" : "新增成功");
			innerVisible.value = false;
			emit("success");
		} finally {
			submitLoading.value = false;
		}
	});
}
</script>