<template>
  <view class="stores-page">
    <page-header title="公司信息与门店/仓库" @back="goBack">
      <template #right>
        <view class="hd-status" :class="coEdit ? 'hd-status--draft' : 'hd-status--saved'">
          <text>{{ coEdit ? (coDirty ? '未保存' : '编辑中') : '已保存' }}</text>
        </view>
      </template>
    </page-header>

    <view class="content-inner">
      <!-- 1. 公司信息（GET /admin/sys-config/tenant-info 真实数据；对齐原稿：只读展示，点「修改」进入行内编辑，无弹窗） -->
      <view class="pd-group">
        <view class="pd-gtitle">
          <view class="gt-bar"></view>
          <text>公司信息</text>
          <view class="gt-act" v-if="!coEdit" @tap="startCoEdit"><text>修改</text></view>
        </view>

        <view class="f-row">
          <text class="f-label">公司名称</text>
          <input v-if="coEdit" class="f-inp" v-model="company.companyName" placeholder="请输入营业执照全称" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.companyName }">{{ company.companyName || '请输入营业执照全称' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">公司简称</text>
          <input v-if="coEdit" class="f-inp" v-model="company.companyShortName" placeholder="用于单据抬头" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.companyShortName }">{{ company.companyShortName || '用于单据抬头' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">税号</text>
          <input v-if="coEdit" class="f-inp" v-model="company.taxNo" placeholder="统一社会信用代码" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !taxNoView }">{{ taxNoView || '统一社会信用代码' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">法人代表</text>
          <input v-if="coEdit" class="f-inp" v-model="company.legalPerson" placeholder="姓名" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.legalPerson }">{{ company.legalPerson || '姓名' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">联系电话</text>
          <input v-if="coEdit" class="f-inp" v-model="company.contactMobile" placeholder="如 020-8888 6666" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.contactMobile }">{{ company.contactMobile || '如 020-8888 6666' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">邮箱</text>
          <input v-if="coEdit" class="f-inp" v-model="company.contactEmail" placeholder="name@company.com" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.contactEmail }">{{ company.contactEmail || 'name@company.com' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">注册地址</text>
          <input v-if="coEdit" class="f-inp" v-model="company.address" placeholder="营业执照登记地址" placeholder-class="f-ph" />
          <text v-else class="f-val" :class="{ 'f-val--ph': !company.address }">{{ company.address || '营业执照登记地址' }}</text>
        </view>

        <!-- 收款银行卡（对齐原稿：编辑态可增加/删除，操作走真实接口） -->
        <view class="pd-gtitle pd-gtitle--sub">
          <view class="gt-bar"></view>
          <text>收款银行卡</text>
          <view class="gt-act" v-if="coEdit && !showBankAdd" @tap="showBankAdd = true"><text>+ 添加</text></view>
        </view>
        <view v-if="companyBanks.length">
          <view class="bank-row" v-for="(b, i) in companyBanks" :key="b.id ?? i">
            <view class="bank-line">
              <text class="bank-name">{{ b.bankName || '未命名账户' }}</text>
              <text class="bank-del" v-if="coEdit" @tap="removeBank(b)">删除</text>
            </view>
            <text class="bank-no">{{ b.accountNo || '—' }}</text>
            <text class="bank-owner" v-if="b.accountName">{{ b.accountName }}</text>
          </view>
        </view>
        <view v-else class="bank-empty">
          <text class="bank-empty-text">暂无收款银行卡</text>
        </view>
        <view v-if="coEdit && showBankAdd" class="bank-add">
          <view class="f-row">
            <text class="f-label">开户银行</text>
            <input class="f-inp" v-model="newBank.bankName" placeholder="如 中国银行广州分行" placeholder-class="f-ph" />
          </view>
          <view class="f-row">
            <text class="f-label">银行账号</text>
            <input class="f-inp" v-model="newBank.accountNo" placeholder="对公账号" placeholder-class="f-ph" />
          </view>
          <view class="bank-add-btns">
            <view class="ab-btn ab-btn--ghost" @tap="cancelBankAdd"><text>取消</text></view>
            <view class="ab-btn ab-btn--primary" @tap="confirmBankAdd"><text>确认添加</text></view>
          </view>
        </view>
      </view>

      <!-- 2. 统计（门店 / 仓库 / 合计，真实数据驱动） -->
      <view class="sum-row">
        <view class="sum-card">
          <text class="sum-lb">门店数量</text>
          <text class="sum-vl sum-vl--blue">{{ storeCnt }} 家</text>
        </view>
        <view class="sum-card">
          <text class="sum-lb">仓库数量</text>
          <text class="sum-vl sum-vl--teal">{{ whCnt }} 个</text>
        </view>
        <view class="sum-card">
          <text class="sum-lb">合计</text>
          <text class="sum-vl">{{ list.length }}</text>
        </view>
      </view>

      <!-- 3. Tab（全部 / 门店 / 仓库） -->
      <view class="sub-tabs">
        <view
          class="sub-tab"
          v-for="t in tabs"
          :key="t.k"
          :class="activeTab === t.k ? 'sub-tab--on' : ''"
          @tap="activeTab = t.k"
        >
          <text>{{ t.name }}</text>
        </view>
      </view>

      <!-- 4. 门店/仓库卡片 -->
      <view v-if="filteredList.length">
        <view class="st-card" v-for="store in filteredList" :key="store.id" @tap="goEdit(store.id)">
          <view class="stc-body">
            <view class="stc-ico" :class="store.type === 'warehouse' ? 'stc-ico--wh' : 'stc-ico--store'">
              <text class="stc-ico-text">{{ store.type === 'warehouse' ? '仓' : '店' }}</text>
            </view>
            <view class="stc-main">
              <view class="stc-t">
                <text class="stc-name">{{ store.name }}</text>
                <text class="ty-badge" :class="store.type === 'warehouse' ? 'ty-wh' : 'ty-store'">
                  {{ store.type === 'warehouse' ? '仓库' : '门店' }}
                </text>
              </view>
              <view class="stc-sub" v-if="store.contactName || store.phone">
                <text>{{ [store.contactName, store.phone].filter(Boolean).join(' · ') }}</text>
              </view>
              <view class="stc-sub stc-sub--addr" v-if="store.address">
                <text>{{ store.address }}</text>
              </view>
              <view class="stc-tags">
                <text class="stc-tag stc-tag--code" v-if="store.code">{{ store.code }}</text>
                <text class="stc-tag stc-tag--def" v-if="store.isDefault">默认</text>
                <text class="stc-tag stc-tag--off" v-if="store.status !== 1">已停用</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="empty">
        <text class="empty-text">暂无{{ tabLabel }}</text>
      </view>

      <view class="safe-bottom"></view>
    </view>

    <!-- 底部操作栏（对齐原稿 act-bar：编辑态=取消/保存公司信息，常态=新增门店/仓库） -->
    <view class="act-bar">
      <block v-if="coEdit">
        <view class="ab-btn ab-btn--ghost" @tap="cancelCoEdit"><text>取消</text></view>
        <view class="ab-btn ab-btn--primary" @tap="saveCompany"><text>保存公司信息</text></view>
      </block>
      <block v-else>
        <view class="ab-btn ab-btn--primary" @tap="goCreate"><text>新增门店 / 仓库</text></view>
      </block>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storesApi, bankAccountsApi, type StoreInfo, type CompanyBankAccount } from '@/api/modules/stores'
import { sysConfigApi, type TenantInfo } from '@/api/modules/sys-config'

function goBack() { uni.navigateBack() }

const loading = ref(false)
const list = ref<StoreInfo[]>([])
const company = ref<TenantInfo>({
  companyName: '', contactPerson: '', contactMobile: '', businessLicense: '',
  companyShortName: null, contactEmail: null, legalPerson: null, address: null, taxNo: null,
})
const companyBanks = ref<CompanyBankAccount[]>([])

const tabs = [
  { k: 'all', name: '全部' },
  { k: 'store', name: '门店' },
  { k: 'warehouse', name: '仓库' },
] as const
const activeTab = ref<'all' | 'store' | 'warehouse'>('all')

const storeCnt = computed(() => list.value.filter((s) => (s.type || 'store') === 'store').length)
const whCnt = computed(() => list.value.filter((s) => s.type === 'warehouse').length)
const filteredList = computed(() =>
  activeTab.value === 'all' ? list.value : list.value.filter((s) => (s.type || 'store') === activeTab.value)
)
const tabLabel = computed(() => (activeTab.value === 'store' ? '门店' : activeTab.value === 'warehouse' ? '仓库' : '门店/仓库'))

// 税号展示兜底：老数据可能存在 business_license 里（两字段同值，原稿只保留「税号」一行）
const taxNoView = computed(() => company.value.taxNo || company.value.businessLicense || '')

async function loadCompany() {
  try {
    const info = await sysConfigApi.getTenantInfo()
    company.value = info ?? company.value
    if (!company.value.taxNo && company.value.businessLicense) {
      company.value.taxNo = company.value.businessLicense
    }
    nextTick(() => { coDirty.value = false })
  } catch {
    console.error('加载企业信息失败')
  }
}

async function loadCompanyBanks() {
  try {
    const res = await bankAccountsApi.list({ page: 1, pageSize: 50 })
    companyBanks.value = res.list
  } catch {
    console.error('加载收款银行卡失败')
  }
}

// —— 收款银行卡增/删（对齐原稿编辑态；后端 POST /admin/bank-accounts + /:id/close） ——
const showBankAdd = ref(false)
const newBank = reactive({ bankName: '', accountNo: '' })

function cancelBankAdd() {
  newBank.bankName = ''
  newBank.accountNo = ''
  showBankAdd.value = false
}

async function confirmBankAdd() {
  if (!newBank.bankName.trim() || !newBank.accountNo.trim()) {
    uni.showToast({ title: '请填写开户银行和银行账号', icon: 'none' })
    return
  }
  try {
    await bankAccountsApi.create({
      bankName: newBank.bankName.trim(),
      accountNo: newBank.accountNo.trim(),
      accountName: (company.value.companyName || '').trim(),
      accountType: 'COMPANY',
    })
    uni.showToast({ title: '已添加', icon: 'success' })
    cancelBankAdd()
    loadCompanyBanks()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '添加失败', icon: 'none' })
  }
}

async function removeBank(b: CompanyBankAccount) {
  if (!b.id) return
  uni.showModal({
    title: '删除银行卡',
    content: `确认删除「${b.bankName || '未命名账户'}」？`,
    success: async (m) => {
      if (!m.confirm) return
      try {
        await bankAccountsApi.close(b.id!)
        uni.showToast({ title: '已删除', icon: 'success' })
        loadCompanyBanks()
      } catch (err: any) {
        uni.showToast({ title: err?.message || '删除失败', icon: 'none' })
      }
    },
  })
}

// —— 公司信息编辑（对齐原稿：修改进入行内编辑，头部徽标 已保存/编辑中/未保存） ——
const coEdit = ref(false)
const coDirty = ref(false)
const coSnap = ref<TenantInfo | null>(null)
const savingCompany = ref(false)

watch(company, () => { if (coEdit.value) coDirty.value = true }, { deep: true })

function startCoEdit() {
  coSnap.value = { ...company.value }
  coEdit.value = true
  coDirty.value = false
}

function cancelCoEdit() {
  if (coSnap.value) company.value = { ...coSnap.value }
  coEdit.value = false
  coDirty.value = false
}

async function saveCompany() {
  if (savingCompany.value) return
  const c = company.value
  if (!(c.companyName || '').trim()) {
    uni.showToast({ title: '请填写公司名称', icon: 'none' })
    return
  }
  savingCompany.value = true
  try {
    await sysConfigApi.updateTenantInfo({
      companyName: (c.companyName || '').trim(),
      companyShortName: (c.companyShortName || '').trim(),
      taxNo: (c.taxNo || '').trim(),
      legalPerson: (c.legalPerson || '').trim(),
      contactMobile: (c.contactMobile || '').trim(),
      contactEmail: (c.contactEmail || '').trim(),
      address: (c.address || '').trim(),
    })
    coEdit.value = false
    coDirty.value = false
    await loadCompany()
    uni.showToast({ title: '公司信息已保存', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  } finally {
    savingCompany.value = false
  }
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await storesApi.list({ page: 1, pageSize: 200 })
    list.value = result.list
  } catch (err) {
    console.error('加载门店列表失败:', err)
  } finally {
    loading.value = false
  }
}

function goCreate() {
  // 跟随列表当前 Tab 预设类型（原稿 openNew 行为）
  const t = activeTab.value === 'warehouse' ? 'WAREHOUSE' : activeTab.value === 'store' ? 'STORE' : ''
  uni.navigateTo({ url: `/pages-sub/admin/stores/store-edit${t ? `?type=${t}` : ''}` })
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages-sub/admin/stores/store-edit?id=${id}` })
}

async function initData() {
  await Promise.all([loadCompany(), loadCompanyBanks(), loadList()])
}

onShow(() => {
  // 编辑态不重拉，避免覆盖未保存内容；返回/首次进入时刷新
  if (!coEdit.value) initData()
})
</script>

<style lang="scss" scoped>
.stores-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.content-inner { padding: 14rpx 20rpx 40rpx; }

/* 头部状态徽标（对齐原稿 hd-status） */
.hd-status {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: $uni-border-radius-pill;
}
.hd-status--saved { color: $uni-color-success; background: $uni-color-success-soft; }
.hd-status--draft { color: $uni-color-warning; background: $uni-color-warning-soft; }

.pd-group {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  margin-bottom: 28rpx;
  overflow: hidden;
}
.pd-gtitle {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 32rpx 16rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-gray-600;
}
.pd-gtitle--sub { padding-top: 20rpx; }
.gt-bar {
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}
.gt-act {
  margin-left: auto;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-color-primary;
  padding: 6rpx 20rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-color-primary-soft;
}

/* 字段行（对齐原稿 f-row：只读值 / 行内输入） */
.f-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.f-row:last-child { border-bottom: none; }
.f-label {
  width: 176rpx;
  font-size: 27rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}
.f-val {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
  word-break: break-all;
}
.f-val--ph { color: $uni-gray-300; }
.f-inp {
  flex: 1;
  min-width: 0;
  height: 60rpx;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  padding: 0 20rpx;
}
.f-ph { color: $uni-gray-300; }

/* 收款银行卡 */
.bank-row {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.bank-row:last-child { border-bottom: none; }
.bank-name { font-size: 27rpx; font-weight: 600; color: $uni-text-color; }
.bank-no { font-size: 24rpx; color: $uni-gray-500; font-family: 'SF Mono', 'Fira Code', monospace; }
.bank-owner { font-size: 22rpx; color: $uni-gray-400; }
.bank-empty { padding: 20rpx 32rpx; }
.bank-empty-text { font-size: 24rpx; color: $uni-gray-400; }
.bank-line { display: flex; align-items: center; justify-content: space-between; }
.bank-del { font-size: 24rpx; font-weight: 600; color: $uni-color-error; padding: 4rpx 12rpx; }
.bank-add { border-top: 1rpx solid $uni-border-color-light; background: $uni-bg-color-page; }
.bank-add .f-row { border-bottom: none; padding: 16rpx 32rpx; }
.bank-add-btns { display: flex; gap: 16rpx; padding: 16rpx 32rpx 24rpx; }
.bank-add-btns .ab-btn { height: 68rpx; font-size: 26rpx; }

/* 统计 */
.sum-row { display: flex; gap: 16rpx; margin-bottom: $uni-spacing-base; }
.sum-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: 20rpx 24rpx;
  box-shadow: $uni-shadow-card-sm;
}
.sum-lb { font-size: 21rpx; color: $uni-gray-500; margin-bottom: 6rpx; display: block; }
.sum-vl { font-size: 32rpx; font-weight: 700; letter-spacing: -0.3px; color: $uni-text-color; }
.sum-vl--blue { color: $uni-color-primary; }
.sum-vl--teal { color: $zx-warehouse; }

/* Tab */
.sub-tabs { display: flex; gap: 12rpx; margin-bottom: $uni-spacing-base; }
.sub-tab {
  flex: 1;
  padding: 16rpx 0;
  font-size: 27rpx;
  color: $uni-gray-400;
  font-weight: 600;
  text-align: center;
  border-radius: $uni-border-radius-base;
  background: $uni-bg-color;
  border: 1rpx solid $uni-border-color-light;
  box-shadow: $uni-shadow-card-sm;
}
.sub-tab--on {
  color: $uni-text-color-inverse;
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

/* 门店/仓库卡片 */
.st-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  margin-bottom: 20rpx;
  overflow: hidden;
}
.stc-body { display: flex; gap: 24rpx; padding: 24rpx; }
.stc-ico {
  width: 84rpx;
  height: 84rpx;
  border-radius: $uni-border-radius-base;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stc-ico--store { background: $zx-badge-warning-strong; }
.stc-ico--wh { background: $zx-warehouse; }
.stc-ico-text { font-size: 34rpx; font-weight: 700; color: $uni-text-color-inverse; }
.stc-main { flex: 1; min-width: 0; }
.stc-t { display: flex; align-items: center; gap: 12rpx; margin-bottom: 6rpx; }
.stc-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ty-badge {
  font-size: 21rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  color: $uni-text-color-inverse;
  flex-shrink: 0;
}
.ty-store { background: $zx-badge-warning-strong; }
.ty-wh { background: $zx-warehouse; }
.stc-sub { font-size: 24rpx; color: $uni-gray-600; margin-bottom: 4rpx; }
.stc-sub--addr { font-size: 23rpx; color: $uni-gray-400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stc-tags { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 10rpx; }
.stc-tag {
  font-size: 21rpx;
  padding: 4rpx 14rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color-page;
  color: $uni-gray-500;
  font-weight: 600;
}
.stc-tag--code { background: transparent; color: $uni-gray-400; padding: 4rpx 0; }
.stc-tag--def { background: $uni-color-primary-soft; color: $uni-color-primary; }
.stc-tag--off { background: $uni-gray-100; color: $uni-gray-400; }

.empty { padding: 80rpx 40rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: $uni-gray-400; }

/* 底部操作栏（对齐原稿 act-bar） */
.act-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  z-index: 50;
}
.ab-btn {
  flex: 1;
  height: 80rpx;
  border-radius: $uni-border-radius-base;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
}
.ab-btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.ab-btn--ghost { background: $uni-bg-color-page; color: $uni-gray-600; flex: 0 0 auto; padding: 0 32rpx; }
.safe-bottom { height: 40rpx; }
</style>
