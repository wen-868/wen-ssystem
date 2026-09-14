<template>
  <!-- 根节点直接为内容片段（框架已在 .pf-main 内渲染，此处不再写 .pf-main） -->
  <div>
    <!-- ① 页头：标题 + 计费口径 ｜ 右侧操作（设计稿 sec-bill .pg-hd，行 780） -->
    <div class="pg-hd">
      <div>
        <div class="pt4">账单计费</div>
        <p class="pd">
          计费引擎口径：套餐费 + 增值费分列出账 · 日对账自动校验 · 差异告警至财务群
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="handleExportStatement">导出对账单</span>
        <span class="btn btn-p" @click="handleGenBill">手动生成账单</span>
      </div>
    </div>

    <!-- ② 三项指标卡（设计稿 .g3 > .kpi，行 781~785） -->
    <div class="g3">
      <div class="kpi">
        <div class="kt">本月总收入</div>
        <div class="kv">{{ kpi.revenue == null ? '--' : fmtMoney(kpi.revenue) }}</div>
        <div class="kd">较上月 <span class="up">--</span> · 套餐 / 增值 待接口拆分</div>
      </div>
      <div class="kpi">
        <div class="kt">待收金额</div>
        <div class="kv" style="color: var(--color-warning)">{{ kpi.pending == null ? '--' : fmtMoney(kpi.pending) }}</div>
        <div class="kd">待支付账单 -- 笔 · 含到期未付 -- 笔</div>
      </div>
      <div class="kpi">
        <div class="kt">欠费租户数</div>
        <div class="kv" style="color: var(--color-danger)">{{ kpi.arrears == null ? '--' : kpi.arrears }}</div>
        <div class="kd">宽限期 -- · 功能降级 -- · 已冻结 --</div>
      </div>
    </div>

    <!-- ③ 主面板：页签切换（设计稿 .panel > .tabs，行 786~789） -->
    <div class="panel mt12">
      <div class="tabs">
        <span class="tab" :class="{ on: activeTab === 'flow' }" @click="activeTab = 'flow'">账单流水</span>
        <span class="tab" :class="{ on: activeTab === 'arrears' }" @click="activeTab = 'arrears'">
          欠费管理 <span class="n">{{ arrearsCount }}</span>
        </span>
        <span class="tab" :class="{ on: activeTab === 'recon' }" @click="activeTab = 'recon'">对账中心</span>
        <span class="tab" :class="{ on: activeTab === 'addon' }" @click="activeTab = 'addon'">
          增值扣费 <span class="ver-tag">v1.5</span>
        </span>
      </div>

      <!-- ===== Tab 1：账单流水（行 790~805） ===== -->
      <div v-show="activeTab === 'flow'">
        <div class="tblwrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>账单编号</th>
                <th>租户</th>
                <th>账单类型</th>
                <th class="num">金额</th>
                <th>支付方式</th>
                <th>支付状态</th>
                <th>生成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in billList" :key="row.id">
                <td>{{ row.reconciliationNo || '--' }}</td>
                <td><b>{{ row.tenantName || '--' }}</b></td>
                <td>
                  <span v-if="row.billType" class="tag" :class="billTypeTag(row.billType)">{{ row.billType }}</span>
                  <span v-else>--</span>
                </td>
                <td class="num"><b>{{ row.orderAmount == null ? '--' : fmtMoney(row.orderAmount) }}</b></td>
                <td>{{ row.payMethod || '--' }}</td>
                <td>
                  <span class="tag" :class="payStatus(row).cls">{{ payStatus(row).text }}</span>
                </td>
                <td>{{ row.createdAt || '--' }}</td>
                <td>
                  <span class="btn-t" @click="openDetail(row)">详情</span>
                  <span class="btn-t" @click="handleInvoice(row)">开票</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="loadingBill" class="empty">加载中…</div>
        <div v-else-if="!billList.length" class="empty">暂无账单流水 · 待接入 GET /platform/reconciliation</div>

        <div class="pagebar">
          <span>共 {{ total }} 笔流水 · 增值扣费逐笔可查可导出</span>
          <div class="pgbtns">
            <span @click="gotoPage(page - 1)">‹</span>
            <span
              v-for="(p, i) in pageBtns"
              :key="i"
              :class="{ on: p === page }"
              @click="typeof p === 'number' && gotoPage(p)"
            >{{ p }}</span>
            <span @click="gotoPage(page + 1)">›</span>
          </div>
        </div>
      </div>

      <!-- ===== Tab 2：欠费管理（行 806~839） ===== -->
      <div v-show="activeTab === 'arrears'">
        <div class="p-hd">
          <span class="pt">欠费管理视图</span>
          <div>
            <span class="btn btn-d" @click="handleBatchUrge">批量催缴（勾选 {{ selectedArrears.length }} 户）</span>
            <span class="btn" @click="handleExportArrears">导出欠费清单</span>
          </div>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tipbar w">
            <span class="ic">!</span>
            <span>
              欠费处理时间线：<b>{{ arrearsTimeline }}</b>。降级采用整体只读模式，由配额引擎自动执行。
            </span>
          </div>

          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th>
                    <span class="ck" :class="{ on: selectedArrears.length === arrearsList.length && arrearsList.length }" @click="toggleAllArrears"></span>
                  </th>
                  <th>租户</th>
                  <th>欠费账单</th>
                  <th class="num">欠费金额</th>
                  <th class="num">欠费天数</th>
                  <th>处理阶段</th>
                  <th>下次动作</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in arrearsList" :key="row.id">
                  <td>
                    <span class="ck" :class="{ on: selectedArrears.includes(row.id) }" @click="toggleArrears(row.id)"></span>
                  </td>
                  <td>
                    <b>{{ row.tenantName || '--' }}</b>
                    <span v-if="row.tenantSub" class="sub">{{ row.tenantSub }}</span>
                  </td>
                  <td>{{ row.billNo || '--' }}</td>
                  <td class="num"><b style="color: var(--color-danger)">{{ row.amount == null ? '--' : fmtMoney(row.amount) }}</b></td>
                  <td class="num">{{ row.days == null ? '--' : row.days }}</td>
                  <td>
                    <span v-if="row.stage" class="tag" :class="arrearsStageTag(row.stage)">{{ row.stage }}</span>
                    <span v-else>--</span>
                    <span v-if="row.stageNote" class="small"> {{ row.stageNote }}</span>
                  </td>
                  <td>{{ row.nextAction || '--' }}</td>
                  <td>
                    <span v-if="row.stage !== '已冻结'" class="btn-t warn" @click="handleUrge(row)">立即催缴</span>
                    <span v-if="row.stage === '功能降级'" class="btn-t" @click="handleRetain(row)">续费挽留</span>
                    <span v-if="row.stage === '已冻结'" class="btn-t dgr" @click="handleCancel(row)">发起注销</span>
                    <span v-if="row.stage === '保留期'" class="btn-t gy" @click="handleRecover(row)">恢复缴费</span>
                    <span class="btn-t" @click="openDetail(row)">详情</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!arrearsList.length" class="empty">暂无欠费租户 · 待接入 GET /platform/billing/arrears</div>

          <p class="small mt8">
            批量催缴：站内 + 短信双通道，文案使用「欠费催缴」模板（变量：租户名/到期日/欠费额）；旗舰租户自动生成客服跟进任务。
          </p>

          <!-- 欠费处理策略（全局） -->
          <div class="panel mt10" style="box-shadow: none">
            <div class="p-hd">
              <span class="pt">欠费处理策略（全局） <span class="ver-tag">v1.5</span></span>
              <span class="ph-s">保存需超级管理员确认 · 变更前后快照留痕 · 仅对后续新账单生效</span>
            </div>
            <div class="p-bd">
              <!-- 未配置：置灰阻断并提示（护栏④：系统不内置任何预设值） -->
              <div v-if="!arrearsConfigured" class="tipbar">
                <span class="ic">i</span>
                <span>
                  欠费处理策略<b>尚未配置</b>：宽限截止、降级截止、冻结截止、保留截止、提醒节点、推送通道与四个自动动作均未落库，
                  <b>系统不内置任何预设值</b>。点击「配置」填写并保存后生效（仅对后续新账单生效）。
                </span>
              </div>

              <div class="g4">
                <span class="fld">
                  <span>宽限截止（天）<span class="small">D+1 ~ N 全功能可用</span></span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <input v-else class="ipt" type="number" min="0" v-model.number="arrearsPolicy.graceEndDays" placeholder="如 15" />
                </span>
                <span class="fld">
                  <span>降级截止（天）<span class="small">只读段结束日</span></span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <input v-else class="ipt" type="number" min="0" v-model.number="arrearsPolicy.degradeEndDays" placeholder="如 30" />
                </span>
                <span class="fld">
                  <span>冻结截止（天）<span class="small">仅可导出段结束日</span></span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <input v-else class="ipt" type="number" min="0" v-model.number="arrearsPolicy.freezeEndDays" placeholder="如 60" />
                </span>
                <span class="fld">
                  <span>保留截止（天）<span class="small">D+N 后转人工注销</span></span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <input v-else class="ipt" type="number" min="0" v-model.number="arrearsPolicy.retainEndDays" placeholder="如 90" />
                </span>
                <span class="fld">
                  <span>到期前提醒节点（天）</span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <input v-else class="ipt" :value="arrearsPolicy.remindNodes?.join(' / ') || ''" @input="onRemindNodesInput" placeholder="如 7 / 3 / 1" />
                </span>
                <span class="fld">
                  <span>催缴推送通道</span>
                  <span v-if="!arrearsConfigured" class="ipt">未配置</span>
                  <span v-else class="ipt">
                    <span
                      v-for="c in CHANNEL_OPTIONS"
                      :key="c.code"
                      class="btn"
                      :class="{ 'btn-p': arrearsPolicy.channels?.includes(c.code) }"
                      style="margin-right: var(--space-1)"
                      @click="toggleChannel(c.code)"
                    >{{ c.label }}</span>
                  </span>
                </span>
              </div>

              <div class="mt10" style="border-top: 1px dashed var(--g2); padding-top: var(--space-2)">
                <div
                  v-for="s in arrearsSwitches"
                  :key="s.key"
                  style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--g1)"
                >
                  <span class="tg" :class="{ off: !arrearsPolicy[s.key] }" @click="toggleArrearsSwitch(s.key)"></span>
                  <div style="flex: 1">
                    <div class="b">{{ s.title }}</div>
                    <div class="small">{{ s.desc }}</div>
                  </div>
                  <span class="tag" :class="arrearsPolicy[s.key] === undefined ? 'tag-gy' : arrearsPolicy[s.key] ? 'tag-g' : 'tag-gy'">
                    {{ arrearsPolicy[s.key] === undefined ? '未配置' : arrearsPolicy[s.key] ? '生效中' : '已关闭' }}
                  </span>
                </div>
              </div>

              <div class="mt10" style="display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap">
                <span v-if="!arrearsConfigured" class="btn btn-p" @click="markArrearsTouched">配置</span>
                <template v-else>
                  <span class="btn btn-p" @click="saveArrearsPolicy">{{ arrearsSaving ? '保存中…' : '保存策略' }}</span>
                  <span class="btn" @click="loadArrearsPolicy">重新读取</span>
                </template>
                <span class="small" style="color: var(--g5)">保存需超级管理员确认 · 变更前后快照留痕 · 仅对后续新账单生效</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Tab 3：对账中心（行 841~856） ===== -->
      <div v-show="activeTab === 'recon'">
        <div class="p-hd">
          <span class="pt">对账中心 · 平台应收 vs 实收</span>
          <span class="ph-s">日对账自动校验 · 差异 &lt;0.1% 判定平账</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>对账日期</th>
                  <th class="num">平台应收</th>
                  <th class="num">支付渠道实收</th>
                  <th class="num">差异</th>
                  <th>差异来源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in reconList" :key="row.id">
                  <td>{{ row.date || '--' }}</td>
                  <td class="num">{{ row.receivable == null ? '--' : fmtMoney(row.receivable) }}</td>
                  <td class="num">{{ row.actual == null ? '--' : fmtMoney(row.actual) }}</td>
                  <td class="num" :style="{ color: row.diff && row.diff < 0 ? 'var(--color-warning)' : 'inherit' }">
                    {{ row.diff == null ? '--' : fmtMoney(row.diff) }}
                  </td>
                  <td>{{ row.source || '--' }}</td>
                  <td><span class="tag" :class="reconStatusTag(row.status)">{{ row.statusText || '--' }}</span></td>
                  <td>
                    <template v-if="hasDiff(row)">
                      <span class="btn-t" @click="handleReconDiff(row)">差异明细</span>
                      <span class="btn-t" @click="handleReReconcile(row)">重新对账</span>
                    </template>
                    <template v-else>
                      <span class="btn-t" @click="handleReconStatement(row)">对账单</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!reconList.length" class="empty">暂无对账记录 · 待接入 GET /platform/billing/reconciliation-daily</div>
        </div>
      </div>

      <!-- ===== Tab 4：增值扣费（行 857~876） ===== -->
      <div v-show="activeTab === 'addon'">
        <div class="p-hd">
          <span class="pt">增值服务扣费流水 <span class="ver-tag">v1.5</span></span>
          <span class="ph-s">存储超额 / API 超额 / 短信包逐笔可查 · ZZ 流水与账单流水 ZD 单号一一对应</span>
        </div>
        <div class="p-bd" style="padding-top: var(--space-2)">
          <div class="tipbar">
            <span class="ic">i</span>
            <span>
              <b>增值计费口径：</b>存储超额
              <b v-if="addonPrice.storagePerGbMonth !== null">¥{{ addonPrice.storagePerGbMonth }} / GB / 月</b>
              <b v-else style="color: var(--warning-text)">未配置</b>
              （超出套餐配额部分按日出账）· API 超额
              <b v-if="addonPrice.apiPer10k !== null">¥{{ addonPrice.apiPer10k }} / 万次</b>
              <b v-else style="color: var(--warning-text)">未配置</b>
              · 短信超量
              <b v-if="addonPrice.smsPerItem !== null">¥{{ addonPrice.smsPerItem }} / 条</b>
              <b v-else style="color: var(--warning-text)">未配置</b>
              · AI 超额见「AI 中心 · 计量流水」（按模型单价）。每日 00:05 日切汇总出账，扣费顺序：账户余额 → 欠费挂账；<b>本月增值扣费合计</b>对应运营大盘「收入构成 · 增值扣费」。
              <span v-if="!addonConfigured" style="color: var(--warning-text)">单价未配置前不做增值出账。</span>
            </span>
          </div>

          <!-- 增值服务单价配置：原单价写死在上方口径文案中（¥10/GB/月 · ¥50/万次 · ¥0.10/条），
               属写死业务值 → 改为后台可配置；未配置一律空值 + 提示，系统不内置预设单价。 -->
          <div class="panel mt10" style="box-shadow: none">
            <div class="p-hd">
              <span class="pt">增值服务单价配置 <span class="ver-tag">v1.5</span></span>
              <span class="ph-s">未配置时不出账 · 系统不内置任何预设单价</span>
            </div>
            <div class="p-bd">
              <div class="g4">
                <span class="fld">
                  <span>存储超额（元 / GB / 月）</span>
                  <input class="ipt" type="number" min="0" step="0.01" v-model.number="addonPrice.storagePerGbMonth" placeholder="未配置" />
                </span>
                <span class="fld">
                  <span>API 超额（元 / 万次）</span>
                  <input class="ipt" type="number" min="0" step="0.01" v-model.number="addonPrice.apiPer10k" placeholder="未配置" />
                </span>
                <span class="fld">
                  <span>短信超量（元 / 条）</span>
                  <input class="ipt" type="number" min="0" step="0.001" v-model.number="addonPrice.smsPerItem" placeholder="未配置" />
                </span>
              </div>
              <div class="mt10" style="display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap">
                <span class="btn btn-p" @click="saveAddonPrice">{{ addonSaving ? '保存中…' : '保存单价' }}</span>
                <span class="btn" @click="loadAddonPrice">重新读取</span>
                <span class="small" style="color: var(--g5)">留痕：updated_by / updated_at 由后端写入；全部留空并保存 = 回到未配置</span>
              </div>
            </div>
          </div>

          <div class="tblwrap mt10">
            <table class="tbl">
              <thead>
                <tr>
                  <th>流水号</th>
                  <th>租户</th>
                  <th>增值项目</th>
                  <th>计费单价</th>
                  <th class="num">本期用量</th>
                  <th class="num">扣费金额</th>
                  <th>扣费方式</th>
                  <th>关联账单</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in addonList" :key="row.id">
                  <td>{{ row.serialNo || '--' }}</td>
                  <td><b>{{ row.tenantName || '--' }}</b></td>
                  <td>
                    <span v-if="row.item" class="tag" :class="addonItemTag(row.item)">{{ row.item }}</span>
                    <span v-else>--</span>
                  </td>
                  <td>{{ row.unitPrice || '--' }}</td>
                  <td class="num">{{ row.usage == null ? '--' : row.usage }}</td>
                  <td class="num"><b>{{ row.amount == null ? '--' : fmtMoney(row.amount) }}</b></td>
                  <td>{{ row.method || '--' }}</td>
                  <td><span v-if="row.relBill" class="btn-t" @click="openDetail({ id: row.relBillId, billNo: row.relBill })">{{ row.relBill }}</span><span v-else>--</span></td>
                  <td>{{ row.time || '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!addonList.length" class="empty">暂无增值扣费流水 · 待接入 GET /platform/billing/addon-charges</div>

          <p class="small mt8">
            对账关系：合并出账时 ZZ 流水金额之和 = 关联 ZD 账单金额；存储超额用量取自「运维 · 存储监控」日切快照，API 超额触发记录见「运维 · 各租户 API 调用量统计」。
          </p>
        </div>
      </div>
    </div>

    <!-- 账单详情弹窗（内容包一层 .zx-scope，行 794 详情/开票） -->
    <el-dialog v-model="detailVisible" title="账单详情" :width="MODAL_W" :close-on-click-modal="false">
      <div v-if="currentDetail" class="zx-scope">
        <div class="g2">
          <span class="fld"><span>账单编号</span><span class="ipt">{{ currentDetail.reconciliationNo || '--' }}</span></span>
          <span class="fld"><span>租户</span><span class="ipt">{{ currentDetail.tenantName || '--' }}</span></span>
          <span class="fld"><span>账单类型</span><span class="ipt">{{ currentDetail.billType || '--' }}</span></span>
          <span class="fld"><span>金额</span><span class="ipt">{{ currentDetail.orderAmount == null ? '--' : fmtMoney(currentDetail.orderAmount) }}</span></span>
          <span class="fld"><span>支付方式</span><span class="ipt">{{ currentDetail.payMethod || '--' }}</span></span>
          <span class="fld"><span>支付状态</span><span class="ipt">{{ payStatus(currentDetail).text }}</span></span>
          <span class="fld"><span>生成时间</span><span class="ipt">{{ currentDetail.createdAt || '--' }}</span></span>
          <span class="fld"><span>结算周期</span><span class="ipt">{{ currentDetail.period || '--' }}</span></span>
        </div>
      </div>
      <div v-else class="zx-scope">
        <div class="empty">暂无账单详情 · 待接入 GET /platform/reconciliation/:id</div>
      </div>
      <template #footer>
        <span class="btn" @click="detailVisible = false">关闭</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
// 沿用现有结算/对账接口（约束：必须保留现有调用）
import {
  getPlatformReconciliations,
  getPlatformReconciliationDetail,
  getReconciliationStats,
  settleReconciliation,
  getArrearsPolicy,
  updateArrearsPolicy,
  getAddonPrice,
  updateAddonPrice,
} from '../api'

const MODAL_W = 'var(--modal-width)'

// ====== Tab 状态 ======
type TabKey = 'flow' | 'arrears' | 'recon' | 'addon'
const activeTab = ref<TabKey>('flow')

// ====== KPI（沿用 getReconciliationStats） ======
const kpi = reactive({
  revenue: null as number | null,
  pending: null as number | null,
  arrears: null as number | null,
})

// ====== Tab1 账单流水（沿用 getPlatformReconciliations） ======
const loadingBill = ref(false)
const billList = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pageBtns = computed<(number | string)[]>(() => {
  const tp = totalPages.value
  const cur = page.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const arr: (number | string)[] = [1]
  if (cur > 3) arr.push('...')
  const s = Math.max(2, cur - 1)
  const e = Math.min(tp - 1, cur + 1)
  for (let i = s; i <= e; i++) arr.push(i)
  if (cur < tp - 2) arr.push('...')
  arr.push(tp)
  return arr
})
function gotoPage(p: number) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchBillList()
}

// ====== Tab2 欠费管理（无接口：空态 + TODO） ======
const arrearsList = ref<any[]>([])
const selectedArrears = ref<number[]>([])
const arrearsCount = ref(0)

/* ── 欠费处理策略（全局配置）
 * 设计稿 v1.6 第 809 行：欠费处理按「4 段边界」建模 —— 宽限截止 / 降级截止 / 冻结截止 / 保留截止（D+N 递增）。
 * 后端已删除旧间隔字段 graceDays / freezeAfterDays / retainDays（推不出设计稿的 D+31 / D+61），
 * 改用 4 个边界字段：graceEndDays / degradeEndDays / freezeEndDays / retainEndDays。
 * 未配置一律 null / undefined + 置灰阻断，系统不内置任何预设值（护栏④）。
 * undefined = 未配置 ≠ false = 已配置为关闭。 */
const arrearsPolicy = reactive({
  graceEndDays: null as number | null,
  degradeEndDays: null as number | null,
  freezeEndDays: null as number | null,
  retainEndDays: null as number | null,
  remindNodes: null as number[] | null,
  channels: null as string[] | null,
  autoDowngrade: undefined as boolean | undefined,
  autoFreeze: undefined as boolean | undefined,
  autoRemind: undefined as boolean | undefined,
  autoCancel: undefined as boolean | undefined,
})
/** 是否已在库中配置（false = 未配置，整块置灰并提示，保存不回写） */
const arrearsConfigured = ref(false)
const arrearsSaving = ref(false)
/** 点击开关即视为「配置意图」，此后方可上送（沿用 Settings.vue 范式） */
function markArrearsTouched() {
  arrearsConfigured.value = true
}

/** 催缴推送通道（白名单，与后端 billing.schema.ts 的 REMIND_CHANNELS 一致） */
const CHANNEL_OPTIONS = [
  { code: 'IN_APP', label: '站内' },
  { code: 'SMS', label: '短信' },
  { code: 'EMAIL', label: '邮件' },
  { code: 'WECHAT', label: '微信' },
] as const

function toggleChannel(code: string) {
  markArrearsTouched()
  const cur = arrearsPolicy.channels || []
  arrearsPolicy.channels = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
}

function channelLabel(codes: string[] | null): string {
  if (!codes?.length) return ''
  return codes.map((c) => CHANNEL_OPTIONS.find((o) => o.code === c)?.label || c).join(' + ')
}

/** 提醒节点以「天」为单位，界面用逗号/斜杠分隔输入，保存前解析为数字数组 */
function onRemindNodesInput(e: Event) {
  markArrearsTouched()
  const raw = (e.target as HTMLInputElement).value
  const nums = raw
    .split(/[^0-9]+/)
    .filter((s) => s !== '')
    .map((s) => Number(s))
  arrearsPolicy.remindNodes = nums.length ? nums : null
}

/** 四个自动动作：标题与说明均由已配置边界推导，不写死任何天数（原「降级 30 天后」等硬编码一律删除） */
const arrearsSwitches = computed(() => [
  {
    key: 'autoDowngrade' as const,
    title: '宽限期结束自动降级只读',
    desc:
      arrearsPolicy.graceEndDays === null
        ? '需先配置「宽限截止」，配置后在此显示生效日（D+宽限截止+1）'
        : `D+${arrearsPolicy.graceEndDays + 1} 起整体只读：可查看可导出，由配额引擎自动执行`,
  },
  {
    key: 'autoFreeze' as const,
    title: '降级后自动冻结',
    desc:
      arrearsPolicy.degradeEndDays === null
        ? '需先配置「降级截止」，配置后在此显示生效日'
        : `D+${arrearsPolicy.degradeEndDays + 1} 冻结：仅可导出数据，暂停计费与登录`,
  },
  {
    key: 'autoRemind' as const,
    title: '欠费提醒自动推送',
    desc:
      arrearsPolicy.remindNodes?.length
        ? `进入宽限期即时推送 + 提前 ${arrearsPolicy.remindNodes.join(' / ')} 天提醒，通道：${channelLabel(arrearsPolicy.channels) || '未配置'}`
        : '需先配置「提醒节点」与「推送通道」',
  },
  {
    key: 'autoCancel' as const,
    title: '保留期结束自动注销',
    desc:
      arrearsPolicy.retainEndDays === null
        ? '需先配置「保留截止」；未配置时不会自动注销，转人工需客服确认后执行「确认清除」'
        : `D+${arrearsPolicy.retainEndDays} 后转人工，需客服确认后执行「确认清除」`,
  },
])

/**
 * 页顶「欠费处理时间线」：设计稿 v1.6 第 809 行按 4 段边界建模 ——
 *   宽限期（D+1~graceEndDays）→ 功能降级·只读（D+graceEndDays+1~degradeEndDays）
 *   → 冻结·仅可导出（D+degradeEndDays+1~freezeEndDays）→ 保留期（D+freezeEndDays+1~retainEndDays）→ 注销清除。
 * 4 个边界任一为 null 时输出未配置提示，不回落任何默认天数、不出现任何写死数字。
 */
const arrearsTimeline = computed(() => {
  const g = arrearsPolicy.graceEndDays
  const d = arrearsPolicy.degradeEndDays
  const f = arrearsPolicy.freezeEndDays
  const r = arrearsPolicy.retainEndDays
  if (g === null || d === null || f === null || r === null) {
    return '欠费处理时间线待配置：请先在「欠费处理策略」中配置宽限截止、降级截止、冻结截止与保留截止四个边界天数，配置后此处按配置值生成。'
  }
  const segs: string[] = [
    `宽限期 ${g} 天（全功能）`,
    `功能降级·只读（D+${g + 1}~${d}）`,
    `冻结·仅可导出（D+${d + 1}~${f}）`,
    `保留期（D+${f + 1}~${r}）`,
    '注销清除',
  ]
  return segs.join(' → ')
})

function toggleArrearsSwitch(key: 'autoDowngrade' | 'autoFreeze' | 'autoRemind' | 'autoCancel') {
  markArrearsTouched()
  arrearsPolicy[key] = !arrearsPolicy[key]
}

async function loadArrearsPolicy() {
  try {
    const res: any = await getArrearsPolicy()
    const d = res?.data?.data || res?.data || {}
    const unconf: string[] = Array.isArray(d._unconfigured) ? d._unconfigured : []
    arrearsConfigured.value = !!d._configured
    if (!d._configured) return
    arrearsPolicy.graceEndDays = d.graceEndDays ?? null
    arrearsPolicy.degradeEndDays = d.degradeEndDays ?? null
    arrearsPolicy.freezeEndDays = d.freezeEndDays ?? null
    arrearsPolicy.retainEndDays = d.retainEndDays ?? null
    arrearsPolicy.remindNodes = Array.isArray(d.remindNodes) ? d.remindNodes : null
    arrearsPolicy.channels = Array.isArray(d.channels) ? d.channels : null
    arrearsPolicy.autoDowngrade = d.autoDowngrade
    arrearsPolicy.autoFreeze = d.autoFreeze
    arrearsPolicy.autoRemind = d.autoRemind
    arrearsPolicy.autoCancel = d.autoCancel
    void unconf
  } catch {
    // 读取失败保持未配置态（空态），绝不回落为任何默认业务值
  }
}

async function saveArrearsPolicy() {
  if (!arrearsConfigured.value) return
  arrearsSaving.value = true
  try {
    const payload: Record<string, unknown> = { version: 1 }
    if (arrearsPolicy.graceEndDays !== null) payload.graceEndDays = Number(arrearsPolicy.graceEndDays)
    if (arrearsPolicy.degradeEndDays !== null) payload.degradeEndDays = Number(arrearsPolicy.degradeEndDays)
    if (arrearsPolicy.freezeEndDays !== null) payload.freezeEndDays = Number(arrearsPolicy.freezeEndDays)
    if (arrearsPolicy.retainEndDays !== null) payload.retainEndDays = Number(arrearsPolicy.retainEndDays)
    if (arrearsPolicy.remindNodes?.length) payload.remindNodes = arrearsPolicy.remindNodes
    if (arrearsPolicy.channels?.length) payload.channels = arrearsPolicy.channels
    if (arrearsPolicy.autoDowngrade !== undefined) payload.autoDowngrade = arrearsPolicy.autoDowngrade
    if (arrearsPolicy.autoFreeze !== undefined) payload.autoFreeze = arrearsPolicy.autoFreeze
    if (arrearsPolicy.autoRemind !== undefined) payload.autoRemind = arrearsPolicy.autoRemind
    if (arrearsPolicy.autoCancel !== undefined) payload.autoCancel = arrearsPolicy.autoCancel
    await updateArrearsPolicy(payload)
    ElMessage.success('欠费处理策略已保存')
    await loadArrearsPolicy()
  } finally {
    arrearsSaving.value = false
  }
}

/* ── 增值服务单价（原为写死文案 ¥10/GB/月 · ¥50/万次 · ¥0.10/条，同属写死业务值） ── */
const addonPrice = reactive({
  storagePerGbMonth: null as number | null,
  apiPer10k: null as number | null,
  smsPerItem: null as number | null,
})
const addonConfigured = ref(false)
const addonSaving = ref(false)

async function loadAddonPrice() {
  try {
    const res: any = await getAddonPrice()
    const d = res?.data?.data || res?.data || {}
    addonConfigured.value = !!d._configured
    if (!d._configured) return
    addonPrice.storagePerGbMonth = d.storagePerGbMonth ?? null
    addonPrice.apiPer10k = d.apiPer10k ?? null
    addonPrice.smsPerItem = d.smsPerItem ?? null
  } catch {
    // 保持未配置态
  }
}

async function saveAddonPrice() {
  addonSaving.value = true
  try {
    const payload: Record<string, unknown> = { version: 1 }
    if (addonPrice.storagePerGbMonth !== null) payload.storagePerGbMonth = Number(addonPrice.storagePerGbMonth)
    if (addonPrice.apiPer10k !== null) payload.apiPer10k = Number(addonPrice.apiPer10k)
    if (addonPrice.smsPerItem !== null) payload.smsPerItem = Number(addonPrice.smsPerItem)
    await updateAddonPrice(payload)
    ElMessage.success('增值服务单价已保存')
    await loadAddonPrice()
  } finally {
    addonSaving.value = false
  }
}
function toggleArrears(id: number) {
  const i = selectedArrears.value.indexOf(id)
  if (i >= 0) selectedArrears.value.splice(i, 1)
  else selectedArrears.value.push(id)
}
function toggleAllArrears() {
  if (selectedArrears.value.length === arrearsList.value.length) selectedArrears.value = []
  else selectedArrears.value = arrearsList.value.map((r) => r.id)
}

// ====== Tab3 对账中心（无接口：空态 + TODO） ======
const reconList = ref<any[]>([])

// ====== Tab4 增值扣费（无接口：空态 + TODO） ======
const addonList = ref<any[]>([])

// ====== 详情弹窗 ======
const detailVisible = ref(false)
const currentDetail = ref<any>(null)

// ====== 工具 ======
function fmtMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '--'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return '¥' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function billTypeTag(t: string): string {
  if (/AI|超额/.test(t)) return 'tag-p'
  if (/存储|扩容|加购/.test(t)) return 'tag-o'
  return 'tag-b'
}
function payStatus(row: any): { text: string; cls: string } {
  const st = row.payStatus || row.status || ''
  const map: Record<string, { text: string; cls: string }> = {
    PAID: { text: '已支付', cls: 'tag-g' },
    UNPAID: { text: '待支付', cls: 'tag-o' },
    GRACE: { text: '宽限期', cls: 'tag-o' },
    FROZEN: { text: '已冻结·暂停计费', cls: 'tag-r' },
  }
  return map[st] || { text: st || '已支付', cls: 'tag-gy' }
}
function arrearsStageTag(stage: string): string {
  if (/冻结/.test(stage)) return 'tag-r'
  if (/降级/.test(stage)) return 'tag-r'
  if (/保留/.test(stage)) return 'tag-gy'
  return 'tag-o'
}
function addonItemTag(item: string): string {
  if (/AI|API/.test(item)) return 'tag-p'
  return 'tag-o'
}
function reconStatusTag(status: string): string {
  if (status === 'DONE' || status === 'SETTLED') return 'tag-g'
  return 'tag-o'
}

// ====== 数据加载（保留现有调用 + loading/空态/错误处理） ======
async function fetchStats() {
  try {
    const res: any = await getReconciliationStats()
    const d = res?.data?.data || res?.data || res || {}
    kpi.revenue = d.monthlyRevenue ?? null
    kpi.pending = d.pendingAmount ?? null
    kpi.arrears = d.arrearsTenants ?? null
    arrearsCount.value = d.arrearsTenants ?? 0
  } catch {
    /* 接口不可用时保持空态，不填充示例数据 */
  }
}

async function fetchBillList() {
  loadingBill.value = true
  try {
    const res: any = await getPlatformReconciliations({
      page: page.value,
      pageSize: pageSize.value,
    })
    const d = res?.data?.data || res?.data || res || {}
    billList.value = d.records || []
    total.value = d.total || 0
  } catch {
    billList.value = []
    total.value = 0
  } finally {
    loadingBill.value = false
  }
}

async function openDetail(row: any) {
  currentDetail.value = null
  detailVisible.value = true
  try {
    const res: any = await getPlatformReconciliationDetail(row.id)
    currentDetail.value = res?.data?.data || res?.data || res || row
  } catch {
    currentDetail.value = row
  }
}

// ====== 操作（无接口写 TODO） ======
function handleExportStatement() {
  // TODO: 待接入 POST /platform/billing/statement/export（导出对账单）
  ElMessage.info('导出对账单：待接入 POST /platform/billing/statement/export')
}
function handleGenBill() {
  // TODO: 待接入 POST /platform/billing/generate（手动生成账单）
  ElMessage.info('手动生成账单：待接入 POST /platform/billing/generate')
}
function handleInvoice(_row: any) {
  // TODO: 待接入 POST /platform/billing/invoice（开票）
  ElMessage.info('开票：待接入 POST /platform/billing/invoice')
}
function handleBatchUrge() {
  if (!selectedArrears.value.length) {
    ElMessage.warning('请先勾选欠费租户')
    return
  }
  // TODO: 待接入 POST /platform/billing/arrears/urge（批量催缴，站内+短信双通道）
  ElMessage.info('批量催缴：待接入 POST /platform/billing/arrears/urge')
}
function handleExportArrears() {
  // TODO: 待接入 POST /platform/billing/arrears/export（导出欠费清单）
  ElMessage.info('导出欠费清单：待接入 POST /platform/billing/arrears/export')
}
function handleUrge(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/urge（立即催缴）
  ElMessage.info('立即催缴：待接入 POST /platform/billing/arrears/:id/urge')
}
function handleRetain(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/retain（续费挽留）
  ElMessage.info('续费挽留：待接入 POST /platform/billing/arrears/:id/retain')
}
function handleCancel(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/cancel（发起注销）
  ElMessage.warning('发起注销：待接入 POST /platform/billing/arrears/:id/cancel')
}
function handleRecover(_row: any) {
  // TODO: 待接入 POST /platform/billing/arrears/:id/recover（恢复缴费）
  ElMessage.info('恢复缴费：待接入 POST /platform/billing/arrears/:id/recover')
}
function handleReconStatement(_row: any) {
  // TODO: 待接入 GET /platform/billing/reconciliation-daily/:date/statement（对账单）
  ElMessage.info('对账单：待接入 GET /platform/billing/reconciliation-daily/:date/statement')
}
/** 有差异（diff ≠ 0）或状态待核查的行 → 差异明细 + 重新对账（设计稿 v1.6 第 849 行） */
function hasDiff(row: any) {
  if (row?.status === 'PENDING') return true
  return row?.diff != null && Number(row.diff) !== 0
}
function handleReconDiff(row: any) {
  // TODO: 待接入 GET /platform/billing/reconciliation-daily/:date/diff
  ElMessage.info(`差异明细：待接入 GET /platform/billing/reconciliation-daily/${row?.date || ''}/diff`)
}
// 重新对账：沿用现有结算接口（待接入专用 /platform/billing/reconcile）
async function handleReReconcile(row: any) {
  try {
    await settleReconciliation(row.id)
    ElMessage.success('已提交重新对账（沿用结算接口，待接入专用 reconcile 端点）')
  } catch { /* 错误提示由请求层统一处理，此处只做内容态 */ }
}

onMounted(() => {
  fetchStats()
  fetchBillList()
  // R101-S2-02 组2：账单类配置读取（未配置时保持空态，不回落任何默认业务值）
  loadArrearsPolicy()
  loadAddonPrice()
})
</script>
