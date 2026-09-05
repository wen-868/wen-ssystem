<template>
  <view class="member-detail-page">
    <page-header :title="isNew ? '新增客户' : (member?.name || '客户详情')" @back="goBack" />

    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="member" class="detail-body">
      <!-- 1. 概览 -->
      <view class="pd-group">
        <view class="ov-head">
          <view class="ov-ava">{{ avatarText }}</view>
          <view class="ov-info">
            <view class="ov-name">
              <text class="ov-name-text">{{ member.name || '会员' }}</text>
              <text class="lv-badge">{{ currentLevelName }}</text>
            </view>
            <view class="ov-meta">
              <text class="ty-badge" :class="isWholesale ? 'ty-wholesale' : 'ty-retail'">{{ typeLabel }}</text>
              <text v-if="member.cardNo" class="ov-code">{{ member.cardNo }}</text>
              <text class="st-badge" :class="member.status === 1 ? 'st-on' : 'st-off'">{{ member.status === 1 ? '正常' : '已冻结' }}</text>
            </view>
          </view>
          <!-- 编辑状态徽标（对齐原稿详情头部 已保存 / 编辑中 / 未保存） -->
          <text class="hd-status" :class="editStatusCls">{{ editStatusText }}</text>
        </view>
        <view class="ov-stats">
          <view class="ov-si">
            <text class="ov-sl">可用积分</text>
            <text class="ov-sv ov-sv--gold">{{ pointBase }}</text>
          </view>
          <view class="ov-si">
            <text class="ov-sl">储值余额</text>
            <text class="ov-sv ov-sv--blue">¥{{ fmt(balance) }}</text>
          </view>
          <view class="ov-si">
            <text class="ov-sl">累计消费</text>
            <text class="ov-sv">¥{{ fmt(totalSpent) }}</text>
          </view>
        </view>
      </view>

      <!-- 2. 客户类型 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>客户类型</text></view>
        <view class="chips-row">
          <text class="chip" :class="editForm.customerType === 'WHOLESALE' ? 'chip--on' : ''" @tap="pickVal('customerType', 'WHOLESALE')">批发客户</text>
          <text class="chip" :class="editForm.customerType !== 'WHOLESALE' ? 'chip--on' : ''" @tap="pickVal('customerType', 'RETAIL')">零售客户</text>
        </view>
        <view class="f-row">
          <text class="f-label">注册日期</text>
          <text class="f-value">{{ regDate }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">最近消费</text>
          <text class="f-value" :class="member.lastConsumeAt ? '' : 'ph'">{{ lastConsumeText }}</text>
        </view>
      </view>

      <!-- 3. 会员等级（autoRetailLevel，真实数据驱动） -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>会员等级</text></view>
        <view class="lv-box">
          <view class="lv-top">
            <text class="lv-cur">{{ currentLevelName }}</text>
            <text class="lv-auto">{{ isWholesale ? '不分级' : '积分自动提升' }}</text>
          </view>

          <block v-if="!isWholesale">
            <view class="lv-prog-wrap">
              <view class="lv-prog" :style="{ width: levelProgress.percent + '%' }"></view>
            </view>
            <text class="lv-tip" v-if="nextLevel">
              累计积分 <text class="lv-strong">{{ pointBase }}</text>，距「{{ nextLevelName }}」还需
              <text class="lv-strong">{{ levelProgress.remain }}</text> 积分（{{ nextMin }} 起）
            </text>
            <text class="lv-tip" v-else>
              累计积分已达 <text class="lv-strong">{{ pointBase }}</text>，当前为最高等级「{{ currentLevelName }}」
            </text>
            <view class="lv-rule">升级规则（累计积分）：{{ ruleText }}</view>
          </block>

          <text v-else class="lv-tip">批发客户统一为「批发客户」，不区分金/银/铜牌；价格与账期在「客户类型」中体现。</text>
        </view>
      </view>

      <!-- 4. 基本信息（对齐原稿：卡号/名称/联系人(批发)/手机/性别/生日） -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>基本信息</text></view>
        <view class="f-row">
          <text class="f-label">会员卡号</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.cardNo" placeholder="如 8801 2345 6789" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.cardNo }">{{ member.cardNo || '如 8801 2345 6789' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">客户名称</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.name" :placeholder="editForm.customerType === 'WHOLESALE' ? '商号名称，如 红星商行' : '请输入姓名'" placeholder-class="f-ph" />
          <text v-else class="f-value">{{ member.name || '—' }}</text>
        </view>
        <view class="f-row" v-if="editForm.customerType === 'WHOLESALE'">
          <text class="f-label">联系人</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.contact" placeholder="对接人姓名" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.contact }">{{ member.contact || '对接人姓名' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">手机号</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.mobile" type="number" placeholder="11 位手机号" placeholder-class="f-ph" />
          <text v-else class="f-value f-value--link" @tap="callPhone">{{ member.mobile || '—' }}</text>
        </view>
        <view class="chips-row">
          <text class="chips-lb">性别</text>
          <text
            class="chip"
            v-for="g in ['男', '女', '未填写']"
            :key="g"
            :class="(editMode ? editForm.gender : (member.gender || '未填写')) === g ? 'chip--on' : ''"
            @tap="pickVal('gender', g)"
          >{{ g }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">生日</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.birthday" placeholder="如 1990-01-01" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.birthday }">{{ member.birthday || '如 1990-01-01' }}</text>
        </view>
      </view>

      <!-- 5. 地址信息 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>地址信息</text></view>
        <view class="f-row">
          <text class="f-label">省份</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.province" placeholder="如 广东省" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.province }">{{ member.province || '如 广东省' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">城市</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.city" placeholder="如 广州市" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.city }">{{ member.city || '如 广州市' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">区/县</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.district" placeholder="如 白云区" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.district }">{{ member.district || '如 白云区' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">详细地址</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.address" placeholder="街道、门牌号等" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.address }">{{ member.address || '街道、门牌号等' }}</text>
        </view>
      </view>

      <!-- 6. 账户信息 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>账户信息</text></view>
        <view class="f-row">
          <text class="f-label">可用积分</text>
          <text class="f-value f-value--gold">{{ pointBase }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">储值余额</text>
          <text class="f-value f-value--blue">¥{{ fmt(balance) }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">累计消费</text>
          <text class="f-value">¥{{ fmt(totalSpent) }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">消费次数</text>
          <text class="f-value">{{ orders.length }} 次</text>
        </view>
        <view class="f-row">
          <text class="f-label">客单价</text>
          <text class="f-value">¥{{ fmt(avgOrder) }}</text>
        </view>
      </view>

      <!-- 7. 标签与备注（对齐原稿：标签回车添加/点删 + 备注；167 迁移后 t_member 有 tags 列） -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>标签与备注</text></view>
        <view class="tag-box">
          <view class="tag-list" v-if="tagList.length">
            <view class="tag-item" v-for="(t, i) in tagList" :key="t" @tap="editMode && removeTag(i)">
              <text>{{ t }}</text><text class="tag-rm" v-if="editMode">×</text>
            </view>
          </view>
          <input
            v-if="editMode"
            class="tag-input"
            v-model="tagInput"
            placeholder="输入标签，回车添加"
            confirm-type="done"
            @confirm="addTag"
          />
          <text v-else-if="!tagList.length" class="tag-empty">暂无标签</text>
        </view>
        <view class="f-row">
          <text class="f-label">备注</text>
          <input v-if="editMode" class="f-inp" v-model="editForm.remark" placeholder="消费偏好、配送要求等" placeholder-class="f-ph" />
          <text v-else class="f-value" :class="{ 'ph': !member.remark }">{{ member.remark || '消费偏好、配送要求等' }}</text>
        </view>
      </view>

      <!-- 8. 状态设置 -->
      <view class="pd-group">
        <view class="pd-gtitle"><view class="gt-bar"></view><text>状态设置</text></view>
        <view class="f-row f-row--static">
          <view class="f-flex">
            <text class="f-label f-label--auto">账户正常</text>
            <text class="f-hint">关闭后该客户无法享受积分与储值消费</text>
          </view>
          <view class="sw" :class="member.status === 1 ? 'sw--on' : ''" @tap="toggleStatus"></view>
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
                <text class="dt-type" :class="d.statusType === 'success' ? 'dt-sale' : 'dt-refund'">{{ d.sub }}</text>
                <text v-if="d.date">{{ d.date }}</text>
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
      <text class="empty-text">会员不存在或已失效</text>
    </view>

    <view class="safe-bottom"></view>

    <!-- 账户操作（对齐原稿 act-bar：查看态=充值/调整积分/修改；编辑态=取消/保存） -->
    <view class="action-bar" v-if="member">
      <block v-if="editMode">
        <view class="ab-btn ab-ghost" @tap="cancelEdit"><text>取消</text></view>
        <view class="ab-btn ab-primary" @tap="saveEdit"><text>保存</text></view>
      </block>
      <block v-else>
        <view class="ab-btn ab-ghost" @tap="openDlg('recharge')"><text>充值</text></view>
        <view class="ab-btn ab-warn" @tap="openDlg('points')"><text>调整积分</text></view>
        <view class="ab-btn ab-primary" @tap="startEdit"><text>修改</text></view>
      </block>
    </view>

    <!-- 充值 / 调整积分 弹窗（原稿同为弹窗：标题 + 当前值 + 单输入框 + 提示 + 取消/确认） -->
    <view v-if="dlg" class="dlg-mask" @tap="closeDlg">
      <view class="dlg" @tap.stop>
        <text class="dlg-t">{{ dlg === 'recharge' ? '客户充值' : '调整积分' }}</text>
        <text v-if="dlg === 'recharge'" class="dlg-d">{{ member?.name }} · 当前余额 ¥{{ fmt(balance) }}</text>
        <text v-else class="dlg-d">{{ member?.name }} · 当前积分 {{ pointBase }}</text>
        <input
          v-if="dlg === 'recharge'"
          class="dlg-inp" v-model="dlgValue" type="digit" placeholder="0.00" placeholder-class="dlg-ph"
        />
        <input
          v-else
          class="dlg-inp" v-model="dlgValue" type="number" placeholder="0" placeholder-class="dlg-ph"
        />
        <text class="dlg-tip">{{ dlg === 'recharge' ? '输入充值金额，保存后余额实时更新' : '正数增加积分，负数扣减积分' }}</text>
        <view class="dlg-btns">
          <view class="dlg-b dlg-b--cancel" @tap="closeDlg"><text>取消</text></view>
          <view class="dlg-b dlg-b--ok" @tap="confirmDlg">
            <text>{{ dlg === 'recharge' ? '确认充值' : '确认调整' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 历史单据覆盖式子页 -->
    <DocPage v-model="docVisible" title="单据明细" :docs="docRows" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, put, post } from '@/api/request'
import { memberLevelApi, type MemberLevel } from '@/api/modules/member-levels'
import DocPage, { type DocRow } from '@/components/DocPage.vue'

interface MemberDetail {
  id: number
  name: string
  mobile: string
  customerType: string
  levelCode: string
  levelName: string
  status: number
  points: number
  totalPoints: number
  frozenPoints: number
  balance: number
  totalSpent: number
  lastConsumeAt: string | null
  createdAt: string | null
  cardNo?: string
  contactPerson?: string
  birthday?: string
  province?: string
  city?: string
  district?: string
  address?: string
  contact?: string | null
  remark?: string | null
  gender?: string | null
  tags?: string | null
}

interface MemberOrder {
  billNo: string
  storeId: number
  receivableAmount: number
  receivedAmount: number
  collectionStatus: string
  businessStatus: string
  createdAt: string
}

const member = ref<MemberDetail | null>(null)
const orders = ref<MemberOrder[]>([])
const loading = ref(false)
const memberId = ref(0)
// 新增模式（member-list FAB → ?new=1）：不加载详情，保存走 POST
const isNew = ref(false)

// 会员等级自动晋级进度（autoRetailLevel，真实数据驱动，不造假）
const levels = ref<MemberLevel[]>([])

const sortedLevels = computed(() =>
  [...levels.value].filter((l) => l.status === 'active').sort((a, b) => a.minPoints - b.minPoints)
)

// 晋级按累计积分计算（优先 totalPoints，回退 points）
const pointBase = computed(() => {
  const m = member.value
  if (!m) return 0
  return Number(m.totalPoints ?? m.points ?? 0)
})

const isWholesale = computed(() => (member.value?.customerType || '') === 'WHOLESALE')

const currentLevel = computed<MemberLevel | null>(() => {
  if (isWholesale.value) return null
  const pts = pointBase.value
  let cur: MemberLevel | null = null
  for (const l of sortedLevels.value) {
    if (pts >= l.minPoints) cur = l
    else break
  }
  return cur
})

const nextLevel = computed<MemberLevel | null>(() => {
  if (isWholesale.value) return null
  const pts = pointBase.value
  return sortedLevels.value.find((l) => pts < l.minPoints) ?? null
})

const currentLevelName = computed(() => {
  if (isWholesale.value) return '批发客户'
  return currentLevel.value?.name || member.value?.levelName || '普通会员'
})

const nextLevelName = computed(() => nextLevel.value?.name || '')
const nextMin = computed(() => nextLevel.value?.minPoints ?? 0)

const levelProgress = computed(() => {
  const cur = currentLevel.value
  const next = nextLevel.value
  const base = pointBase.value
  if (!next || !cur) return { percent: 100, remain: 0 }
  const curMin = cur.minPoints
  const span = next.minPoints - curMin
  const done = base - curMin
  const percent = span > 0 ? Math.max(0, Math.min(100, Math.round((done / span) * 100))) : 0
  const remain = Math.max(0, next.minPoints - base)
  return { percent, remain }
})

const ruleText = computed(() =>
  sortedLevels.value.map((l) => `${l.name} ${l.minPoints}+`).join('　')
)

const typeLabel = computed(() => (isWholesale.value ? '批发客户' : '零售客户'))

const avatarText = computed(() => (member.value?.name || '会').charAt(0))

const balance = computed(() => member.value?.balance ?? 0)
const totalSpent = computed(() => member.value?.totalSpent ?? 0)
const avgOrder = computed(() => {
  const t = totalSpent.value
  return orders.value.length ? Math.round((t / orders.value.length) * 100) / 100 : 0
})

const regDate = computed(() => formatDate(member.value?.createdAt) || '—')
const lastConsumeText = computed(() => formatDate(member.value?.lastConsumeAt) || '暂无')
const hasAddr = computed(() => {
  const m = member.value
  if (!m) return false
  return !!(m.province || m.city || m.district || m.address)
})

const docRows = computed<DocRow[]>(() =>
  orders.value.map((o) => ({
    no: o.billNo,
    date: formatDate(o.createdAt),
    amount: Number(o.receivableAmount || 0),
    status: orderStatusLabel(o),
    statusType: o.collectionStatus === 'PAID' ? 'success' : o.collectionStatus === 'PARTIAL' ? 'warning' : 'default',
    sub: '销售单',
  }))
)

const docVisible = ref(false)

function openDoc() {
  docVisible.value = true
}

function fmt(n: number): string {
  const v = Number(n || 0)
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function goRecharge() {
  uni.navigateTo({ url: '/pages-sub/marketing/stored-cards/stored-cards' })
}

function goPoints() {
  uni.navigateTo({ url: '/pages-sub/marketing/points/points-detail' })
}

/* ===== 行内编辑（对齐原稿：修改后字段原地变输入框，无弹窗） ===== */
const editDirty = ref(false)
const editMode = ref(false)
const editForm = ref({
  name: '', mobile: '', customerType: 'RETAIL' as string, address: '', remark: '',
  cardNo: '', contact: '', gender: '未填写', birthday: '',
  province: '', city: '', district: '', tags: '',
})
const editStatusText = computed(() => {
  if (!editMode.value) return '已保存'
  return editDirty.value ? '未保存' : '编辑中'
})

// 标签（t_member.tags 逗号分隔存储）
const tagInput = ref('')
const tagList = computed(() => {
  const src = editMode.value ? editForm.value.tags : (member.value?.tags || '')
  return (src || '').split(',').map((t) => t.trim()).filter(Boolean)
})

function addTag() {
  const v = (tagInput.value || '').trim()
  if (!v) return
  const list = tagList.value
  if (list.includes(v)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  editForm.value.tags = [...list, v].join(',')
  tagInput.value = ''
}

function removeTag(i: number) {
  const list = [...tagList.value]
  list.splice(i, 1)
  editForm.value.tags = list.join(',')
}

function pickVal(k: 'customerType' | 'gender', v: string) {
  if (!editMode.value) {
    uni.showToast({ title: '当前为只读状态，请点「修改」', icon: 'none' })
    return
  }
  ;(editForm.value as any)[k] = v
}
const editStatusCls = computed(() => (editMode.value ? 'hd-status--draft' : 'hd-status--saved'))
// 进入编辑/加载填充表单不算改动；watcher 在异步 flush 中触发，故在 nextTick 复位
watch(editForm, () => { if (editMode.value) editDirty.value = true }, { deep: true })

/* ===== 充值 / 调整积分 弹窗（严格对齐设计稿：标题+当前值+单输入框+提示+取消/确认） =====
 * 充值走真实储值卡：无卡先开卡（首充金额），有卡直接 /admin/store-value-cards/:cardNo/recharge；
 * 积分走 POST /admin/members/:id/points/adjust（正负调整，写 t_points_record）。 */
const dlg = ref<'' | 'recharge' | 'points'>('')
const dlgValue = ref('')
const dlgSubmitting = ref(false)

function openDlg(which: 'recharge' | 'points') {
  dlgValue.value = ''
  dlg.value = which
}

function closeDlg() {
  dlg.value = ''
}

async function confirmDlg() {
  if (dlgSubmitting.value) return
  const v = Number(dlgValue.value)
  if (dlgValue.value === '' || isNaN(v)) {
    uni.showToast({ title: '请输入有效数值', icon: 'none' })
    return
  }
  if (!member.value) return
  if (dlg.value === 'recharge' && v <= 0) {
    uni.showToast({ title: '充值金额需大于 0', icon: 'none' })
    return
  }
  if (dlg.value === 'points' && pointBase.value + v < 0) {
    uni.showToast({ title: '积分不能为负数', icon: 'none' })
    return
  }
  dlgSubmitting.value = true
  try {
    if (dlg.value === 'recharge') {
      const list: any = await get('/admin/store-value-cards', { customerId: memberId.value, page: 1, pageSize: 1 })
      const card = list?.records?.[0]
      if (card?.cardNo) {
        await post(`/admin/store-value-cards/${card.cardNo}/recharge`, { amount: v })
      } else {
        await post('/admin/store-value-cards', { customerId: memberId.value, customerName: member.value.name || '会员', initialAmount: v })
      }
      uni.showToast({ title: '充值成功', icon: 'success' })
    } else if (dlg.value === 'points') {
      await post(`/admin/members/${memberId.value}/points/adjust`, { points: v, type: 'ADJUST', remark: '会员管理手工调整' })
      uni.showToast({ title: '积分已调整', icon: 'success' })
    }
    dlg.value = ''
    loadDetail()
  } catch (err: any) {
    // request 层已 toast 具体失败原因
  } finally {
    dlgSubmitting.value = false
  }
}

/* ===== 修改客户（对齐原稿：行内编辑，无弹窗） ===== */

function fillEditForm(m: MemberDetail) {
  editForm.value = {
    name: m.name || '',
    mobile: m.mobile || '',
    customerType: m.customerType || 'RETAIL',
    address: m.address || '',
    remark: m.remark || '',
    cardNo: m.cardNo || '',
    contact: m.contact || '',
    gender: m.gender || '未填写',
    birthday: m.birthday || '',
    province: m.province || '',
    city: m.city || '',
    district: m.district || '',
    tags: m.tags || '',
  }
}

function startEdit() {
  const m = member.value
  if (!m) return
  fillEditForm(m)
  editMode.value = true
  nextTick(() => { editDirty.value = false })
}

function cancelEdit() {
  if (isNew.value) {
    // 新增模式取消 = 放弃新建，返回列表
    setTimeout(() => uni.navigateBack(), 120)
    return
  }
  if (member.value) fillEditForm(member.value)
  editMode.value = false
  dirtyReset()
}

function dirtyReset() {
  editDirty.value = false
}

async function saveEdit() {
  if (!editForm.value.name.trim()) {
    uni.showToast({ title: '请填写客户名称', icon: 'none' })
    return
  }
  if (!editForm.value.mobile.trim()) {
    uni.showToast({ title: '请填写手机号', icon: 'none' })
    return
  }
  const payload = {
    name: editForm.value.name.trim(),
    mobile: editForm.value.mobile.trim(),
    customerType: editForm.value.customerType,
    address: editForm.value.address.trim(),
    remark: editForm.value.remark.trim(),
    cardNo: editForm.value.cardNo.trim(),
    contact: editForm.value.contact.trim(),
    gender: editForm.value.gender || '未填写',
    birthday: editForm.value.birthday.trim(),
    province: editForm.value.province.trim(),
    city: editForm.value.city.trim(),
    district: editForm.value.district.trim(),
    tags: tagList.value.join(','),
  }
  try {
    if (isNew.value) {
      await post('/store/members/manage', payload)
      uni.showToast({ title: '新增成功', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 600)
      return
    }
    if (!member.value) return
    await put(`/store/members/${memberId.value}`, payload)
    editMode.value = false
    uni.showToast({ title: '已保存', icon: 'none' })
    loadDetail()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
  }
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return String(d).slice(0, 16).replace('T', ' ')
}

function orderStatusLabel(order: MemberOrder): string {
  const s = order.businessStatus || ''
  if (s === 'VOIDED') return '已作废'
  if (s === 'DRAFT') return '暂存'
  const c = order.collectionStatus || ''
  if (c === 'PAID') return '已收款'
  if (c === 'PARTIAL') return '部分收款'
  return '待收款'
}

function callPhone() {
  if (member.value?.mobile) {
    uni.makePhoneCall({ phoneNumber: member.value.mobile })
  }
}

async function toggleStatus() {
  if (!member.value) return
  const next = member.value.status === 1 ? 0 : 1
  const prev = member.value.status
  member.value = { ...member.value, status: next }
  try {
    await put(`/store/members/${memberId.value}`, { status: next })
    uni.showToast({ title: next === 1 ? '账户已恢复正常' : '账户已冻结', icon: 'none' })
  } catch (err) {
    member.value = { ...member.value, status: prev }
    uni.showToast({ title: '状态更新失败', icon: 'none' })
  }
}

async function loadDetail() {
  if (!memberId.value) return
  loading.value = true
  try {
    const res: any = await get(`/store/members/${memberId.value}`)
    member.value = (res?.data ?? res) as MemberDetail
  } catch (err: any) {
    uni.showToast({ title: err?.msg || '加载会员详情失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadOrders() {
  if (!memberId.value) return
  try {
    const res: any = await get(`/store/members/${memberId.value}/orders`, { page: 1, pageSize: 10 })
    const data = res?.data ?? res ?? {}
    orders.value = data.records ?? []
  } catch (err) {
    console.error('加载会员订单失败:', err)
  }
}

async function loadLevels() {
  try {
    const res = await memberLevelApi.list({ page: 1, pageSize: 100 })
    levels.value = res.list ?? []
  } catch (err) {
    console.error('加载会员等级配置失败:', err)
  }
}

onLoad((query: any) => {
  if (query?.new === '1') {
    // 新增模式（对齐原稿 openNew）：详情页直接以可编辑空表单呈现，无弹窗
    isNew.value = true
    member.value = {
      id: 0, name: '', mobile: '', customerType: 'RETAIL', levelCode: '', levelName: '',
      status: 1, points: 0, totalPoints: 0, frozenPoints: 0, balance: 0, totalSpent: 0,
      lastConsumeAt: null, createdAt: null,
    }
    fillEditForm(member.value)
    editMode.value = true
    editDirty.value = false
    loadLevels()
    return
  }
  memberId.value = Number(query?.id ?? 0)
  loadDetail()
  loadOrders()
  loadLevels()
})
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.member-detail-page {
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
.lv-badge {
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
  flex-shrink: 0;
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
.ty-wholesale { background: $uni-color-primary-soft; color: $uni-color-primary; }
.ty-retail { background: $uni-color-warning-soft; color: $uni-color-warning; }
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
.ov-sv--gold { color: $zx-badge-warning-strong; }
.ov-sv--blue { color: $uni-color-primary; }

/* chips */
.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.chip {
  padding: 12rpx 26rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color-soft;
  font-size: 25rpx;
  font-weight: 600;
  color: $uni-gray-500;
}
.chip--on {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
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
}
.f-value.ph { color: $uni-gray-400; }
.f-value--link { color: $uni-color-primary; }
.f-value--pending { color: $uni-text-color-placeholder; }
.f-value--gold { color: $zx-badge-warning-strong; font-weight: 700; }
.f-value--blue { color: $uni-color-primary; font-weight: 700; }
.f-flex { flex: 1; min-width: 0; }
.f-hint {
  font-size: 22rpx;
  color: $uni-gray-500;
  margin-top: 4rpx;
  line-height: 1.4;
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
  background: $ai-bg-page;
  box-shadow: 0 2rpx 6rpx $zx-black-200;
  transition: transform $uni-transition-normal;
}
.sw--on { background: $uni-color-success; }
.sw--on::after { transform: translateX(36rpx); }

/* 会员等级盒（对齐原稿 .lv-box / .lv-prog） */
.lv-box { padding: 24rpx 32rpx; }
.lv-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.lv-cur {
  font-size: 30rpx;
  font-weight: 700;
  flex: 1;
  color: $uni-text-color;
}
.lv-auto {
  font-size: 21rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  flex-shrink: 0;
}
.lv-prog-wrap {
  height: 12rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-gray-100;
  overflow: hidden;
  margin-bottom: 16rpx;
}
.lv-prog {
  height: 100%;
  border-radius: $uni-border-radius-pill;
  background: $uni-color-primary;
  transition: width $uni-transition-slow;
}
.lv-tip {
  font-size: 23rpx;
  color: $uni-gray-500;
  line-height: 1.5;
}
.lv-strong { color: $zx-badge-warning-strong; font-weight: 700; }
.lv-rule {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed $uni-border-color-light;
  font-size: 22rpx;
  color: $uni-gray-400;
  line-height: 1.6;
}

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

/* 编辑状态徽标（对齐原稿详情头部：已保存 / 编辑中 / 未保存） */
.hd-status {
  font-size: 21rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  flex-shrink: 0;
}
.hd-status--saved { background: $zx-badge-success-bg; color: $zx-badge-success-strong; }
.hd-status--draft { background: $uni-color-warning-soft; color: $uni-color-warning; }

/* 充值 / 调整积分 / 修改 弹窗（严格对齐设计稿 dlg 居中对话框） */
.dlg-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: $zx-black-200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 60rpx;
}
.dlg {
  width: 100%;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 32rpx;
}
.dlg--edit {
  max-height: 80vh;
  overflow-y: auto;
}
.dlg-t {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-text-color;
  text-align: center;
}
.dlg-d {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $uni-gray-500;
  text-align: center;
}
.dlg-inp {
  margin-top: 24rpx;
  width: 100%;
  height: 80rpx;
  border-radius: $uni-border-radius-sm;
  background: $uni-bg-color-soft;
  padding: 0 24rpx;
  font-size: 29rpx;
  color: $uni-text-color;
  text-align: center;
}
.dlg-ph { color: $uni-gray-300; }
/* 客户类型选择 chips（新增/编辑弹层） */
.dlg-chips { display: flex; gap: 16rpx; flex: 1; }
.dlg-chip {
  flex: 1;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: $uni-gray-500;
  border: 2rpx solid transparent;
}
.dlg-chip--on {
  background: rgba(37, 99, 235, 0.08);
  border-color: $uni-color-primary;
  color: $uni-color-primary;
  font-weight: 600;
}
.dlg-tip {
  display: block;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $uni-gray-400;
  text-align: center;
  line-height: 1.5;
}
.dlg-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}
.dlg-b {
  flex: 1;
  height: 80rpx;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
}
.dlg-b--cancel {
  background: $uni-bg-color-soft;
  color: $uni-gray-600;
}
.dlg-b--ok {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}
.dlg-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.dlg-row:last-of-type { border-bottom: none; }
.dlg-lb {
  width: 150rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}
.dlg-inp--row {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
}
.ab-warn {
  background: $uni-color-warning-soft;
  color: $uni-color-warning;
}
</style>
