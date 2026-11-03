<template>
	<div class="tree-panel">
		<el-card shadow="never" class="tree-card">
			<div class="tree-header">
				<!-- 上: 标题 + 自定义头部操作区(slot, 可放新增/编辑按钮) -->
				<div class="tree-header-top">
					<span class="tree-title">{{ title }}</span>
					<slot name="header-actions"></slot>
				</div>
				<!-- 下: 搜索框(占满整行) -->
				<el-input
					v-if="showFilter"
					v-model="filterText"
					placeholder="搜索"
					clearable
					size="small"
					:prefix-icon="Search"
				/>
			</div>

			<el-tree
				ref="treeRef"
				class="tree-content"
				:data="treeData"
				:props="treeProps"
				node-key="id"
				highlight-current
				:default-expand-all="defaultExpandAll"
				:expand-on-click-node="false"
				:filter-node-method="filterNode"
				@node-click="handleNodeClick"
			/>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { ElTree } from "element-plus";
import { Search } from "@element-plus/icons-vue";

/**
 * 左侧树面板组件
 * -------------------------------------------------------------
 * 【使用方式】
 *   <TreePanel
 *     :tree-data="treeData"
 *     title="接口分类"
 *     @node-click="handleNodeClick"
 *   />
 *
 * 【外部数据字段约定】
 *   - 默认: { id, label, children }
 *   - 如果后端字段不同, 通过 treeProps 传入映射, 例:
 *     :tree-props="{ label: 'name', children: 'subs' }"
 *
 * 【API 对接】
 *   在父组件 loadTree() 中调用后端接口, 将返回值赋给 treeData 即可
 *   详见 dataInterface.vue 中的 loadTree 示例
 */

// ========== Props ==========
interface TreeNode {
	id: number | string;
	label?: string;
	children?: TreeNode[];
	[key: string]: any;
}

interface TreePanelProps {
	/** 树标题 */
	title?: string;
	/** 树数据, 默认空数组(外部异步加载后赋值) */
	treeData?: TreeNode[];
	/** 后端字段映射 */
	treeProps?: { label?: string; children?: string };
	/** 是否默认展开全部节点 */
	defaultExpandAll?: boolean;
	/** 是否显示搜索框 */
	showFilter?: boolean;
}

const props = withDefaults(defineProps<TreePanelProps>(), {
	title: "分类",
	treeData: () => [],
	treeProps: () => ({ label: "label", children: "children" }),
	defaultExpandAll: true,
	showFilter: true,
});

// ========== Emits ==========
const emit = defineEmits<{
	/** 点击节点时触发, payload 为节点原始数据 */
	(e: "node-click", node: TreeNode): void;
}>();

// ========== Internal ==========
const treeRef = ref<InstanceType<typeof ElTree>>();
const filterText = ref("");

// 搜索过滤
watch(filterText, (val) => {
	treeRef.value?.filter(val);
});

function filterNode(value: string, data: TreeNode) {
	if (!value) return true;
	const labelKey = props.treeProps.label || "label";
	const label = data[labelKey] || "";
	return label.indexOf(value) !== -1;
}

function handleNodeClick(data: TreeNode) {
	emit("node-click", data);
}

/**
 * 【供父组件调用的方法】
 * 刷新树数据(内部会自动重新渲染)
 * 也可以直接通过响应式 prop 传入新数据
 */
function refresh() {
	treeRef.value?.updateKeyChildren("-1", props.treeData as any);
}

defineExpose({ refresh });
</script>

<style scoped>
.tree-panel {
	height: 100%;
}

.tree-card {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.tree-card :deep(.el-card__body) {
	flex: 1;
	overflow: auto;
	padding: 12px;
}

.tree-header {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 10px;
}

.tree-header-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.tree-title {
	font-weight: 600;
	font-size: 14px;
	color: #303133;
}

.tree-content {
	width: 100%;
}
</style>