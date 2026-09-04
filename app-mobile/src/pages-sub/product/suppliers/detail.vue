<template>
  <view class="supplier-detail-page">
    <page-header :title="detail?.name || '供应商详情'" @back="goBack" />

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="detail" class="detail-body">
      <!-- 1. 概览（对齐原稿白卡 .ov-head / .ov-stats，非渐变 hero） -->
      <view class="pd-group">
        <view class="ov-head">
          <view class="ov-ava" :class="isOn ? '' : 'ov-ava--off'">{{ avatarText }}</view>
          <view class="ov-info">
            <view class="ov-name">
              <text class="ov-name-text">{{ detail.name }}</text>
            </view>
            <view class="ov-meta">
              <text v-if="detail.supplierCode" class="ov-code">{{ detail.supplierCode }}</text>
              <text v-if="detail.supplyType" class="ty-badge ty-sup">{{ detail.supplyType }}</text>
              <text class="st-badge" :class="isOn ? 'st-on' : 'st-off'">{{ isOn ? '合作中' : '已停用' }}</text>
            </view>
          </view>
        </view>
        <view class="ov-stats">
          <view class="ov-si">
            <text class="ov-sl">累计采购</text>
            <text class="ov-sv ov-sv--blue">¥{{ fmt(purchaseTotal) }}</text>
          </view>
          <view class="ov-si">
            <text class="ov-sl">应付账款</text>
            <text class="ov-sv" :class="payable > 0 ? 'ov-sv--warn' : 'ph'">{{ payableText }}</text>
          </view>
          <view class="ov-si">
            <text class="ov-sl">最近采购</text>
            <text class="ov-sv ov-sv--sm" :class="lastBuyText === '—' ? 'ph' : ''">{{ lastBuyText }}</text>
          </view>
        </view>
      </view>

      <!-- 2. 基本信息 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>基本信息</text></view>
        <view class="f-row" v-if="detail.supplierCode">
          <text class="f-label">供应商编码</text>
          <text class="f-value">{{ detail.supplierCode }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">供应商名称</text>
          <text class="f-value">{{ detail.name || '—' }}</text>
        </view>
        <view class="f-row" v-if="detail.shortName">
          <text class="f-label">简称</text>
          <text class="f-value">{{ detail.shortName }}</text>
        </view>
        <view class="f-row" v-if="detail.supplyType">
          <text class="f-label">分类</text>
          <text class="f-value">{{ detail.supplyType }}</text>
        </view>
      </view>

      <!-- 3. 联系人信息 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>联系人信息</text></view>
        <view class="f-row">
          <text class="f-label">联系人</text>
          <text class="f-value">{{ detail.contactPerson || '—' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">手机号</text>
          <text class="f-value f-value--link" @tap="callPhone">{{ detail.contactMobile || '—' }}</text>
        </view>
        <view class="f-row" v-if="primaryContact?.phone">
          <text class="f-label">固定电话</text>
          <text class="f-value">{{ primaryContact.phone }}</text>
        </view>
        <view class="f-row" v-if="primaryContact?.wechat">
          <text class="f-label">微信</text>
          <text class="f-value">{{ primaryContact.wechat }}</text>
        </view>
        <view class="f-row" v-if="primaryContact?.email">
          <text class="f-label">邮箱</text>
          <text class="f-value">{{ primaryContact.email }}</text>
        </view>
      </view>

      <!-- 4. 结算信息（含结算银行卡，对齐原稿嵌套于组内） -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>结算信息</text></view>
        <view class="chips-row">
          <text class="chip-chip-label">结算方式</text>
          <text
            class="chip"
            v-for="opt in settleDisplayOptions"
            :key="opt.value"
            :class="[settlementType === opt.value ? 'chip--on' : '', opt.pending ? 'chip--pending' : '']"
          >{{ opt.label }}{{ opt.pending ? '·待后端' : '' }}</text>
        </view>
        <view class="f-row" v-if="settlementDayText">
          <text class="f-label">结算日</text>
          <text class="f-value">{{ settlementDayText }}</text>
        </view>
        <!-- 账期(天)：设计稿字段(payTermDays)，后端 t_supplier 无该列 → 占位不造假；现结时按设计稿隐藏 -->
        <view class="f-row" v-if="settlementType !== 'CASH'">
          <text class="f-label">账期（天）</text>
          <text class="f-value f-value--pending">后端对接中</text>
        </view>
        <view class="f-row" v-if="taxRateText">
          <text class="f-label">税率</text>
          <text class="f-value">{{ taxRateText }}</text>
        </view>
        <!-- 付款方式：设计稿有（银行转账/现金/承兑汇票/支付宝/微信），后端 t_supplier 无 payment_method 列 → 占位不造假 -->
        <view class="f-row">
          <text class="f-label">付款方式</text>
          <text class="f-value f-value--pending">后端对接中</text>
        </view>
        <!-- 税号：设计稿有（统一社会信用代码），后端 t_supplier 无 tax_no 列 → 占位不造假 -->
        <view class="f-row">
          <text class="f-label">税号</text>
          <text class="f-value f-value--pending">后端对接中</text>
        </view>

        <!-- 结算银行卡：设计稿为「多张、可增删」；后端暂无按供应商归集的多卡接口，
             故以 BanksCard 只读展示供应商行内主卡（真实数据），多卡能力待后端。 -->
        <view class="pd-gtitle pd-gtitle--sub"><view class="gt-bar"></view><text>结算银行卡</text></view>
        <BanksCard
          v-model="bankAccounts"
          :editable="false"
          :show-head="false"
          title="结算银行卡"
          :pending-backend="true"
        />
        <text class="bank-pending-tip">设计稿支持多张，后端多卡接口对接中，当前展示主卡</text>
      </view>

      <!-- 5. 地址信息 -->
      <view class="pd-group" v-if="hasAddr">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>地址信息</text></view>
        <view class="f-row" v-if="detail.province"><text class="f-label">省份</text><text class="f-value">{{ detail.province }}</text></view>
        <view class="f-row" v-if="detail.city"><text class="f-label">城市</text><text class="f-value">{{ detail.city }}</text></view>
        <view class="f-row" v-if="detail.district"><text class="f-label">区/县</text><text class="f-value">{{ detail.district }}</text></view>
        <view class="f-row" v-if="addrDetail"><text class="f-label">详细地址</text><text class="f-value">{{ addrDetail }}</text></view>
      </view>

      <!-- 6. 标签与备注（标签取分类 supplyType，备注取 remark，均为真实字段） -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>标签与备注</text></view>
        <view class="tag-box">
          <view v-if="tags.length" class="tag-list">
            <text class="tag-item" v-for="(t, i) in tags" :key="i">{{ t }}</text>
          </view>
          <view v-else class="bank-empty">
            <text class="bank-empty-text">暂无标签</text>
          </view>
        </view>
        <view class="f-row" v-if="detail.remark">
          <text class="f-label">备注</text>
          <text class="f-value">{{ detail.remark }}</text>
        </view>
      </view>

      <!-- 7. 状态设置 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>状态设置</text></view>
        <view class="f-row f-row--static">
          <view class="f-flex">
            <text class="f-label f-label--auto">合作中</text>
            <text class="f-hint">停用后开单/采购单选不到该供应商，历史单据不受影响</text>
          </view>
          <view class="sw" :class="isOn ? 'sw--on' : ''" @tap="toggleStatus"></view>
        </view>
      </view>

      <!-- 8. 历史单据 -->
      <view class="pd-group">
        <view class="pd-gtitle">
          <view class="gt-bar"></view>
          <text>历史单据<text v-if="docRows.length">（{{ docRows.length }}）</text></text>
        </view>
        <view v-if="docRows.length">
          <view class="doc-row" v-for="d in docRows" :key="d.no" @tap="openDoc">
            <view class="doc-main">
              <text class="doc-no">{{ d.no }}</text>
              <view class="doc-sub">
                <text class="dt-type" :class="d.statusType === 'info' ? 'dt-refund' : 'dt-sale'">{{ d.sub }}</text>
                <text v-if="d.date">{{ d.date }}</text>
                <text v-if="d.status">{{ d.status }}</text>
              </view>
            </view>
            <text class="doc-amt">¥{{ fmt(d.amount) }}</text>
            <text class="doc-che">›</text>
          </view>
        </view>
        <view v-else class="empty">暂无历史单据</view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-text">供应商不存在或已失效</text>
    </view>

    <view class="safe-bottom"></view>

    <!-- 底部操作栏 -->
    <view class="action-bar" v-if="detail">
      <view class="ab-btn ab-ghost" @tap="openEdit"><text>编辑</text></view>
      <view class="ab-btn ab-primary" @tap="toggleStatus">
        <text>{{ isOn ? '停用' : '启用' }}</text>
      </view>
    </view>

    <!-- 编辑弹层 -->
    <view class="overlay" v-if="showEdit" @tap="showEdit = false">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>编辑供应商</text></view>
        <scroll-view class="panel-body" scroll-y>
          <view class="form-item">
            <text class="form-label">供应商名称 <text class="required">*</text></text>
            <input class="form-input" v-model="editForm.name" placeholder="请输入供应商名称" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">简称</text>
            <input class="form-input" v-model="editForm.shortName" placeholder="用于开单快速选择" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系人</text>
            <input class="form-input" v-model="editForm.contactPerson" placeholder="请输入联系人姓名" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系电话</text>
            <input class="form-input" v-model="editForm.contactMobile" type="number" placeholder="请输入联系电话" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">结算方式</text>
            <view class="settle-chips">
              <view
                class="settle-chip"
                v-for="opt in settleOptions"
                :key="opt.value"
                :class="{ 'settle-chip--on': editForm.settlementType === opt.value }"
                @tap="editForm.settlementType = opt.value"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="form-item" v-if="editForm.settlementType !== 'CASH'">
            <text class="form-label">结算日（每月）</text>
            <input class="form-input" v-model="editForm.settlementDay" type="number" placeholder="如 5 表示每月 5 日" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">税率（%）</text>
            <input class="form-input" v-model="editForm.taxRate" type="digit" placeholder="如 13 表示 13%" placeholder-class="form-ph" />
          </view>

          <view class="form-item">
            <text class="form-label">开户银行</text>
            <input class="form-input" v-model="editForm.bankName" placeholder="如 工商银行贵阳分行" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">银行账号</text>
            <input class="form-input" v-model="editForm.bankAccount" placeholder="结算账户卡号" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">账户名称</text>
            <input class="form-input" v-model="editForm.bankAccountName" placeholder="开户名（单位）" placeholder-class="form-ph" />
          </view>

          <view class="form-item">
            <text class="form-label">详细地址</text>
            <textarea class="form-area" v-model="editForm.address" placeholder="省 / 市 / 区 / 详细地址" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">备注</text>
            <textarea class="form-area" v-model="editForm.remark" placeholder="合作说明、账期等" placeholder-class="form-ph" />
          </view>
        </scroll-view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="showEdit = false"><text>取消</text></view>
          <view class="m-btn m-btn--primary" @tap="submitEdit"><text>保存</text></view>
        </view>
      </view>
    </view>

    <!-- 历史单据覆盖式子页 -->
    <DocPage v-model="docVisible" title="历史单据" :docs="docRows" :pending-backend="docPending" />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supplierApi, type Supplier } from '@/api/modules/suppliers'
import { purchaseApi } from '@/api/modules/purchase'
import { purchaseReturnApi } from '@/api/modules/returns'
import DocPage, { type DocRow } from '@/components/DocPage.vue'
import BanksCard, { type BankAccount } from '@/components/BanksCard.vue'

const detail = ref<Supplier | null>(null)
const supplierId = ref<number>(0)
const loading = ref(false)

/** 供应商统计（应付账款 = SUM(payable_amount)） */
const stats = ref<{ orderCount: number; totalAmount: number }>({ orderCount: 0, totalAmount: 0 })

const purchaseOrders = ref<any[]>([])
const inStocks = ref<any[]>([])
const returns = ref<any[]>([])
const purchasePending = ref(false)
const returnPending = ref(false)

const settleOptions = [
  { label: '现结', value: 'CASH' },
  { label: '月结', value: 'MONTHLY' },
  { label: '季结', value: 'QUARTERLY' },
] as const

/**
 * 详情展示用（对齐设计稿）：货到付款/预付 后端 zod 校验仅支持 CASH/MONTHLY/QUARTERLY，
 * 以禁用态「待后端」展示、不可选不造假；存量「季结」数据仍保留展示（设计稿去掉了它，但真实数据不能凭空消失）。
 */
const settleDisplayOptions = computed<{ label: string; value: string; pending?: boolean }[]>(() => {
  const base: { label: string; value: string; pending?: boolean }[] = [
    { label: '月结', value: 'MONTHLY' },
    { label: '现结', value: 'CASH' },
    { label: '货到付款', value: 'DELIVERY', pending: true },
    { label: '预付', value: 'PREPAY', pending: true },
  ]
  if (settlementType.value === 'QUARTERLY') base.push({ label: '季结', value: 'QUARTERLY' })
  return base
})

const isOn = computed(() => (detail.value?.status ?? 0) === 1)
const settlementType = computed(() => detail.value?.settlementType || '')

const avatarText = computed(() => (detail.value?.name || '供').charAt(0))

const addrDetail = computed(() => detail.value?.address || '')

const hasAddr = computed(() => {
  const d = detail.value
  if (!d) return false
  return !!(d.province || d.city || d.district || d.address)
})

/** 主联系人（getDetail 返回 contacts，is_primary 优先） */
const primaryContact = computed(() => {
  const list = detail.value?.contacts || []
  return list.find((c) => Number(c.isPrimary) === 1) || list[0] || null
})

/**
 * 结算银行卡（真实数据：存于供应商行本身 bankName/bankAccount/bankAccountName）
 * 设计稿要求「多张、可增删」，但后端暂无按供应商归集的多卡接口，
 * 故此处以 BanksCard 只读展示主卡，不伪造多卡、不开放增删。
 */
const bankAccounts = computed<BankAccount[]>({
  get() {
    const d = detail.value
    if (!d || (!d.bankName && !d.bankAccount)) return []
    return [{
      bankName: d.bankName || '—',
      accountNo: d.bankAccount || '—',
      accountName: d.bankAccountName || '',
    }]
  },
  // 只读：多卡增删待后端接口，不接受组件回写，避免写入后端无法保存的数据
  set() { /* noop */ },
})

/** 标签：以分类 supplyType 作为业务标签（后端无独立标签存储，不造假） */
const tags = computed(() => {
  const t = detail.value?.supplyType
  return t ? [t] : []
})

const settlementDayText = computed(() => {
  const day = detail.value?.settlementDay
  return day ? `每月 ${day} 日` : ''
})

const taxRateText = computed(() => {
  const r = Number(detail.value?.taxRate ?? 0)
  return r > 0 ? `${(r * 100).toFixed(1).replace(/\.0$/, '')}%` : ''
})

function fmt(n: number): string {
  const v = Number(n || 0)
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return String(d).slice(0, 16).replace('T', ' ')
}

function statusTypeOf(s?: string): DocRow['statusType'] {
  if (!s) return 'default'
  if (/完成|已入库|成功|通过|入库/.test(s)) return 'success'
  if (/待|在途|处理中/.test(s)) return 'warning'
  if (/取消|作废|失败|驳回/.test(s)) return 'danger'
  if (/退/.test(s)) return 'info'
  return 'default'
}

// —— 历史单据（合并采购单 / 采购退货，对齐原稿 .doc-row） ——
const purchaseRows = computed<DocRow[]>(() => {
  const orders = purchaseOrders.value.map((o: any) => ({
    no: o.orderNo,
    date: formatDate(o.orderDate),
    amount: Number(o.totalAmount || 0),
    status: o.status,
    statusType: statusTypeOf(o.status),
    sub: '采购单',
  }))
  const stocks = inStocks.value.map((s: any) => ({
    no: s.inStockNo,
    date: formatDate(s.inStockDate),
    amount: Number(s.totalAmount || 0),
    status: s.statusLabel || s.status,
    statusType: statusTypeOf(s.status),
    sub: '采购入库',
  }))
  return [...orders, ...stocks].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
})

const returnRows = computed<DocRow[]>(() => {
  const id = supplierId.value
  return returns.value
    .filter((r: any) => r.supplier_id === id || r.supplierId === id)
    .map((r: any) => ({
      no: r.return_no || r.returnNo || r.stock_no || r.stockNo || '',
      date: formatDate(r.createdAt || r.created_at),
      amount: Number(r.total_amount ?? r.totalAmount ?? 0),
      status: r.status || '',
      statusType: 'info' as const,
      sub: '退货单',
    }))
})

const docRows = computed<DocRow[]>(() =>
  [...returnRows.value, ...purchaseRows.value].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
)

const docPending = computed(() => purchasePending.value || returnPending.value)

// —— 概览统计（真实数据驱动，不造假） ——
// 累计采购：由真实加载的采购单据金额汇总；最近采购：由单据日期取最新。
const purchaseTotal = computed(() => purchaseRows.value.reduce((s, d) => s + Number(d.amount || 0), 0))
// 应付账款：后端 stats 接口 SUM(payable_amount)，真实数据。
const payable = computed(() => Number(stats.value?.totalAmount ?? 0))
const payableText = computed(() => (payable.value > 0 ? '¥' + fmt(payable.value) : '—'))
const lastBuyText = computed(() => {
  const dates = docRows.value.map((d) => d.date).filter(Boolean).sort().reverse()
  return dates[0] || '—'
})

// —— 历史单据覆盖式子页 ——
const docVisible = ref(false)
function openDoc() {
  docVisible.value = true
}

// —— 编辑 ——
const showEdit = ref(false)
const editForm = reactive<{
  name: string
  shortName: string
  contactPerson: string
  contactMobile: string
  settlementType: 'CASH' | 'MONTHLY' | 'QUARTERLY'
  settlementDay: string
  taxRate: string
  bankName: string
  bankAccount: string
  bankAccountName: string
  address: string
  remark: string
}>({
  name: '',
  shortName: '',
  contactPerson: '',
  contactMobile: '',
  settlementType: 'CASH',
  settlementDay: '',
  taxRate: '',
  bankName: '',
  bankAccount: '',
  bankAccountName: '',
  address: '',
  remark: '',
})

function openEdit() {
  const d = detail.value
  if (!d) return
  editForm.name = d.name || ''
  editForm.shortName = d.shortName || ''
  editForm.contactPerson = d.contactPerson || ''
  editForm.contactMobile = d.contactMobile || ''
  editForm.settlementType = (d.settlementType as any) || 'CASH'
  editForm.settlementDay = d.settlementDay ? String(d.settlementDay) : ''
  editForm.taxRate = d.taxRate ? String(Number(d.taxRate) * 100) : ''
  editForm.bankName = d.bankName || ''
  editForm.bankAccount = d.bankAccount || ''
  editForm.bankAccountName = d.bankAccountName || ''
  editForm.address = d.address || ''
  editForm.remark = d.remark || ''
  showEdit.value = true
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    uni.showToast({ title: '请输入供应商名称', icon: 'none' })
    return
  }
  try {
    await supplierApi.update(supplierId.value, {
      name: editForm.name.trim(),
      shortName: editForm.shortName.trim() || undefined,
      contactPerson: editForm.contactPerson.trim() || undefined,
      contactMobile: editForm.contactMobile.trim() || undefined,
      settlementType: editForm.settlementType,
      settlementDay: editForm.settlementDay ? Number(editForm.settlementDay) : undefined,
      taxRate: editForm.taxRate ? Number(editForm.taxRate) / 100 : undefined,
      bankName: editForm.bankName.trim() || undefined,
      bankAccount: editForm.bankAccount.trim() || undefined,
      bankAccountName: editForm.bankAccountName.trim() || undefined,
      address: editForm.address.trim() || undefined,
      remark: editForm.remark.trim() || undefined,
    })
    showEdit.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    loadDetail()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  }
}

async function toggleStatus() {
  if (!detail.value) return
  const next = detail.value.status === 1 ? 0 : 1
  const prev = detail.value.status
  detail.value = { ...detail.value, status: next }
  try {
    await supplierApi.update(supplierId.value, { status: next } as any)
    uni.showToast({ title: next === 1 ? '已启用合作' : '已停用', icon: 'none' })
  } catch (err: any) {
    detail.value = { ...detail.value, status: prev }
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
  }
}

function callPhone() {
  if (detail.value?.contactMobile) {
    uni.makePhoneCall({ phoneNumber: detail.value.contactMobile })
  }
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

async function loadDetail() {
  if (!supplierId.value) return
  loading.value = true
  try {
    const res: any = await supplierApi.getById(supplierId.value)
    detail.value = (res?.data ?? res) as Supplier
  } catch (err: any) {
    uni.showToast({ title: err?.msg || '加载供应商详情失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  if (!supplierId.value) return
  try {
    const s = await supplierApi.getStats(supplierId.value)
    stats.value = { orderCount: Number(s?.orderCount ?? 0), totalAmount: Number(s?.totalAmount ?? 0) }
  } catch {
    // 统计失败时保持 0，页面显示「—」，不造假
  }
}

async function loadPurchaseDocs() {
  const id = supplierId.value
  try {
    const [o, s] = await Promise.all([
      purchaseApi.getOrderList({ page: 1, pageSize: 50, supplierId: id }).catch(() => null),
      purchaseApi.getInStockList({ page: 1, pageSize: 50, supplierId: id }).catch(() => null),
    ])
    purchaseOrders.value = o?.list || []
    inStocks.value = s?.list || []
  } catch {
    purchasePending.value = true
  }
}

async function loadReturns() {
  try {
    const res = await purchaseReturnApi.list({ page: 1, pageSize: 50 }).catch(() => null)
    returns.value = res?.records || []
  } catch {
    returnPending.value = true
  }
}

onLoad((query: any) => {
  supplierId.value = Number(query?.id ?? 0)
  if (supplierId.value) {
    loadDetail()
    loadStats()
    loadPurchaseDocs()
    loadReturns()
  }
})
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.supplier-detail-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

/* 分组卡片（对齐原稿 .pd-group） */
.pd-group {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card;
  margin: $uni-spacing-base $uni-spacing-lg 0;
  overflow: hidden;
}
.pd-gtitle {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 32rpx 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-text-color-secondary;
}
.pd-gtitle--sub {
  padding-top: 8rpx;
}
.gt-bar {
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
  flex-shrink: 0;
}

/* 概览头（对齐原稿 .ov-head） */
.ov-head {
  display: flex;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  align-items: center;
}
.ov-ava {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
  flex-shrink: 0;
}
.ov-ava--off { background: $uni-gray-300; }
.ov-info { flex: 1; min-width: 0; }
.ov-name {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.ov-name-text {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-text-color;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: $uni-gray-500;
  flex-wrap: wrap;
}
.ov-code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-gray-400;
}
.ty-badge {
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  flex-shrink: 0;
}
.ty-sup { background: $uni-color-primary-soft; color: $uni-color-primary; }
.st-badge {
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  flex-shrink: 0;
}
.st-on { background: $zx-badge-success-bg; color: $zx-badge-success-strong; }
.st-off { background: $zx-badge-danger-bg; color: $zx-badge-danger-strong; }

.ov-stats {
  display: flex;
  border-top: 1rpx solid $uni-border-color-light;
  background: $uni-bg-color-soft;
}
.ov-si {
  flex: 1;
  padding: 20rpx 12rpx;
  text-align: center;
}
.ov-si + .ov-si { border-left: 1rpx solid $uni-border-color-light; }
.ov-sl {
  font-size: 21rpx;
  color: $uni-gray-500;
  margin-bottom: 4rpx;
  display: block;
}
.ov-sv {
  font-size: 28rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
}
.ov-sv--blue { color: $uni-color-primary; }
.ov-sv--warn { color: $zx-badge-warning-strong; }
.ov-sv--sm { font-size: 24rpx; }
.ov-sv.ph { color: $uni-gray-400; }

/* chips */
.chips-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.chip-chip-label {
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-right: 2rpx;
}
.chip {
  padding: 10rpx 24rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color-soft;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
}
.chip--on {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}
/* 设计稿有但后端未支持的选项：禁用占位态（虚线框+弱化，不可选不造假） */
.chip--pending {
  border: 1rpx dashed $uni-border-color;
  background: transparent;
  color: $uni-text-color-placeholder;
}
.bank-pending-tip {
  display: block;
  padding: 12rpx 32rpx 24rpx;
  font-size: 22rpx;
  color: $uni-text-color-placeholder;
  line-height: 1.5;
}

/* 字段行（对齐原稿 .f-row） */
.f-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.f-row:last-child { border-bottom: none; }
.f-row--static { align-items: center; }
.f-label {
  width: 164rpx;
  font-size: 27rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
  padding-top: 1rpx;
}
.f-label--auto { width: auto; flex: 1; }
.f-value {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
  word-break: break-all;
}
.f-value.ph { color: $uni-gray-400; }
.f-value--link { color: $uni-color-primary; }
/* 后端字段未就绪时占位（不造假：明示对接中，不编造数据） */
.f-value--pending { color: $uni-text-color-placeholder; }
.f-flex { flex: 1; min-width: 0; }
.f-hint {
  font-size: 22rpx;
  color: $uni-gray-500;
  margin-top: 4rpx;
  line-height: 1.4;
}

/* 结算银行卡（对齐原稿 .bank-row，嵌套于组内） */
.bank-row {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.bank-name {
  font-size: 27rpx;
  font-weight: 600;
  color: $uni-text-color;
}
.bank-no {
  font-size: 24rpx;
  color: $uni-gray-500;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.bank-owner {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.bank-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4rpx;
  padding: 20rpx 32rpx;
}
.bank-empty-text { font-size: 24rpx; color: $uni-gray-400; }
.bank-empty-hint { font-size: 20rpx; color: $uni-gray-300; }

/* 标签（对齐原稿 .tag-box） */
.tag-box {
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.tag-list { display: flex; flex-wrap: wrap; gap: 16rpx; }
.tag-item {
  display: inline-flex;
  align-items: center;
  padding: 10rpx 20rpx;
  border-radius: $uni-border-radius-sm;
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  font-size: 24rpx;
  font-weight: 600;
}

/* 开关（对齐原稿 .sw） */
.sw {
  width: 88rpx;
  height: 52rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-gray-200;
  position: relative;
  flex-shrink: 0;
  transition: background $uni-transition-normal;
}
.sw::after {
  content: '';
  position: absolute;
  top: 6rpx;
  left: 6rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $uni-bg-color;
  box-shadow: $uni-shadow-knob;
  transition: transform $uni-transition-normal;
}
.sw--on { background: $uni-color-success; }
.sw--on::after { transform: translateX(36rpx); }

/* 历史单据（对齐原稿 .doc-row） */
.doc-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.doc-row:last-child { border-bottom: none; }
.doc-main { flex: 1; min-width: 0; }
.doc-no {
  font-size: 27rpx;
  font-weight: 700;
  color: $uni-text-color;
}
.doc-sub {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $uni-gray-500;
}
.dt-type {
  font-size: 21rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: $uni-border-radius-pill;
  flex-shrink: 0;
}
.dt-sale { background: $uni-color-primary-soft; color: $uni-color-primary; }
.dt-refund { background: $uni-color-warning-soft; color: $uni-color-warning; }
.doc-amt {
  font-size: 28rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  flex-shrink: 0;
}
.doc-che {
  font-size: 32rpx;
  color: $uni-gray-300;
  flex-shrink: 0;
}

.empty {
  padding: 48rpx 40rpx;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-400;
}

/* 加载 / 空态 */
.loading-overlay {
  padding: 120rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-sm;
}
.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 24rpx; color: $uni-gray-400; }
.empty-state {
  padding: 160rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-text { font-size: 26rpx; color: $uni-gray-400; }

.safe-bottom { height: 40rpx; }

/* 底部操作栏 */
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  gap: 18rpx;
  padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-border-color;
}
.ab-btn {
  flex: 1;
  height: 88rpx;
  border-radius: $uni-border-radius-sm;
  font-size: 29rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ab-primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.ab-ghost {
  background: $uni-bg-color;
  color: $uni-gray-600;
  border: 1rpx solid $uni-border-color;
}

/* 编辑弹层 */
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
  background: $uni-bg-color;
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
.panel-body { max-height: 56vh; }
.form-item { margin-bottom: 24rpx; }
.form-label {
  display: block;
  font-size: 26rpx;
  color: $uni-gray-500;
  margin-bottom: 12rpx;
}
.required { color: $uni-color-error; }
.form-input {
  width: 100%;
  height: 84rpx;
  background: $uni-bg-color-soft;
  border-radius: $uni-border-radius-sm;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-text-color;
  box-sizing: border-box;
}
.form-ph { color: $uni-gray-300; }
.form-area {
  width: 100%;
  min-height: 140rpx;
  background: $uni-bg-color-soft;
  border-radius: $uni-border-radius-sm;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: $uni-text-color;
  box-sizing: border-box;
  line-height: 1.4;
}
.settle-chips { display: flex; gap: 16rpx; }
.settle-chip {
  flex: 1;
  height: 76rpx;
  background: $uni-bg-color-soft;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: $uni-gray-500;
  border: 2rpx solid transparent;
}
.settle-chip--on {
  background: $uni-color-primary-soft;
  border-color: $uni-color-primary;
  color: $uni-color-primary;
  font-weight: 600;
}
.panel-ft { display: flex; gap: 18rpx; margin-top: 28rpx; }
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
.m-btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.m-btn--ghost { background: $uni-bg-color; color: $uni-gray-600; border: 1rpx solid $uni-border-color; }
</style>
