<template>
	<div class="login-container">
		<div class="login-left">
			<div class="login-form-wrapper">
				<div class="login-header">
					<div class="login-logo">
						<div class="logo-icon">
							<el-icon :size="24"><Management /></el-icon>
						</div>
						<span class="logo-text">企业管理系统</span>
					</div>
				</div>

				<div class="login-welcome">
					<h1 class="login-title">欢迎回来</h1>
					<p class="login-subtitle">登录您的企业账户，开启高效管理之旅</p>
				</div>

				<div class="login-notice">
					<el-icon class="notice-icon"><InfoFilled /></el-icon>
					<p class="notice-text">
						系统默认一个账号同时只能登录一个设备，若在使用过程中意外退出登录，可能是该账号在其他设备登录导致当前会话被清除。您可以根据实际需求调整为支持账号多端同时登录。
					</p>
				</div>

				<el-form
					ref="formRef"
					:model="loginForm"
					:rules="rules"
					class="login-form"
					@keyup.enter="handleLogin"
				>
					<el-form-item prop="username">
						<el-input
							v-model="loginForm.username"
							placeholder="请输入用户名"
							size="large"
							:prefix-icon="User"
							clearable
						/>
					</el-form-item>

					<el-form-item prop="password">
						<el-input
							v-model="loginForm.password"
							type="password"
							placeholder="请输入密码"
							size="large"
							:prefix-icon="Lock"
							show-password
							clearable
						/>
					</el-form-item>
					<div class="login-footer">
						<span>还没有账号？</span>
						<router-link to="/register">立即注册</router-link>
					</div>
					<el-form-item>
						<el-button
							type="primary"
							size="large"
							class="login-btn"
							:loading="loading"
							@click="handleLogin"
						>
							<span v-if="!loading">登 录</span>
							<span v-else>登录中...</span>
						</el-button>
					</el-form-item>
				</el-form>
			</div>
		</div>

		<div class="login-right">
			<div class="login-bg">
				<div class="shape shape-1"></div>
				<div class="shape shape-2"></div>
				<div class="shape shape-3"></div>
				<div class="shape shape-4"></div>
				<div class="shape shape-5"></div>
				<div class="grid-pattern"></div>
			</div>
			<div class="login-content">
				<div class="feature-badges">
					<div class="badge">企业级</div>
					<div class="badge">安全可靠</div>
					<div class="badge">高效管理</div>
				</div>
				<h2 class="slogan-title">智能化企业管理平台</h2>
				<p class="slogan-desc">
					集成化、数字化、智能化的企业级解决方案，助力企业高效运营
				</p>
				<div class="feature-list">
					<div class="feature-item">
						<div class="feature-icon">
							<el-icon :size="24"><DataAnalysis /></el-icon>
						</div>
						<div class="feature-text">
							<div class="feature-title">数据分析</div>
							<div class="feature-desc">实时数据可视化</div>
						</div>
					</div>
					<div class="feature-item">
						<div class="feature-icon">
							<el-icon :size="24"><Lock /></el-icon>
						</div>
						<div class="feature-text">
							<div class="feature-title">安全管控</div>
							<div class="feature-desc">多层权限保护</div>
						</div>
					</div>
					<div class="feature-item">
						<div class="feature-icon">
							<el-icon :size="24"><Connection /></el-icon>
						</div>
						<div class="feature-text">
							<div class="feature-title">协同办公</div>
							<div class="feature-desc">团队高效协作</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { User, Lock } from "@element-plus/icons-vue";
import { useUserStore } from "@/stores/user";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const loginForm = reactive({
	username: "",
	password: "",
});

const rules: FormRules = {
	username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
	password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleLogin() {
	if (!formRef.value) return;
	await formRef.value.validate(async (valid) => {
		if (!valid) return;
		loading.value = true;
		try {
			await userStore.login({ ...loginForm });
			ElMessage.success("登录成功");
			const redirect = (route.query.redirect as string) || "/";
			router.push(redirect);
		} catch (e) {
			// 错误信息已由响应拦截器统一提示
		} finally {
			loading.value = false;
		}
	});
}
</script>

<!-- <style scoped>
.login-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2d3d 0%, #409eff 100%);
}

.login-card {
  width: 420px;
  padding: 20px 24px;
  border-radius: 10px;
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  margin: 12px 0 4px;
  font-size: 22px;
  color: #303133;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.login-btn {
  width: 100%;
}

.login-footer {
  text-align: center;
  font-size: 13px;
  color: #606266;
  margin-bottom: 12px;
}

.login-footer a {
  color: #409eff;
  text-decoration: none;
}

.tips {
  font-size: 12px;
}
</style> -->

<style scoped>
.login-container {
	display: flex;
	min-height: 100vh;
	background: var(--bg-primary);
}

.login-left {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40px;
	background: linear-gradient(
		135deg,
		var(--bg-primary) 0%,
		var(--bg-secondary) 50%,
		var(--bg-primary) 100%
	);
	position: relative;
	overflow: hidden;
}

/* 左侧背景装饰 */
.login-left::before {
	content: "";
	position: absolute;
	top: -50%;
	left: -50%;
	width: 200%;
	height: 200%;
	background:
		radial-gradient(
			circle at 20% 80%,
			rgba(99, 102, 241, 0.08) 0%,
			transparent 50%
		),
		radial-gradient(
			circle at 80% 20%,
			rgba(139, 92, 246, 0.08) 0%,
			transparent 50%
		),
		radial-gradient(
			circle at 40% 40%,
			rgba(236, 72, 153, 0.05) 0%,
			transparent 40%
		);
	pointer-events: none;
}

/* 网格背景 */
.login-left::after {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-image:
		linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
		linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
	background-size: 60px 60px;
	pointer-events: none;
}

.login-form-wrapper {
	width: 100%;
	max-width: 440px;
	padding: 48px;
	background: var(--bg-primary);
	border-radius: 24px;
	box-shadow:
		0 4px 6px -1px rgba(0, 0, 0, 0.05),
		0 10px 15px -3px rgba(0, 0, 0, 0.08),
		0 20px 25px -5px rgba(0, 0, 0, 0.05);
	border: 1px solid var(--border-light);
	position: relative;
	z-index: 1;
	animation: slideInUp 0.6s ease-out;
}

@keyframes slideInUp {
	from {
		opacity: 0;
		transform: translateY(30px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.login-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 48px;
}

.login-logo {
	display: flex;
	align-items: center;
	gap: 12px;
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

.login-welcome {
	margin-bottom: 32px;
}

.login-title {
	font-size: 32px;
	font-weight: 700;
	color: var(--text-primary);
	margin-bottom: 8px;
	letter-spacing: -0.5px;
}

.login-subtitle {
	font-size: 15px;
	color: var(--text-secondary);
	line-height: 1.6;
}

.login-notice {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 16px 20px;
	background: var(--primary-50);
	border: 1px solid var(--primary-200);
	border-radius: 12px;
	margin-bottom: 24px;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-notice:hover {
	background: var(--primary-100);
	box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
	transform: translateY(-1px);
}

.notice-icon {
	color: var(--color-primary);
	font-size: 18px;
	margin-top: 2px;
	flex-shrink: 0;
}

.notice-text {
	font-size: 13px;
	color: var(--text-secondary);
	line-height: 1.6;
	margin: 0;
	flex: 1;
}

@media (max-width: 640px) {
	.login-notice {
		padding: 14px 16px;
	}

	.notice-text {
		font-size: 12px;
	}
}

.login-options {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 24px;
}

.forgot-link {
	font-size: 13px;
	font-weight: 500;
}

.login-form :deep(.el-input__wrapper) {
	background: var(--bg-secondary);
	border: 2px solid transparent;
	box-shadow:
		inset 0 2px 4px rgba(0, 0, 0, 0.02),
		0 1px 2px rgba(0, 0, 0, 0.05);
	border-radius: 14px;
	padding: 6px 18px;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-form :deep(.el-input__wrapper:hover) {
	border-color: var(--primary-200);
	background: var(--bg-primary);
}

.login-form :deep(.el-input__wrapper:focus-within) {
	border-color: var(--color-primary);
	background: var(--bg-primary);
	box-shadow:
		0 0 0 4px var(--primary-100),
		0 4px 12px rgba(99, 102, 241, 0.15);
	transform: translateY(-1px);
}

.login-form :deep(.el-input__inner) {
	height: 48px;
	font-size: 15px;
	color: var(--text-primary);
}

.login-form :deep(.el-input__inner::placeholder) {
	color: var(--text-tertiary);
}

.captcha-wrapper {
	display: flex;
	gap: 12px;
}

.captcha-wrapper .el-input {
	flex: 1;
}

.captcha-image {
	width: 130px;
	height: 58px;
	border-radius: 14px;
	overflow: hidden;
	cursor: pointer;
	border: 2px solid transparent;
	background: var(--bg-secondary);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	box-shadow:
		inset 0 2px 4px rgba(0, 0, 0, 0.02),
		0 1px 2px rgba(0, 0, 0, 0.05);
}

.captcha-image:hover {
	border-color: var(--color-primary);
	background: var(--bg-primary);
	box-shadow:
		0 0 0 4px var(--primary-100),
		0 4px 12px rgba(99, 102, 241, 0.15);
	transform: translateY(-1px);
}

.captcha-image img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.captcha-loading {
	color: var(--text-tertiary);
}

.remember-checkbox {
	font-weight: 500;
}

.remember-checkbox :deep(.el-checkbox__label) {
	color: var(--text-secondary);
}
.login-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 13px;
  color: var(--text-secondary);
}

.login-btn {
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

.login-btn::before {
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

.login-btn:hover {
	transform: translateY(-2px);
	box-shadow:
		0 6px 20px rgba(99, 102, 241, 0.5),
		0 12px 30px rgba(99, 102, 241, 0.3);
	background-position: 100% 100%;
}

.login-btn:hover::before {
	left: 100%;
}

.login-btn:active {
	transform: translateY(0);
	box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
}

.login-divider {
	display: flex;
	align-items: center;
	margin: 32px 0 20px;
	color: var(--text-tertiary);
	font-size: 13px;
}

.login-divider::before,
.login-divider::after {
	content: "";
	flex: 1;
	height: 1px;
	background: var(--border-light);
}

.login-divider span {
	padding: 0 16px;
}

.test-accounts {
	display: flex;
	gap: 12px;
	flex-wrap: wrap;
}

.account-tag {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 18px;
	background: var(--bg-secondary);
	border: 2px solid transparent;
	border-radius: 12px;
	font-size: 13px;
	color: var(--text-secondary);
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	font-weight: 500;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.account-tag:hover {
	background: var(--primary-50);
	border-color: var(--primary-200);
	color: var(--color-primary);
	transform: translateY(-3px);
	box-shadow:
		0 4px 12px rgba(99, 102, 241, 0.15),
		0 2px 4px rgba(0, 0, 0, 0.05);
}

.account-tag .el-icon {
	font-size: 16px;
}

.account-info {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.account-name {
	font-weight: 600;
	color: var(--text-primary);
}

.account-detail {
	font-size: 11px;
	color: var(--text-tertiary);
}

/* 右侧区域 */
.login-right {
	flex: 1.2;
	background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
}

.login-bg {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	overflow: hidden;
}

.grid-pattern {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-image:
		linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
		linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
	background-size: 50px 50px;
}

.shape {
	position: absolute;
	border-radius: 50%;
	filter: blur(60px);
}

.shape-1 {
	width: 500px;
	height: 500px;
	background: rgba(99, 102, 241, 0.4);
	top: -100px;
	right: -100px;
}

.shape-2 {
	width: 400px;
	height: 400px;
	background: rgba(139, 92, 246, 0.3);
	bottom: 100px;
	left: -100px;
}

.shape-3 {
	width: 300px;
	height: 300px;
	background: rgba(236, 72, 153, 0.2);
	bottom: -50px;
	right: 20%;
}

.shape-4 {
	width: 200px;
	height: 200px;
	background: rgba(59, 130, 246, 0.3);
	top: 30%;
	left: 20%;
}

.shape-5 {
	width: 150px;
	height: 150px;
	background: rgba(245, 158, 11, 0.2);
	top: 60%;
	right: 30%;
}

.login-content {
	position: relative;
	z-index: 1;
	text-align: center;
	color: white;
	padding: 40px;
	max-width: 500px;
}

.feature-badges {
	display: flex;
	gap: 12px;
	justify-content: center;
	margin-bottom: 32px;
}

.badge {
	padding: 6px 16px;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 20px;
	font-size: 13px;
	font-weight: 500;
	backdrop-filter: blur(10px);
}

.slogan-title {
	font-size: 42px;
	font-weight: 700;
	margin-bottom: 16px;
	letter-spacing: -1px;
	background: linear-gradient(135deg, #fff 0%, #c7d7fe 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.slogan-desc {
	font-size: 16px;
	opacity: 0.8;
	margin-bottom: 48px;
	line-height: 1.7;
}

.feature-list {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.feature-item {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 20px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 16px;
	backdrop-filter: blur(10px);
	transition: all 0.25s ease;
}

.feature-item:hover {
	background: rgba(255, 255, 255, 0.1);
	transform: translateX(8px);
}

.feature-icon {
	width: 48px;
	height: 48px;
	background: linear-gradient(
		135deg,
		rgba(99, 102, 241, 0.5) 0%,
		rgba(139, 92, 246, 0.5) 100%
	);
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.feature-text {
	text-align: left;
}

.feature-title {
	font-size: 16px;
	font-weight: 600;
	margin-bottom: 4px;
}

.feature-desc {
	font-size: 13px;
	opacity: 0.7;
}

@media (max-width: 1024px) {
	.login-right {
		display: none;
	}

	.login-left {
		flex: 1;
	}
}

@media (max-width: 640px) {
	.login-left {
		padding: 24px;
	}

	.login-title {
		font-size: 26px;
	}

	.test-accounts {
		flex-direction: column;
	}

	.account-tag {
		justify-content: center;
	}
}

:deep(.el-input__wrapper.is-autofill),
:deep(.el-input__wrapper:has(input:-webkit-autofill)) {
	box-shadow: 0 0 0 1000px #EBE9F3 inset !important;
	-webkit-box-shadow: 0 0 0 1000px #EBE9F3 inset !important;
	transition: background-color 5000s ease-in-out 0s;
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