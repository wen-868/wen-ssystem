<template>
  <view class="config-page">
    <page-header :title="isEdit ? '编辑等级' : '新增等级'" @back="goBack" />

    <scroll-view class="form-content" scroll-y>
      <view class="form-card">
        <view class="form-item">
          <text class="form-label">等级名称 <text class="required">*</text></text>
          <input
            class="form-input"
            v-model="form.name"
            type="text"
            placeholder="请输入等级名称"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">积分门槛 <text class="required">*</text></text>
          <view class="input-wrap">
            <input
              class="form-input"
              v-model="form.minPoints"
              type="number"
              placeholder="请输入积分门槛"
              placeholder-class="input-placeholder"
            />
            <text class="input-unit">积分</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">折扣率 <text class="required">*</text></text>
          <view class="input-wrap">
            <input
              class="form-input"
              v-model="form.discountRate"
              type="digit"
              placeholder="请输入折扣率（如 95 表示 9.5 折）"
              placeholder-class="input-placeholder"
            />
            <text class="input-unit">%</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">排序号</text>
          <input
            class="form-input"
            v-model="form.sortOrder"
            type="number"
            placeholder="请输入排序号"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea
            class="form-textarea"
            v-model="form.description"
            placeholder="请输入等级描述"
            placeholder-class="input-placeholder"
            :maxlength="500"
          />
        </view>

        <view class="form-item" v-if="isEdit">
          <text class="form-label">状态</text>
          <view class="status-switch">
            <view class="switch-label">禁用</view>
            <switch :checked="form.status === 'active'" @change="toggleStatus" />
            <view class="switch-label">启用</view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="save-btn" @tap="saveLevel">
        <text>{{ isEdit ? '保存修改' : '创建等级' }}</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { memberLevelApi, type MemberLevel } from '@/api/modules/member-levels'

const isEdit = ref(false)
const form = reactive({
  name: '',
  minPoints: '',
  discountRate: '',
  sortOrder: '0',
  description: '',
  status: 'active' as 'active' | 'disabled'
})

function goBack() {
  uni.navigateBack()
}

function toggleStatus(e: any) {
  form.status = e.detail.value ? 'active' : 'disabled'
}

async function loadDetail() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const id = Number(currentPage.options?.id)
  
  if (id) {
    isEdit.value = true
    try {
      const detail = await memberLevelApi.detail(id)
      form.name = detail.name
      form.minPoints = String(detail.minPoints)
      form.discountRate = String(detail.discountRate)
      form.sortOrder = String(detail.sortOrder)
      form.description = detail.description || ''
      form.status = detail.status
    } catch (err) {
      console.error('加载等级详情失败:', err)
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  }
}

async function saveLevel() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入等级名称', icon: 'none' })
    return
  }
  if (!form.minPoints) {
    uni.showToast({ title: '请输入积分门槛', icon: 'none' })
    return
  }
  if (!form.discountRate) {
    uni.showToast({ title: '请输入折扣率', icon: 'none' })
    return
  }

  const data: Omit<MemberLevel, 'id' | 'createdAt' | 'updatedAt'> = {
    name: form.name.trim(),
    minPoints: Number(form.minPoints),
    discountRate: Number(form.discountRate),
    sortOrder: Number(form.sortOrder),
    description: form.description.trim(),
    status: form.status
  }

  try {
    if (isEdit.value) {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as any
      const id = Number(currentPage.options?.id)
      await memberLevelApi.update(id, data)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await memberLevelApi.create(data)
      uni.showToast({ title: '创建成功', icon: 'success' })
    }
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    console.error('保存失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style lang="scss" scoped>
.config-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(20rpx + env(safe-area-inset-top));
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 36rpx;
  color: $uni-gray-700;
}

.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.header-right {
  width: 64rpx;
}

.form-content {
  padding: $uni-spacing-base;
}

.form-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.form-item {
  margin-bottom: $uni-spacing-lg;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 600;
  margin-bottom: $uni-spacing-sm;
  display: block;
}

.required {
  color: $uni-color-error;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base;
  font-size: 30rpx;
  color: $uni-gray-700;
}

.input-placeholder {
  color: $uni-gray-300;
}

.input-wrap {
  display: flex;
  align-items: center;
}

.input-wrap .form-input {
  flex: 1;
}

.input-unit {
  font-size: 28rpx;
  color: $uni-gray-400;
  margin-left: 16rpx;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: $uni-gray-50;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  font-size: 30rpx;
  color: $uni-gray-700;
}

.status-switch {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.switch-label {
  font-size: 28rpx;
  color: $uni-gray-400;
}

.bottom-bar {
  padding: 20rpx 24rpx;
  background: $uni-bg-color;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.save-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
