<template>
	<div
		class="page-container interface-form-page"
		v-loading="pageLoading"
		element-loading-text="加载中..."
	>
		<div class="page-layout">
			<div class="layout-sidebar">
				<TreePanel
					:tree-data="treeData"
					title="接口分类" 
					@node-click="handleTreeClick"
				/>

				<el-card shadow="never" class="tree-card db-table-card">
					<div class="tree-header">
						<div class="tree-header-top">
							<span class="tree-title">数据库表</span>
							<el-button
								link
								size="small"
								:icon="Refresh"
								@click="loadDatabaseTables"
								>刷新</el-button
							>
						</div>
					</div>
					<div v-loading="tablesLoading" class="db-tree-wrap">
						<el-tree
							ref="dbTreeRef"
							class="db-tree"
							:data="dbTreeData"
							node-key="id"
							highlight-current
							lazy
							:load="loadDbNode"
							expand-on-click-node
							:filter-node-method="
								(v: string, n: { label: string; }) => !v || (n.label as string)?.includes(v)
							"
							@node-click="handleDbNodeClick"
						>
							<template #default="{ node, data }">
								<div class="db-node-label">
									<el-icon
										v-if="data.meta?.type === 'table'"
										class="node-icon table-icon"
										><Grid
									/></el-icon>
									<el-icon
										v-else-if="data.meta?.key === 'PRI'"
										class="node-icon pk-icon"
										><Key
									/></el-icon>
									<el-icon v-else class="node-icon col-icon"
										><Document
									/></el-icon>
									<span class="node-name">{{ data.label }}</span>
									<span v-if="data.meta?.type === 'column'" class="node-type">{{
										data.meta.typeLabel
									}}</span>
									<span
										v-if="
											data.meta?.type === 'column' && data.meta?.key === 'PRI'
										"
										class="node-pk"
										>PK</span
									>
								</div>
							</template>
						</el-tree>
					</div>
					<div class="db-filter">
						<el-input
							v-model="dbFilter"
							size="small"
							placeholder="搜索表名/字段"
							clearable
							:prefix-icon="Search"
						/>
					</div>
				</el-card>
			</div>

			<div class="layout-content">
				<div v-if="!savedSuccess" class="top-bar">
					<div class="top-meta">
						<span class="mode-tag">{{ isEdit ? "编辑接口" : "新增接口" }}</span>
						<span class="meta-sep">·</span>
						<span class="meta-text" v-if="form.name">{{ form.name }}</span>
						<span class="meta-text dim" v-else>未命名接口</span>
					</div>
				</div>

				<div v-if="!savedSuccess" class="steps-rail">
					<div
						v-for="(step, idx) in steps"
						:key="idx"
						class="step-node"
						:class="{ active: currentStep === idx, done: currentStep > idx }"
						@click="jumpStep(idx)"
					>
						<div class="step-circle">
							<el-icon v-if="currentStep > idx"><Check /></el-icon>
							<span v-else>{{ idx + 1 }}</span>
						</div>
						<div class="step-meta">
							<div class="step-title">{{ step.title }}</div>
							<div class="step-desc">{{ step.desc }}</div>
						</div>
						<div v-if="idx < steps.length - 1" class="step-line" />
					</div>
				</div>

				<!-- ========= Step 1 ========= -->
				<div v-if="!savedSuccess" v-show="currentStep === 0" class="step-panel">
					<div class="step1-grid">
						<div class="step1-form-card">
							<div class="card-title">基本信息</div>
							<el-form
								ref="formRef"
								:model="form"
								:rules="rules"
								label-width="120px"
								class="step1-form"
							>
								<el-form-item label="接口名称" prop="name">
									<el-input
										v-model="form.name"
										placeholder="例如：用户分页查询"
									/>
								</el-form-item>
								<el-form-item label="请求路径" prop="path">
									<el-input v-model="form.path" placeholder="例如 /user/page" />
									<div class="form-tip">
										路径将以 /dapi 为前缀对外暴露, 实际调用:
										<code>/dapi{{ form.path || "你的路径" }}</code>
									</div>
								</el-form-item>
								<el-form-item label="请求方式" prop="method">
									<div class="method-group">
										<el-radio-group v-model="form.method" style="text-align: center;">
											<el-radio-button value="GET">GET</el-radio-button>
											<el-radio-button value="POST">POST</el-radio-button>
											<el-radio-button value="PUT">PUT</el-radio-button>
											<el-radio-button value="DELETE">DELETE</el-radio-button>
										</el-radio-group>
									</div>
								</el-form-item>
								<el-form-item label="返回类型">
									<el-radio-group v-model="form.resultType">
										<el-radio-button value="SINGLE">单条</el-radio-button>
										<el-radio-button value="LIST">列表</el-radio-button>
										<el-radio-button value="PAGE">分页</el-radio-button>
									</el-radio-group>
									<div class="form-tip">
										分页类型自动追加 pageNum/pageSize 参数
									</div>
								</el-form-item>
								<el-form-item label="所属分类">
									<el-tree-select
										v-model="form.categoryId"
										:data="treeData"
										:props="{
											label: 'label',
											value: 'id',
											children: 'children',
										}"
										placeholder="选择分类"
										check-strictly
										clearable
										style="width: 100%"
									/>
								</el-form-item>
								<el-form-item label="描述" class="span-two">
									<el-input
										v-model="form.description"
										type="textarea"
										:rows="3"
										placeholder="简要说明接口用途"
									/>
								</el-form-item>
							</el-form>
						</div>
					</div>
					<div class="step-footer">
						<el-button type="primary" size="large" @click="nextStep"
							>下一步：编写 SQL
							<el-icon class="el-icon--right"><ArrowRight /></el-icon
						></el-button>
					</div>
				</div>

				<!-- ========= Step 2 ========= -->
				<div v-if="!savedSuccess" v-show="currentStep === 1" class="step-panel">
					<div class="step2-grid">
						<div class="step2-sql-card">
							<div class="card-title-row">
								<div class="card-title">SQL 语句</div>
								<div class="card-tools">
									<el-button
										size="small"
										text
										@click="applySqlTemplate('user-list')"
										>📋 用户列表模板</el-button
									>
									<el-button
										size="small"
										text
										@click="applySqlTemplate('user-detail')"
										>📋 用户详情模板</el-button
									>
									<el-button
										size="small"
										text
										@click="applySqlTemplate('dynamic')"
										>📋 动态排序模板</el-button
									>
								</div>
							</div>
							<div class="sql-editor-wrap">
								<div class="sql-linenumbers">
									<div v-for="n in sqlLineCount" :key="n" class="sql-lineno">
										{{ n }}
									</div>
								</div>
								<textarea
									ref="sqlTextareaRef"
									v-model="form.sqlContent"
									class="sql-textarea"
									placeholder="SELECT id, name, status FROM sys_user WHERE status = #{status} AND username LIKE CONCAT('%', #{username}, '%')"
									spellcheck="false"
									@input="onSqlInput"
								/>
							</div>
							<div class="sql-status-bar">
								<span class="sql-hint">
									💡 <code>#{paramName}</code> 普通参数占位 ·
									<code>${paramName}</code> 动态片段占位
								</span>
								<span class="sql-stats">
									{{ sqlLineCount }} 行 ·
									{{ (form.sqlContent || "").length }} 字符
									<span v-if="detectedParams.length > 0"
										>· 检测到 {{ detectedParams.length }} 个参数</span
									>
								</span>
							</div>
						</div>

						<div class="step2-param-card">
							<div class="card-title-row">
								<div class="card-title">参数配置</div>
								<div class="card-tools">
									<el-button
										type="primary"
										size="large"
										class="add-param-btn"
										:icon="Plus"
										@click="openParamDialog()"
										>新增参数</el-button
									>
								</div>
							</div>

							<div class="param-body" v-if="form.params.length > 0">
								<div
									v-for="(p, idx) in form.params"
									:key="idx"
									class="param-row"
									:class="{
										detected:
											detectedParams.includes(p.paramName) && !p.interfaceId,
									}"
								>
									<div class="p-left">
										<span class="p-name">{{ p.paramName }}</span>
										<el-tag
											v-if="p.required"
											type="danger"
											size="small"
											effect="plain"
											>必填</el-tag
										>
										<el-tag v-if="p.type" size="small" effect="plain">{{
											p.type
										}}</el-tag>
										<el-tag
											v-if="p.position"
											type="info"
											size="small"
											effect="plain"
											>{{ p.position }}</el-tag
										>
									</div>
									<div class="p-right">
										<el-button
											type="primary"
											link
											size="small"
											@click="insertParamToSql(p)"
											>插入SQL</el-button
										>
										<el-button
											type="primary"
											link
											size="small"
											@click="openParamDialog(idx)"
											>编辑</el-button
										>
										<el-button
											type="danger"
											link
											size="small"
											@click="removeParam(idx)"
											>删除</el-button
										>
									</div>
								</div>
							</div>

							<el-empty
								v-else
								description="暂无参数, 点击右上角新增"
								:image-size="80"
								class="param-empty"
							/>
						</div>
					</div>
					<div class="step-footer">
						<el-button size="large" @click="prevStep">上一步</el-button>
						<el-button type="primary" size="large" @click="nextStep"
							>下一步：保存接口
							<el-icon class="el-icon--right"><ArrowRight /></el-icon
						></el-button>
					</div>
				</div>

				<!-- ========= Step 3 保存 ========= -->
				<div v-if="!savedSuccess" v-show="currentStep === 2" class="step-panel">
					<div class="save-panel">
						<el-alert
							type="info"
							:closable="false"
							:title="`请核对以下信息, 确认无误后点击右上角「${isEdit ? '保存修改' : '保存接口'}」按钮完成保存`"
							show-icon
						/>

						<div class="save-summary">
							<div class="save-row">
								<span class="save-label">接口名称</span>
								<span class="save-value">{{ form.name || "未填写" }}</span>
							</div>
							<div class="save-row">
								<span class="save-label">请求方式 / 路径</span>
								<span class="save-value">
									<el-tag
										:type="methodTagType(form.method)"
										effect="dark"
										size="small"
										class="save-method"
										>{{ form.method || "—" }}</el-tag
									>
									<span class="save-path">/dapi{{ form.path || "—" }}</span>
								</span>
							</div>
							<div class="save-row">
								<span class="save-label">所属分类</span>
								<span class="save-value">{{
									form.categoryName || "未选择"
								}}</span>
							</div>
							<div class="save-row">
								<span class="save-label">返回类型</span>
								<span class="save-value">{{
									(
										{ SINGLE: "单条", LIST: "列表", PAGE: "分页" } as Record<
											string,
											string
										>
									)[form.resultType || "LIST"] || form.resultType
								}}</span>
							</div>
							<div class="save-row">
								<span class="save-label">SQL 长度</span>
								<span class="save-value">{{
									form.sqlContent?.length || 0
								}} 字符 · {{ sqlLineCount }} 行</span>
							</div>
							<div class="save-row">
								<span class="save-label">参数数量</span>
								<span class="save-value">{{ form.params.length }} 个</span>
							</div>
							<div class="save-row" v-if="form.description">
								<span class="save-label">描述</span>
								<span class="save-value save-desc">{{
									form.description
								}}</span>
							</div>
						</div>
					</div>
					<div class="step-footer">
						<el-button size="large" @click="prevStep">上一步</el-button>
						<el-button
							type="primary"
							size="large"
							:loading="submitLoading"
							@click="handleSubmit"
						>
							{{ isEdit ? "保存修改" : "保存接口" }}
						</el-button>
					</div>
				</div>

				<!-- ========= 保存成功页 ========= -->
				<div v-if="savedSuccess" class="success-panel" v-loading="false">
					<el-result
						icon="success"
						title="保存成功"
						:sub-title="
							isEdit
								? '接口修改已保存并生效'
								: '接口创建成功, 已可通过右侧菜单或接口列表继续管理'
						"
					>
						<!-- <template #extra>
							<div class="success-actions">
								<el-button size="large" @click="handleNewInterface">
									继续新增
								</el-button>
								<el-button
									type="primary"
									size="large"
									@click="handleBackList"
								>
									返回接口列表
								</el-button>
							</div>
						</template> -->
					</el-result>
				</div>
			</div>
		</div>

		<el-dialog
			v-model="paramDialogVisible"
			:title="paramIsEdit ? '编辑参数' : '新增参数'"
			width="520px"
			:close-on-click-modal="false"
			@closed="resetParamForm"
		>
			<el-form
				ref="paramFormRef"
				:model="paramForm"
				:rules="paramRules"
				label-width="90px"
			>
				<el-form-item label="参数名" prop="paramName">
					<el-input
						v-model="paramForm.paramName"
						placeholder="SQL 中用 #{paramName} 引用"
					/>
				</el-form-item>
				<el-form-item label="字段名">
					<el-input
						v-model="paramForm.fieldName"
						placeholder="对应数据库字段, 如 id"
					/>
				</el-form-item>
				<el-form-item label="类型" prop="type">
					<el-select v-model="paramForm.type" style="width: 100%">
						<el-option label="String" value="String" />
						<el-option label="Number" value="Number" />
						<el-option label="Boolean" value="Boolean" />
						<el-option label="Date" value="Date" />
					</el-select>
				</el-form-item>
				<el-form-item label="位置">
					<el-select v-model="paramForm.position" clearable style="width: 100%">
						<el-option label="query (URL参数)" value="query" />
						<el-option label="path (路径参数)" value="path" />
						<el-option label="body (请求体)" value="body" />
						<el-option label="header" value="header" />
					</el-select>
				</el-form-item>
				<el-form-item label="必填">
					<el-switch v-model="paramForm.required" />
				</el-form-item>
				<el-form-item label="默认值">
					<el-input v-model="paramForm.defaultValue" placeholder="不传时使用" />
				</el-form-item>
				<el-form-item label="描述">
					<el-input
						v-model="paramForm.desc"
						type="textarea"
						:rows="2"
						placeholder="参数说明"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="paramDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="submitParamForm">保存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: "InterfaceFormView" });

import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	ArrowRight,
	Plus,
	Check,
	Grid,
	Key,
	Document,
	Refresh,
	Search,
} from "@element-plus/icons-vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import type { ElTree } from "element-plus";
import TreePanel from "@/layout/components/TreePanel.vue";
import {
	getCategoryTree,
	getInterfaceDetail,
	addInterface,
	updateInterface,
	listDatabaseTables,
	listTableColumns,
	type DataInterface,
	type ParamItem,
	type TreeNode,
	type TableMeta,
	type ColumnMeta,
} from "@/api/dynamicInterface";

const steps = [
	{ title: "基本信息", desc: "名称 / 路径 / 分类" },
	{ title: "SQL & 参数", desc: "编写 SQL 语句" },
	{ title: "保存", desc: "确认并保存接口" },
];

const route = useRoute();
const router = useRouter();
const mode = computed(() => (route.query.mode as string) || "add");
const isEdit = computed(() => mode.value === "edit");
const editId = computed(() => route.query.id as string | undefined);
const defaultCategoryId = computed(
	() => route.query.categoryId as string | undefined,
);

const currentStep = ref(0);
function jumpStep(idx: number) {
	if (idx === 0 || idx < currentStep.value) {
		currentStep.value = idx;
	} else if (idx === 1 && currentStep.value === 0) {
		formRef.value?.validate((valid) => {
			if (valid) currentStep.value = idx;
		});
	} else if (idx === 2) {
		currentStep.value = idx;
	}
}
function nextStep() {
	if (currentStep.value === 0) {
		formRef.value?.validate((valid) => {
			if (valid) currentStep.value++;
		});
	} else {
		currentStep.value++;
	}
}
function prevStep() {
	if (currentStep.value > 0) currentStep.value--;
}

const pageLoading = ref(false);
const submitLoading = ref(false);
const savedSuccess = ref(false);
const formRef = ref<FormInstance>();
const sqlTextareaRef = ref<HTMLTextAreaElement>();
const treeData = ref<TreeNode[]>([]);

const dbTreeRef = ref<InstanceType<typeof ElTree>>();
const dbTreeData = ref<any[]>([]);
const tablesLoading = ref(false);
const dbFilter = ref("");

watch(dbFilter, (val) => {
	dbTreeRef.value?.filter(val);
});

async function loadDatabaseTables() {
	tablesLoading.value = true;
	try {
		const tables: TableMeta[] = await listDatabaseTables();
		dbTreeData.value = tables.map((t) => ({
			id: "table:" + t.name,
			label: t.name,
			isLeaf: false,
			meta: { type: "table", name: t.name, comment: t.comment, rows: t.rows },
		}));
	} catch (e: any) {
		ElMessage.error("加载数据库表失败: " + (e?.message || e));
	} finally {
		tablesLoading.value = false;
	}
}

async function loadDbNode(node: any, resolve: (children: any[]) => void) {
	if (node.level === 0) {
		return resolve(dbTreeData.value);
	}
	const tableName = node.data?.meta?.name;
	if (!tableName) return resolve([]);
	try {
		const columns: ColumnMeta[] = await listTableColumns(tableName);
		resolve(
			columns.map((c) => ({
				id: `col:${tableName}:${c.name}`,
				label: c.name,
				isLeaf: true,
				meta: {
					type: "column",
					name: c.name,
					typeLabel: c.type,
					key: c.key,
					nullable: c.nullable,
					comment: c.comment,
				},
			})),
		);
	} catch {
		resolve([]);
	}
}

function handleDbNodeClick(data: any) {
	const type = data.meta?.type;
	if (!type) return;
	const value = data.meta.name;
	const ta = sqlTextareaRef.value;
	if (!ta) {
		form.sqlContent = (form.sqlContent || "") + value;
		ElMessage.success(`已追加 ${type === "table" ? "表名" : "字段"}: ${value}`);
		return;
	}
	const start = ta.selectionStart;
	const end = ta.selectionEnd;
	const sql = form.sqlContent ?? "";
	const before = sql.slice(0, start);
	const after = sql.slice(end);
	form.sqlContent = before + value + after;
	nextTick(() => {
		ta.focus();
		ta.setSelectionRange(start + value.length, start + value.length);
	});
	ElMessage.success(`已插入 ${type === "table" ? "表名" : "字段"}: ${value}`);
}

function handleTreeClick(node: TreeNode) {
	form.categoryId = node.id as any;
	form.categoryName = node.label || node.name || "";
}

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

const rules: FormRules<DataInterface> = {
	name: [{ required: true, message: "请输入接口名称", trigger: "blur" }],
	path: [{ required: true, message: "请输入请求路径", trigger: "blur" }],
	method: [{ required: true, message: "请选择请求方式", trigger: "change" }],
};

const methodTagType = (m: string) =>
	(
		({
			GET: "success",
			POST: "primary",
			PUT: "warning",
			DELETE: "danger",
		}) as Record<string, any>
	)[m] || "info";

const sqlLineCount = computed(() => {
	if (!form.sqlContent) return 1;
	return Math.max(1, form.sqlContent.split("\n").length);
});

function onSqlInput() {
	/* trigger recompute */
}

const detectedParams = computed(() => {
	const found = new Set<string>();
	const re = /#\{(\w+)\}/g;
	let m;
	while ((m = re.exec(form.sqlContent || "")) !== null) {
		found.add(m[1]);
	}
	return Array.from(found);
});

function applySqlTemplate(tpl: string) {
	const templates: Record<string, { sql: string; params?: ParamItem[] }> = {
		"user-list": {
			sql: "SELECT id, username, nickname, email, status, create_time\nFROM sys_user\nWHERE 1=1\n  AND (#{username} IS NULL OR username LIKE CONCAT('%', #{username}, '%'))\n  AND (#{status} IS NULL OR status = #{status})\nORDER BY create_time DESC",
			params: [
				{
					paramName: "username",
					fieldName: "username",
					type: "String",
					position: "query",
					required: false,
					defaultValue: "",
					desc: "用户名模糊搜索",
				},
				{
					paramName: "status",
					fieldName: "status",
					type: "Number",
					position: "query",
					required: false,
					defaultValue: "",
					desc: "用户状态",
				},
			],
		},
		"user-detail": {
			sql: "SELECT id, username, nickname, email, phone, status, create_time\nFROM sys_user\nWHERE id = #{userId}",
			params: [
				{
					paramName: "userId",
					fieldName: "id",
					type: "Number",
					position: "query",
					required: true,
					defaultValue: "",
					desc: "用户ID",
				},
			],
		},
		dynamic: {
			sql: "SELECT * FROM sys_user\nWHERE 1=1\n  AND (#{keyword} IS NULL OR username LIKE CONCAT('%', #{keyword}, '%') OR nickname LIKE CONCAT('%', #{keyword}, '%'))\nORDER BY ${sortField} ${sortOrder}",
			params: [
				{
					paramName: "keyword",
					fieldName: "",
					type: "String",
					position: "query",
					required: false,
					defaultValue: "",
					desc: "关键字搜索",
				},
				{
					paramName: "sortField",
					fieldName: "",
					type: "String",
					position: "query",
					required: false,
					defaultValue: "create_time",
					desc: "排序字段",
				},
				{
					paramName: "sortOrder",
					fieldName: "",
					type: "String",
					position: "query",
					required: false,
					defaultValue: "DESC",
					desc: "排序方向 ASC/DESC",
				},
			],
		},
	};
	const t = templates[tpl];
	if (!t) return;
	form.sqlContent = t.sql;
	if (t.params) form.params = t.params;
	ElMessage.success("模板已应用");
}

function removeParam(idx: number) {
	form.params.splice(idx, 1);
}

function insertParamToSql(p: ParamItem) {
	if (!p.paramName) return;
	const placeholder = `#{${p.paramName}}`;
	const ta = sqlTextareaRef.value;
	if (!ta) {
		form.sqlContent += placeholder;
		return;
	}
	const start = ta.selectionStart;
	const end = ta.selectionEnd;
	const sql = form.sqlContent ?? "";
	const before = sql.slice(0, start);
	const after = sql.slice(end);
	form.sqlContent = before + placeholder + after;
	nextTick(() => {
		ta.focus();
		ta.setSelectionRange(
			start + placeholder.length,
			start + placeholder.length,
		);
	});
}

const paramDialogVisible = ref(false);
const paramFormRef = ref<FormInstance>();
const paramEditIdx = ref<number | null>(null);
const paramIsEdit = computed(() => paramEditIdx.value !== null);

const paramForm = reactive<ParamItem>({
	paramName: "",
	fieldName: "",
	type: "String",
	position: "query",
	required: false,
	defaultValue: "",
	desc: "",
});

const paramRules = {
	paramName: [{ required: true, message: "请输入参数名", trigger: "blur" }],
	type: [{ required: true, message: "请选择参数类型", trigger: "change" }],
};

function openParamDialog(idx?: number) {
	if (idx !== undefined && idx !== null) {
		paramEditIdx.value = idx;
		Object.assign(paramForm, {
			paramName: form.params[idx].paramName,
			fieldName: form.params[idx].fieldName,
			type: form.params[idx].type,
			position: form.params[idx].position,
			required: form.params[idx].required,
			defaultValue: form.params[idx].defaultValue ?? "",
			desc: (form.params[idx] as any).desc ?? "",
		});
	} else {
		paramEditIdx.value = null;
		Object.assign(paramForm, {
			paramName: "",
			fieldName: "",
			type: "String",
			position: "query",
			required: false,
			defaultValue: "",
			desc: "",
		});
	}
	paramDialogVisible.value = true;
}

function resetParamForm() {
	paramFormRef.value?.resetFields();
}

async function submitParamForm() {
	if (!paramFormRef.value) return;
	await paramFormRef.value.validate((valid) => {
		if (!valid) return;
		const data: ParamItem = {
			paramName: paramForm.paramName.trim(),
			fieldName: paramForm.fieldName.trim(),
			type: paramForm.type,
			position: paramForm.position,
			required: paramForm.required,
			defaultValue: paramForm.defaultValue,
			desc: paramForm.desc,
		};
		if (paramIsEdit.value) {
			form.params[paramEditIdx.value!] = data;
			ElMessage.success("参数已更新");
		} else {
			form.params.push(data);
			ElMessage.success("参数已新增");
		}
		paramDialogVisible.value = false;
	});
}

async function loadTree() {
	treeData.value = await getCategoryTree();
}

async function loadDetail() {
	if (!isEdit.value || !editId.value) return;
	pageLoading.value = true;
	try {
		const res = await getInterfaceDetail(Number(editId.value));
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

async function handleSubmit() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) {
			currentStep.value = 0;
			return;
		}
		if (!(form.sqlContent ?? "").trim()) {
			ElMessage.warning("SQL 语句为空, 请先填写 SQL 语句");
			currentStep.value = 1;
			return;
		}
		submitLoading.value = true;
		try {
			const payload = {
				id: form.id,
				name: form.name,
				path: form.path,
				method: form.method,
				categoryId: form.categoryId,
				description: form.description,
				sqlContent: form.sqlContent,
				resultType: form.resultType,
				params: form.params.map((p) => ({
					paramName: p.paramName,
					fieldName: p.fieldName,
					type: p.type,
					position: p.position,
					required: p.required,
					defaultValue: p.defaultValue,
					description: p.desc || (p as any).description || "",
				})),
			};
			if (isEdit.value || form.id) {
				await updateInterface({ ...payload, id: form.id });
			} else {
				const res: any = await addInterface(payload);
				// 后端若返回新主键则记录, 后续继续保存按更新处理
				if (typeof res === "number") form.id = res;
				else if (res && typeof res.id === "number") form.id = res.id;
			}
			// 保存成功后切换到成功页, 不再展示步骤条
			savedSuccess.value = true;
		} finally {
			submitLoading.value = false;
		}
	});
}

/** 保存成功页: 返回接口列表 */
function handleBackList() {
	router.push("/functionalDesign/Interface/dataInterface");
}

/** 保存成功页: 继续新增接口 (重置表单) */
function handleNewInterface() {
	Object.assign(form, {
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
	savedSuccess.value = false;
	currentStep.value = 0;
}

onMounted(async () => {
	loadDatabaseTables();
	await loadTree();
	if (isEdit.value) {
		await loadDetail();
	} else {
		form.categoryId = defaultCategoryId.value;
	}
});
</script>

<style scoped>
/* ============ 页面整体: 全屏铺满、无页面滚动条 ============ */
.interface-form-page {
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

.success-panel {
	flex: 1;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	overflow: auto;
}

.success-panel :deep(.el-result__icon svg) {
	width: 72px;
	height: 72px;
}

.success-actions {
	display: flex;
	gap: 16px;
	justify-content: center;
	margin-top: 8px;
}

/* 统一加大页面内 Element 控件文字 */
.interface-form-page :deep(.el-form-item__label),
.interface-form-page :deep(.el-input__inner),
.interface-form-page :deep(.el-textarea__inner),
.interface-form-page :deep(.el-select__placeholder),
.interface-form-page :deep(.el-select__selected-item),
.interface-form-page :deep(.el-radio-button__inner),
.interface-form-page :deep(.el-radio__label),
.interface-form-page :deep(.el-tree-node__label),
.interface-form-page :deep(.el-tabs__item),
.interface-form-page :deep(.el-button) {
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
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
	font-weight: 600;
	font-size: 15px;
	padding: 4px 12px;
	border-radius: 12px;
}

.meta-sep {
	color: var(--el-text-color-placeholder);
	font-size: 15px;
}

.meta-text {
	font-weight: 600;
	font-size: 16px;
	color: var(--el-text-color-primary);
}
.meta-text.dim {
	color: var(--el-text-color-secondary);
	font-style: italic;
}

.top-actions {
	display: flex;
	gap: 8px;
}

/* ============ 步骤条 ============ */
.steps-rail {
	display: flex;
	align-items: stretch;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	padding: 14px 24px;
	margin-bottom: 12px;
	flex-shrink: 0;
}

.step-node {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 14px;
	position: relative;
	cursor: pointer;
}

.step-circle {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 16px;
	background: var(--el-fill-color);
	color: var(--el-text-color-secondary);
	border: 2px solid var(--el-border-color);
	transition: all 0.2s;
	flex-shrink: 0;
}

.step-node.active .step-circle {
	background: var(--el-color-primary);
	color: #fff;
	border-color: var(--el-color-primary);
}

.step-node.done .step-circle {
	background: var(--el-color-success);
	color: #fff;
	border-color: var(--el-color-success);
}

.step-meta .step-title {
	font-weight: 600;
	font-size: 16px;
	color: var(--el-text-color-primary);
}

.step-node.active .step-meta .step-title {
	color: var(--el-color-primary);
}

.step-meta .step-desc {
	font-size: 13px;
	color: var(--el-text-color-secondary);
	margin-top: 2px;
}

.step-line {
	position: absolute;
	top: 50%;
	left: calc(100% - 12px);
	width: 24px;
	height: 2px;
	background: var(--el-border-color);
	transform: translateY(-50%);
}

.step-node.done .step-line {
	background: var(--el-color-success);
}

/* ============ 步骤面板: 占满剩余高度 ============ */
.step-panel {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	padding: 20px;
	overflow: hidden;
}

.card-title {
	font-weight: 600;
	font-size: 17px;
	color: var(--el-text-color-primary);
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

.card-tools {
	display: flex;
	gap: 4px;
}

.form-tip {
	margin-top: 6px;
	font-size: 13px;
	color: var(--el-text-color-secondary);
}
.form-tip code {
	background: var(--el-fill-color);
	padding: 1px 6px;
	border-radius: 3px;
	font-family: Consolas, Menlo, monospace;
	font-size: 13px;
}

.method-group {
	width: 100%;
}

.step-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	padding-top: 14px;
	margin-top: 14px;
	border-top: 1px solid var(--el-border-color-lighter);
	flex-shrink: 0;
}

/* ============ Step 1 基本信息 (无内层边框, 双列表单更舒展) ============ */
.step1-grid {
	flex: 1;
	min-height: 0;
	display: flex;
}

.step1-form-card {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	background: var(--el-fill-color-lighter);
	border-radius: 8px;
	padding: 20px 28px 22px;
	overflow: hidden;
}

/* 卡片标题区: 背景与表单体区分开, 更像一个真正的 section 标题 */
.step1-form-card .card-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 17px;
	font-weight: 700;
	color: var(--el-text-color-primary);
	padding-bottom: 14px;
	margin-bottom: 18px;
	border-bottom: 1px dashed var(--el-border-color);
}

.step1-form-card .card-title::before {
	content: "";
	display: inline-block;
	width: 4px;
	height: 18px;
	background: var(--el-color-primary);
	border-radius: 2px;
	flex-shrink: 0;
}

/* 表单本体 */
.step1-form {
	flex: 1;
	display: grid;
	grid-template-columns: 1fr 1fr;
	column-gap: 44px;
	row-gap: 16px;
	align-content: start;
}

/* 覆盖 Element 默认 label 样式: 顶对齐+更宽 */
.step1-form :deep(.el-form-item) {
	margin-bottom: 0;
}

.step1-form :deep(.el-form-item__label) {
	font-size: 15px;
	font-weight: 500;
	color: var(--el-text-color-primary);
	line-height: 38px;
	padding-right: 12px;
}

.step1-form :deep(.el-form-item__content) {
	line-height: 38px;
}

/* 输入框 / 选择框统一高度, 与 label 等高更协调 */
.step1-form :deep(.el-input__wrapper),
.step1-form :deep(.el-select__wrapper),
.step1-form :deep(.el-textarea__inner) {
	height: 38px;
}

.step1-form :deep(.el-textarea__inner) {
	height: auto;
	min-height: 96px;
	line-height: 1.6;
	padding-top: 10px;
	padding-bottom: 10px;
}

/* radio-button 组高度 */
.step1-form :deep(.el-radio-button__inner) {
	height: 38px;
	line-height: 22px;
	text-align: center;
}

/* 带提示的表单项: content 改为 flex 纵向排布, 让 form-tip 紧贴在输入框正下方 */
.step1-form :deep(.el-form-item) {
	display: grid;
	grid-template-columns: 120px 1fr;
	align-items: start;
}

.step1-form :deep(.el-form-item__label) {
	text-align: right;
}

.step1-form :deep(.el-form-item__content) {
	min-width: 0;
}

/* 让 el-input / el-radio-group / el-tree-select 占满 content 宽度 */
.step1-form :deep(.el-input),
.step1-form :deep(.el-tree-select),
.step1-form :deep(.el-radio-group) {
	width: 100%;
}

/* form-tip 间距和样式 */
.step1-form :deep(.el-form-item) .form-tip {
	margin-top: 6px;
	font-size: 13px;
	line-height: 1.5;
	color: var(--el-text-color-secondary);
}

.step1-form :deep(.el-form-item) .form-tip code {
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-lighter);
	padding: 1px 6px;
	border-radius: 3px;
	font-family: Consolas, Menlo, monospace;
	font-size: 13px;
}

.step1-form .span-two {
	grid-column: span 2;
}

/* ============ Step 2 SQL & 参数 ============ */
.step2-grid {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: 2fr 1fr;
	gap: 20px;
}

.step2-sql-card,
.step2-param-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 16px;
	display: flex;
	flex-direction: column;
	min-height: 0;
	overflow: hidden;
}

.sql-editor-wrap {
	flex: 1;
	min-height: 0;
	display: flex;
	border: 1px solid var(--el-border-color);
	border-radius: 8px;
	overflow: hidden;
	background: var(--el-bg-color);
}

.sql-linenumbers {
	width: 44px;
	background: var(--el-fill-color-lighter);
	border-right: 1px solid var(--el-border-color-lighter);
	padding: 12px 8px;
	text-align: right;
	font-family: Consolas, Menlo, monospace;
	font-size: 15px;
	line-height: 1.6;
	color: var(--el-text-color-placeholder);
	user-select: none;
	overflow: hidden;
}

.sql-lineno {
	height: 24px;
}

.sql-textarea {
	flex: 1;
	height: 100%;
	padding: 12px 14px;
	border: none;
	outline: none;
	resize: none;
	font-family: Consolas, Menlo, "Courier New", monospace;
	font-size: 15px;
	line-height: 1.6;
	color: var(--el-text-color-primary);
	background: var(--el-bg-color);
	tab-size: 2;
}

.sql-status-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 10px;
	font-size: 13px;
	color: var(--el-text-color-secondary);
	flex-shrink: 0;
}

.sql-hint code {
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
	padding: 1px 6px;
	border-radius: 3px;
	font-family: Consolas, Menlo, monospace;
	font-size: 13px;
}

.sql-stats {
	color: var(--el-text-color-placeholder);
}

/* 新增参数按钮: 加大, 图标与文字水平对齐 */
.add-param-btn {
	height: 42px;
	padding: 0 22px;
	font-size: 15px;
	font-weight: 600;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
}

.add-param-btn :deep(.el-icon) {
	font-size: 18px;
	display: inline-flex;
	align-items: center;
}

/* 参数列表 */
.param-body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 2px 4px 4px;
}

.param-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	background: var(--el-fill-color-lighter);
	border-radius: 6px;
	margin-bottom: 8px;
	transition: background 0.15s;
}

.param-row:hover {
	background: var(--el-fill-color);
}

.param-row.detected {
	border: 1px dashed var(--el-color-primary-light-5);
}

.p-left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	font-size: 15px;
}

.p-name {
	font-family: Consolas, Menlo, monospace;
	font-weight: 600;
	font-size: 15px;
	color: var(--el-color-primary);
}

.p-right {
	display: flex;
	gap: 2px;
	flex-shrink: 0;
}

.param-empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

/* ============ Step 3 保存确认 ============ */
.save-panel {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.save-panel :deep(.el-alert) {
	flex-shrink: 0;
}

.save-summary {
	flex: 1;
	min-height: 0;
	background: var(--el-fill-color-lighter);
	border-radius: 8px;
	padding: 20px 28px;
	overflow: auto;
}

.save-row {
	display: grid;
	grid-template-columns: 130px 1fr;
	gap: 16px;
	align-items: flex-start;
	padding: 10px 0;
	border-bottom: 1px dashed var(--el-border-color-lighter);
	font-size: 15px;
}

.save-row:last-child {
	border-bottom: none;
}

.save-label {
	color: var(--el-text-color-secondary);
	font-weight: 500;
}

.save-value {
	color: var(--el-text-color-primary);
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}

.save-method {
	flex-shrink: 0;
}

.save-path {
	font-family: Consolas, Menlo, monospace;
	font-weight: 500;
}

.save-desc {
	font-weight: 400;
	line-height: 1.6;
	color: var(--el-text-color-regular);
}

/* 参数弹窗内文字同步加大 */
:deep(.el-dialog) {
	font-size: 15px;
}
:deep(.el-dialog__title) {
	font-size: 17px;
}

@media (max-width: 1100px) {
	.step1-form {
		grid-template-columns: 1fr;
	}
	.step1-form .span-two {
		grid-column: span 1;
	}
	.step2-grid {
		grid-template-columns: 1fr;
	}
}

/* ======== 数据库表树 ======== */
.db-table-card {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.db-table-card :deep(.el-card__body) {
	padding: 10px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.db-tree-wrap {
	flex: 1;
	min-height: 0;
	overflow: auto;
}

.db-tree {
	width: 100%;
}

.db-tree :deep(.el-tree-node__content) {
	height: 30px;
	padding-left: 6px;
}

.db-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
	background: #ecf5ff;
}

.db-node-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	width: 100%;
}

.node-icon {
	font-size: 14px;
	flex-shrink: 0;
}

.table-icon {
	color: #409eff;
}

.pk-icon {
	color: #e6a23c;
}

.col-icon {
	color: #909399;
}

.node-name {
	font-family: "JetBrains Mono", Consolas, Menlo, monospace;
	font-size: 12.5px;
	color: #303133;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.node-type {
	font-size: 11px;
	color: #909399;
	font-family: "JetBrains Mono", Consolas, Menlo, monospace;
	background: #f4f4f5;
	padding: 1px 5px;
	border-radius: 3px;
	flex-shrink: 0;
}

.node-pk {
	font-size: 10px;
	font-weight: 700;
	color: #fff;
	background: #e6a23c;
	padding: 0 4px;
	border-radius: 3px;
	line-height: 16px;
	flex-shrink: 0;
}

.db-filter {
	flex-shrink: 0;
}
</style>