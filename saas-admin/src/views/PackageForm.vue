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
                  v-for="c in cycleOptions"
                  :key="c.key"
                  class="btn"
                  :class="{ 'btn-p': form.planType === c.key }"
                  @click="form.planType = c.key"
                >{{ c.label }}<span v-if="c.days" class="small">{{ c.days }}</span></span>
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
          <span>③ 功能开关矩阵 <i class="small inline-note">（勾选即售 · 租户实际可用 = 全局开关 ∩ 套餐开关 ∩ 租户级开关）</i></span>
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
<div ref="quotaRef" class="fld mt14"><span>④ 资源配额</span></div>
        <div class="panel sec-panel">
          <div class="p-bd quota-grid">
            <span class="fld"><span>账号数</span><span class="ipt">{{ form.maxUsers }} <b class="small unit">个</b></span></span>
            <span class="fld"><span>商品上限</span><span class="ipt">{{ Number(form.maxProducts).toLocaleString() }} <b class="small unit">个</b></span></span>
            <span class="fld"><span>仓库数</span><span class="ipt">{{ form.maxStores }} <b class="small unit">个</b></span></span>
            <span class="fld"><span>存储容量</span><span class="ipt">{{ form.maxStorageGb }} <b class="small unit">GB</b></span></span>
            <span class="fld"><span>API 日额度</span><span class="ipt">{{ Number(form.apiQuota).toLocaleString() }} <b class="small unit">次/日</b></span></span>
            <span class="fld"><span>AI 额度</span><span class="ipt">{{ Number(form.aiQuota).toLocaleString() }} <b class="small unit">次/月</b></span></span>
          </div>
        </div>

        <!-- ⑤ 升降级与续费规则 -->
        <div class="fld mt14"><span>⑤ 升降级与续费规则</span></div>
        <div class="panel sec-panel">
          <div class="p-bd rule-bd">
            <div>
              <span class="small rule-title">升级生效方式</span>
              <div class="rule-opts">
                <span class="rule-opt" @click="form.upgradeMode = '立即'">
                  <span class="rd" :class="{ on: form.upgradeMode === '立即' }"></span>立即生效，剩余天数按天折算补差价（推荐）
                </span>
                <span class="rule-opt" @click="form.upgradeMode = '周期结束'">
                  <span class="rd" :class="{ on: form.upgradeMode === '周期结束' }"></span>当前周期结束后生效
                </span>
              </div>
            </div>
            <div>
              <span class="small rule-title">降级生效方式</span>
              <div class="chips">
                <span class="btn" :class="{ 'btn-p': form.downgradeMode === '周期结束生效' }" @click="form.downgradeMode = '周期结束生效'">周期结束生效</span>
                <span class="btn" :class="{ 'btn-p': form.downgradeMode === '立即生效·下期按新价' }" @click="form.downgradeMode = '立即生效·下期按新价'">立即生效·下期按新价</span>
              </div>
            </div>
            <div>
              <span class="small rule-title">停售后存量租户续费策略</span>
              <div class="chips">
                <span
                  v-for="r in renewOptions"
                  :key="r"
                  class="btn"
                  :class="{ 'btn-p': form.renewPolicy === r }"
                  @click="form.renewPolicy = r"
                >{{ r }}</span>
              </div>
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
import { getPlanDetail, createPlan, updatePlan } from "../api";

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

/* ── 状态（设计稿下拉文案循环） ── */
const statusCycle = ["草稿（仅平台可见）", "已上架", "停售"];
const statusIdx = ref(0);
const statusLabel = computed(() => statusCycle[statusIdx.value]);
function cycleStatus() {
  statusIdx.value = (statusIdx.value + 1) % statusCycle.length;
}

/* ── 计费周期（设计稿：月付 / 季付 / 年付 / 自定义天数 90天） ── */
const cycleOptions = [
  { key: "MONTHLY", label: "月付" },
  { key: "QUARTERLY", label: "季付" },
  { key: "YEARLY", label: "年付" },
  { key: "CUSTOM", label: "自定义天数", days: "90天" },
];

/* ── 续费策略（设计稿三选一） ── */
const renewOptions = ["禁止续费·引导升级", "允许续费最后一年", "自动转推荐套餐"];

/* ── 表单状态 ── */
const form = reactive({
  planCode: "",
  planName: "",
  description: "",
  planType: "YEARLY",
  price: 0,
  sortOrder: 50,
  promoPrice: null as number | null,
  promoStart: "",
  promoEnd: "",
  maxUsers: 0,
  maxProducts: 0,
  maxStores: 0,
  maxStorageGb: 0,
  apiQuota: 0,
  aiQuota: 0,
  upgradeMode: "立即",
  downgradeMode: "立即生效·下期按新价",
  renewPolicy: "允许续费最后一年",
});

/* ── 功能开关矩阵（设计稿五组，默认全选，分销裂变除外） ── */
interface FeatureItem {
  name: string;
  v11?: boolean;
}
interface FeatureGroup {
  name: string;
  items: FeatureItem[];
}
const featureGroups: FeatureGroup[] = [
  { name: "进销存核心", items: [
    { name: "采购管理" }, { name: "销售管理" }, { name: "库存/盘点/调拨" },
    { name: "成本核算" }, { name: "审批流（多级审核）" }, { name: "送货单签收" },
  ] },
  { name: "多仓库 / 多计量单位", items: [
    { name: "多仓库" }, { name: "多单位换算" }, { name: "多级批发价" }, { name: "客户等级价" },
  ] },
  { name: "会员营销", items: [
    { name: "会员储值" }, { name: "积分体系" }, { name: "会员价/券" },
  ] },
  { name: "小程序商城", items: [
    { name: "线上选品下单" }, { name: "优惠券领取核销" }, { name: "即时零售对接" }, { name: "分销裂变" },
  ] },
  { name: "API / 报表 / AI", items: [
    { name: "开放平台 API" }, { name: "标准报表" }, { name: "自定义报表" },
    { name: "AI 助手（增强）" }, { name: "数据批量导出" }, { name: "自定义AI模型接入", v11: true },
  ] },
];

const checked = reactive<Record<string, boolean>>({});
featureGroups.forEach((g) =>
  g.items.forEach((it) => {
    checked[it.name] = it.name !== "分销裂变";
  })
);

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
    Object.assign(form, {
      planCode: data.planCode || "",
      planName: data.planName || "",
      description: data.description || "",
      planType: data.planType || "YEARLY",
      price: data.price || 0,
      sortOrder: data.sortOrder ?? 0,
      maxUsers: data.maxUsers ?? 0,
      maxProducts: data.maxProducts ?? 0,
      maxStores: data.maxStores ?? 0,
      maxStorageGb: Math.round((data.maxStorageMb ?? 0) / 1024),
    });
    // 草稿态前端保留（后端 DRAFT 枚举由阿坚 S2-02 补），其余按真实状态回填
    statusIdx.value = data.status === "ACTIVE" ? 1 : data.status === "DRAFT" ? 0 : 2;
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
    const payload = {
      planCode: form.planCode || `PLAN${Date.now()}`,
      planName: form.planName,
      description: form.description,
      planType: form.planType,
      durationDays: form.planType === "CUSTOM" ? 90 : form.planType === "MONTHLY" ? 30 : form.planType === "QUARTERLY" ? 90 : 365,
      price: Number(form.price) || 0,
      maxUsers: form.maxUsers,
      maxProducts: form.maxProducts,
      maxStores: form.maxStores,
      maxStorageMb: form.maxStorageGb * 1024,
      sortOrder: form.sortOrder,
      // 凌舟裁定 R101-S1-R1：草稿态前端保留，提交 status 用 DRAFT；
      // 后端 DRAFT 枚举由阿坚在 S2-02 补齐并登记 docs/数据库变更清单.md，本轮禁止用 INACTIVE 冒充草稿
      status: isDraft ? "DRAFT" : statusIdx.value === 1 ? "ACTIVE" : "INACTIVE",
      moduleAccess: featureGroups.flatMap((g) => g.items.filter((it) => checked[it.name]).map((it) => it.name)),
    };
    if (isEdit.value) {
      await updatePlan(planId.value, payload);
      ElMessage.success(isDraft ? "已存为草稿" : "保存并上架成功");
    } else {
      await createPlan(payload);
      ElMessage.success(isDraft ? "已存为草稿" : "保存并上架成功");
    }
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
    Object.assign(form, {
      planName: `${d.planName || ""} 副本`.trim(),
      planCode: "",
      description: d.description || "",
      planType: d.planType || "YEARLY",
      price: d.price ?? 0,
      maxUsers: d.maxUsers ?? 0,
      maxProducts: d.maxProducts ?? 0,
      maxStores: d.maxStores ?? 0,
      maxStorageGb: d.maxStorageMb ? Math.round(d.maxStorageMb / 1024) : 0,
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
