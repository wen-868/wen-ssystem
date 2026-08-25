<template>
  <view class="category-edit-page">
    <page-header :title="isEdit ? '编辑分类' : '新建分类'" @back="goBack" />

    <form ref="formRef" :model="form" class="category-form">
      <view class="form-section">
        <view class="form-item">
          <text class="form-label">分类名称</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.name"
              type="text"
              placeholder="请输入分类名称"
              placeholder-class="input-placeholder"
              @input="clearError('name')"
            />
          </view>
          <view class="field-error" v-if="errors.name">
            <text class="error-text">{{ errors.name }}</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">上级分类</text>
          <view class="form-control" @tap="chooseParent">
            <text class="form-value" :class="{ 'form-value--placeholder': !selectedParentName }">
              {{ selectedParentName || '无（作为顶级分类）' }}
            </text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">排序号</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.sortNo"
              type="number"
              placeholder="数字越小越靠前"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">销售设置</view>

        <view class="form-item form-item--row">
          <view class="row-left">
            <text class="form-label">允许线上销售</text>
            <text class="form-hint">禁止后该分类商品仅线下销售</text>
          </view>
          <switch :checked="form.allowOnlineSale === 1" @change="onToggleOnline" :color="COLOR_PRIMARY" />
        </view>

        <view class="form-item form-item--row">
          <view class="row-left">
            <text class="form-label">启用状态</text>
            <text class="form-hint">禁用后该分类不可使用</text>
          </view>
          <switch :checked="form.status === 1" @change="onToggleStatus" :color="COLOR_PRIMARY" />
        </view>
      </view>

      <button class="submit-btn" @tap="onSubmit">{{ isEdit ? '保存修改' : '创建分类' }}</button>
    </form>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { categoriesApi, type CategoryInfo } from '@/api/modules/categories'
import { COLOR_PRIMARY } from '@/constants/colors'

const formRef = ref<any>(null)
const isEdit = ref(false)
const editId = ref<number | null>(null)
const parentList = ref<CategoryInfo[]>([])
const selectedParentId = ref<number | null>(null)

const form = reactive({
  name: '',
  sortNo: '0',
  allowOnlineSale: 1,
  status: 1,
})

const rules: Rules = {
  name: [
    { required: true, message: '请输入分类名称' },
    { minLength: 1, message: '名称至少1个字' },
    { maxLength: 20, message: '名称最多20个字' },
  ],
}

const { errors, validate, clearError } = useFormValidation(form, rules)

const selectedParentName = computed(() => {
  if (!selectedParentId.value) return ''
  const p = parentList.value.find((c) => c.id === selectedParentId.value)
  return p?.name ?? ''
})

function onToggleOnline(e: any) {
  form.allowOnlineSale = e.detail.value ? 1 : 0
}

function onToggleStatus(e: any) {
  form.status = e.detail.value ? 1 : 0
}

function chooseParent() {
  const items = ['无（作为顶级分类）', ...parentList.value.map((c) => c.name)]
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      if (res.tapIndex === 0) {
        selectedParentId.value = null
      } else {
        selectedParentId.value = parentList.value[res.tapIndex - 1]?.id ?? null
      }
    },
  })
}

async function loadParents() {
  try {
    const list = await categoriesApi.list()
    parentList.value = list
  } catch (err) {
    console.error('加载上级分类失败:', err)
  }
}

async function loadDetail(id: number) {
  try {
    const list = await categoriesApi.list()
    const cat = list.find((c) => c.id === id)
    if (cat) {
      form.name = cat.name
      form.sortNo = String(cat.sortNo ?? cat.sortOrder ?? 0)
      form.allowOnlineSale = cat.allowOnlineSale ?? 1
      form.status = cat.status ?? 1
      selectedParentId.value = cat.parentId ?? null
    }
  } catch (err) {
    console.error('加载分类详情失败:', err)
  }
}

async function onSubmit() {
  const valid = await validate()
  if (!valid) return

  const data = {
    name: form.name,
    parentId: selectedParentId.value,
    sortNo: parseInt(form.sortNo) || 0,
    allowOnlineSale: form.allowOnlineSale,
    status: form.status,
  }

  uni.showLoading({ title: '保存中...' })
  try {
    if (isEdit.value && editId.value) {
      await categoriesApi.update(editId.value, data)
    } else {
      await categoriesApi.create(data)
    }
    uni.hideLoading()
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err) {
    uni.hideLoading()
    console.error('保存分类失败:', err)
  }
}

onLoad((options) => {
  if (options?.id) {
    isEdit.value = true
    editId.value = Number(options.id)
    loadDetail(editId.value)
  } else if (options?.parentId) {
    selectedParentId.value = Number(options.parentId)
  }
  loadParents()
})
</script>

<style lang="scss" scoped>
.category-edit-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.category-form { padding: $uni-spacing-sm $uni-spacing-base; }
.form-section {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm; box-shadow: $uni-shadow-card-sm;
}
.section-title { font-size: 26rpx; font-weight: 600; color: $uni-gray-700; margin-bottom: $uni-spacing-md; }
.form-item { margin-bottom: $uni-spacing-md; }
.form-item--row {
  display: flex; justify-content: space-between; align-items: center;
}
.form-label { font-size: 26rpx; color: $uni-gray-500; margin-bottom: $uni-spacing-xs; display: block; }
.form-hint { font-size: 22rpx; color: $uni-gray-300; display: block; }
.row-left { flex: 1; }
.form-control { position: relative; }
.form-input {
  width: 100%; height: 80rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base; font-size: 28rpx; color: $uni-gray-700; box-sizing: border-box;
}
.form-value {
  display: block; height: 80rpx; line-height: 80rpx; background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs; padding: 0 $uni-spacing-base; font-size: 28rpx; color: $uni-gray-700;
}
.form-value--placeholder { color: $uni-gray-300; font-size: 26rpx; }
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.field-error { margin-top: $uni-spacing-xs; }
.error-text { font-size: 24rpx; color: $uni-color-error; }
.submit-btn {
  width: 100%; height: 88rpx; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx; font-size: 30rpx; font-weight: 600; color: $uni-text-color-inverse; border: none; margin-top: 16rpx;
}
.submit-btn::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>

