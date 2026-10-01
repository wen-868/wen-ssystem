<template>
  <!-- 06 营销 · 渠道推广（内容片段，由框架 PlatformLayout 的 .pf-main 提供样式作用域） -->
  <div>
    <!-- ① 页头：渠道归属口径说明 + 右侧操作 -->
    <div class="pg-hd">
      <div>
        <div class="pt4">渠道推广</div>
        <!-- C6-3-2a 口径修正（业主 2026-09-27 拍板）：归因不依赖官网自注册，
             落点＝平台「开租户 / 订阅审核通过」时绑定；代理商邀请优先于老带新（规划 4.14）。 -->
        <p class="pd">渠道归属：在平台「开租户 / 订阅审核通过」时按推广码或代理商绑定归因（自注册不分配归属）· 代理商邀请优先于老带新 · 归属关系落库后不可更改</p>
      </div>
      <div class="pg-act">
        <!-- R7：渠道报表并入本页「渠道效果」子 Tab，不新增独立页面/路由/菜单 -->
        <span class="btn" @click="openReport">渠道效果报表</span>
        <span class="btn btn-p" @click="openCreateDialog">+ 生成推广码</span>
      </div>
    </div>

    <!-- 子 Tab（R7 裁定：渠道报表并入本页，不新增独立页面/路由/菜单） -->
    <div class="tabs">
      <span class="tab" :class="{ on: activeTab === 'promo' }" @click="activeTab = 'promo'">推广码与台账</span>
      <span class="tab" :class="{ on: activeTab === 'report' }" @click="activeTab = 'report'">渠道效果</span>
    </div>

    <template v-if="activeTab === 'promo'">
    <!-- ② 推广码列表 -->
    <div class="panel">
      <div class="p-hd">
        <span class="pt">推广码列表</span>
        <div class="frow">
          <el-select
            v-model="queryStatus"
            placeholder="状态：全部"
            clearable
            style="width:140px"
            @change="fetchPromoCodes"
          >
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
          <input
            class="ipt"
            v-model="searchKeyword"
            placeholder="搜索码值 / 渠道名"
            @keyup.enter="fetchPromoCodes"
          />
          <span class="btn" @click="fetchPromoCodes">查询</span>
        </div>
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>码值</th>
              <th>来源渠道</th>
              <th>渠道负责人</th>
              <th>有效期</th>
              <th>状态</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="promoCodes.length === 0">
              <td colspan="7"><div class="empty">{{ loading ? "加载中…" : "暂无推广码数据" }}</div></td>
            </tr>
            <tr v-for="row in promoCodes" :key="row.id">
              <td>{{ row.promoCode }}</td>
              <td>{{ row.channelType }} / {{ row.channelName }}</td>
              <td>{{ row.ownerAdminId ?? "—" }}</td>
              <td>{{ row.expireAt || "长期有效" }}</td>
              <td>{{ row.status === "ACTIVE" ? "启用" : "停用" }}</td>
              <td>{{ row.remark || "—" }}</td>
              <td>
                <span class="btn" @click="openAttributionDialog(row)">归因</span>
                <span class="btn" @click="handleDisable(row)">停用</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 渠道转化指标（注册数 / 注册转化数 / 付费转化）无数据模型，归 C6-3-2b：
           本单只接码档案与归因，不展示任何推算值、不预置示例数字。 -->
      <p class="small mt8" style="padding:0 var(--panel-body-padding) var(--space-3)">
        渠道转化指标（注册数 / 付费转化）与老带新台账归 <b>C6-3-2b</b>，本单不接数据、不展示任何推算值。
      </p>
    </div>
    <!-- ③ 老带新台账 -->
    <div class="panel mt12">
      <div class="p-hd">
        <span class="pt">老带新台账</span>
        <div class="lg-row">
          <span class="tag tag-b">奖励比例 20%</span>
          <span class="tag tag-b">年度上限 60,000 积分</span>
          <span class="tag tag-b">冷静期 7 天</span>
          <span class="tag tag-b">积分有效期 24 个月</span>
        </div>
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>邀请人</th>
              <th>被邀请人</th>
              <th>关联账单</th>
              <th class="num">计奖基数</th>
              <th class="num">奖励积分（20%）</th>
              <th class="num">邀请人年度累计</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referralLedger.length === 0">
              <td colspan="8"><div class="empty">暂无老带新台账数据（归 C6-3-2b，本单未接数据）</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ④ 冲回机制 + 积分出口说明 -->
      <p class="small mt8" style="padding:0 var(--panel-body-padding) var(--space-3)">
        冲回机制：冷静期内全额退款或 12 个月内注销，奖励原路冲回（可用积分扣减，不足记负）；确认作弊全数追回并停用邀请资格。积分出口：
        <span class="v12-tag lt">v1.2</span>
        ① 续费抵扣（1 积分 = 1 元）② AI 用量抵扣（按平台配置汇率冲抵公共模型 Token 用量，积分优先于套餐内含额度扣减，详见版块05「积分抵扣」）③ 提现（财务审核，单月 ≤2 次、单次 ≥500 元）。
      </p>

      <!-- ⑤ 积分消耗流水示例（v1.2 AI 用量抵扣）说明块 -->
      <div class="v11-note" style="margin:0 var(--panel-body-padding) var(--space-3)">
        <span class="v12-tag lt">v1.2</span>
        <span>
          <b>积分消耗流水示例（AI 用量抵扣）：</b>
          <b class="dgr-text">-500 积分</b>
          · <b>AI用量抵扣</b>（按当前配置汇率 1 积分 = 50 token，冲抵平台公共模型用量 25,000 token）· 操作后积分余额 12,700 · 消耗时锁定汇率 · 抵扣不可退、不可转赠。
        </span>
      </div>
    </div>
    </template>

    <!-- ③ 渠道效果（R7：并入子 Tab；数据源待立项 T11） -->
    <template v-else>
      <div class="panel">
        <div class="p-hd">
          <span class="pt">渠道效果报表</span>
          <span class="ph-s">并入本页子 Tab（裁定 R7）· 不新增独立页面/路由/菜单</span>
        </div>
        <div class="p-bd">
          <div class="empty">暂无渠道效果数据（渠道效果报表 / 老带新台账归 C6-3-2b，本单未接数据）</div>
          <p class="small mt8" style="color:var(--g5)">
            报表口径（注册→付费转化漏斗 / 渠道佣金月结 / 有效期分布）需产品确认，见
            <b>C6-3-2b（R101-C6-2 立项清单 T11）</b>；本 Tab 不展示任何本地推算或示例数值。
          </p>
        </div>
      </div>
    </template>

    <!-- ⑥ 「生成推广码」弹窗（Element Plus 弹窗，内部用设计稿组件类，包一层 .zx-scope 启用样式） -->
    <el-dialog v-model="dialogVisible" title="生成推广码" width="var(--modal-width-sm)" :close-on-click-modal="false">
      <div class="zx-scope dialog-body">
        <div class="frow">
          <div class="fld fld-grow">
            <span>渠道类型 <i class="req">*</i></span>
            <el-select v-model="form.channelType" placeholder="请选择渠道类型" style="width:100%">
              <el-option label="市场渠道" value="市场渠道" />
              <el-option label="异业合作" value="异业合作" />
              <el-option label="地推" value="地推" />
              <el-option label="其他" value="其他" />
            </el-select>
          </div>
          <div class="fld fld-grow">
            <span>渠道名称 <i class="req">*</i></span>
            <input class="ipt" v-model="form.channelName" placeholder="请输入渠道名称" />
          </div>
        </div>

        <div class="fld">
          <span>有效期（留空 = 长期有效）</span>
          <el-date-picker
            v-model="form.expireAt"
            type="datetime"
            placeholder="选择有效期（留空 = 长期有效）"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width:100%"
          />
        </div>

        <div class="fld">
          <span>备注</span>
          <input class="ipt" v-model="form.remark" placeholder="备注（选填）" />
        </div>

        <div class="tipbar">
          <span class="ic">i</span>
          <span>码值由平台生成（<b>PC</b> + 8 位去易混大写字母数字）；归因在平台「开租户 / 订阅审核通过」时按本码绑定，自注册不分配归属。本单不含奖励规则 / 佣金配置。</span>
        </div>
      </div>

      <template #footer>
        <div class="zx-scope">
          <span class="btn" @click="dialogVisible = false">取消</span>
          <span class="btn btn-p" @click="handleGenerate">{{ saving ? "生成中…" : "生成推广码" }}</span>
        </div>
      </template>
    </el-dialog>

    <!-- ⑦ 「该码归因」只读弹窗（C6-3-2a：归因明细只读聚合，不提供改绑 / 申诉入口） -->
    <el-dialog v-model="attrVisible" :title="`归因明细 · ${attrCode}`" width="var(--modal-width-sm)">
      <div class="zx-scope dialog-body">
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>租户 ID</th>
                <th>归因类型</th>
                <th>归因时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="attributions.length === 0">
                <td colspan="3"><div class="empty">{{ attrLoading ? "加载中…" : "该码暂无归因记录" }}</div></td>
              </tr>
              <tr v-for="(a, i) in attributions" :key="`${a.tenantId}-${i}`">
                <td>{{ a.tenantId }}</td>
                <td>{{ attributionTypeLabel(a.attributionType) }}</td>
                <td>{{ a.attributedAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="small">归因明细只读（一租户一条归因，落库后不可更改）；本单不提供改绑 / 申诉入口。</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import {
  listPromoCodes,
  createPromoCode,
  disablePromoCode,
  listPromoCodeAttributions,
  type PromoCodeRow
} from "../../api";

/* ═══════════════════════════════════════════════════════════════
   数据层：R101-C6-3-2a **已接线**（Tab① 推广码与台账）
   · 推广码：列表（分页 + 关键词 + 状态）/ 生成 / 停用 —— 真实调用 /api/platform/promo-codes
   · 归因：按码查看只读聚合（t_tenant_attribution）
   · 老带新台账 + 渠道效果报表归 C6-3-2b：保持诚实空态，不调用任何接口、不造数
   · 零金额：本页不出现任何金额 / 分润 / 佣金 / 结算 / 提现字段
   ═══════════════════════════════════════════════════════════════ */

const loading = ref(false);
const promoCodes = ref<PromoCodeRow[]>([]);
const referralLedger = ref<any[]>([]);

const searchKeyword = ref("");
const queryStatus = ref<"ACTIVE" | "DISABLED" | "">("");
/** R7：本页子 Tab（promo = 推广码与台账 / report = 渠道效果报表，并入本页，不新增独立路由） */
const activeTab = ref<"promo" | "report">("promo");

const dialogVisible = ref(false);
const saving = ref(false);
/** 生成体字段集 = PromoCodeCreateBody（api.ts 声明 ↔ 后端 createBodySchema 逐字一致） */
const form = reactive({
  channelType: "",
  channelName: "",
  expireAt: "",
  remark: ""
});

const attrVisible = ref(false);
const attrLoading = ref(false);
const attrCode = ref("");
const attributions = ref<{ tenantId: string; attributionType: string; attributedAt: string }[]>([]);

/** 后端响应解包：axios 拦截器原样返回 AxiosResponse ⇒ data.data 为业务载荷 */
function payloadOf(res: any): any {
  return res?.data?.data;
}

/** GET /platform/promo-codes —— 推广码列表（空表 ⇒ items: []，不造数） */
async function fetchPromoCodes() {
  loading.value = true;
  try {
    const res: any = await listPromoCodes({
      page: 1,
      pageSize: 50,
      keyword: searchKeyword.value.trim() || undefined,
      status: queryStatus.value || undefined
    });
    const data = payloadOf(res);
    promoCodes.value = Array.isArray(data?.items) ? data.items : [];
  } catch {
    // 拦截器已给中文提示；这里只清空列表，不造数、不假成功
    promoCodes.value = [];
  } finally {
    loading.value = false;
  }
}

/** 老带新台账归 C6-3-2b（无表、无端点）⇒ 诚实空态；不调用任何接口，也不展示推算值 */
async function fetchReferralLedger() {
  referralLedger.value = [];
}

function openReport() {
  // ③-b #68 + 裁定 R7：不指向独立报表页，改为切到本页「渠道效果」子 Tab（数据源归 C6-3-2b）
  activeTab.value = "report";
}

function openCreateDialog() {
  Object.assign(form, { channelType: "", channelName: "", expireAt: "", remark: "" });
  dialogVisible.value = true;
}

/** POST /platform/promo-codes —— 生成推广码（码值由后端生成：PC + 8 位去易混大写字母数字） */
async function handleGenerate() {
  if (!form.channelType) {
    ElMessage.warning("请选择渠道类型");
    return;
  }
  if (!form.channelName.trim()) {
    ElMessage.warning("请填写渠道名称");
    return;
  }
  saving.value = true;
  try {
    const res: any = await createPromoCode({
      channelType: form.channelType,
      channelName: form.channelName.trim(),
      expireAt: form.expireAt || null,
      remark: form.remark.trim() || null
    });
    const created = payloadOf(res);
    ElMessage.success(created?.promoCode ? `已生成推广码 ${created.promoCode}` : "推广码已生成");
    dialogVisible.value = false;
    await fetchPromoCodes();
  } catch {
    // 拦截器已给中文提示（含 409 冲突等），不吞错、不假成功
  } finally {
    saving.value = false;
  }
}

/** POST /platform/promo-codes/:id/disable —— 停用（后端幂等：已停用返回 alreadyDisabled=true） */
async function handleDisable(row: PromoCodeRow) {
  if (row.status === "DISABLED") {
    ElMessage.info(`推广码 ${row.promoCode} 已是停用状态`);
    return;
  }
  try {
    const res: any = await disablePromoCode(row.id);
    const data = payloadOf(res);
    ElMessage.success(
      data?.alreadyDisabled
        ? `推广码 ${row.promoCode} 此前已停用（幂等，无重复操作）`
        : `推广码 ${row.promoCode} 已停用`
    );
    await fetchPromoCodes();
  } catch {
    // 拦截器已给中文提示（未知 id ⇒ 404 等）
  }
}

function attributionTypeLabel(type: string): string {
  if (type === "AGENT") return "代理商邀请";
  if (type === "PROMO") return "渠道推广码";
  if (type === "REFERRAL") return "老带新";
  return type;
}

/** GET /platform/promo-codes/:code/attributions —— 该码归因只读列表 */
async function openAttributionDialog(row: PromoCodeRow) {
  attrCode.value = row.promoCode;
  attrVisible.value = true;
  attrLoading.value = true;
  attributions.value = [];
  try {
    const res: any = await listPromoCodeAttributions(row.promoCode);
    const data = payloadOf(res);
    attributions.value = Array.isArray(data?.items) ? data.items : [];
  } catch {
    attributions.value = [];
  } finally {
    attrLoading.value = false;
  }
}

onMounted(() => {
  fetchPromoCodes();
  fetchReferralLedger();
});
</script>

<style scoped>
/* 设计稿专用类（.v12-tag / .v11-note 等为版块注释标记，components.css 未收录，此处用 tokens 补充） */
.v12-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  white-space: nowrap;
}
.v12-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
.v11-note {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  font-size: var(--text-xs);
  color: var(--g5);
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  line-height: var(--leading-normal);
}
.dgr-text {
  color: var(--color-danger);
}
.req {
  color: var(--color-danger);
  font-style: normal;
}
.fld-grow {
  flex: 1;
  min-width: 0;
}
.panel-embed {
  box-shadow: none;
  border-radius: var(--radius-lg);
}
.rule-grid {
  display: grid;
  gap: var(--space-2);
}
.rule-label {
  font-size: var(--kpi-title-size);
  color: var(--g6);
  flex: none;
}
.dialog-body {
  display: grid;
  gap: var(--space-3);
}
</style>
