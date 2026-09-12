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

    <!-- ============ 升降级流向报表（设计稿 sec-plan 升级/降级流向，展开式面板） ============ -->
    <div v-if="flowOpen" class="panel mt12">
      <div class="p-hd">
        <span class="pt">升降级流向报表</span>
        <span class="ph-s">
          区间：
          <span
            v-for="r in flowRanges"
            :key="r"
            class="btn-t"
            :class="{ on: flowRange === r }"
            @click="flowRange = r"
          >{{ r }}</span>
        </span>
      </div>
      <div class="p-bd tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>流向类型</th>
              <th>来源套餐</th>
              <th>目标套餐</th>
              <th class="num">租户数</th>
              <th>发生时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!flowRows.length">
              <td colspan="5" class="muted">暂无流向数据 · 待接入 GET /platform/plans/upgrade-flow-report</td>
            </tr>
            <tr v-for="(f, i) in flowRows" :key="i">
              <td><span class="tag" :class="f.dir === 'UP' ? 'tag-g' : 'tag-o'">{{ f.dir === 'UP' ? '升级' : '降级' }}</span></td>
              <td>{{ f.fromName }}</td>
              <td>{{ f.toName }}</td>
              <td class="num">{{ f.tenantCount }}</td>
              <td>{{ f.time }}</td>
            </tr>
          </tbody>
        </table>
        <p class="small mt8">口径：按订阅关系变更事件统计，升级含免费→付费；降级含付费→免费与高档→低档。数据来自真实接口，无数据时保持空态。</p>
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
            <tr v-if="!compareRows.length">
              <td colspan="7" class="muted">暂无套餐数据 · 待接入 GET /platform/plans（不展示任何模拟业务数字）</td>
            </tr>
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

    <!-- 空态（接口无数据，禁模拟数据：不回落任何演示数据） -->
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

/* ── 数据状态：仅取真实接口，无数据一律空态（禁模拟数据） ── */
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

/* 接口数据 → 卡片结构（禁模拟数据：无接口数据时为空，页面走空态） */
const plans = computed<PlanCard[]>(() => {
  if (!apiPlans.value.length) return [];
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
      { key: "copy", label: "复制" },
      r.status === "ACTIVE"
        ? { key: "offline", label: "停售", cls: "gy" }
        : { key: "online", label: "重新上架" },
      // 凌舟裁定：配额详情不单独开页，进入编辑抽屉并定位到「④ 资源配额」分区
      { key: "quota", label: "配额详情" },
    ],
  }));
});

/* 页头概览（禁模拟数据：无接口数据时不通写任何家数/金额） */
const headDesc = computed(() => {
  if (apiPlans.value.length) {
    const on = apiPlans.value.filter((p) => p.status === "ACTIVE").length;
    const draft = apiPlans.value.filter((p) => p.status === "DRAFT").length;
    return `共 ${apiPlans.value.length} 个套餐 · 上架中 ${on} · 停售 ${apiPlans.value.length - on - draft} · 草稿 ${draft} · 已订阅租户 --`;
  }
  return "套餐数据待接入 GET /platform/plans（当前无真实数据）";
});

/* ── 对照表（仅展示真实接口套餐，无数据走空态，不编造业务数字） ── */
interface CompareRow {
  name: string; src: string; srcCls: string; price: string;
  switches: string; v11?: boolean; swNote?: string;
  quota: string; rule: string; stCls: string; stText: string;
}
const compareRows = computed<CompareRow[]>(() =>
  apiPlans.value.length ? buildRowsFromApi() : []
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

/* ── 升降级流向报表（设计稿 sec-plan 升级/降级流向；真实接口，无数据走空态） ── */
const flowOpen = ref(false);
const flowRanges = ["本月", "近 3 月", "近 12 月"];
const flowRange = ref("本月");
const flowRows = ref<{ dir: string; fromName: string; toName: string; tenantCount: number; time: string }[]>([]);
// TODO: 待接入 GET /platform/plans/upgrade-flow-report?range=，当前无接口故恒为空态（禁止编造流向数据）
function openFlowReport() {
  flowOpen.value = !flowOpen.value;
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
    /* 禁模拟数据：接口异常时保持空态，不回落任何演示数据 */
  } finally {
    loading.value = false;
  }
}

/* ── 操作 ── */
function goCreate() {
  router.push("/packages/create");
}

function onPlanAction(key: string, p: PlanCard) {
  switch (key) {
    case "edit":
    case "copy":
      if (p.id) {
        router.push(key === "edit" ? `/packages/${p.id}/edit` : `/packages/create?copyFrom=${p.id}`);
      } else {
        // TODO: 复制套餐待接入（建议 POST /platform/plans/:id/copy）
        ElMessage.info("暂无套餐数据：待接口接入后可编辑/复制");
      }
      break;
    case "offline":
    case "online":
      toggleStatus(p, key === "offline" ? "INACTIVE" : "ACTIVE");
      break;
    case "quota":
      // 凌舟裁定：配额详情不单独开页 → 进入编辑抽屉并定位到「④ 资源配额」分区
      if (p.id) {
        router.push(`/packages/${p.id}/edit?section=quota`);
      } else {
        ElMessage.info("暂无套餐数据：待接口接入后可查看配额");
      }
      break;
    // 凌舟裁定：续费策略属五段式第⑤段（设计稿第 748 行），移除独立入口，不再出现 case "renew"
    case "delete":
      handleDelete(p);
      break;
  }
}

async function toggleStatus(p: PlanCard, newStatus: string) {
  if (!p.id) {
    ElMessage.info("暂无套餐数据：待接口接入后可变更状态");
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
    ElMessage.info("暂无套餐数据：待接口接入后可删除");
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
