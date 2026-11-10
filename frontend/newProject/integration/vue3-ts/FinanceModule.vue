<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
	moduleNames,
	type ModuleId,
	type ModuleMessage,
	type ModuleStatus,
} from "./types";
const props = withDefaults(
	defineProps<{ moduleId: ModuleId; baseUrl?: string; height?: string }>(),
	{
		baseUrl: "/finance/modules/",
		height: "calc(100vh - 100px)",
	},
);
const emit = defineEmits<{
	ready: [ModuleStatus];
	status: [ModuleStatus];
	error: [string];
}>();
const frame = ref<HTMLIFrameElement | null>(null);
const src = computed(() => {
	if (!(props.moduleId in moduleNames)) throw new Error("未知财务模块");
	const base = new URL(
		props.baseUrl.replace(/\/?$/, "/"),
		window.location.origin,
	);
	const url = new URL(`${props.moduleId}/index.html`, base);
	if (!["https:", "http:"].includes(url.protocol))
		throw new Error("模块地址必须使用HTTP/HTTPS");
	url.searchParams.set("embed", "1");
	return url.href;
});
const pending = new Map<
	string,
	{
		resolve: (v: ModuleStatus) => void;
		reject: (e: Error) => void;
		timer: ReturnType<typeof setTimeout>;
	}
>();
function receive(event: MessageEvent<ModuleMessage>) {
	if (
		event.source !== frame.value?.contentWindow ||
		event.origin !== new URL(src.value).origin
	)
		return;
	const m = event.data;
	if (
		!m ||
		m.channel !== "shipgrid-finance-v1" ||
		m.moduleId !== props.moduleId ||
		!m.payload
	)
		return;
	if (m.type === "ready") emit("ready", m.payload);
	if (m.type === "status") {
		emit("status", m.payload);
		const task = m.requestId ? pending.get(m.requestId) : undefined;
		if (task && m.requestId) {
			clearTimeout(task.timer);
			pending.delete(m.requestId);
			task.resolve(m.payload);
		}
	}
}
function cancelPending() {
	for (const p of pending.values()) {
		clearTimeout(p.timer);
		p.reject(new Error("模块页面已切换或卸载"));
	}
	pending.clear();
}
function getStatus(): Promise<ModuleStatus> {
	return new Promise((resolve, reject) => {
		const target = frame.value?.contentWindow;
		if (!target) {
			reject(new Error("模块尚未加载"));
			return;
		}
		const requestId = crypto.randomUUID();
		const timer = setTimeout(() => {
			pending.delete(requestId);
			reject(new Error("读取模块状态超时"));
		}, 10000);
		pending.set(requestId, { resolve, reject, timer });
		target.postMessage(
			{
				channel: "shipgrid-finance-v1",
				moduleId: props.moduleId,
				type: "get-status",
				requestId,
			} satisfies ModuleMessage,
			new URL(src.value).origin,
		);
	});
}
onMounted(() => window.addEventListener("message", receive));
onBeforeUnmount(() => {
	window.removeEventListener("message", receive);
	cancelPending();
});
watch(src, cancelPending);
defineExpose({ getStatus });
</script>
<template>
	<iframe
		ref="frame"
		:key="src"
		:src="src"
		:title="moduleNames[moduleId]"
		class="finance-module"
		:style="{ height }"
		referrerpolicy="strict-origin-when-cross-origin"
		@error="emit('error', '模块页面无法加载，请检查发布路径')"
	/>
</template>
<style scoped>
.finance-module {
	display: block;
	width: 100%;
	border: 0;
	min-height: 600px;
	background: #f5f7fa;
}
</style>
