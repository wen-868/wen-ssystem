<template>
  <view class="product-edit-page">
    <view class="page-header">
      <text class="header-title">{{ isEdit ? '编辑商品' : '新建商品' }}</text>
    </view>

    <!-- 扫码命中提示条 -->
    <view v-if="libraryHit" class="library-hit-bar">
      <text class="hit-icon">&#xe642;</text>
      <text class="hit-text">已匹配平台商品库，表单已自动填充（分类需手动选择）</text>
    </view>

    <form ref="formRef" :model="form" class="edit-form">
      <!-- 主图 -->
      <view class="form-section">
        <view class="section-title">商品图片</view>
        <view class="image-upload" @tap="onChooseImage">
          <image v-if="form.mainImage" class="main-image" :src="form.mainImage" mode="aspectFill" />
          <view v-else class="image-placeholder">
            <text class="upload-icon">&#xe619;</text>
            <text class="upload-text">点击上传主图</text>
          </view>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="form-section">
        <view class="section-title">基本信息</view>

        <view class="form-item">
          <text class="form-label"><text class="required">*</text>商品名称</text>
          <input
            class="form-input"
            v-model="form.name"
            placeholder="请输入商品名称"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">品牌</text>
          <input
            class="form-input"
            v-model="form.brandName"
            placeholder="请输入品牌"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">规格</text>
          <input
            class="form-input"
            v-model="form.specs"
            placeholder="如：500ml*6瓶"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">单位</text>
          <input
            class="form-input"
            v-model="form.unit"
            placeholder="如：瓶、箱、盒"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label"><text class="required">*</text>商品分类</text>
          <view class="form-picker" @tap="onChooseCategory">
            <text :class="form.categoryName ? 'picker-value' : 'picker-placeholder'">
              {{ form.categoryName || '请选择分类' }}
            </text>
            <text class="picker-arrow">&#xe612;</text>
          </view>
        </view>
      </view>

      <!-- 酒类扩展信息 -->
      <view class="form-section">
        <view class="section-title">酒类信息</view>

        <view class="form-item">
          <text class="form-label">酒精度</text>
          <input
            class="form-input"
            v-model="form.alcohol"
            placeholder="如：53%vol"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">产地</text>
          <input
            class="form-input"
            v-model="form.origin"
            placeholder="如：贵州仁怀"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">香型</text>
          <input
            class="form-input"
            v-model="form.aroma"
            placeholder="如：酱香型、浓香型"
            placeholder-class="input-placeholder"
          />
        </view>
      </view>

      <!-- SKU 信息 -->
      <view class="form-section">
        <view class="section-title">SKU 信息</view>

        <view class="form-item">
          <text class="form-label">SKU 名称</text>
          <input
            class="form-input"
            v-model="form.skuName"
            placeholder="如：茅台飞天53度500ml"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">条码</text>
          <view class="input-with-action">
            <input
              class="form-input form-input--flex"
              v-model="form.barcode"
              placeholder="请扫描或输入条码"
              placeholder-class="input-placeholder"
            />
            <view class="scan-btn" @tap="onScanBarcode">
              <text class="scan-icon">&#xe634;</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">建议零售价</text>
          <input
            class="form-input"
            v-model="form.suggestedRetailPrice"
            type="digit"
            placeholder="0.00"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">容量</text>
          <input
            class="form-input"
            v-model="form.volume"
            placeholder="如：500ml"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-item">
          <text class="form-label">包装</text>
          <input
            class="form-input"
            v-model="form.packaging"
            placeholder="如：箱装、盒装"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-row">
          <view class="form-item form-item--half">
            <text class="form-label">基础单位</text>
            <input
              class="form-input"
              v-model="form.baseUnit"
              placeholder="如：瓶"
              placeholder-class="input-placeholder"
            />
          </view>
          <view class="form-item form-item--half">
            <text class="form-label">箱单位</text>
            <input
              class="form-input"
              v-model="form.boxUnit"
              placeholder="如：箱"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">箱规（每箱数量）</text>
          <input
            class="form-input"
            v-model="form.boxRatio"
            type="number"
            placeholder="如：6"
            placeholder-class="input-placeholder"
          />
        </view>
      </view>

      <!-- 商品简介 -->
      <view class="form-section">
        <view class="section-title">商品简介</view>
        <textarea
          class="form-textarea"
          v-model="form.description"
          placeholder="请输入商品简介"
          placeholder-class="input-placeholder"
          :maxlength="500"
          :auto-height="true"
        />
      </view>

      <!-- 提交按钮 -->
      <view class="submit-section">
        <button class="submit-btn" @tap="onSubmit">
          {{ isEdit ? '保存修改' : '创建商品' }}
        </button>
      </view>

      <view class="safe-bottom"></view>
    </form>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { consumeLibraryFillData, scanForNewProduct } from '@/native/scan'
import { productsApi, type CategoryInfo } from '@/api/modules/products'

const formRef = ref<any>(null)
/** 是否命中平台商品库（控制顶部提示条） */
const libraryHit = ref(false)
/** 是否编辑模式（暂未接入 edit 入口） */
const isEdit = ref(false)

const form = reactive({
  // 基本信息
  name: '',
  brandName: '',
  specs: '',
  unit: '',
  mainImage: '',
  categoryId: undefined as number | undefined,
  categoryName: undefined as string | undefined,
  // 酒类信息（从 properties 解析）
  alcohol: '',
  origin: '',
  aroma: '',
  // SKU 信息
  skuName: '',
  barcode: '',
  suggestedRetailPrice: '',
  volume: '',
  packaging: '',
  baseUnit: '',
  boxUnit: '',
  boxRatio: '' as string | number,
  // 简介
  description: '',
})

const formRules: Rules = {
  name: [{ required: true, message: '请输入商品名称' }],
  categoryId: [{ required: true, message: '请选择商品分类' }],
}
const { errors, validate } = useFormValidation(form, formRules)

/** 平台商品库 properties 解析：提取酒精度/产地/香型 */
function parseProperties(raw: unknown): { alcohol?: string; origin?: string; aroma?: string } {
  if (!raw) return {}
  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  } else if (typeof raw === 'object' && raw !== null) {
    obj = raw as Record<string, unknown>
  } else {
    return {}
  }
  return {
    alcohol: obj.alcohol != null ? String(obj.alcohol) : undefined,
    origin: obj.origin != null ? String(obj.origin) : undefined,
    aroma: obj.aroma != null ? String(obj.aroma) : undefined,
  }
}

/** 加载平台商品库预填充数据 */
function loadLibraryFillData() {
  const data = consumeLibraryFillData()
  if (!data) return
  libraryHit.value = true

  // 基本信息（命中平台商品库）
  if (data.name != null) form.name = String(data.name)
  if (data.brandName != null) form.brandName = String(data.brandName)
  if (data.specs != null) form.specs = String(data.specs)
  if (data.unit != null) form.unit = String(data.unit)
  if (data.mainImage != null) form.mainImage = String(data.mainImage)
  if (data.description != null) form.description = String(data.description)
  if (data.suggestedRetailPrice != null) form.suggestedRetailPrice = String(data.suggestedRetailPrice)

  // category 字段故意留空不填充（平台商品库不含商户自定义分类）
  // form.categoryId / form.categoryName 保持 undefined，用户手动选择

  // 酒类扩展属性（从 properties 解析）
  const parsed = parseProperties(data.properties)
  if (parsed.alcohol) form.alcohol = parsed.alcohol
  if (parsed.origin) form.origin = parsed.origin
  if (parsed.aroma) form.aroma = parsed.aroma

  // SKU 信息
  const sku = (data.sku || {}) as Record<string, unknown>
  if (sku.skuName != null) form.skuName = String(sku.skuName)
  if (sku.barcode != null) form.barcode = String(sku.barcode)
  if (sku.volume != null) form.volume = String(sku.volume)
  if (sku.packaging != null) form.packaging = String(sku.packaging)
  if (sku.baseUnit != null) form.baseUnit = String(sku.baseUnit)
  if (sku.boxUnit != null) form.boxUnit = String(sku.boxUnit)
  if (sku.boxRatio != null && sku.boxRatio !== '') form.boxRatio = String(sku.boxRatio)
}

/** 选择商品分类（简单实现：跳转分类列表） */
function onChooseCategory() {
  uni.showToast({ title: '分类选择开发中', icon: 'none' })
}

/** 上传主图 */
function onChooseImage() {
  uni.showToast({ title: '图片上传开发中', icon: 'none' })
}

/** 点击条码旁扫码按钮（复用新建商品流程扫码） */
async function onScanBarcode() {
  try {
    await scanForNewProduct({ title: '扫一扫商品条码' })
    // scanForNewProduct 内部已跳转并重新加载本页，这里不需要额外处理
  } catch (err) {
    console.error('[product-edit] 扫码失败:', err)
  }
}

/** 提交表单（占位，后续对接创建商品 API） */
async function onSubmit() {
  const ok = await validate()
  if (!ok) {
    uni.showToast({ title: '请完善必填信息', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认提交',
    content: '确认创建商品？（提交功能待对接后端 API）',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 800)
      }
    }
  })
}

onMounted(() => {
  loadLibraryFillData()
})
</script>

<style scoped>
.product-edit-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.library-hit-bar {
  margin: 16rpx 24rpx 0;
  padding: 16rpx 20rpx;
  background: linear-gradient(135deg, #e6f7ff, #f0f5ff);
  border: 2rpx solid #91d5ff;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.hit-icon { font-size: 28rpx; color: #1677FF; }
.hit-text { font-size: 24rpx; color: #0050b3; line-height: 1.5; flex: 1; }

.edit-form { padding: 0 0 32rpx; }
.form-section {
  margin: 16rpx 24rpx 0;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-left: 12rpx;
  border-left: 6rpx solid #1677FF;
}
.form-item { padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.form-item:last-child { border-bottom: none; }
.form-row {
  display: flex;
  gap: 24rpx;
}
.form-item--half { flex: 1; border-bottom: none; }
.form-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 12rpx;
}
.required { color: #ff4d4f; margin-right: 4rpx; }
.form-input {
  width: 100%;
  height: 72rpx;
  padding: 0 20rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333;
  box-sizing: border-box;
}
.form-input--flex { flex: 1; }
.input-placeholder { color: #bbb; }
.form-textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333;
  box-sizing: border-box;
}
.form-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72rpx;
  padding: 0 20rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
}
.picker-value { font-size: 26rpx; color: #333; }
.picker-placeholder { font-size: 26rpx; color: #bbb; }
.picker-arrow { font-size: 24rpx; color: #999; }

.input-with-action {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.scan-btn {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-icon { font-size: 32rpx; color: #fff; }

.image-upload {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: #f7f9fc;
}
.main-image { width: 100%; height: 100%; }
.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 2rpx dashed #d9d9d9;
  border-radius: 16rpx;
  box-sizing: border-box;
}
.upload-icon { font-size: 48rpx; color: #bbb; }
.upload-text { font-size: 22rpx; color: #bbb; }

.submit-section { padding: 32rpx 48rpx 0; }
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  border: none;
}
.submit-btn::after { border: none; }

.safe-bottom { height: calc(40rpx + env(safe-area-inset-bottom)); }
</style>
