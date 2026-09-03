<template>
  <view class="stores-page">
    <page-header title="公司信息与门店/仓库" @back="goBack" />

    <view class="content-inner">
      <!-- 1. 公司信息（GET /admin/sys-config/tenant-info 真实数据；税号后端无列，如实显示空） -->
      <view class="pd-group">
        <view class="pd-gtitle">
          <view class="gt-bar"></view>
          <text>公司信息</text>
          <view class="gt-act" @tap="openEntEdit"><text>修改</text></view>
        </view>

        <view class="f-row">
          <text class="f-label">公司名称</text>
          <text class="f-value">{{ company.companyName || '—' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">联系人</text>
          <text class="f-value">{{ company.contactPerson || '—' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">联系电话</text>
          <text class="f-value">{{ company.contactMobile || '—' }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">营业执照</text>
          <text class="f-value">{{ company.businessLicense || '—' }}</text>
        </view>
        <view class="f-row" v-if="company.companyShortName">
          <text class="f-label">公司简称</text>
          <text class="f-value">{{ company.companyShortName }}</text>
        </view>
        <view class="f-row">
          <text class="f-label">税号</text>
          <text class="f-value">{{ company.taxNo || '—' }}</text>
        </view>
        <view class="f-row" v-if="company.legalPerson">
          <text class="f-label">法人代表</text>
          <text class="f-value">{{ company.legalPerson }}</text>
        </view>
        <view class="f-row" v-if="company.contactEmail">
          <text class="f-label">邮箱</text>
          <text class="f-value">{{ company.contactEmail }}</text>
        </view>
        <view class="f-row" v-if="company.address">
          <text class="f-label">注册地址</text>
          <text class="f-value">{{ company.address }}</text>
        </view>

        <!-- 收款银行卡（子标题，嵌套于组内；GET /admin/bank-accounts 真实数据） -->
        <view class="pd-gtitle pd-gtitle--sub">
          <view class="gt-bar"></view>
          <text>收款银行卡</text>
        </view>
        <view v-if="companyBanks.length">
          <view class="bank-row" v-for="(b, i) in companyBanks" :key="b.id ?? i">
            <text class="bank-name">{{ b.bankName || '未命名账户' }}</text>
            <text class="bank-no">{{ b.accountNo || '—' }}</text>
            <text class="bank-owner" v-if="b.accountName">{{ b.accountName }}</text>
          </view>
        </view>
        <view v-else class="bank-empty">
          <text class="bank-empty-text">暂无收款银行卡</text>
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

      <!-- 4. 门店/仓库卡片（图标色：门店橙 / 仓库青） -->
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
                <text>{{ store.contactName || '—' }}<text v-if="store.phone"> · {{ store.phone }}</text></text>
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

    <!-- 企业信息编辑弹层（真实字段） -->
    <view class="overlay" v-if="showEntEdit" @tap="showEntEdit = false">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>编辑企业信息</text></view>
        <view class="panel-body">
          <view class="form-item">
            <text class="form-label">企业名称 <text class="required">*</text></text>
            <input class="form-input" v-model="entForm.companyName" placeholder="请输入企业名称" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">企业简称</text>
            <input class="form-input" v-model="entForm.companyShortName" placeholder="用于开单/采购单抬头简称" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系人</text>
            <input class="form-input" v-model="entForm.contactPerson" placeholder="请输入联系人" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系电话</text>
            <input class="form-input" v-model="entForm.contactMobile" type="number" placeholder="请输入联系电话" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系邮箱</text>
            <input class="form-input" v-model="entForm.contactEmail" placeholder="请输入联系邮箱" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">法定代表人</text>
            <input class="form-input" v-model="entForm.legalPerson" placeholder="请输入法人姓名" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">注册地址</text>
            <input class="form-input" v-model="entForm.address" placeholder="请输入注册地址" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">营业执照</text>
            <input class="form-input" v-model="entForm.businessLicense" placeholder="统一社会信用代码" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">税号</text>
            <input class="form-input" v-model="entForm.taxNo" placeholder="纳税人识别号" placeholder-class="form-ph" />
          </view>
        </view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="showEntEdit = false"><text>取消</text></view>
          <view class="m-btn m-btn--primary" @tap="submitEntEdit"><text>保存</text></view>
        </view>
      </view>
    </view>

    <!-- 新增门店 / 仓库 -->
    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
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

async function loadCompany() {
  try {
    const info = await sysConfigApi.getTenantInfo()
    company.value = info ?? company.value
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

// —— 企业信息编辑 ——
const showEntEdit = ref(false)
const entForm = reactive({ companyName: '', companyShortName: '', contactPerson: '', contactMobile: '', contactEmail: '', legalPerson: '', address: '', businessLicense: '', taxNo: '' })
const savingEnt = ref(false)

function openEntEdit() {
  entForm.companyName = company.value.companyName ?? ''
  entForm.companyShortName = company.value.companyShortName ?? ''
  entForm.contactPerson = company.value.contactPerson ?? ''
  entForm.contactMobile = company.value.contactMobile ?? ''
  entForm.contactEmail = company.value.contactEmail ?? ''
  entForm.legalPerson = company.value.legalPerson ?? ''
  entForm.address = company.value.address ?? ''
  entForm.businessLicense = company.value.businessLicense ?? ''
  entForm.taxNo = company.value.taxNo ?? ''
  showEntEdit.value = true
}

async function submitEntEdit() {
  const name = entForm.companyName.trim()
  if (!name) {
    uni.showToast({ title: '请输入企业名称', icon: 'none' })
    return
  }
  if (savingEnt.value) return
  savingEnt.value = true
  try {
    const info = await sysConfigApi.updateTenantInfo({
      companyName: name,
      companyShortName: entForm.companyShortName.trim(),
      contactPerson: entForm.contactPerson.trim(),
      contactMobile: entForm.contactMobile.trim(),
      contactEmail: entForm.contactEmail.trim(),
      legalPerson: entForm.legalPerson.trim(),
      address: entForm.address.trim(),
      businessLicense: entForm.businessLicense.trim(),
      taxNo: entForm.taxNo.trim(),
    })
    // 保存成功后重拉 getTenantInfo（含 snake_case→camelCase 兜底映射），保证简称/法人等字段正确回显
    if (info) await loadCompany()
    showEntEdit.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err?.message || '保存失败', icon: 'none' })
  } finally {
    savingEnt.value = false
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
  uni.navigateTo({ url: '/pages-sub/admin/stores/store-edit' })
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages-sub/admin/stores/store-edit?id=${id}` })
}

loadCompany()
loadCompanyBanks()
loadList()
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.stores-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}
.content-inner { padding: $uni-spacing-base $uni-spacing-lg calc(160rpx + env(safe-area-inset-bottom)); }

/* 分组卡片（对齐原稿 .pd-group） */
.pd-group {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card;
  margin-bottom: $uni-spacing-base;
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
.pd-gtitle--sub { padding-top: 8rpx; }
.gt-bar {
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
  flex-shrink: 0;
}
.gt-act {
  margin-left: auto;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-color-primary;
  padding: 4rpx 20rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-color-primary-soft;
}

/* 字段行 */
.f-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 22rpx 32rpx;
  border-bottom: 1rpx solid $uni-border-color-light;
}
.f-row:last-child { border-bottom: none; }
.f-label {
  width: 164rpx;
  font-size: 27rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
  padding-top: 1rpx;
}
.f-value {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  color: $uni-text-color;
  text-align: right;
  word-break: break-all;
}
.f-value.ph { color: $uni-gray-400; }

/* 收款银行卡（对齐原稿 .bank-row，嵌套于组内） */
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

/* 统计（对齐原稿 .sum-row） */
.sum-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: $uni-spacing-base;
}
.sum-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: 20rpx 24rpx;
  box-shadow: $uni-shadow-card-sm;
}
.sum-lb {
  font-size: 21rpx;
  color: $uni-gray-500;
  margin-bottom: 6rpx;
  display: block;
}
.sum-vl {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: $uni-text-color;
}
.sum-vl--blue { color: $uni-color-primary; }
.sum-vl--teal { color: $zx-warehouse; }

/* Tab（对齐原稿 .sub-tabs） */
.sub-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: $uni-spacing-base;
}
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
  font-weight: 700;
  background: $uni-color-primary;
  border-color: $uni-color-primary;
  box-shadow: $uni-shadow-primary-sm;
}

/* 门店卡片（对齐原稿 .st-card） */
.st-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  margin-bottom: $uni-spacing-sm;
  overflow: hidden;
}
.stc-body {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
}
.stc-ico {
  width: 84rpx;
  height: 84rpx;
  border-radius: $uni-border-radius-base;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stc-ico--store { background: $zx-store; }
.stc-ico--wh { background: $zx-warehouse; }
.stc-ico-text {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}
.stc-main { flex: 1; min-width: 0; }
.stc-t {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}
.stc-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.ty-badge {
  font-size: 21rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: $uni-border-radius-pill;
  flex-shrink: 0;
  color: $uni-text-color-inverse;
}
.ty-store { background: $zx-store; }
.ty-wh { background: $zx-warehouse; }
.stc-sub {
  font-size: 24rpx;
  color: $uni-gray-500;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.stc-sub--addr {
  color: $uni-gray-400;
  font-size: 23rpx;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stc-tags {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
  margin-top: 10rpx;
}
.stc-tag {
  font-size: 21rpx;
  padding: 4rpx 14rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color-soft;
  color: $uni-gray-500;
  font-weight: 600;
}
.stc-tag--def { background: $uni-color-primary-soft; color: $uni-color-primary; }
.stc-tag--off { background: $uni-gray-100; color: $uni-gray-400; }
.stc-tag--code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: transparent;
  color: $uni-gray-400;
  padding: 0;
}

.empty {
  padding: 80rpx 40rpx;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-400;
}

.safe-bottom { height: 40rpx; }

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

/* 新增 FAB */
.fab-btn {
  position: fixed;
  right: 40rpx;
  bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: $uni-gradient-blue;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $uni-shadow-primary;
  z-index: 60;
}
.fab-icon {
  font-size: 56rpx;
  color: $uni-text-color-inverse;
  font-weight: 300;
}
</style>
