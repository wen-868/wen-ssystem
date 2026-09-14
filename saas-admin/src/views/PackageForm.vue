<template>
  <div>
    <!-- ============ 页头 ============ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">{{ isEdit ? "编辑套餐" : "新建套餐" }}</div>
        <p class="pd">
          {{ isEdit ? "改配置即改商品 · 价格类变更需超级管理员密码二次确认" : (copiedFromName ? `复制自：${copiedFromName} · ` : "") + "五段式配置（定价 / 周期 / 功能开关矩阵 / 资源配额 / 升降级与续费规则）" }}
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="goBack">返回列表</span>
      </div>
    </div>

    <!-- ============ 滑出表单（设计稿 .drawer 486px 五段式） ============ -->
    <div class="drawer-page" v-loading="pageLoading">
      <div class="d-hd">
        <span class="pt">{{ isEdit ? "编辑套餐" : "新建套餐" }}</span>
        <span class="small">{{ isEdit ? `套餐编码：${form.planCode || "--"}` : copiedFromName ? `复制自：${copiedFromName}` : "新建套餐（可从列表页「复制」进入）" }}</span>
        <span class="d-x" @click="goBack">✕</span>
      </div>

      <div class="d-bd">
        <!-- 策略包保存失败提示（内容区错误态，避免与客户端统一提示重复弹窗） -->
        <div v-if="policyError" class="policy-err">{{ policyError }}</div>

        <!-- ① 基本信息 -->
        <div class="fld"><span>① 基本信息</span></div>
        <div class="panel sec-panel">
          <div class="p-bd sec-bd">
            <div class="fld">
              <span>套餐名称 <i class="req">*</i></span>
              <input class="ipt" v-model="form.planName" placeholder="如：标准版" />
            </div>
            <div class="fld">
              <span>套餐描述</span>
              <input class="ipt desc-ipt" v-model="form.description" placeholder="一句话描述该套餐的适用场景与能力边界" />
            </div>
            <div class="frow">
              <span class="fld grow-min">
                <span>状态</span>
                <span class="sel fill" @click="cycleStatus">{{ statusLabel }}</span>
              </span>
              <span class="fld grow-min">
                <span>排序权重</span>
                <input class="ipt" v-model.number="form.sortOrder" />
              </span>
            </div>
          </div>
        </div>

        <!-- ② 定价设置 -->
        <div class="fld mt14"><span>② 定价设置</span></div>
        <div class="panel sec-panel">
          <div class="p-bd sec-bd">
            <div class="frow">
              <span class="fld grow-amount">
                <span>金额（元）<i class="req">*</i></span>
                <input class="ipt" v-model.number="form.price" />
              </span>
              <span class="fld grow-min">
                <span>币种</span>
                <span class="sel fill">CNY 人民币</span>
              </span>
            </div>
            <div class="fld">
              <span>计费周期</span>
              <div class="chips">
                <span
                  v-for="c in PLAN_TYPE_OPTIONS"
                  :key="c.key"
                  class="btn"
                  :class="{ 'btn-p': form.planType === c.key }"
                  @click="form.planType = c.key"
                >{{ c.label }}<span v-if="c.key === 'CUSTOM' && form.durationDays" class="small">{{ form.durationDays }}天</span></span>
              </div>
              <div v-if="form.planType === 'CUSTOM'" class="frow mt10">
                <span class="fld grow-min">
                  <span>自定义天数（天）</span>
                  <input class="ipt" v-model.number="form.durationDays" placeholder="未配置" />
                </span>
              </div>
            </div>
            <div class="frow promo-row">
              <span class="fld grow-min">
                <span class="promo-label">限时活动价（可选）</span>
                <input class="ipt" v-model.number="form.promoPrice" />
              </span>
              <span class="fld grow-min">
                <span class="promo-label">活动开始</span>
                <input class="ipt" v-model="form.promoStart" placeholder="YYYY-MM-DD" />
              </span>
              <span class="fld grow-min">
                <span class="promo-label">活动结束</span>
                <input class="ipt" v-model="form.promoEnd" placeholder="YYYY-MM-DD" />
              </span>
            </div>
          </div>
        </div>

        <!-- ③ 功能开关矩阵 -->
        <div class="fld mt14">
          <span>③ 功能开关矩阵 <i class="small inline-note">（已选 {{ checkedCount }} / {{ TOTAL_FEATURE_COUNT }} 项 · 勾选即售 · 租户实际可用 = 全局开关 ∩ 套餐开关 ∩ 租户级开关）</i></span>
        </div>
        <div class="mx-list">
          <div v-for="g in featureGroups" :key="g.name" class="mx">
            <div class="mx-hd" @click="toggleGroup(g)">
              <span class="ck" :class="{ on: isGroupOn(g) }"></span>{{ g.name }}
            </div>
            <div class="mx-bd">
              <span
                v-for="it in g.items"
                :key="it.name"
                class="mx-it"
                @click="toggleItem(it.name)"
              >
                <span class="ck" :class="{ on: checked[it.name] }"></span>{{ it.name }}
                <span v-if="it.v11" class="v11-tag">v1.1</span>
              </span>
              <!-- 自定义AI模型接入 · 分套餐默认态（设计稿 v11-row / v11-note） -->
              <template v-if="g.name === 'API / 报表 / AI'">
                <div class="v11-row">
                  <span class="small" style="color: var(--g5)">分套餐默认态：</span>
                  <span class="v11-lock">
                    <span class="lkic">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                    </span>免费版 · 锁定
                    <span class="v11-onlypay">仅付费</span>
                  </span>
                  <span class="v11-ck"><span class="ck on"></span>基础版 · 默认开启</span>
                  <span class="v11-ck"><span class="ck on"></span>标准版 · 默认开启</span>
                  <span class="v11-ck"><span class="ck on"></span>旗舰版 · 默认开启</span>
                </div>
                <div class="v11-note">
                  <span class="v11-tag lt" style="margin-top: 1px; flex: none">v1.1</span>
                  <span><b>自定义模型：</b>租户接入自有大模型API密钥，免费版不可用（密钥平台加密托管，调用经 AI 网关统一计量）。</span>
                </div>
              </template>
            </div>
          </div>
        </div>

<!-- ④ 资源配额 -->
<div ref="quotaRef" class="fld mt14"><span>④ 资源配额 <i class="small inline-note">（留空 = 未配置，不上送、不落库；系统不内置预设值）</i></span></div>
        <div class="panel sec-panel">
          <div class="p-bd quota-grid">
            <span class="fld"><span>账号数（个）</span><input class="ipt" v-model.number="form.maxUsers" placeholder="未配置" /></span>
            <span class="fld"><span>商品上限（个）</span><input class="ipt" v-model.number="form.maxProducts" placeholder="未配置" /></span>
            <span class="fld"><span>仓库数（个）</span><input class="ipt" v-model.number="form.maxStores" placeholder="未配置" /></span>
            <span class="fld"><span>存储容量（GB）</span><input class="ipt" v-model.number="form.maxStorageGb" placeholder="未配置" /></span>
            <span class="fld"><span>API 日额度（次/日）</span><input class="ipt" v-model.number="form.apiQuota" placeholder="未配置" /></span>
            <span class="fld"><span>AI 额度（次/月）</span><input class="ipt" v-model.number="form.aiQuota" placeholder="未配置" /></span>
          </div>
        </div>

        <!-- ⑤ 升降级与续费规则 -->
        <div class="fld mt14"><span>⑤ 升降级与续费规则 <i class="small inline-note">（未选 = 未配置，不上送；系统不内置预设规则）</i></span></div>
        <div class="panel sec-panel">
          <div class="p-bd rule-bd">
            <div>
              <span class="small rule-title">升级生效方式</span>
              <div class="rule-opts">
                <span
                  v-for="o in UPGRADE_MODE_OPTIONS"
                  :key="o.key"
                  class="rule-opt"
                  @click="form.upgradeMode = o.key"
                >
                  <span class="rd" :class="{ on: form.upgradeMode === o.key }"></span>{{ o.label }}
                </span>
              </div>
              <span v-if="!form.upgradeMode" class="small unset-note">未配置</span>
            </div>
            <div>
              <span class="small rule-title">降级生效方式</span>
              <div class="chips">
                <span
                  v-for="o in DOWNGRADE_MODE_OPTIONS"
                  :key="o.key"
                  class="btn"
                  :class="{ 'btn-p': form.downgradeMode === o.key }"
                  @click="form.downgradeMode = o.key"
                >{{ o.label }}</span>
              </div>
              <span v-if="!form.downgradeMode" class="small unset-note">未配置</span>
            </div>
            <div>
              <span class="small rule-title">停售后存量租户续费策略</span>
              <div class="chips">
                <span
                  v-for="r in RENEW_POLICY_OPTIONS"
                  :key="r.key"
                  class="btn"
                  :class="{ 'btn-p': form.renewPolicy === r.key }"
                  @click="form.renewPolicy = r.key"
                >{{ r.label }}</span>
              </div>
              <span v-if="!form.renewPolicy" class="small unset-note">未配置</span>
            </div>
          </div>
        </div>

        <p class="small mt10">
          提交后进入草稿；价格类变更需超级管理员密码二次确认，新旧配置自动生成快照存档。
        </p>
      </div>

      <div class="d-ft">
        <span class="btn" style="margin-right: auto" @click="submit(true)">存为草稿</span>
        <span class="btn btn-p" @click="submit(false)">保存并上架</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  getPlanDetail,
  createPlan,
  updatePlan,
  getPlanPolicy,
  updatePlanPolicy,
} from "../api";
import {
  PLAN_TYPE_OPTIONS,
  PLAN_TYPE_DAYS,
  PLAN_STATUS_OPTIONS,
  UPGRADE_MODE_OPTIONS,
  DOWNGRADE_MODE_OPTIONS,
  RENEW_POLICY_OPTIONS,
  FEATURE_GROUPS,
  TOTAL_FEATURE_COUNT,
  buildPlanPolicy,
} from "../constants/plan-features";
import type { FeatureGroup } from "../constants/plan-features";

const route = useRoute();
const router = useRouter();

const isEdit = computed(() => !!route.params.id);
const planId = computed(() => Number(route.params.id));

const pageLoading = ref(false);
const submitLoading = ref(false);
/* 配额分区锚点（列表页「配额详情」进入时定位用） */
const quotaRef = ref<HTMLElement | null>(null);
/* 复制来源套餐名（用于页头提示，展示真实读取结果，不虚构） */
const copiedFromName = ref("");
/* 策略包保存失败的内容区错误态（不重复弹 toast，见「双 toast 收敛口径」） */
const policyError = ref("");

/* ── 状态（枚举取值表见 docs/API接口文档.md · P36/POST /api/platform/plans） ── */
const statusCycle = PLAN_STATUS_OPTIONS;
const statusIdx = ref(0);
const statusLabel = computed(() => statusCycle[statusIdx.value]?.label || "—");
function cycleStatus() {
  statusIdx.value = (statusIdx.value + 1) % statusCycle.length;
}

/* ── 表单状态 ──
 * 未配置语义（护栏④）：额度/规则/活动价一律以 null、"" 表示「未配置」，
 * 不预置任何数字或选项，提交时未配置项不上送、不落库。 */
const form = reactive({
  planCode: "",
  planName: "",
  description: "",
  planType: "" as string,
  durationDays: null as number | null,
  price: 0,
  sortOrder: 50,
  promoPrice: null as number | null,
  promoStart: "",
  promoEnd: "",
  maxUsers: null as number | null,
  maxProducts: null as number | null,
  maxStores: null as number | null,
  maxStorageGb: null as number | null,
  apiQuota: null as number | null,
  aiQuota: null as number | null,
  upgradeMode: "" as string,
  downgradeMode: "" as string,
  renewPolicy: "" as string,
});

/* ── 功能开关矩阵（唯一事实源：src/constants/plan-features.ts，总项数不写死） ── */
const featureGroups = FEATURE_GROUPS;

const checked = reactive<Record<string, boolean>>({});
/* 铁律：不预置任何勾选（未配置即未勾选）；禁止用前端默认值冒充「已配置」 */
featureGroups.forEach((g) => g.items.forEach((it) => (checked[it.name] = false)));

const checkedCount = computed(() => featureGroups.reduce((n, g) => n + g.items.filter((it) => checked[it.name]).length, 0));

function resetChecked() {
  featureGroups.forEach((g) => g.items.forEach((it) => (checked[it.name] = false)));
}

function toggleItem(name: string) {
  checked[name] = !checked[name];
}
function isGroupOn(g: FeatureGroup) {
  return g.items.every((it) => checked[it.name]);
}
function toggleGroup(g: FeatureGroup) {
  const on = isGroupOn(g);
  g.items.forEach((it) => {
    checked[it.name] = !on;
  });
}

/* ── 套餐策略包读写（组1：无结构化列承载的配置项） ──
 * 与套餐主记录分离存储：t_platform_config（config_key='plan_policy:<planId>'）。
 * 读取失败一律返回空对象 = 全部「未配置」，绝不虚构值（禁模拟数据铁律）。 */
async function loadPolicy(id: number): Promise<Record<string, any>> {
  if (!id) return {};
  try {
    const res = await getPlanPolicy(id);
    const d = (res as any)?.data?.data || (res as any)?.data || {};
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

/* ── 编辑态回填（保留 getPlanDetail 逻辑） ── */
async function fetchDetail() {
  pageLoading.value = true;
  try {
    const res = await getPlanDetail(planId.value);
    const data = res.data?.data || (res as any).data || res;
    const moduleAccess: string[] =
      typeof data.moduleAccess === "string"
        ? JSON.parse(data.moduleAccess || "[]")
        : (data.moduleAccess || []);
    /* 策略包（t_platform_config · config_key='plan_policy:<planId>'）：
     * 未配置的子项一律回填为「未配置」语义（null / ""），不补默认值。
     * 注意：这些项不写 t_subscription_plan.features（该列为功能特性码数组且对外透出）。 */
    const policy: any = await loadPolicy(planId.value);
    Object.assign(form, {
      planCode: data.planCode || "",
      planName: data.planName || "",
      description: data.description || "",
      planType: data.planType || "",
      durationDays: data.durationDays ?? null,
      price: data.price ?? 0,
      sortOrder: data.sortOrder ?? 0,
      maxUsers: data.maxUsers ?? null,
      maxProducts: data.maxProducts ?? null,
      maxStores: data.maxStores ?? null,
      maxStorageGb: data.maxStorageMb != null ? Math.round(data.maxStorageMb / 1024) : null,
      apiQuota: policy?.quota?.apiDaily ?? null,
      aiQuota: policy?.quota?.aiMonthly ?? null,
      upgradeMode: policy?.upgrade?.mode ?? "",
      downgradeMode: policy?.downgrade?.mode ?? "",
      renewPolicy: policy?.renew?.policy ?? "",
      promoPrice: policy?.promo?.price ?? null,
      promoStart: policy?.promo?.start ?? "",
      promoEnd: policy?.promo?.end ?? "",
    });
    // 状态按真实枚举回填（DRAFT / ACTIVE / INACTIVE）
    const stIdx = statusCycle.findIndex((s) => s.key === data.status);
    statusIdx.value = stIdx >= 0 ? stIdx : 0;
    resetChecked();
    featureGroups.forEach((g) =>
      g.items.forEach((it) => {
        if (moduleAccess.includes(it.name)) checked[it.name] = true;
      })
    );
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载失败");
  } finally {
    pageLoading.value = false;
  }
}

/* ── 提交（存为草稿 / 保存并上架） ── */
async function submit(isDraft: boolean) {
  if (!String(form.planName).trim()) {
    ElMessage.warning("请输入套餐名称");
    return;
  }
  submitLoading.value = true;
  try {
    /* durationDays：月/季/年取固定天数；自定义取表单值；未配置周期则不落天数 */
    const durationDays =
      form.planType === "CUSTOM"
        ? form.durationDays
        : PLAN_TYPE_DAYS[form.planType] ?? null;

    const payload: Record<string, unknown> = {
      planCode: form.planCode || `PLAN${Date.now()}`,
      planName: form.planName,
      description: form.description,
      price: Number(form.price) || 0,
      sortOrder: form.sortOrder,
      status: isDraft ? "DRAFT" : statusCycle[statusIdx.value]?.key || "ACTIVE",
      moduleAccess: featureGroups.flatMap((g) => g.items.filter((it) => checked[it.name]).map((it) => it.name)),
    };
    /* 未配置的结构化列一律不上送（不写占位值，护栏④） */
    if (form.planType) payload.planType = form.planType;
    if (durationDays !== null && durationDays !== undefined) payload.durationDays = durationDays;
    if (form.maxUsers !== null && form.maxUsers !== undefined) payload.maxUsers = Number(form.maxUsers);
    if (form.maxProducts !== null && form.maxProducts !== undefined) payload.maxProducts = Number(form.maxProducts);
    if (form.maxStores !== null && form.maxStores !== undefined) payload.maxStores = Number(form.maxStores);
    if (form.maxStorageGb !== null && form.maxStorageGb !== undefined) payload.maxStorageMb = Number(form.maxStorageGb) * 1024;

    let targetId = 0;
    if (isEdit.value) {
      await updatePlan(planId.value, payload);
      targetId = planId.value;
    } else {
      const created: any = await createPlan(payload);
      targetId = Number(created?.data?.data?.id ?? created?.data?.id ?? 0);
    }

    /* 策略包单独保存（落 t_platform_config）：未配置的子项不出现在包里，
     * 全部为空时写入 {version:1} = 未配置语义，不会把占位值固化。 */
    if (targetId) {
      try {
        await updatePlanPolicy(
          targetId,
          buildPlanPolicy({
            apiQuota: form.apiQuota,
            aiQuota: form.aiQuota,
            upgradeMode: form.upgradeMode,
            downgradeMode: form.downgradeMode,
            renewPolicy: form.renewPolicy,
            promoPrice: form.promoPrice,
            promoStart: form.promoStart,
            promoEnd: form.promoEnd,
          })
        );
        policyError.value = "";
      } catch {
        // 双 toast 收敛口径：错误提示由 HTTP 客户端统一弹出，此处只留内容区错误态
        policyError.value =
          "套餐主信息已保存，但策略配置（升级/降级/续费/额度/限时活动）保存失败，请重试";
        return;
      }
    } else {
      policyError.value =
        "套餐已保存，但未能取得套餐 ID，策略配置（升级/降级/续费/额度/限时活动）未保存，请回到编辑页补充";
      return;
    }

    ElMessage.success(isDraft ? "已存为草稿" : "保存并上架成功");
    router.push("/packages");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  } finally {
    submitLoading.value = false;
  }
}

function goBack() {
  router.push("/packages");
}

onMounted(async () => {
  if (isEdit.value) {
    await fetchDetail();
  } else if (route.query.copyFrom) {
    // 复制套餐（设计稿第 717 行「复制自：旗舰版」）：载入源套餐配置作为新建初值，保存后生成新套餐
    await copyFrom(Number(route.query.copyFrom));
  }
  // 凌舟裁定：配额详情不单独开页 → 从列表页带 ?section=quota 进来时定位到「④ 资源配额」分区
  if (route.query.section === "quota") {
    await nextTick();
    quotaRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

/* 复制套餐：读取源套餐详情回填表单（仅作初值，不落库） */
async function copyFrom(sourceId: number) {
  if (!sourceId) return;
  pageLoading.value = true;
  try {
    const res = await getPlanDetail(sourceId);
    const d = (res as any)?.data?.data || (res as any)?.data || {};
    /* 源套餐策略包（t_platform_config）：仅作新建初值，不落库 */
    const fea: any = await loadPolicy(sourceId);
    Object.assign(form, {
      planName: `${d.planName || ""} 副本`.trim(),
      planCode: "",
      description: d.description || "",
      planType: d.planType || "",
      durationDays: d.durationDays ?? null,
      price: d.price ?? 0,
      maxUsers: d.maxUsers ?? null,
      maxProducts: d.maxProducts ?? null,
      maxStores: d.maxStores ?? null,
      maxStorageGb: d.maxStorageMb != null ? Math.round(d.maxStorageMb / 1024) : null,
      apiQuota: fea?.quota?.apiDaily ?? null,
      aiQuota: fea?.quota?.aiMonthly ?? null,
      upgradeMode: fea?.upgrade?.mode ?? "",
      downgradeMode: fea?.downgrade?.mode ?? "",
      renewPolicy: fea?.renew?.policy ?? "",
      promoPrice: fea?.promo?.price ?? null,
      promoStart: fea?.promo?.start ?? "",
      promoEnd: fea?.promo?.end ?? "",
      sortOrder: d.sortOrder ?? 0,
    });
    // 功能开关矩阵按源套餐回填
    const srcModules: string[] = Array.isArray(d.moduleAccess)
      ? d.moduleAccess
      : typeof d.moduleAccess === "string"
        ? JSON.parse(d.moduleAccess || "[]")
        : [];
    featureGroups.forEach((g) =>
      g.items.forEach((it) => {
        checked[it.name] = srcModules.includes(it.name);
      })
    );
    copiedFromName.value = d.planName || "";
    // TODO: 后端提供 POST /platform/plans/:id/copy 后改为服务端复制，当前为「读取源配置 + 新建」的等效实现
  } catch {
    ElMessage.warning("未能读取源套餐配置，请确认接口 GET /platform/plans/:id 可用");
  } finally {
    pageLoading.value = false;
  }
}
</script>

<style scoped>
/* 策略包保存失败提示（内容区错误态；颜色/间距全部取自设计令牌） */
.policy-err {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--warning-line);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--warning-text);
  font-size: var(--text-sm);
  line-height: 1.6;
}

/* 抽屉式表单页（设计稿 .drawer 宽 486px 右滑；此处以页面内右对齐卡片呈现） */
.drawer-page {
  width: 486px;
  max-width: 100%;
  margin-left: auto;
  background: var(--bg-card);
  border: 1px solid var(--g2);
  border-radius: var(--card-radius);
  box-shadow: var(--shell-shadow);
  display: flex;
  flex-direction: column;
}
.d-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 13px var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.d-hd .pt {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.d-x:hover {
  background: var(--g0);
  color: var(--g6);
}
.d-bd {
  flex: 1;
  overflow-y: auto;
  padding: var(--panel-body-padding) var(--space-4);
}
.d-ft {
  flex: none;
  border-top: 1px solid var(--g2);
  padding: 11px var(--space-4);
  display: flex;
  gap: var(--space-2);
  background: var(--bg-card);
}

/* 分区标题（.fld > span 复用 kv-label 样式，加粗以作分区头） */
.d-bd > .fld > span {
  font-weight: var(--font-semibold);
  color: var(--g7);
}
.inline-note {
  font-style: normal;
}

/* 分区面板 */
.sec-panel {
  border-radius: var(--radius-lg);
  margin-top: var(--space-2);
}
.sec-bd {
  display: grid;
  gap: 10px;
}

/* 必填星标 */
.req {
  color: var(--color-danger);
  font-style: normal;
}

/* 描述输入框加高（设计稿 height:44px） */
.desc-ipt {
  height: var(--input-height-lg);
}

/* 宽度工具 */
.grow-min {
  flex: 1;
  min-width: 130px;
}
.grow-amount {
  flex: 1.2;
  min-width: 120px;
}
.fill {
  width: 100%;
}

/* 选项组 */
.chips {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

/* 限时活动价（设计稿橙色提示块） */
.promo-row {
  background: var(--color-warning-soft);
  border: 1px solid var(--warning-line);
  border-radius: var(--radius-lg);
  padding: var(--space-2) 10px;
}
.promo-label {
  color: var(--warning-text) !important;
}

/* 功能开关矩阵 */
.mx-list {
  display: grid;
  gap: var(--space-2);
}
.mx-hd {
  cursor: pointer;
}
.mx-it {
  cursor: pointer;
}
.v11-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  border-top: 1px dashed var(--g2);
  margin-top: 7px;
  padding: 7px 0 2px;
}

/* v1.1 修订相关（设计稿 .v11-*，色值取自 tokens） */
.v11-tag {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  white-space: nowrap;
}
.v11-tag.lt {
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
.v11-ck {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--tag-font-size);
  padding: 2.5px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-success-soft);
  background: var(--color-success-soft);
  color: var(--color-success);
  white-space: nowrap;
}
.v11-ck .ck {
  width: 10px;
  height: 10px;
}
.v11-lock {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--tag-font-size);
  padding: 2.5px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--g2);
  background: var(--g0);
  color: var(--g4);
  white-space: nowrap;
}
.lkic {
  display: inline-grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: var(--radius-xs);
  background: var(--g3);
  color: var(--g6);
  flex: none;
}
.v11-onlypay {
  display: inline-flex;
  align-items: center;
  font-size: 8.5px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 5px;
  background: var(--color-warning-soft);
  border: 1px solid var(--warning-line);
  color: var(--color-warning);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
}
.v11-note {
  width: 100%;
  display: flex;
  gap: 7px;
  align-items: flex-start;
  font-size: var(--text-xs);
  color: var(--g5);
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: 7px 11px;
  line-height: var(--leading-normal);
  margin-top: 7px;
}

/* 资源配额（设计稿三列网格） */
.quota-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.unit {
  font-weight: var(--font-normal);
}
/* 未配置提示（护栏④：未配置须显式可辨，不得静默套用默认值） */
.unset-note {
  display: inline-block;
  margin-top: 4px;
  color: var(--g4);
}

/* 升降级规则 */
.rule-bd {
  display: grid;
  gap: 11px;
}
.rule-title {
  display: block;
  margin-bottom: 5px;
  color: var(--g6);
}
.rule-opts {
  display: grid;
  gap: 6px;
  font-size: 11.5px;
  color: var(--g6);
}
.rule-opt {
  display: flex;
  gap: 7px;
  align-items: center;
  cursor: pointer;
}
</style>
