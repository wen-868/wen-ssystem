<template>
  <!-- 06 营销 · 渠道推广（内容片段，由框架 PlatformLayout 的 .pf-main 提供样式作用域） -->
  <div>
    <!-- ① 页头：渠道归属口径说明 + 右侧操作 -->
    <div class="pg-hd">
      <div>
        <div class="pt4">渠道推广</div>
        <p class="pd">渠道归属：渠道码与邀请码同时出现按「后触点优先」归因 · 注册后 24h 内可申诉改绑 · 反刷风控自动拦截关联单</p>
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
          <!-- TODO: 来源渠道筛选接入 GET /platform/marketing/promo-codes 的 channel 参数 -->
          <span class="sel">来源渠道：全部</span>
          <input class="ipt" v-model="searchKeyword" placeholder="搜索码值 / 渠道名" />
        </div>
      </div>
      <div class="tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>码值</th>
              <th>来源渠道</th>
              <th>创建人</th>
              <th class="num">注册数</th>
              <th class="num">注册转化数</th>
              <th class="num">付费转化</th>
              <th>有效期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="promoCodes.length === 0">
              <td colspan="9"><div class="empty">暂无推广码数据</div></td>
            </tr>
          </tbody>
        </table>
      </div>
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
              <td colspan="8"><div class="empty">暂无老带新台账数据</div></td>
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
          <div class="empty">暂无渠道效果数据（渠道推广码 / 老带新台账数据模型待立项 T11）</div>
          <p class="small mt8" style="color:var(--g5)">
            报表口径（注册→付费转化漏斗 / 渠道佣金月结 / 有效期分布）需产品确认，见
            <b>R101-C6-2 立项清单 T11</b>；本 Tab 不展示任何本地推算或示例数值。
          </p>
        </div>
      </div>
    </template>

    <!-- ⑥ 「生成推广码」弹窗（Element Plus 弹窗，内部用设计稿组件类，包一层 .zx-scope 启用样式） -->
    <el-dialog v-model="dialogVisible" title="生成推广码" width="var(--modal-width-sm)" :close-on-click-modal="false">
      <div class="zx-scope dialog-body">
        <div class="fld">
          <span>渠道名称 <i class="req">*</i></span>
          <input class="ipt" v-model="form.channelName" placeholder="请输入渠道名称" />
        </div>

        <div class="frow">
          <div class="fld fld-grow">
            <span>有效期</span>
            <!-- TODO: 有效期接入日期选择 / 接口返回的可选档位 -->
            <span class="sel">选择有效期</span>
          </div>
          <div class="fld fld-grow">
            <span>渠道负责人</span>
            <!-- TODO: 渠道负责人接入运营人员列表 GET /platform/admin-users -->
            <span class="sel">选择负责人</span>
          </div>
        </div>

        <div class="fld">
          <span>绑定奖励规则（新租户经此码注册并付费后）</span>
          <div class="panel panel-embed">
            <div class="p-bd rule-grid">
              <div class="frow">
                <span class="rule-label">首单奖励积分</span>
                <input class="ipt" v-model="form.firstOrderPoints" placeholder="积分" />
                <span class="small">发放给新租户</span>
              </div>
              <div class="frow">
                <span class="rule-label">渠道佣金比例</span>
                <input class="ipt" v-model="form.commissionRate" placeholder="比例" />
                <span class="small">计入渠道月结</span>
              </div>
            </div>
          </div>
        </div>

        <div class="tipbar">
          <span class="ic">i</span>
          <span>生成后可下载二维码与推广海报；注册自动归因渠道来源，归属关系落库后不可更改（24h 内可申诉改绑）。</span>
        </div>
      </div>

      <template #footer>
        <div class="zx-scope">
          <span class="btn" @click="dialogVisible = false">取消</span>
          <span class="btn btn-p" @click="handleGenerate">生成推广码</span>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";

const loading = ref(false);
const promoCodes = ref<any[]>([]);
const referralLedger = ref<any[]>([]);

const searchKeyword = ref("");
/** R7：本页子 Tab（promo = 推广码与台账 / report = 渠道效果报表，并入本页，不新增独立路由） */
const activeTab = ref<"promo" | "report">("promo");

const dialogVisible = ref(false);
const saving = ref(false);
const form = reactive({
  channelName: "",
  expireAt: "",
  owner: "",
  firstOrderPoints: "",
  commissionRate: ""
});

// TODO: 待接入 GET /platform/marketing/promo-codes（来源渠道 channel、关键字 keyword、分页）
async function fetchPromoCodes() {
  loading.value = true;
  try {
    promoCodes.value = [];
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "推广码加载失败");
  } finally {
    loading.value = false;
  }
}

// TODO: 待接入 GET /platform/marketing/referral-ledger（分页）
async function fetchReferralLedger() {
  try {
    referralLedger.value = [];
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "老带新台账加载失败");
  }
}

function openReport() {
  // ③-b #68 + 裁定 R7：不再指向独立报表页 `/platform/marketing/channel-report`，
  // 改为切到本页「渠道效果」子 Tab（数据源待立项 T11，子 Tab 内为诚实空态）
  activeTab.value = "report";
}

function openCreateDialog() {
  Object.assign(form, {
    channelName: "",
    expireAt: "",
    owner: "",
    firstOrderPoints: "",
    commissionRate: ""
  });
  dialogVisible.value = true;
}

// TODO: 待接入 POST /platform/marketing/promo-codes（生成推广码）
async function handleGenerate() {
  if (!form.channelName) {
    ElMessage.warning("请填写渠道名称");
    return;
  }
  saving.value = true;
  try {
    // 禁"假成功"（同 ③-a #46 口径）：POST /platform/marketing/promo-codes 属 T11 立项项（无表）⇒ 失败可见
    ElMessage.warning("推广码生成接口尚未接入，未生成（待立项 T11：t_promo_code 建表后接入）");
    dialogVisible.value = false;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "生成失败");
  } finally {
    saving.value = false;
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
