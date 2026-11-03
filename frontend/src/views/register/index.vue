<template>
	<div class="register-container">
		<el-card class="register-card">
			<div class="register-header">
				<div class="login-logo">
					<div class="logo-icon">
						<el-icon :size="24"><Management /></el-icon>
					</div>
					<span class="logo-text">企业管理系统</span>
				</div>
				<h2 class="title">用户注册</h2>
				<p class="subtitle">注册后默认拥有「客户」角色</p>
			</div>

			<el-form
				ref="formRef"
				:model="form"
				:rules="rules"
				size="large"
				class="register-form"
				@keyup.enter="handleRegister"
			>
				<el-form-item prop="username">
					<el-input
						v-model="form.username"
						placeholder="用户名（3-20 位 用于登录）"
						:prefix-icon="User"
						clearable
					/>
				</el-form-item>
				<el-form-item prop="nickname">
					<el-input
						v-model="form.nickname"
						placeholder="昵称（用于展示姓名）"
						:prefix-icon="Avatar"
						clearable
					/>
				</el-form-item>
				<el-form-item prop="password">
					<el-input
						v-model="form.password"
						type="password"
						placeholder="密码（6-32 位）"
						:prefix-icon="Lock"
						show-password
						clearable
					/>
				</el-form-item>
				<el-form-item prop="confirmPassword">
					<el-input
						v-model="form.confirmPassword"
						type="password"
						placeholder="确认密码"
						:prefix-icon="Lock"
						show-password
						clearable
					/>
				</el-form-item>
				<el-form-item>
					<el-button
						type="primary"
						size="large"
						class="register-btn"
						:loading="loading"
						@click="handleRegister"
					>
						注 册
					</el-button>
				</el-form-item>
				<div class="register-footer">
					<router-link to="/login">已有账号？返回登录</router-link>
				</div>
			</el-form>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { User, Lock, Avatar } from "@element-plus/icons-vue";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
	username: "",
	nickname: "",
	password: "",
	confirmPassword: "",
});

const validateConfirm = (_rule: any, value: string, callback: any) => {
	if (value !== form.password) {
		callback(new Error("两次输入的密码不一致"));
	} else {
		callback();
	}
};

const rules: FormRules = {
	username: [
		{ required: true, message: "请输入用户名", trigger: "blur" },
		{ min: 3, max: 20, message: "用户名长度需在 3-20 位之间", trigger: "blur" },
	],
	nickname: [
		{ required: true, message: "请输入昵称", trigger: "blur" },
		{ min: 1, max: 20, message: "昵称长度需在 1-20 位之间", trigger: "blur" },
	],
	password: [
		{ required: true, message: "请输入密码", trigger: "blur" },
		{ min: 6, max: 32, message: "密码长度需在 6-32 位之间", trigger: "blur" },
	],
	confirmPassword: [
		{ required: true, message: "请再次输入密码", trigger: "blur" },
		{ validator: validateConfirm, trigger: "blur" },
	],
};

async function handleRegister() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		loading.value = true;
		try {
			await userStore.register({
				username: form.username,
				password: form.password,
				nickname: form.nickname,
			});
			ElMessage.success("注册成功，请登录");
			router.push("/login");
		} catch (e) {
			// 统一提示
		} finally {
			loading.value = false;
		}
	});
}
</script>

<style scoped>
.register-container {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(
		135deg,
		var(--bg-primary) 0%,
		var(--bg-secondary) 50%,
		var(--bg-primary) 100%
	);
}

.register-card {
	width: 420px;
	padding: 16px 24px;
	border-radius: 10px;
	background-color: #eceaf2;
}

.register-header {
	text-align: center;
	margin-bottom: 18px;
}

.login-logo {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-left: 60px;
}

.logo-icon {
	width: 44px;
	height: 44px;
	background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: white;
	box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.logo-text {
	font-size: 22px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.5px;
}

.title {
	margin: 10px 0 4px;
	font-size: 20px;
	color: #303133;
}

.subtitle {
	margin: 0;
	font-size: 13px;
	color: #909399;
}

.register-btn {
	width: 100%;
	height: 54px;
	font-size: 16px;
	font-weight: 600;
	border-radius: 14px;
	background: linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #8b5cf6 100%);
	background-size: 200% 200%;
	border: none;
	box-shadow:
		0 4px 14px rgba(99, 102, 241, 0.4),
		0 8px 20px rgba(99, 102, 241, 0.2);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;
}
.register-btn::before {
	content: "";
	position: absolute;
	top: 0;
	left: -100%;
	width: 100%;
	height: 100%;
	background: linear-gradient(
		90deg,
		transparent,
		rgba(255, 255, 255, 0.2),
		transparent
	);
	transition: left 0.5s ease;
}

.register-btn:hover {
	transform: translateY(-2px);
	box-shadow:
		0 6px 20px rgba(99, 102, 241, 0.5),
		0 12px 30px rgba(99, 102, 241, 0.3);
	background-position: 100% 100%;
}

.register-btn:hover::before {
	left: 100%;
}

.register-btn:active {
	transform: translateY(0);
	box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
}

.register-form :deep(.el-input__wrapper) {
	background: var(--bg-secondary);
	border: 2px solid transparent;
	box-shadow:
		inset 0 2px 4px rgba(0, 0, 0, 0.02),
		0 1px 2px rgba(0, 0, 0, 0.05);
	border-radius: 14px;
	padding: 6px 18px;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.register-form :deep(.el-input__wrapper:hover) {
	border-color: var(--primary-200);
	background: var(--bg-primary);
}

.register-form :deep(.el-input__wrapper:focus-within) {
	border-color: var(--color-primary);
	background: var(--bg-primary);
	box-shadow:
		0 0 0 4px var(--primary-100),
		0 4px 12px rgba(99, 102, 241, 0.15);
	transform: translateY(-1px);
}

.register-form :deep(.el-input__inner) {
	height: 48px;
	font-size: 15px;
	color: var(--text-primary);
}

.register-form :deep(.el-input__inner::placeholder) {
	color: var(--text-tertiary);
}

.register-footer {
	text-align: center;
	font-size: 13px;
}

.register-footer a {
	color: #409eff;
	text-decoration: none;
}

:deep(input:-webkit-autofill),
:deep(input:-webkit-autofill:hover),
:deep(input:-webkit-autofill:focus) {
	-webkit-text-fill-color: inherit !important;
	-webkit-box-shadow: 0 0 0 1000px #EBE9F3 inset !important;
	box-shadow: 0 0 0 1000px #EBE9F3 inset !important;
	transition: background-color 5000s ease-in-out 0s;
}
</style>
