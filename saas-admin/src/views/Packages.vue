<template>
  <div>
    <!-- ============ 引擎说明提示条（设计稿 sec-plan .tipbar） ============ -->
    <div class="tipbar">
      <span class="ic">i</span>
      <span>
        <b>套餐为动态配置引擎：</b>所有套餐均由平台自主创建与修改，当前预置模板（免费/基础/标准/旗舰）可编辑、可停用，不作为固定商品；价格调整需密码二次确认并留存新旧价格快照，仅超级管理员与财务角色可操作。
      </span>
    </div>

    <!-- ============ 页头（设计稿 .pg-hd） ============ -->
    <div class="pg-hd mt12">
      <div>
        <div class="pt4">套餐管理</div>
        <p class="pd">{{ headDesc }}</p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="openFlowReport">升降级流向报表</span>
        <span class="btn btn-p" @click="goCreate">+ 新建套餐</span>
      </div>
    </div>

    <!-- ============ 套餐卡片网格（设计稿 .g3 + .plan） ============ -->
    <div class="g3">
      <div
        v-for="p in plans"
        :key="p.name"
        class="plan"
        :class="{ hot: p.hot, 'is-dashed': p.dashed }"
      >
        <span v-if="p.badge" class="badge">{{ p.badge }}</span>
        <div class="ph">
          <span class="pn">{{ p.name }}</span>
          <span class="tag" :class="p.tagCls">{{ p.tagText }}</span>
        </div>
        <div class="pv">¥{{ p.price }} <i>/ {{ p.unit }}</i></div>
        <div class="pnum">{{ p.line1 }}</div>
        <div class="pnum">{{ p.line2 }}</div>
        <div class="pft">
          <span
            v-for="a in p.actions"
            :key="a.label"
            class="btn-t"
            :class="a.cls"
            @click="onPlanAction(a.key, p)"
          >{{ a.label }}</span>
        </div>
      </div>
    </div>

    <!-- ============ 预置模板与自建套餐对照（设计稿 .panel + .tbl） ============ -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">预置模板与自建套餐对照</span>
        <span class="ph-s">预置 4 档为初始数据，与自建套餐同引擎同配置结构</span>
      </div>
      <div class="p-bd tblwrap compare-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>套餐</th>
              <th>来源</th>
              <th>定价 / 周期</th>
              <th>功能开关数</th>
              <th>配额摘要</th>
              <th>升降级规则</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in compareRows" :key="r.name">
              <td><b>{{ r.name }}</b></td>
              <td><span class="tag" :class="r.srcCls">{{ r.src }}</span></td>
              <td>{{ r.price }}</td>
              <td>
                {{ r.switches }}
                <span v-if="r.v11" class="v11-tag lt">v1.1</span>
                <span v-if="r.swNote" class="small"> · {{ r.swNote }}</span>
              </td>
              <td>{{ r.quota }}</td>
              <td>{{ r.rule }}</td>
              <td><span class="tag" :class="r.stCls">{{ r.stText }}</span></td>
            </tr>
          </tbody>
        </table>
        <p class="small mt8">
          <span class="v11-tag lt note-tag">v1.1</span>功能开关数按 28 项总目录统计；其中「<b>自定义AI模型接入</b>」为付费专属能力——基础版 / 标准版 / 旗舰版默认开启，免费版锁定不可选（规则详见下方新建套餐表单 · 功能开关矩阵）。
        </p>
      </div>
    </div>

    <!-- 空态（接口无数据且演示数据不可用时兜底） -->
    <div v-if="!plans.length" class="empty mt12">
      暂无套餐数据，点击「+ 新建套餐」创建平台第一个套餐
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { getPlans, updatePlan } from "../api";

const router = useRouter();

/* ── 数据状态：优先接口，无数据时回落到设计稿演示数据保证视觉完整 ── */
const loading = ref(false);
const apiPlans = ref<any[]>([]);

interface PlanAction {
  key: string;
  label: string;
  cls?: string;
}
interface PlanCard {
  id?: number;
  name: string;
  tagCls: string;
  tagText: string;
  price: string;
  unit: string;
  line1: string;
  line2: string;
  hot?: boolean;
  dashed?: boolean;
  badge?: string;
  actions: PlanAction[];
}

/* 设计稿第 688~693 行的 6 张套餐卡片（演示数据） */
const demoPlans: PlanCard[] = [
  {
    name: "免费版", tagCls: "tag-g", tagText: "上架中", price: "0", unit: "永久免费",
    line1: "已订阅 671 家 · 获客漏斗入口", line2: "账号 1 · 商品 100 · 仓库 1 · 存储 1GB",
    actions: [
      { key: "edit", label: "编辑" },
      { key: "copy", label: "复制" },
      { key: "offline", label: "停售", cls: "gy" },
      { key: "quota", label: "配额详情" },
    ],
  },
  {
    name: "基础版", tagCls: "tag-g", tagText: "上架中", price: "4,800", unit: "年",
    line1: "已订阅 310 家 · 本月新增付费 14", line2: "账号 3 · 商品 2,000 · 存储 5GB · AI 500次/月",
    actions: [
      { key: "edit", label: "编辑" },
      { key: "copy", label: "复制" },
      { key: "offline", label: "停售", cls: "gy" },
    ],
  },
  {
    name: "标准版", tagCls: "tag-g", tagText: "上架中", price: "9,800", unit: "年",
    line1: "已订阅 191 家 · 本月新增付费 6", line2: "账号 10 · 商品 20,000 · API 10万次/月",
    hot: true, badge: "主力套餐",
    actions: [
      { key: "edit", label: "编辑" },
      { key: "copy", label: "复制" },
      { key: "offline", label: "停售", cls: "gy" },
    ],
  },
  {
    name: "旗舰版", tagCls: "tag-g", tagText: "上架中", price: "19,800", unit: "年",
    line1: "已订阅 114 家 · 含专属客服 SLA", line2: "账号 30 · 商品 100,000 · 存储 100GB",
    actions: [
      { key: "edit", label: "编辑" },
      { key: "copy", label: "复制" },
      { key: "offline", label: "停售", cls: "gy" },
    ],
  },
  {
    name: "批发专享版", tagCls: "tag-gy", tagText: "停售", price: "12,800", unit: "年",
    line1: "已订阅 0 家 · 2026-06 自主创建", line2: "停售后存量租户：允许续费最后一年",
    actions: [
      { key: "edit", label: "编辑" },
      { key: "online", label: "重新上架" },
      { key: "renew", label: "续费策略" },
    ],
  },
  {
    name: "生鲜行业专供", tagCls: "tag-p", tagText: "草稿", price: "15,800", unit: "年",
    line1: "复制自旗舰版 · 尚未发布", line2: "已配置：定价 ✓ 功能矩阵 ✓ 配额 ✓",
    dashed: true,
    actions: [
      { key: "edit", label: "继续编辑" },
      { key: "online", label: "发布上架" },
      { key: "delete", label: "删除", cls: "dgr" },
    ],
  },
];

/* 接口数据 → 卡片结构（字段尽力映射，未覆盖的以 '-' 展示） */
const plans = computed<PlanCard[]>(() => {
  if (!apiPlans.value.length) return demoPlans;
  return apiPlans.value.map((r) => ({
    id: r.id,
    name: r.planName || "-",
    tagCls: r.status === "ACTIVE" ? "tag-g" : "tag-gy",
    tagText: r.status === "ACTIVE" ? "上架中" : "停售",
    price: Number(r.price || 0).toLocaleString(),
    unit: r.planType === "PERMANENT" ? "永久" : `${r.durationDays || 365}天`,
    line1: `已订阅 -- · ${r.description || ""}`,
    line2: `账号 ${r.maxUsers ?? "-"} · 商品 ${Number(r.maxProducts || 0).toLocaleString()} · 门店 ${r.maxStores ?? "-"}`,
    actions: [
      { key: "edit", label: "编辑" },
      r.status === "ACTIVE"
        ? { key: "offline", label: "停售", cls: "gy" }
        : { key: "online", label: "重新上架" },
    ],
  }));
});

/* 页头概览（接口未接入时沿用设计稿文案口径） */
const headDesc = computed(() => {
  if (apiPlans.value.length) {
    const on = apiPlans.value.filter((p) => p.status === "ACTIVE").length;
    return `共 ${apiPlans.value.length} 个套餐 · 上架中 ${on} · 停售 ${apiPlans.value.length - on} · 已订阅租户 --`;
  }
  return "共 6 个套餐 · 上架中 4 · 停售 1 · 草稿 1 · 已订阅租户 1,286";
});

/* ── 对照表（设计稿第 701~705 行，演示数据） ── */
interface CompareRow {
  name: string; src: string; srcCls: string; price: string;
  switches: string; v11?: boolean; swNote?: string;
  quota: string; rule: string; stCls: string; stText: string;
}
const demoRows: CompareRow[] = [
  { name: "免费版", src: "预置模板", srcCls: "tag-gy", price: "¥0 · 永久", switches: "7 / 28 项", v11: true, swNote: "不含自定义AI模型（锁定）", quota: "1 账号 · 100 商品 · 1GB", rule: "升级即时生效", stCls: "tag-g", stText: "上架" },
  { name: "基础版", src: "预置模板", srcCls: "tag-gy", price: "¥4,800 / 年", switches: "16 / 28 项", quota: "3 账号 · 2,000 商品 · 5GB", rule: "升级即时生效·按天折算", stCls: "tag-g", stText: "上架" },
  { name: "标准版", src: "预置模板", srcCls: "tag-gy", price: "¥9,800 / 年", switches: "24 / 28 项", quota: "10 账号 · 20,000 商品 · 20GB", rule: "支持自定义天数周期", stCls: "tag-g", stText: "上架" },
  { name: "旗舰版", src: "预置模板", srcCls: "tag-gy", price: "¥19,800 / 年", switches: "28 / 28 项", quota: "30 账号 · 100,000 商品 · 100GB", rule: "全量功能 · 开放平台", stCls: "tag-g", stText: "上架" },
  { name: "批发专享版", src: "自主创建", srcCls: "tag-p", price: "¥12,800 / 年", switches: "26 / 28 项", quota: "20 账号 · 50,000 商品 · 60GB", rule: "停售 · 存量允许续费一年", stCls: "tag-gy", stText: "停售" },
];
const compareRows = computed<CompareRow[]>(() =>
  apiPlans.value.length ? buildRowsFromApi() : demoRows
);

function buildRowsFromApi(): CompareRow[] {
  return apiPlans.value.map((r) => ({
    name: r.planName || "-",
    src: "自主创建",
    srcCls: "tag-p",
    price: `¥${Number(r.price || 0).toLocaleString()} / ${r.planType === "PERMANENT" ? "永久" : `${r.durationDays || 365}天`}`,
    switches: `${(r.moduleAccess || []).length} / 28 项`,
    quota: `${r.maxUsers ?? "-"} 账号 · ${Number(r.maxProducts || 0).toLocaleString()} 商品`,
    rule: r.status === "ACTIVE" ? "升级即时生效" : "停售 · 存量允许续费一年",
    stCls: r.status === "ACTIVE" ? "tag-g" : "tag-gy",
    stText: r.status === "ACTIVE" ? "上架" : "停售",
  }));
}

/* ── 列表加载：保留 getPlans 调用 ── */
async function fetchList() {
  loading.value = true;
  try {
    const res = await getPlans({});
    const data = res.data?.data || (res as any).data || res;
    const records = data.records || [];
    apiPlans.value = records.map((r: any) => ({
      ...r,
      moduleAccess: typeof r.moduleAccess === "string" ? JSON.parse(r.moduleAccess || "[]") : (r.moduleAccess || []),
    }));
  } catch {
    /* 接口异常时回落演示数据，不打断页面 */
  } finally {
    loading.value = false;
  }
}

/* ── 操作 ── */
function goCreate() {
  router.push("/packages/create");
}

function openFlowReport() {
  // TODO: 待接入升降级流向报表（建议 GET /platform/plans/upgrade-flow-report）
  ElMessage.info("升降级流向报表：待接入报表接口");
}

function onPlanAction(key: string, p: PlanCard) {
  switch (key) {
    case "edit":
    case "copy":
      if (p.id) {
        router.push(key === "edit" ? `/packages/${p.id}/edit` : `/packages/create?copyFrom=${p.id}`);
      } else {
        // TODO: 复制套餐待接入（建议 POST /platform/plans/:id/copy）
        ElMessage.info("演示数据：待接口对接后可编辑/复制");
      }
      break;
    case "offline":
    case "online":
      toggleStatus(p, key === "offline" ? "INACTIVE" : "ACTIVE");
      break;
    case "quota":
      ElMessage.info("配额详情：待接入配额查询接口");
      break;
    case "renew":
      ElMessage.info("续费策略：待接入续费策略配置接口");
      break;
    case "delete":
      handleDelete(p);
      break;
  }
}

async function toggleStatus(p: PlanCard, newStatus: string) {
  if (!p.id) {
    ElMessage.info("演示数据：待接口对接后可变更状态");
    return;
  }
  const action = newStatus === "ACTIVE" ? "上架" : "停售";
  try {
    await ElMessageBox.confirm(
      `确定要${action}套餐「${p.name}」吗？`,
      `${action}确认`,
      { type: "warning", confirmButtonText: `确定${action}`, cancelButtonText: "取消" }
    );
  } catch { return; }
  try {
    await updatePlan(p.id, { status: newStatus });
    ElMessage.success(`已${action}`);
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "操作失败");
  }
}

async function handleDelete(p: PlanCard) {
  if (!p.id) {
    ElMessage.info("演示数据：待接口对接后可删除");
    return;
  }
  try {
    await ElMessageBox.confirm(`确定要删除套餐「${p.name}」吗？`, "确认删除", { type: "warning" });
  } catch { return; }
  // TODO: 删除套餐待接入（建议 DELETE /platform/plans/:id）
  ElMessage.info("删除套餐：待接入删除接口");
}

onMounted(fetchList);
</script>

<style scoped>
/* 草稿卡片虚线描边（设计稿 style="border-style:dashed"） */
.plan.is-dashed {
  border-style: dashed;
}

/* 对照表 v1.1 修订标记（设计稿 .v11-tag，色值取自 tokens） */
.v11-tag {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  vertical-align: var(--ver-tag-valign);
  white-space: nowrap;
  background: var(--color-primary);
  color: var(--text-inverse);
}
.v11-tag.lt {
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
.compare-wrap {
  padding-top: 8px;
}
.note-tag {
  margin-right: 5px;
}
</style>
