import { createRouter, createWebHashHistory } from "vue-router";
import { defineComponent, h } from "vue";
import { useAuthStore } from "../stores/auth";
import { resolvePlatformModule, platformRoleAllows } from "../config/platform-menu";

/**
 * 无权访问拒绝态（TOTAL-PLATFORM-MENU-ROLE-FILTER-01）：
 * 直接访问无权路由（含复制 URL）时呈现明确拒绝，而不是空白或假成功。
 * 内联组件（不新增文件）：语义色全部走 tokens.css 变量，不写死色值。
 */
const ForbiddenView = defineComponent({
  name: "ForbiddenView",
  setup() {
    const back = () => { window.location.hash = "#/dashboard"; };
    const retry = () => { window.location.reload(); };
    return () =>
      h("div", { style: "display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;" }, [
        h("div", { style: "font-size:40px;line-height:1;" }, "⛔"),
        h("div", { style: "font-size:18px;font-weight:600;color:var(--text-primary);" }, "无权访问该页面"),
        h("div", { style: "font-size:13px;color:var(--text-muted);max-width:420px;text-align:center;" },
          "当前账号的角色未被授予该功能域的访问权限（fail-closed）。如需开通，请联系平台超级管理员调整角色授权。"),
        h("div", { style: "display:flex;gap:8px;margin-top:8px;" }, [
          h("button", { type: "button", onClick: back, style: "padding:6px 16px;border:1px solid var(--border-normal);background:var(--bg-card);color:var(--text-primary);border-radius:6px;cursor:pointer;font-size:13px;" }, "返回运营大盘"),
          h("button", { type: "button", onClick: retry, style: "padding:6px 16px;border:none;background:var(--color-primary);color:#fff;border-radius:6px;cursor:pointer;font-size:13px;" }, "重试恢复身份"),
        ]),
      ]);
  },
});

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  if (!token) return true;
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp;
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/login/PlatformLogin.vue'),
      meta: { title: '平台登录', requiresAuth: false },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/login/PlatformRegister.vue'),
      meta: { title: '商户注册', requiresAuth: false },
    },
    {
      path: '/forbidden',
      name: 'Forbidden',
      component: ForbiddenView,
      meta: { title: '无权访问', requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('../layouts/PlatformLayout.vue'),
      redirect: '/dashboard',
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
          meta: { title: '运营大盘' },
        },
        /* ── 06 营销 · 渠道推广（设计稿 sec-market） ── */
        {
          path: 'marketing/channels',
          name: 'MarketingChannels',
          component: () => import('../views/marketing/ChannelPromotion.vue'),
          meta: { title: '渠道推广' },
        },
        /* ── 16 营销 · 代理商管理（设计稿 sec-agent） ── */
        {
          path: 'marketing/agents',
          name: 'MarketingAgents',
          component: () => import('../views/marketing/AgentManagement.vue'),
          meta: { title: '代理商管理' },
        },
        /* ── 07 平台 · 管理员权限（设计稿 sec-admin） ── */
        {
          path: 'platform/admins',
          name: 'PlatformAdmins',
          component: () => import('../views/platform/AdminPermissions.vue'),
          meta: { title: '管理员权限' },
        },
        /* ── 09 平台 · 模板中心（设计稿 sec-tpl） ── */
        {
          path: 'platform/templates',
          name: 'PlatformTemplates',
          component: () => import('../views/platform/TemplateCenter.vue'),
          meta: { title: '模板中心' },
        },
        /* ── 12 运维 · 工单系统（设计稿 sec-ticket） ── */
        {
          path: 'ops/tickets',
          name: 'OpsTickets',
          component: () => import('../views/ops/TicketSystem.vue'),
          meta: { title: '工单系统' },
        },
        /* ── 14 开放平台 · API 密钥 / Webhook（设计稿 sec-open） ── */
        {
          path: 'open/api-keys',
          name: 'OpenApiKeys',
          component: () => import('../views/open/ApiKeyList.vue'),
          meta: { title: 'API 密钥' },
        },
        {
          path: 'open/webhooks',
          name: 'OpenWebhooks',
          component: () => import('../views/open/WebhookList.vue'),
          meta: { title: 'Webhook' },
        },
        /* 旧路径兼容：商品库 · API 密钥 → 开放平台 · API 密钥 */
        {
          path: 'library/api-keys',
          redirect: '/open/api-keys',
        },
        {
          path: 'applications',
          name: 'ApplicationList',
          component: () => import('../views/tenant/ApplicationList.vue'),
          meta: { title: '注册审核' },
        },
        {
          path: 'applications/:id',
          name: 'ApplicationDetail',
          component: () => import('../views/tenant/ApplicationDetail.vue'),
          meta: { title: '申请详情' },
        },
        {
          path: 'tenants',
          name: 'TenantList',
          component: () => import('../views/tenant/TenantList.vue'),
          meta: { title: '租户管理' },
        },
        {
          path: 'tenants/create',
          name: 'TenantCreate',
          component: () => import('../views/tenant/TenantForm.vue'),
          meta: { title: '新增租户' },
        },
        {
          path: 'tenants/:id',
          name: 'TenantDetail',
          component: () => import('../views/tenant/TenantDetail.vue'),
          meta: { title: '租户详情' },
        },
        {
          path: 'monitor',
          name: 'Monitor',
          component: () => import('../views/monitor/MonitorView.vue'),
          meta: { title: '监控告警' },
        },
        {
          path: 'packages',
          name: 'Packages',
          component: () => import('../views/Packages.vue'),
          meta: { title: '套餐管理' },
        },
        {
          path: 'packages/create',
          name: 'PackageCreate',
          component: () => import('../views/PackageForm.vue'),
          meta: { title: '新建套餐' },
        },
        {
          path: 'packages/:id/edit',
          name: 'PackageEdit',
          component: () => import('../views/PackageForm.vue'),
          meta: { title: '编辑套餐' },
        },
        {
          path: 'subscriptions',
          name: 'Subscriptions',
          component: () => import('../views/Subscriptions.vue'),
          meta: { title: '订阅管理' },
        },
        {
          path: 'subscriptions/:id',
          name: 'SubscriptionDetail',
          component: () => import('../views/SubscriptionDetail.vue'),
          meta: { title: '订阅详情' },
        },
        {
          path: 'subscription-applies',
          name: 'SubscriptionApplies',
          component: () => import('../views/subscription/SubscriptionApplies.vue'),
          meta: { title: '订阅申请' },
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('../views/Settings.vue'),
          meta: { title: '系统配置' },
        },
        {
          path: 'message-config',
          name: 'MessageConfig',
          component: () => import('../views/MessageConfig.vue'),
          meta: { title: '消息配置' },
        },
        {
          path: 'announcements',
          name: 'Announcements',
          component: () => import('../views/Announcements.vue'),
          meta: { title: '公告管理' },
        },
        {
          path: 'reviews',
          name: 'PlatformReviews',
          component: () => import('../views/PlatformReviews.vue'),
          meta: { title: '平台评价' },
        },
        {
          path: 'reconciliation',
          name: 'Reconciliation',
          component: () => import('../views/Reconciliation.vue'),
          meta: { title: '账单计费' },
        },
        {
          path: 'tenant-usage',
          name: 'TenantUsage',
          component: () => import('../views/TenantUsage.vue'),
          meta: { title: '租户使用统计' },
        },
        {
          path: 'audit-logs',
          name: 'AuditLogs',
          component: () => import('../views/AuditLogs.vue'),
          meta: { title: '日志中心' },
        },
        {
          path: 'error-logs',
          name: 'ErrorLogs',
          component: () => import('../views/ErrorLogs.vue'),
          meta: { title: '错误日志' },
        },
        {
          path: 'app-versions',
          name: 'AppVersions',
          component: () => import('../views/AppVersions.vue'),
          meta: { title: '版本发布' },
        },
        {
          path: 'library/spus',
          name: 'LibrarySpus',
          component: () => import('../views/library/LibrarySpus.vue'),
          meta: { title: '商品库 · SPU管理' },
        },
        {
          path: 'library/brands',
          name: 'LibraryBrands',
          component: () => import('../views/library/LibraryBrands.vue'),
          meta: { title: '商品库 · 品牌管理' },
        },
        {
          path: 'library/reviews',
          name: 'LibraryReviews',
          component: () => import('../views/library/LibraryReviews.vue'),
          meta: { title: '商品库 · 审核列表' },
        },
        {
          path: 'library/import',
          name: 'LibraryImport',
          component: () => import('../views/library/LibraryImport.vue'),
          meta: { title: '商品库 · 批量导入' },
        },
        {
          path: 'mobile-preview',
          name: 'MobilePreview',
          component: () => import('../views/MobilePreview.vue'),
          meta: { title: '移动端预览' },
        },
        {
          path: 'ai-config/platform',
          name: 'PlatformAiConfig',
          component: () => import('../views/ai-config/PlatformAiConfig.vue'),
          meta: { title: '模型接入' },
        },
        {
          path: 'ai-config/tenants',
          name: 'TenantAiConfig',
          component: () => import('../views/ai-config/TenantAiConfig.vue'),
          meta: { title: 'AI配置 · 租户配置' },
        },
        {
          path: 'ai-config/usage',
          name: 'AiUsageStats',
          component: () => import('../views/ai-config/AiUsageStats.vue'),
          meta: { title: '用量监控' },
        },
        {
          path: 'ai-config/billing',
          name: 'AiBillingConfig',
          component: () => import('../views/ai-config/AiBillingConfig.vue'),
          meta: { title: '计费管理' },
        },
        {
          path: 'ai-config/cognition',
          name: 'AiCognitionView',
          component: () => import('../views/ai-config/AiCognitionView.vue'),
          meta: { title: 'AI配置 · 认知层（记忆/学习/进化）' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const token = typeof authStore.token === 'string' ? authStore.token : (authStore.token as any)?.value;
  const expired = token && isTokenExpired(token);

  if (expired) {
    authStore.logout();
    if (to.path !== "/login") {
      next("/login");
      return;
    }
  }

  if (to.meta.requiresAuth !== false && !token) {
    next("/login");
    return;
  }
  if (to.path === "/login" && token) {
    next("/dashboard");
    return;
  }

  // 会话恢复（REHYDRATE-01）：token 有效但身份缺失（刷新页面/重开浏览器）时，
  // 先恢复身份再放行 —— 避免页面先渲染「未登录」再闪烁成真实姓名（防路由闪烁）。
  // - single-flight：并发导航复用同一次 /auth/me（防重复请求）；
  // - 'expired' ⇒ fail-closed：清会话跳登录页；
  // - 'network-error' ⇒ 保留 token 放行，顶栏提供「重试」（网络抖动 ≠ 身份无效）。
  if (to.meta.requiresAuth !== false && token && !authStore.adminInfo) {
    const state = await authStore.rehydrate();
    if (state === "expired") {
      next("/login");
      return;
    }
  }

  // 路由权限 fail-closed（MENU-ROLE-FILTER-01 · 关闭 G2）：菜单过滤 ≠ 权限放行，
  // 复制 URL 直接访问无权路由一律拒绝态（/forbidden），不允许空白或假成功。
  // - 未知角色/身份未恢复 ⇒ 一律无权（fail-closed）；
  // - 受保护路由未命中任何权限域映射 ⇒ 同样拒绝（不因映射缺失而放行）；
  // - /forbidden 本身放行（拒绝态终点，避免重定向循环）。
  if (to.meta.requiresAuth !== false && to.path !== "/forbidden") {
    const mod = resolvePlatformModule(to.path);
    const role = (authStore.adminInfo as { role?: string | null } | null)?.role ?? null;
    if (!mod || !platformRoleAllows(role, mod)) {
      next("/forbidden");
      return;
    }
  }

  next();
});

export default router;
