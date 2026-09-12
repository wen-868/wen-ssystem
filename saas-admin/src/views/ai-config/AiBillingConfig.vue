<template>
  <!-- ═══════════════════════════════════════════════════════════════
       05 AI 中心 · 计费管理（设计稿 v1.6 #sec-ai · 行 965~1090，Tab ②③④）
       根节点直接是内容片段，外层由 PlatformLayout 的 <main class="pf-main"> 包裹。
       计费策略（套餐加成倍率）复用现有套餐 API（api.getPlans）；额度包 / 积分抵扣暂无接口 → 空态 + TODO。
       ═══════════════════════════════════════════════════════════════ -->
  <div class="ai-billing">
    <!-- ════════ 页头 ════════ -->
    <div class="pg-hd">
      <div>
        <div class="pt4">计费管理</div>
        <p class="pd">
          AI 超额费用 = 模型成本单价 × 套餐倍率；积分可冲抵平台公共模型费用（v1.2）；价格调整需密码二次确认并留档快照
        </p>
      </div>
      <div class="pg-act">
        <span class="btn" @click="todo('计费策略快照')">配置快照</span>
      </div>
    </div>

    <!-- ════════ 子页签 ════════ -->
    <div class="tabs">
      <span class="tab" :class="{ on: billingTab === 'strategy' }" @click="billingTab = 'strategy'">② 计费策略</span>
      <span class="tab" :class="{ on: billingTab === 'pack' }" @click="billingTab = 'pack'">③ 额度包商品</span>
      <span class="tab" :class="{ on: billingTab === 'points' }" @click="billingTab = 'points'">
        ④ 积分抵扣 <span class="ver-tag">v1.2</span>
      </span>
    </div>

    <!-- ════════ Tab 计费策略（行 965~989） ════════ -->
    <div v-show="billingTab === 'strategy'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 2</span>计费策略 · 按套餐加成倍率</span>
          <span class="ph-s">AI 超额费用 = 模型成本单价 × 套餐倍率；价格调整需密码二次确认并留档快照</span>
        </div>
        <div class="p-bd" style="padding-top:10px">
          <div class="g2">
            <div>
              <div class="tblwrap">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>套餐</th>
                      <th class="num">加成倍率</th>
                      <th>月度额度用尽策略</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in billingRows" :key="p.planName">
                      <td><b>{{ p.planName }}</b></td>
                      <td class="num"><b>{{ p.multiplier }}</b></td>
                      <td>{{ p.strategy }}</td>
                      <td><span class="btn-t" @click="todo('编辑 ' + p.planName + ' 加成倍率')">编辑</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="empty" v-if="billingRows.length === 0">暂无套餐加成倍率配置</div>
            </div>
            <div>
              <div class="panel flush">
                <div class="p-hd">
                  <span class="pt" style="font-size:12.5px">免费版赠送额度设置</span>
                  <span class="tag tag-o">获客钩子</span>
                </div>
                <div class="p-bd" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <span class="fld">
                    <span>每月赠送调用次数</span>
                    <input class="ipt" placeholder="如 50 次/月" />
                  </span>
                  <span class="fld">
                    <span>赠送模型</span>
                    <span class="sel" style="width:100%;justify-content:space-between">请选择赠送模型 <span class="caret">▾</span></span>
                  </span>
                  <p class="small" style="grid-column:1/-1">
                    免费额度月初重置不累计；用尽后商家后台出现「升级基础版」引导卡（AI 额度同时是获客钩子与付费点）。<br />
                    <span class="ver-tag">v1.1</span><b style="color:var(--color-primary-active)">免费版仅可使用平台公共模型，不支持自定义模型</b>——赠送额度不可用于租户自定义模型，自定义模型调用仅按付费套餐倍率计量。
                  </p>
                </div>
              </div>
              <div class="pg-act mt12">
                <span class="btn btn-p" @click="todo('保存免费版赠送额度')">保存配置</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════ Tab 额度包商品（行 990~997） ════════ -->
    <div v-show="billingTab === 'pack'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 3</span>额度包商品</span>
          <span class="btn btn-p" @click="todo('新建额度包')">+ 新建额度包</span>
        </div>
        <div class="p-bd g3" style="padding-top:10px">
          <div class="panel flush" v-for="pk in quotaPacks" :key="pk.id">
            <div class="p-bd">
              <div class="model-top">
                <b class="model-name">{{ pk.name }}</b>
                <span class="tag" :class="pk.statusClass">{{ pk.statusText }}</span>
              </div>
              <div class="qrow mt8">
                <span style="width:60px">额度</span>
                <div class="qfill"></div>
                <em>{{ pk.quota }}</em>
              </div>
              <div class="qrow">
                <span style="width:60px">售价</span>
                <div class="qfill"></div>
                <em><b style="font-size:14px;color:var(--ink)">{{ pk.price }}</b></em>
              </div>
              <p class="small mt8">
                {{ pk.sold }} · {{ pk.valid }}
                <span class="lk fr" @click="todo('编辑 ' + pk.name)">编辑 · 下架 ›</span>
              </p>
            </div>
          </div>
          <div class="panel flush dashed add-card" v-if="quotaPacks.length">
            <div class="center">
              <b class="rule-title">新建额度包</b>
              <p class="small mt6">名称 / 额度 Token 数 / 售价 / 有效期 /<br />适用套餐范围 / 限购数量</p>
            </div>
          </div>
          <div class="empty" v-if="quotaPacks.length === 0">暂无额度包商品，点击右上角「+ 新建额度包」创建</div>
        </div>
      </div>
    </div>

    <!-- ════════ Tab 积分抵扣（行 998~1090） ════════ -->
    <div v-show="billingTab === 'points'">
      <div class="panel mt12">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 4</span>积分抵扣 · Token 结算冲抵 <span class="ver-tag">v1.2 新增</span></span>
          <span class="ph-s">用量照常计量 · 结算时积分按当前配置汇率冲抵应计费用（积分余额映射为可抵扣 Token 量）</span>
        </div>
        <div class="p-bd" style="display:grid;gap:12px">
          <!-- 抵扣汇率配置 -->
          <div class="panel flush" style="border-color:var(--color-primary-soft)">
            <div class="p-hd">
              <span class="pt" style="font-size:12.5px">抵扣汇率配置 <span class="ver-tag">v1.2</span> <span class="tag tag-gy">手动配置 · 非固定值</span></span>
              <span class="ph-s">Token 计量与模型单价不因积分变化，汇率仅用于结算冲抵</span>
            </div>
            <div class="p-bd" style="display:grid;gap:11px">
              <div style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end">
                <span class="fld" style="width:150px">
                  <span>积分面额</span>
                  <input class="ipt" v-model="pointsForm.points" placeholder="1 积分" />
                </span>
                <span style="font-size:14px;font-weight:700;color:var(--g6);padding-bottom:8px">=</span>
                <span class="fld" style="width:170px">
                  <span>折算 Token 数</span>
                  <input class="ipt" v-model="pointsForm.tokens" placeholder="50 token" />
                </span>
                <span class="btn btn-p" @click="todo('保存抵扣汇率')">保存配置</span>
                <span style="display:flex;align-items:center;gap:8px;padding-bottom:4px;margin-left:auto;flex-wrap:wrap">
                  <span class="tg" :class="{ off: !pointsEnabled }" @click="pointsEnabled = !pointsEnabled"></span>
                  <b style="font-size:12.5px;white-space:nowrap">启用积分抵扣</b>
                  <span class="tag" :class="pointsEnabled ? 'tag-g' : 'tag-gy'">{{ pointsEnabled ? '已开启' : '已关闭' }}</span>
                </span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center">
                <div style="flex:none;text-align:center;padding:4px 16px;border-right:1px dashed var(--g2)">
                  <div class="rate-val">{{ rateText }}</div>
                  <p class="small" style="margin-top:3px"><span class="tag tag-b">当前配置值</span> <span class="small">由上方表单配置，可随时修改，非固定规则</span></p>
                </div>
                <div style="flex:1;min-width:min(300px,100%)">
                  <div class="calc-note">
                    <b>换算示例</b><span>（按当前配置汇率折算）：10 万积分 ≈ <b>500 万 token</b> 可抵扣量 ≈ 按公共模型均价约抵 <b>¥250</b> 用量</span>
                  </div>
                  <p class="small" style="margin-top:6px">汇率由平台管理员手动配置，调整后<b style="color:var(--color-warning)">仅对新消耗生效</b>（消耗时锁定汇率，已抵扣部分不追溯）；汇率未配置或未保存时，上方「启用积分抵扣」总开关自动置灰并提示「请先配置汇率」。</p>
                </div>
              </div>
              <p class="small" style="border-top:1px dashed var(--g2);padding-top:8px">
                <span class="ver-tag">v1.2</span><b>修改记录：</b>暂无修改记录（配置变更留痕可审计）。
              </p>
            </div>
          </div>

          <!-- 抵扣范围 + 适用模型约束 -->
          <div class="g2">
            <div class="panel flush">
              <div class="p-hd">
                <span class="pt" style="font-size:12.5px">抵扣范围 <span class="ver-tag">v1.2</span></span>
                <span class="tag tag-g">按套餐矩阵开启中</span>
              </div>
              <div class="p-bd" style="display:grid;gap:10px">
                <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
                  <span class="tg" :class="{ off: !pointsEnabled }" @click="pointsEnabled = !pointsEnabled"></span>
                  <b style="font-size:12.5px">全局积分抵扣开关</b>
                  <span class="small" style="margin-left:auto">关闭后全部租户暂停积分冲抵，仅按扣减顺序结算</span>
                </div>
                <div class="tblwrap">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th v-for="pl in planColumns" :key="pl">{{ pl }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style="text-align:center" v-for="pl in planColumns" :key="pl">
                          <span class="tg" :class="{ off: !rangeOn[pl] }" @click="rangeOn[pl] = !rangeOn[pl]"></span>
                          <p class="small" style="margin-top:5px" v-if="pl === '免费版'"><span class="tag tag-o">积分主要消耗出口</span></p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="panel flush">
              <div class="p-hd">
                <span class="pt" style="font-size:12.5px">适用模型与抵扣约束</span>
              </div>
              <div class="p-bd" style="display:grid;gap:9px">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <span class="tag tag-b">平台公共模型 · 可用积分抵扣</span>
                  <span class="v11-lock">
                    <span class="lkic">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                    租户自定义模型 · 不可积分抵扣
                    <span class="v11-onlypay">仅付费</span>
                  </span>
                </div>
                <div class="v11-note">
                  <span class="ver-tag" style="margin-top:1px;flex:none">v1.2</span>
                  <span><b>仅限平台公共模型，自定义模型不可用积分抵扣</b>——与 v1.1 付费墙规则咬合：自定义模型调用仅按付费套餐倍率计量，不参与积分冲抵。</span>
                </div>
                <div class="tipbar w" style="padding:8px 11px">
                  <span class="ic">!</span>
                  <span>抵扣部分<b>不可退、不可转赠</b>；老带新奖励积分冲回时，若对应积分已消耗，则从后续获取积分中扣减（不足记负）。</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Token 结算扣减顺序 -->
          <div>
            <p class="b" style="font-size:12px;margin-bottom:7px">Token 结算扣减顺序（固定顺序，租户不可调整）<span class="ver-tag" style="margin-left:6px">v1.2</span></p>
            <div class="steps">
              <div class="step on"><span class="sn">1</span><div><b>积分抵扣</b><p class="sd">营销资产优先消耗</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">2</span><div><b>套餐内含额度</b><p class="sd">当期套餐内含部分</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">3</span><div><b>额度包</b><p class="sd">已购加量包余额</p></div></div>
              <span class="step-line"></span>
              <div class="step"><span class="sn">4</span><div><b>超额计费</b><p class="sd">按套餐倍率并入账单</p></div></div>
            </div>
            <p class="small mt8">当前节点说明：<b style="color:var(--color-primary-active)">积分（营销资产）优先消耗，保护已付费资源</b>——先冲抵积分，再扣套餐内含与额度包，最后才进入超额计费。</p>
          </div>

          <!-- 积分抵扣流水 -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:7px">
              <p class="b" style="font-size:12px">积分抵扣流水（逐次冲抵明细）</p>
              <div class="frow">
                <span class="sel">租户：全部 <span class="caret">▾</span></span>
                <span class="sel">套餐版本：全部 <span class="caret">▾</span></span>
                <span class="btn" @click="todo('导出抵扣流水')">导出</span>
              </div>
            </div>
            <div class="tblwrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>租户</th>
                    <th>套餐版本</th>
                    <th>模型</th>
                    <th class="num">消耗 Token</th>
                    <th class="num">抵扣积分</th>
                    <th class="num">操作后积分余额</th>
                    <th>来源模型</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in pointsFlow" :key="f.id">
                    <td>{{ f.time }}</td>
                    <td><b>{{ f.tenant }}</b></td>
                    <td>{{ f.plan }}</td>
                    <td>{{ f.model }}</td>
                    <td class="num">{{ f.tokens }}</td>
                    <td class="num"><b style="color:var(--color-warning)">{{ f.points }}</b></td>
                    <td class="num">{{ f.balance }}</td>
                    <td><span class="tag tag-b">{{ f.source }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="empty" v-if="pointsFlow.length === 0">暂无积分抵扣流水</div>
            <p class="small mt8">抵扣积分 = 消耗 Token ÷ 当前配置汇率（向上取整）；消耗时锁定汇率，汇率调整不追溯已抵扣流水；<span class="ver-tag" style="margin-left:2px">v1.2</span></p>
          </div>

          <!-- 租户视角 -->
          <div class="tenant-view">
            <span class="ver-tag" style="flex:none">v1.2 租户视角</span>
            <div style="flex:1;min-width:min(280px,100%)">
              <div style="font-size:14px">当前积分余额：<b style="font-size:19px;color:var(--color-primary-active)">—</b> <span style="color:var(--g5)">→</span> 约可抵扣 <b style="font-size:19px;color:var(--color-primary-active)">—</b></div>
              <p class="small" style="margin-top:2px">按当前配置汇率实时折算 · 展示于商户端 AI 页面 · 积分变动即时刷新可抵扣量</p>
            </div>
            <span class="btn btn-p" style="flex:none" @click="todo('前往商户端预览')">前往商户端预览</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPlans } from '../../api'

const billingTab = ref<'strategy' | 'pack' | 'points'>('strategy')

/** 套餐列表（复用现有 api.getPlans 填充「套餐」列；加成倍率 / 策略为套餐级配置，暂无接口 → 占位） */
// TODO: 待接入 GET /platform/ai/billing-strategies —— 套餐加成倍率与月度额度用尽策略（按套餐维度）
const planColumns = ref<string[]>([])
const billingRows = computed(() =>
  planColumns.value.map((name) => ({ planName: name, multiplier: '—', strategy: '—' }))
)
const rangeOn = reactive<Record<string, boolean>>({})

/** 额度包商品：暂无接口 → 空态 */
// TODO: 待接入 GET /platform/ai/quota-packs —— 额度包商品（名称 / 额度 Token / 售价 / 有效期 / 适用套餐 / 限购）
interface QuotaPack {
  id: number
  name: string
  statusText: string
  statusClass: string
  quota: string
  price: string
  sold: string
  valid: string
}
const quotaPacks = ref<QuotaPack[]>([])

/** 积分抵扣 */
const pointsEnabled = ref(false)
const pointsForm = reactive({ points: '', tokens: '' })
const rateText = computed(() => {
  if (pointsForm.points && pointsForm.tokens) return `${pointsForm.points} 积分 = ${pointsForm.tokens} token`
  return '—'
})

/** 积分抵扣流水：暂无接口 → 空态 */
// TODO: 待接入 GET /platform/ai/points-deduction-log —— 积分抵扣逐次流水（时间/租户/套餐/模型/Token/积分/余额）
interface PointsFlow {
  id: number
  time: string
  tenant: string
  plan: string
  model: string
  tokens: string
  points: string
  balance: string
  source: string
}
const pointsFlow = ref<PointsFlow[]>([])

function todo(msg: string) {
  ElMessage.info(`${msg}（接口待接入）`)
}

async function loadPlans() {
  try {
    const res = await getPlans()
    const list = (res as any)?.list ?? (res as any)?.records ?? []
    const names = (list as any[]).map((p) => p.planName || p.name || p.planCode || '—')
    planColumns.value = names.length ? names : ['免费版', '基础版', '标准版', '旗舰版']
    names.forEach((n) => (rangeOn[n] = false))
  } catch {
    // 失败回退到套餐枚举，避免页面空白
    planColumns.value = ['免费版', '基础版', '标准版', '旗舰版']
  }
}

onMounted(loadPlans)
</script>

<style scoped>
.ai-billing {
  /* 根容器作用域锚点 */
}
.flush {
  box-shadow: none;
}
.dashed {
  border-style: dashed;
}
.qfill {
  flex: 1 1 auto;
  min-width: 8px;
}
.caret {
  color: var(--g4);
  font-size: var(--ctrl-caret-size);
  margin-left: auto;
}
.model-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.model-name {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.rule-title {
  font-size: var(--text-md);
  font-weight: var(--font-bold);
}
.center {
  text-align: center;
  min-height: var(--tpl-card-min-h);
  display: grid;
  place-items: center;
}
.lk.fr {
  float: right;
  cursor: pointer;
}
.rate-val {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-primary-active);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.calc-note {
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: 9px 13px;
  font-size: var(--text-sm);
  color: var(--color-primary-active);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.v11-lock {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  padding: 2px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--g2);
  background: var(--g0);
  color: var(--g5);
}
.v11-lock .lkic {
  display: inline-grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: 4px;
  background: var(--g3);
  color: var(--g6);
  flex: none;
}
.v11-onlypay {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  line-height: 1;
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  border: 1px solid var(--warning-line);
  color: var(--color-warning);
  font-weight: var(--font-semibold);
  margin-left: 4px;
}
.v11-note {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  font-size: var(--text-xs);
  color: var(--g5);
  background: var(--color-primary-bg);
  border: 1px dashed var(--color-primary-soft);
  border-radius: var(--radius-lg);
  padding: 7px 11px;
  line-height: 1.6;
}
.tenant-view {
  border: 1px solid var(--color-primary-soft);
  background: var(--color-primary-bg);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
}
</style>
