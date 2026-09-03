<template>
  <view class="batch-price-page">
    <page-header title="批量调价" @back="goBack">
      <template #right>
        <view class="log-btn" @tap="openLog">
          <text class="log-btn-icon">◷</text>
          <view class="log-badge" v-if="priceLog.length > 0">{{ priceLog.length }}</view>
        </view>
      </template>
    </page-header>

    <!-- 顶部筛选 Tab：分类 / 品牌 / 状态（选择即圈定调价范围并自动全选） -->
    <view class="top-tabs">
      <view
        class="top-tab"
        v-for="tab in filterTabs"
        :key="tab.k"
        :class="{ 'top-tab--active': activePop === tab.k }"
        @tap="togglePop(tab.k)"
      >
        <text class="top-tab-label">{{ tab.label }}</text>
        <text class="top-tab-val">{{ tab.val }}</text>
      </view>

      <view class="flt-pop" v-if="activePop" @tap.stop>
        <view
          class="flt-pop-item"
          v-for="opt in activePopOptions"
          :key="String(opt.value)"
          :class="{ 'flt-pop-item--on': opt.value === activePopValue }"
          @tap="pickFilter(activePop, opt.value)"
        >
          <text class="flt-pop-label">{{ opt.label }}</text>
          <text class="flt-pop-ck" v-if="opt.value === activePopValue">✓</text>
        </view>
      </view>
    </view>
    <view class="flt-mask" v-if="activePop" @tap="activePop = ''"></view>

    <scroll-view class="content" scroll-y>
      <!-- 搜索框 -->
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input
          class="search-input"
          :value="kw"
          placeholder="搜索商品名称 / 条码"
          placeholder-class="search-placeholder"
          @input="onKw($event)"
        />
        <text class="search-clear" v-if="kw" @tap="clearKw">×</text>
      </view>

      <!-- 调价规则卡：价格类型多选 + 单一共享规则 -->
      <view class="card">
        <view class="card-title">
          <text>调价规则</text>
          <text class="card-sub">{{ ADJ.types.length > 0 ? `已选 ${ADJ.types.length} 个价格类型` : '请选择价格类型' }}</text>
        </view>

        <view class="pt-chips">
          <view
            class="pt-chip"
            v-for="t in SELL_TYPES"
            :key="t.k"
            :class="{ 'pt-chip--on': ADJ.types.includes(t.k) }"
            @tap="toggleType(t.k)"
          >
            <text>{{ t.name }}</text>
          </view>
        </view>
        <view class="rule-empty" v-if="ADJ.types.length === 0">
          <text>未选择价格类型，请在上方勾选</text>
        </view>

        <view class="adj-bar">
          <view class="mode-chips">
            <view
              class="mode-chip"
              :class="{ 'mode-chip--on': ADJ.mode === 'PERCENTAGE' }"
              @tap="setRuleMode('PERCENTAGE')"
            >
              <text>按比例</text>
            </view>
            <view
              class="mode-chip"
              :class="{ 'mode-chip--on': ADJ.mode === 'FIXED' }"
              @tap="setRuleMode('FIXED')"
            >
              <text>按金额</text>
            </view>
          </view>
          <view class="adj-btn" :class="{ 'adj-btn--on': ADJ.dir === 'down' }" @tap="setRuleDir('down')">
            <text>−</text>
          </view>
          <view class="adj-mid">
            <input
              class="rule-inp"
              type="digit"
              :value="ADJ.val === '' ? '' : String(ADJ.val)"
              placeholder="0"
              placeholder-class="rule-inp-placeholder"
              @focus="onValFocus"
              @blur="onValBlur"
              @input="setRuleVal($event)"
            />
            <text class="inp-lb">{{ ADJ.mode === 'PERCENTAGE' ? '%' : '元' }}</text>
          </view>
          <view class="adj-btn" :class="{ 'adj-btn--on': ADJ.dir === 'up' }" @tap="setRuleDir('up')">
            <text>＋</text>
          </view>
        </view>

        <!-- 按价格类型逐项说明 -->
        <view class="type-desc">
          <template v-if="ADJ.types.length > 0">
            <view class="td-row" v-for="k in ADJ.types" :key="k">
              <text class="td-name">{{ typeName(k) }}</text>
              <text class="td-step">{{ ruleStep() }}</text>
            </view>
          </template>
          <view class="td-empty" v-else>
            <text>请先在上方选择价格类型</text>
          </view>
        </view>

        <!-- 抹零 -->
        <view class="round-row">
          <text class="round-lb">抹零</text>
          <view class="round-opts">
            <view
              class="round-chip"
              v-for="r in ROUNDS"
              :key="r.k"
              :class="{ 'round-chip--on': ADJ.round === r.k }"
              @tap="setRound(r.k)"
            >
              <text>{{ r.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 影响试算 -->
      <view class="trial">
        <view class="trial-hd">
          <text class="trial-hd-icon">⚠</text>
          <text>影响试算</text>
          <text class="trial-sub">{{ selectedList.length }} 件商品</text>
        </view>
        <view class="trial-empty" v-if="selectedList.length === 0">
          <text>请先勾选要调价的商品</text>
        </view>
        <template v-else>
          <view class="trial-row" v-for="row in trialRows" :key="row.k">
            <text class="tl">{{ typeName(row.k) }}</text>
            <text class="ov">{{ fmt2(row.oldAvg) }}</text>
            <text class="ar">→</text>
            <text class="nv">{{ fmt2(row.newAvg) }}</text>
            <text class="pc" :class="row.diff >= 0 ? 'pc--up' : 'pc--down'">
              {{ (row.diff >= 0 ? '+' : '') + row.pct.toFixed(1) + '%' }}
            </text>
          </view>
          <view class="trial-empty" v-if="ADJ.types.length === 0">
            <text>未选择价格类型，请先勾选；或展开商品逐个调整</text>
          </view>
          <view class="trial-row" v-if="marginRow">
            <text class="tl">毛利率</text>
            <text class="ov">{{ marginRow.old.toFixed(1) + '%' }}</text>
            <text class="ar">→</text>
            <text class="nv">{{ marginRow.new.toFixed(1) + '%' }}</text>
            <text class="pc" :class="marginRow.diff >= 0 ? 'pc--up' : 'pc--down'">
              {{ (marginRow.diff >= 0 ? '+' : '') + marginRow.diff.toFixed(1) + 'pp' }}
            </text>
          </view>
          <view class="trial-warn" v-if="badCount > 0">
            <text class="trial-warn-icon">⚠</text>
            <text>{{ badCount }} 件商品调后售价低于进货价，已标红，请确认</text>
          </view>
        </template>
      </view>

      <!-- 商品清单（勾选 + 展开逐个改价） -->
      <view class="plist">
        <view class="plist-hd">
          <text class="plist-title">商品清单</text>
          <text class="plist-badge">已选 {{ selectedList.length }}/{{ filteredList.length }}</text>
          <text class="plink" @tap="selAll(true)">全选</text>
          <text class="plink" @tap="selAll(false)">清空</text>
        </view>

        <view class="pempty" v-if="filteredList.length === 0">
          <text class="pempty-t">没有符合条件的商品</text>
          <text class="pempty-s">换个筛选条件试试</text>
        </view>

        <view
          class="pitem"
          v-for="p in filteredList"
          :key="p.id"
          :class="{ 'pitem--off': !sel[p.id], 'pitem--warn': sel[p.id] && isBad(p) }"
        >
          <view class="pi-hd" @tap="toggleSel(p.id)">
            <view class="pi-ck" :class="{ 'pi-ck--on': sel[p.id] }"><text class="pi-ck-mark">✓</text></view>
            <view class="pi-thumb"><text class="pi-thumb-letter">{{ (p.name || '?')[0] }}</text></view>
            <view class="pi-info">
              <text class="pi-name">{{ p.name }}</text>
              <view class="pi-sub">
                <text v-if="p.specs">{{ p.specs }}</text>
                <text v-if="p.brandName">{{ p.brandName }}</text>
                <text v-if="p.status === 'OFF'" class="pi-sub-off">已停用</text>
              </view>
            </view>
            <text class="pi-stock">{{ p.stock }}{{ p.unit }}</text>
            <view class="pi-exp" :class="{ 'pi-exp--on': !!expanded[p.id] }" @tap.stop="toggleExp(p.id)">
              <text class="pi-exp-arrow">▾</text>
            </view>
          </view>

          <view class="pi-body" v-if="rowKeys(p).length > 0">
            <view class="prow" v-for="k in rowKeys(p)" :key="k">
              <text class="prow-lb">{{ typeName(k) }}</text>
              <text class="prow-old">{{ fmt2(num((p as any)[k])) }}</text>
              <text class="prow-ar">→</text>
              <input
                class="np-inp"
                :class="{ 'np-inp--bad': isBadCell(p, k) }"
                type="digit"
                :value="manualDisplay(p, k)"
                placeholder="0.00"
                placeholder-class="np-inp-placeholder"
                @input="onManual(p, k, $event)"
                @blur="onManualBlur(p, k, $event)"
              />
              <text class="tag-m" v-if="isManual(p, k)" @tap="clearManual(p, k)">手动</text>
            </view>
          </view>
          <view class="pi-note" v-else-if="ADJ.types.length > 0">
            <text>点右侧箭头展开，可单独微调该商品</text>
          </view>
          <view class="pi-note" v-else>
            <text>请先在上方选择价格类型</text>
          </view>
        </view>
      </view>

      <view class="content-bottom-pad"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="act-bar">
      <view class="sel-all" @tap="selAll(!allSelected)">
        <view class="sa" :class="{ 'sa--on': allSelected }"><text class="sa-mark">✓</text></view>
        <text>全选</text>
      </view>
      <view class="ab-btn ab-btn--ghost" :class="{ 'ab-btn--dis': UNDO.length === 0 }" @tap="doUndo">
        <text>撤销</text>
      </view>
      <view
        class="ab-btn ab-btn--primary"
        :class="{ 'ab-btn--dis': !canConfirm }"
        @tap="canConfirm ? openConfirm() : confirmBlocked()"
      >
        <text>确认调价{{ selectedList.length > 0 ? `（${selectedList.length} 件）` : '' }}</text>
      </view>
    </view>

    <!-- 确认调价弹层 -->
    <view class="overlay" v-if="showConfirm" @tap="showConfirm = false">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>确认调价</text></view>
        <scroll-view class="panel-body" scroll-y>
          <view class="panel-card">
            <text class="panel-line">
              本次将调整
              <text class="panel-strong">{{ selectedList.length }}</text>
              件商品、
              <text class="panel-strong">{{ ADJ.types.length }}</text>
              个价格类型
              <text v-if="manualCount > 0">，其中手动调整 <text class="panel-strong panel-strong--warn">{{ manualCount }}</text> 处</text>
            </text>
            <view class="panel-rule"><text>调价规则：{{ ruleSummary() || '仅手动逐个调整' }}</text></view>
            <view class="m-sum" v-for="row in confirmRows" :key="row.k">
              <text class="m-sum-l">{{ typeName(row.k) }}</text>
              <text class="m-sum-old">{{ fmt2(row.oldAvg) }}</text>
              <text class="m-sum-ar">→</text>
              <text class="m-sum-new">{{ fmt2(row.newAvg) }}</text>
              <text class="pc" :class="row.diff >= 0 ? 'pc--up' : 'pc--down'">
                {{ (row.diff >= 0 ? '+' : '') + row.pct.toFixed(1) + '%' }}
              </text>
            </view>
          </view>
          <view class="panel-tip">
            <text>· 确认后立即生效，新开单据按新价取价&#10;· 已保存的历史单据不受影响，仍按原单价结算</text>
          </view>
          <view class="panel-card panel-card--danger" v-if="badCount > 0">
            <text class="panel-danger-line">⚠ 有 {{ badCount }} 件商品调后售价低于进货价，确认后将亏损销售</text>
          </view>
        </scroll-view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="showConfirm = false"><text>再检查</text></view>
          <view class="m-btn m-btn--primary" @tap="doAdjust"><text>确认调价</text></view>
        </view>
      </view>
    </view>

    <!-- 调价完成弹层 -->
    <view class="overlay" v-if="showDone" @tap="closeDone">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>调价完成</text></view>
        <scroll-view class="panel-body" scroll-y>
          <view class="done-wrap">
            <view class="done-icon"><text class="done-icon-mark">✓</text></view>
            <text class="done-title">{{ doneInfo.total }} 件商品价格已更新</text>
            <text class="done-sub">共 {{ doneInfo.changed }} 处价格变动{{ doneInfo.manual > 0 ? `，含手动调整 ${doneInfo.manual} 处` : '' }}{{ doneInfo.failed > 0 ? `，失败 ${doneInfo.failed} 件` : '' }}</text>
          </view>
          <view class="panel-rule panel-rule--center"><text>{{ doneInfo.rules }}</text></view>
        </scroll-view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="closeDone('log')"><text>查看记录</text></view>
          <view class="m-btn m-btn--primary" @tap="closeDone('finish')"><text>完成</text></view>
        </view>
      </view>
    </view>

    <!-- 调价记录弹层 -->
    <view class="overlay" v-if="showLog" @tap="showLog = false">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>调价记录</text></view>
        <scroll-view class="panel-body" scroll-y>
          <view class="pempty" v-if="priceLog.length === 0">
            <text class="pempty-t">暂无调价记录</text>
            <text class="pempty-s">完成一次批量调价后，这里会留痕可查</text>
          </view>
          <view class="log-item" v-for="(l, i) in priceLog" :key="i">
            <view class="log-t"><text>{{ l.time }}</text></view>
            <text class="log-r">{{ l.rules }}</text>
            <text class="log-d">涉及 {{ l.count }} 件商品 · {{ l.changed }} 处价格变动{{ l.manual > 0 ? ` · 手动 ${l.manual} 处` : '' }}{{ l.failed > 0 ? ` · 失败 ${l.failed} 件` : '' }}</text>
          </view>
        </scroll-view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="showLog = false"><text>关闭</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import pageHeader from '@/components/page-header/page-header.vue'
import {
  productsApi,
  updateSkuPrice,
  type ProductInfo,
  type CategoryInfo,
} from '@/api/modules/products'

function goBack() {
  uni.navigateBack()
}

/* ── 价格类型：可调四档 + 进货价（仅作亏本预警参照，不可调不可见） ── */
const SELL_TYPES = [
  { k: 'wholesalePrice', name: '批发价' },
  { k: 'retailPrice', name: '零售价' },
  { k: 'storePrice', name: '门店价' },
  { k: 'miniappPrice', name: '小程序价' },
] as const
const COST_KEY = 'costPrice'

function typeName(k: string): string {
  return SELL_TYPES.find((t) => t.k === k)?.name ?? k
}

const ROUNDS = [
  { k: 'all', name: '全保留' },
  { k: 'yuan', name: '到元' },
  { k: 'jiao', name: '到角' },
  { k: 'fen', name: '到分' },
] as const

/* ── 调价状态（types 为多选，共用一套规则；manual 优先于规则） ── */
const ADJ = reactive({
  types: ['wholesalePrice'] as string[],
  mode: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  dir: 'up' as 'up' | 'down',
  val: 5 as number | '',
  round: 'fen' as (typeof ROUNDS)[number]['k'],
})

const kw = ref('')
const activeCat = ref(0) // 0 = 全部分类
const activeBrand = ref('') // '' = 全部品牌
const activeStatus = ref('') // '' = 全部状态；'ON' | 'OFF'

const manual = reactive<Record<string, string>>({}) // `${productId}:${typeKey}` -> 输入串
const expanded = reactive<Record<number, boolean>>({})
const sel = reactive<Record<number, boolean>>({})

const UNDO = ref<Array<{ label: string; kind: string; snap: string }>>([])
let _valEditing = false

/* ── 数据 ── */
const products = ref<ProductInfo[]>([])
const categories = ref<CategoryInfo[]>([])
const loading = ref(false)

async function loadAll() {
  loading.value = true
  try {
    // 批量调价需要全量商品做筛选/试算，循环分页拉取
    const acc: ProductInfo[] = []
    let page = 1
    for (;;) {
      const res = await productsApi.list({ page, pageSize: 100 })
      const list = res?.list ?? []
      acc.push(...list)
      const total = res?.total ?? acc.length
      if (list.length < 100 || acc.length >= total || page >= 20) break
      page++
    }
    products.value = acc
  } catch (err) {
    console.error('加载商品失败:', err)
    uni.showToast({ title: '加载商品失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await productsApi.categories()
  } catch (err) {
    console.error('加载分类失败:', err)
  }
}

/* ── 工具 ── */
function num(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
function fmt2(n: number): string {
  return (Number(n) || 0).toFixed(2)
}
/** 抹零：向下舍去零头（非四舍五入） */
function roundVal(v: number, mode: string): number {
  if (mode === 'yuan') return Math.floor(v + 1e-9)
  if (mode === 'jiao') return Math.floor(v * 10 + 1e-9) / 10
  if (mode === 'fen') return Math.floor(v * 100 + 1e-9) / 100
  return v
}
function manualKey(p: ProductInfo, k: string): string {
  return `${p.id}:${k}`
}
function isManual(p: ProductInfo, k: string): boolean {
  const v = manual[manualKey(p, k)]
  return v !== undefined && v !== ''
}
/** 新价：手动值优先 → 共享规则 → 不变 */
function calcNew(p: ProductInfo, k: string): number {
  const m = manual[manualKey(p, k)]
  if (m !== undefined && m !== '') {
    const f = parseFloat(m)
    if (isFinite(f)) return f
  }
  if (!ADJ.types.includes(k)) return num((p as any)[k])
  const v = Number(ADJ.val) || 0
  const base = num((p as any)[k])
  const nv =
    ADJ.mode === 'PERCENTAGE'
      ? base * (1 + (ADJ.dir === 'up' ? 1 : -1) * (v / 100))
      : base + (ADJ.dir === 'up' ? 1 : -1) * v
  return roundVal(nv, ADJ.round)
}
/** 亏本判定：调后售价低于进货价（无成本价权限时不判） */
function isBad(p: ProductInfo): boolean {
  const cost = (p as any)[COST_KEY]
  if (cost == null) return false
  return ADJ.types.some((k) => calcNew(p, k) < Number(cost))
}
function isBadCell(p: ProductInfo, k: string): boolean {
  const cost = (p as any)[COST_KEY]
  if (cost == null || !sel[p.id]) return false
  const nv = calcNew(p, k)
  return isFinite(nv) && nv < Number(cost)
}
/** 输入框显示值：手改显示输入串，否则显示规则计算值 */
function manualDisplay(p: ProductInfo, k: string): string {
  const m = manual[manualKey(p, k)]
  if (m !== undefined) return m
  return fmt2(calcNew(p, k))
}
function rowKeys(p: ProductInfo): string[] {
  // 展开看全部可调类型；默认只展示正在调整的类型
  if (expanded[p.id]) return SELL_TYPES.map((t) => t.k)
  return ADJ.types.slice()
}

/* ── 筛选 ── */
const filteredList = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return products.value.filter((p) => {
    if (activeCat.value !== 0 && p.categoryId !== activeCat.value) return false
    if (activeBrand.value && (p.brandName ?? '') !== activeBrand.value) return false
    if (activeStatus.value && p.status !== activeStatus.value) return false
    if (k) {
      const hay = `${p.name ?? ''} ${p.barcode ?? ''}`.toLowerCase()
      if (!hay.includes(k)) return false
    }
    return true
  })
})
const selectedList = computed(() => filteredList.value.filter((p) => sel[p.id]))
const allSelected = computed(() => {
  const all = filteredList.value
  return all.length > 0 && all.every((p) => sel[p.id])
})
/** 筛选即圈定调价范围：选择重置为新结果 */
function resetSel() {
  Object.keys(sel).forEach((key) => delete sel[Number(key)])
  filteredList.value.forEach((p) => {
    sel[p.id] = true
  })
}

const brandOptions = computed(() => {
  const set = new Set<string>()
  products.value.forEach((p) => {
    if (p.brandName) set.add(p.brandName)
  })
  return Array.from(set).sort()
})

const filterTabs = computed(() => [
  {
    k: 'cat' as const,
    label: '分类',
    val: activeCat.value === 0 ? '全部分类' : categories.value.find((c) => c.id === activeCat.value)?.name ?? '全部分类',
  },
  { k: 'brand' as const, label: '品牌', val: activeBrand.value || '全部品牌' },
  {
    k: 'status' as const,
    label: '状态',
    val: activeStatus.value === 'ON' ? '已启用' : activeStatus.value === 'OFF' ? '已停用' : '全部状态',
  },
])

const activePop = ref<'' | 'cat' | 'brand' | 'status'>('')
const activePopOptions = computed(() => {
  if (activePop.value === 'cat') {
    return [{ label: '全部分类', value: 0 }].concat(
      categories.value.map((c) => ({ label: c.name, value: c.id }))
    )
  }
  if (activePop.value === 'brand') {
    return [{ label: '全部品牌', value: '' }].concat(
      brandOptions.value.map((b) => ({ label: b, value: b }))
    )
  }
  if (activePop.value === 'status') {
    return [
      { label: '全部状态', value: '' },
      { label: '已启用', value: 'ON' },
      { label: '已停用', value: 'OFF' },
    ]
  }
  return []
})
const activePopValue = computed(() => {
  if (activePop.value === 'cat') return activeCat.value
  if (activePop.value === 'brand') return activeBrand.value
  if (activePop.value === 'status') return activeStatus.value
  return ''
})
const activePopType = computed(() =>
  activePop.value === 'cat' ? 'number' : 'string'
)

function togglePop(k: '' | 'cat' | 'brand' | 'status') {
  activePop.value = activePop.value === k ? '' : k
}
function pickFilter(kind: string, value: any) {
  if (kind === 'cat') activeCat.value = value
  else if (kind === 'brand') activeBrand.value = value
  else if (kind === 'status') activeStatus.value = value
  activePop.value = ''
  resetSel()
  uni.showToast({ title: `已按筛选结果选中 ${filteredList.value.length} 件商品`, icon: 'none' })
}

function onKw(e: any) {
  kw.value = e?.detail?.value || ''
  resetSel()
}
function clearKw() {
  kw.value = ''
  resetSel()
}

/* ── 撤销栈：同类连续操作合并为一步 ── */
function snapState(): string {
  return JSON.stringify({
    types: ADJ.types.slice(),
    mode: ADJ.mode,
    dir: ADJ.dir,
    val: ADJ.val,
    round: ADJ.round,
    manual: { ...manual },
  })
}
function pushUndo(label: string, kind: string) {
  const last = UNDO.value[UNDO.value.length - 1]
  if (last && last.kind === kind) return
  UNDO.value.push({ label, kind, snap: snapState() })
}
function doUndo() {
  const last = UNDO.value.pop()
  if (!last) {
    uni.showToast({ title: '没有可撤销的操作', icon: 'none' })
    return
  }
  const s = JSON.parse(last.snap)
  ADJ.types = s.types.slice()
  ADJ.mode = s.mode
  ADJ.dir = s.dir
  ADJ.val = s.val
  ADJ.round = s.round
  Object.keys(manual).forEach((key) => delete manual[key])
  Object.assign(manual, s.manual)
  uni.showToast({ title: `已撤销：${last.label}`, icon: 'none' })
}

/* ── 规则操作 ── */
function toggleType(k: string) {
  pushUndo('选择价格类型', 'types')
  const i = ADJ.types.indexOf(k)
  if (i >= 0) ADJ.types.splice(i, 1)
  else ADJ.types.push(k)
}
function setRuleMode(m: 'PERCENTAGE' | 'FIXED') {
  pushUndo('切换调价方式', 'mode')
  ADJ.mode = m
}
function setRuleDir(d: 'up' | 'down') {
  pushUndo('调整涨跌', 'dir')
  ADJ.dir = d
}
function setRuleVal(e: any) {
  const v = e?.detail?.value ?? ''
  if (!_valEditing) {
    pushUndo('调整数值', 'val')
    _valEditing = true
  }
  ADJ.val = v === '' ? '' : Number(v)
}
function onValFocus() {
  _valEditing = false
}
function onValBlur() {
  _valEditing = false
}
function setRound(k: (typeof ROUNDS)[number]['k']) {
  pushUndo('调整抹零', 'round')
  ADJ.round = k
}
function ruleStep(): string {
  const sign = ADJ.dir === 'up' ? '上调' : '下调'
  const step = ADJ.mode === 'PERCENTAGE' ? `${ADJ.val}%` : `${fmt2(Number(ADJ.val) || 0)} 元`
  return `${sign} ${step}`
}
function ruleShort(): string {
  const sign = ADJ.dir === 'up' ? '+' : '−'
  const step = ADJ.mode === 'PERCENTAGE' ? `${ADJ.val}%` : `${fmt2(Number(ADJ.val) || 0)}元`
  return sign + step
}
function ruleSummary(): string {
  if (ADJ.types.length === 0) return ''
  return ADJ.types.map((k) => `${typeName(k)} ${ruleShort()}`).join(' · ')
}

/* ── 影响试算 ── */
const trialRows = computed(() => {
  const list = selectedList.value
  if (list.length === 0) return []
  return ADJ.types.map((k) => {
    const oldAvg = list.reduce((s, p) => s + num((p as any)[k]), 0) / list.length
    const newAvg = list.reduce((s, p) => s + calcNew(p, k), 0) / list.length
    const diff = newAvg - oldAvg
    return { k, oldAvg, newAvg, diff, pct: oldAvg !== 0 ? (diff / oldAvg) * 100 : 0 }
  })
})
/** 毛利率：仅当批发价参与调价时展示其变化 */
const marginRow = computed(() => {
  const list = selectedList.value
  if (list.length === 0 || !ADJ.types.includes('wholesalePrice')) return null
  let hasCost = false
  for (const p of list) {
    if ((p as any)[COST_KEY] != null) {
      hasCost = true
      break
    }
  }
  if (!hasCost) return null
  const m = (ws: (p: ProductInfo) => number, cs: (p: ProductInfo) => number) => {
    const ow = list.reduce((s, p) => s + ws(p), 0)
    const oc = list.reduce((s, p) => s + cs(p), 0)
    return ow > 0 ? ((ow - oc) / ow) * 100 : 0
  }
  const oldM = m((p) => num(p.wholesalePrice), (p) => num((p as any)[COST_KEY] ?? 0))
  const newM = m((p) => calcNew(p, 'wholesalePrice'), (p) => num((p as any)[COST_KEY] ?? 0))
  return { old: oldM, new: newM, diff: newM - oldM }
})
const badCount = computed(() => selectedList.value.filter((p) => isBad(p)).length)

/* ── 选择 / 展开 / 手改 ── */
function toggleSel(id: number) {
  sel[id] = !sel[id]
}
function selAll(v: boolean) {
  filteredList.value.forEach((p) => {
    sel[p.id] = v
  })
}
function toggleExp(id: number) {
  expanded[id] = !expanded[id]
}
/** 手改输入：输入过程中保留原串（不重渲染覆盖输入框），失焦时格式化或回退规则值 */
function onManual(p: ProductInfo, k: string, e: any) {
  pushUndo('逐个改价', 'manual')
  manual[manualKey(p, k)] = e?.detail?.value ?? ''
}
function onManualBlur(p: ProductInfo, k: string, e: any) {
  const key = manualKey(p, k)
  const raw = manual[key]
  if (raw === undefined) return
  const f = parseFloat(raw)
  if (raw === '' || !isFinite(f)) {
    delete manual[key] // 清空 = 恢复跟随批量规则
    return
  }
  manual[key] = String(f)
}
function clearManual(p: ProductInfo, k: string) {
  pushUndo('清除手动', 'manual')
  delete manual[manualKey(p, k)]
  uni.showToast({ title: '已恢复跟随批量规则', icon: 'none' })
}

const manualCount = computed(() => {
  let n = 0
  selectedList.value.forEach((p) => {
    ADJ.types.forEach((k) => {
      if (isManual(p, k)) n++
    })
  })
  return n
})

/* ── 确认 / 执行 ── */
const showConfirm = ref(false)
const showDone = ref(false)
const showLog = ref(false)
const executing = ref(false)
const priceLog = ref<
  Array<{ time: string; count: number; changed: number; manual: number; failed: number; rules: string }>
>([])
const doneInfo = ref({ total: 0, changed: 0, manual: 0, failed: 0, rules: '' })

const canConfirm = computed(() => selectedList.value.length > 0 && ADJ.types.length > 0)

const confirmRows = computed(() => trialRows.value)

function confirmBlocked() {
  if (selectedList.value.length === 0) uni.showToast({ title: '请先勾选要调价的商品', icon: 'none' })
  else if (ADJ.types.length === 0) uni.showToast({ title: '请先在上方选择要调整的价格类型', icon: 'none' })
  else uni.showToast({ title: '请设置调价规则，或展开商品逐个调整价格', icon: 'none' })
}
function openConfirm() {
  if (!canConfirm.value) {
    confirmBlocked()
    return
  }
  showConfirm.value = true
}

function nowStr(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 执行：前端按规则/手改/抹零算好每个商品的新价，逐个 PUT（每商品一次，多档位合并提交），试算即所得 */
async function doAdjust() {
  if (executing.value) return
  const targets = selectedList.value.slice()
  if (targets.length === 0 || ADJ.types.length === 0) {
    showConfirm.value = false
    return
  }
  showConfirm.value = false

  type Op = { p: ProductInfo; payload: Record<string, number> }
  const ops: Op[] = []
  let changed = 0
  let manualCnt = 0
  targets.forEach((p) => {
    const payload: Record<string, number> = {}
    ADJ.types.forEach((k) => {
      const nv = calcNew(p, k)
      if (!isFinite(nv)) return
      if (isManual(p, k)) manualCnt++
      if (Math.abs(nv - num((p as any)[k])) < 1e-9) return
      payload[k] = Math.round(nv * 100) / 100
      changed++
    })
    if (Object.keys(payload).length > 0) ops.push({ p, payload })
  })

  if (ops.length === 0) {
    uni.showToast({ title: '没有需要调整的价格', icon: 'none' })
    return
  }

  executing.value = true
  uni.showLoading({ title: `执行中 0/${ops.length}`, mask: true })
  let okCnt = 0
  let failCnt = 0
  for (let i = 0; i < ops.length; i++) {
    const { p, payload } = ops[i]
    try {
      await updateSkuPrice(Number(p.id), payload)
      okCnt++
      // 本地同步新价，试算与清单即时反映
      Object.keys(payload).forEach((k) => {
        ;(p as any)[k] = payload[k]
      })
    } catch (err) {
      failCnt++
      console.error(`更新商品 ${p.name} 价格失败:`, err)
    }
    if ((i + 1) % 5 === 0 || i + 1 === ops.length) {
      uni.showLoading({ title: `执行中 ${i + 1}/${ops.length}`, mask: true })
    }
  }
  uni.hideLoading()
  executing.value = false

  priceLog.value.unshift({
    time: nowStr(),
    count: targets.length,
    changed,
    manual: manualCnt,
    failed: failCnt,
    rules: ruleSummary() || '仅手动逐个调整',
  })
  doneInfo.value = {
    total: okCnt,
    changed,
    manual: manualCnt,
    failed: failCnt,
    rules: priceLog.value[0].rules,
  }
  showDone.value = true
}

/** 完成后回到干净状态：规则复位、选择重选、清空撤销栈（保留筛选条件） */
function afterAdjust() {
  ADJ.types = ['wholesalePrice']
  ADJ.mode = 'PERCENTAGE'
  ADJ.dir = 'up'
  ADJ.val = 5
  ADJ.round = 'fen'
  Object.keys(manual).forEach((key) => delete manual[key])
  Object.keys(expanded).forEach((key) => delete expanded[Number(key)])
  UNDO.value = []
  resetSel()
}
function closeDone(action: 'log' | 'finish') {
  showDone.value = false
  if (action === 'log') {
    showLog.value = true
    afterAdjust()
  } else {
    afterAdjust()
  }
}
function openLog() {
  showLog.value = true
}

onMounted(() => {
  loadAll().then(resetSel)
  loadCategories()
})
</script>

<style lang="scss" scoped>
.batch-price-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $uni-bg-color-grey;
}

/* 页头记录入口 */
.log-btn {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-btn-icon {
  font-size: 40rpx;
  color: $uni-gray-600;
  line-height: 1;
}

.log-badge {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 6rpx;
  border-radius: 999rpx;
  background: $uni-color-error;
  color: $ai-bg-page;
  font-size: 18rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* ── 顶部筛选 Tab ── */
.top-tabs {
  position: relative;
  z-index: 30;
  display: flex;
  background: $uni-bg-color;
  border-bottom: 1rpx solid $zx-black-50;
  flex-shrink: 0;
}

.top-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  padding: 16rpx 8rpx;
  position: relative;
}

.top-tab-label {
  font-size: 27rpx;
  font-weight: 500;
  color: $uni-gray-600;
  line-height: 1.2;
}

.top-tab-val {
  max-width: 192rpx;
  font-size: 22rpx;
  color: $uni-gray-400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.top-tab--active .top-tab-label,
.top-tab--active .top-tab-val {
  color: $uni-color-primary;
  font-weight: 700;
}

.top-tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 52rpx;
  height: 6rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}

.flt-pop {
  position: absolute;
  top: 100%;
  left: 20rpx;
  right: 20rpx;
  margin-top: 8rpx;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  box-shadow: 0 8rpx 32rpx $zx-black-140;
  z-index: 31;
  max-height: 60vh;
  overflow-y: auto;
}

.flt-pop-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 28rpx;
  font-size: 27rpx;
  border-bottom: 1rpx solid $zx-black-40;
}

.flt-pop-item:last-child {
  border-bottom: none;
}

.flt-pop-item--on {
  color: $uni-color-primary;
  font-weight: 600;
}

.flt-pop-label {
  flex: 1;
  min-width: 0;
}

.flt-pop-ck {
  color: $uni-color-primary;
  font-weight: 700;
}

.flt-mask {
  position: fixed;
  inset: 0;
  z-index: 29;
}

/* ── 内容区 ── */
.content {
  flex: 1;
  min-height: 0;
}

.content-bottom-pad {
  height: 180rpx;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: 0 24rpx;
  height: 76rpx;
  margin: 20rpx 28rpx 0;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 28rpx;
  color: $uni-text-color;
}

.search-placeholder {
  color: $uni-gray-300;
}

.search-clear {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: $uni-gray-400;
}

/* ── 卡片通用 ── */
.card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card;
  padding: 28rpx;
  margin: 24rpx 28rpx 0;
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  color: $uni-text-color;
}

.card-sub {
  margin-left: auto;
  font-size: 22rpx;
  color: $uni-gray-400;
  font-weight: 400;
}

/* 价格类型多选 chips */
.pt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.pt-chip {
  font-size: 25rpx;
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  background: $uni-bg-color-grey;
  color: $uni-gray-600;
  font-weight: 600;
  transition: all 0.22s;
}

.pt-chip--on {
  background: $uni-color-primary;
  color: $ai-bg-page;
  box-shadow: 0 6rpx 16rpx $zx-primary-220;
}

.rule-empty {
  font-size: 25rpx;
  color: $uni-gray-400;
  text-align: center;
  padding: 20rpx 0;
  background: $uni-bg-color-grey;
  border-radius: $uni-border-radius-sm;
  margin-bottom: 20rpx;
}

/* 调价方式 + 涨跌 + 数值 */
.adj-bar {
  display: flex;
  align-items: stretch;
  gap: 16rpx;
}

.mode-chips {
  display: flex;
  gap: 6rpx;
  background: $uni-bg-color-grey;
  padding: 4rpx;
  border-radius: $uni-border-radius-sm;
  flex-shrink: 0;
}

.mode-chip {
  padding: 8rpx 18rpx;
  border-radius: 12rpx;
  font-size: 23rpx;
  font-weight: 600;
  color: $uni-gray-600;
}

.mode-chip--on {
  background: $uni-bg-color;
  color: $uni-color-primary;
  box-shadow: 0 2rpx 6rpx $zx-black-80;
}

.adj-btn {
  width: 80rpx;
  flex-shrink: 0;
  border: 1rpx solid $uni-border-color;
  border-radius: 16rpx;
  background: $uni-bg-color-grey;
  font-size: 44rpx;
  font-weight: 700;
  color: $uni-gray-600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.adj-btn--on {
  background: $uni-color-primary;
  color: $ai-bg-page;
  border-color: $uni-color-primary;
}

.adj-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  border: 1rpx solid $uni-border-color;
  border-radius: 16rpx;
  padding: 0 20rpx;
  background: $uni-bg-color;
}

.rule-inp {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  text-align: right;
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.rule-inp-placeholder {
  color: $uni-gray-300;
}

.inp-lb {
  font-size: 24rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

/* 按价格类型逐项说明 */
.type-desc {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.td-row {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: $uni-gray-600;
  background: $uni-bg-color-grey;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
}

.td-name {
  font-weight: 700;
  color: $uni-text-color;
}

.td-step {
  margin-left: auto;
  color: $uni-color-primary;
  font-weight: 700;
}

.td-empty {
  font-size: 24rpx;
  color: $uni-gray-400;
  text-align: center;
  padding: 12rpx 0;
  background: $uni-bg-color-grey;
  border-radius: 12rpx;
}

/* 抹零 */
.round-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed $uni-border-color;
}

.round-lb {
  font-size: 24rpx;
  color: $uni-gray-600;
  flex-shrink: 0;
}

.round-opts {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

.round-chip {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: $uni-bg-color-grey;
  font-size: 23rpx;
  font-weight: 600;
  color: $uni-gray-600;
}

.round-chip--on {
  background: $uni-color-primary;
  color: $ai-bg-page;
}

/* ── 影响试算 ── */
.trial {
  background: $zx-badge-warning-bg;
  border: 1rpx solid $zx-amber-300;
  border-radius: $uni-border-radius-base;
  padding: 26rpx;
  margin: 24rpx 28rpx 0;
}

.trial-hd {
  font-size: 26rpx;
  font-weight: 700;
  color: $zx-amber-700;
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.trial-hd-icon {
  font-size: 26rpx;
}

.trial-sub {
  margin-left: auto;
  font-size: 22rpx;
  color: $uni-gray-400;
  font-weight: 400;
}

.trial-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 25rpx;
  margin-bottom: 12rpx;
}

.trial-row .tl {
  color: $uni-gray-600;
  width: 104rpx;
  flex-shrink: 0;
}

.trial-row .ov {
  color: $uni-gray-400;
  text-decoration: line-through;
}

.trial-row .ar {
  color: $uni-gray-300;
  font-size: 22rpx;
}

.trial-row .nv {
  font-weight: 700;
  color: $uni-color-success;
}

.pc {
  margin-left: auto;
  font-size: 22rpx;
  font-weight: 700;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}

.pc--up {
  background: $zx-green-100;
  color: $zx-green-700;
}

.pc--down {
  background: $zx-red-50;
  color: $zx-red-700;
}

.trial-empty {
  font-size: 25rpx;
  color: $uni-gray-400;
  text-align: center;
  padding: 12rpx 0;
}

.trial-warn {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed $zx-amber-300;
  font-size: 24rpx;
  color: $uni-color-error;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.trial-warn-icon {
  flex-shrink: 0;
}

/* ── 商品清单 ── */
.plist {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card;
  margin: 24rpx 28rpx 0;
  overflow: hidden;
}

.plist-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 26rpx;
  border-bottom: 1rpx solid $zx-black-40;
}

.plist-title {
  font-size: 27rpx;
  font-weight: 700;
  flex: 1;
  color: $uni-text-color;
}

.plist-badge {
  font-size: 22rpx;
  font-weight: 600;
  color: $uni-color-primary;
  background: $zx-primary-80;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}

.plink {
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 600;
  padding: 8rpx 12rpx;
}

.pempty {
  text-align: center;
  padding: 72rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.pempty-t {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-500;
}

.pempty-s {
  font-size: 25rpx;
  color: $uni-gray-400;
}

.pitem {
  border-bottom: 1rpx solid $zx-black-40;
  transition: opacity 0.22s, background 0.22s;
}

.pitem:last-child {
  border-bottom: none;
}

.pitem--off {
  opacity: 0.45;
}

.pitem--warn {
  background: $zx-red-50b;
}

.pi-hd {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 22rpx 26rpx 16rpx;
}

.pi-ck {
  width: 38rpx;
  height: 38rpx;
  border-radius: 12rpx;
  border: 3rpx solid $uni-gray-300;
  flex-shrink: 0;
  margin-top: 2rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pi-ck--on {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.pi-ck-mark {
  color: $ai-bg-page;
  font-size: 22rpx;
  font-weight: 700;
  display: none;
}

.pi-ck--on .pi-ck-mark {
  display: block;
}

.pi-thumb {
  width: 68rpx;
  height: 68rpx;
  border-radius: 18rpx;
  flex-shrink: 0;
  background: $zx-primary-80;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pi-thumb-letter {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.pi-info {
  flex: 1;
  min-width: 0;
}

.pi-name {
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.35;
  color: $uni-text-color;
  word-break: break-all;
  display: block;
}

.pi-sub {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 4rpx;
}

.pi-sub text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.pi-sub-off {
  color: $uni-color-error !important;
}

.pi-stock {
  font-size: 22rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.pi-exp {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.22s;
}

.pi-exp--on {
  transform: rotate(180deg);
}

.pi-exp-arrow {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.pi-body {
  padding: 0 26rpx 22rpx 82rpx;
}

.prow {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

.prow:last-child {
  margin-bottom: 0;
}

.prow-lb {
  font-size: 24rpx;
  color: $uni-gray-600;
  width: 96rpx;
  flex-shrink: 0;
}

.prow-old {
  font-size: 26rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.prow-ar {
  color: $uni-gray-300;
  font-size: 22rpx;
  flex-shrink: 0;
}

.np-inp {
  flex: 1;
  min-width: 0;
  height: 58rpx;
  border: 1rpx solid $uni-border-color;
  border-radius: 12rpx;
  text-align: right;
  padding: 0 14rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: $uni-color-primary;
  background: $uni-bg-color;
  box-sizing: border-box;
}

.np-inp--bad {
  border-color: $uni-color-error;
  color: $uni-color-error;
  background: $zx-red-50b;
}

.np-inp-placeholder {
  color: $uni-gray-300;
}

.tag-m {
  font-size: 20rpx;
  font-weight: 700;
  color: $uni-color-warning;
  background: $zx-badge-draft-bg;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.pi-note {
  font-size: 23rpx;
  color: $uni-gray-400;
  padding: 0 26rpx 20rpx 82rpx;
}

/* ── 底部操作栏 ── */
.act-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: 0 8rpx 32rpx $zx-black-140;
  padding: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  z-index: 25;
}

.sel-all {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 25rpx;
  font-weight: 600;
  color: $uni-gray-600;
  padding: 8rpx 4rpx;
  flex-shrink: 0;
}

.sa {
  width: 38rpx;
  height: 38rpx;
  border-radius: 12rpx;
  border: 3rpx solid $uni-gray-300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sa--on {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.sa-mark {
  color: $ai-bg-page;
  font-size: 22rpx;
  font-weight: 700;
  display: none;
}

.sa--on .sa-mark {
  display: block;
}

.ab-btn {
  height: 84rpx;
  border-radius: $uni-border-radius-sm;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ab-btn--ghost {
  background: $uni-bg-color-grey;
  color: $uni-gray-600;
  flex: 1;
}

.ab-btn--primary {
  background: $uni-color-primary;
  color: $ai-bg-page;
  flex: 2;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

.ab-btn--dis {
  background: $uni-gray-300;
  color: $ai-bg-page;
  box-shadow: none;
  opacity: 0.7;
}

/* ── 弹层 ── */
.overlay {
  position: fixed;
  inset: 0;
  background: $uni-mask-bg;
  z-index: 400;
  display: flex;
  align-items: flex-end;
}

.panel {
  width: 100%;
  background: $uni-bg-color-grey;
  border-radius: 40rpx 40rpx 0 0;
  padding: 36rpx 32rpx calc(44rpx + env(safe-area-inset-bottom));
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 28rpx;
  color: $uni-text-color;
}

.panel-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 56vh;
}

.panel-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.panel-card--danger {
  background: $zx-red-50b;
  border: 1rpx solid $zx-red-100;
}

.panel-line {
  font-size: 26rpx;
  color: $uni-gray-600;
  line-height: 1.6;
  display: block;
}

.panel-strong {
  color: $uni-text-color;
  font-weight: 700;
}

.panel-strong--warn {
  color: $uni-color-warning;
}

.panel-rule {
  font-size: 25rpx;
  color: $uni-gray-600;
  margin: 16rpx 0 8rpx;
  padding: 16rpx 20rpx;
  background: $uni-bg-color-grey;
  border-radius: $uni-border-radius-sm;
}

.panel-rule--center {
  text-align: center;
}

.m-sum {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 26rpx;
  margin-top: 16rpx;
}

.m-sum-l {
  color: $uni-gray-600;
  width: 128rpx;
  flex-shrink: 0;
}

.m-sum-old {
  color: $uni-gray-400;
  text-decoration: line-through;
}

.m-sum-ar {
  color: $uni-gray-300;
  font-size: 22rpx;
}

.m-sum-new {
  font-weight: 700;
  color: $uni-color-success;
}

.panel-tip {
  font-size: 23rpx;
  color: $uni-gray-400;
  line-height: 1.5;
  background: $uni-bg-color;
  padding: 18rpx 22rpx;
  border-radius: $uni-border-radius-sm;
}

.panel-danger-line {
  font-size: 25rpx;
  color: $uni-color-error;
  line-height: 1.5;
}

.panel-ft {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}

.m-btn {
  flex: 1;
  height: 88rpx;
  border-radius: $uni-border-radius-sm;
  font-size: 29rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.m-btn--primary {
  background: $uni-color-primary;
  color: $ai-bg-page;
}

.m-btn--ghost {
  background: $uni-bg-color;
  color: $uni-gray-600;
  border: 1rpx solid $uni-border-color;
}

/* 完成弹层 */
.done-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0 20rpx;
}

.done-icon {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: $zx-green-100;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.done-icon-mark {
  font-size: 48rpx;
  font-weight: 700;
  color: $uni-color-success;
}

.done-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-success;
}

.done-sub {
  font-size: 25rpx;
  color: $uni-gray-400;
  margin-top: 12rpx;
}

/* 记录 */
.log-item {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.log-t {
  font-size: 23rpx;
  color: $uni-gray-400;
  margin-bottom: 12rpx;
}

.log-r {
  font-size: 27rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
  display: block;
  color: $uni-text-color;
}

.log-d {
  font-size: 24rpx;
  color: $uni-gray-400;
}
</style>
