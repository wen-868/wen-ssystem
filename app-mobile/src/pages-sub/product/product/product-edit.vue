<template>
  <view class="product-edit-page">
    <page-header :title="isEdit ? '编辑商品' : '新建商品'" @back="goBack" />

    <!-- 扫码命中提示条 -->
    <view v-if="libraryHit" class="library-hit-bar">
      <image class="hit-icon ic" src="/static/icons/ic/check.svg" mode="aspectFit"/>
      <text class="hit-text">已匹配平台商品库，表单已自动填充（分类需手动选择）</text>
    </view>

    <form ref="formRef" :model="form" class="edit-form">
      <!-- 主图 -->
      <view class="form-section">
        <view class="section-title">商品图片</view>
        <view class="image-upload" @tap="onChooseImage">
          <image v-if="form.mainImage" class="main-image" :src="form.mainImage" mode="aspectFill" />
          <view v-else class="image-placeholder">
            <image class="upload-icon ic" src="/static/icons/ic/upload.svg" mode="aspectFit"/>
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
            <image class="picker-arrow ic" src="/static/icons/ic/chevron-down.svg" mode="aspectFit"/>
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
              <image class="scan-icon ic" src="/static/icons/ic/scan.svg" mode="aspectFit"/>
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

    <!-- 商品分类选择弹层（R94-01：接入真实分类接口） -->
    <view v-if="categoryPickerVisible" class="category-mask" @tap="categoryPickerVisible = false">
      <view class="category-sheet" @tap.stop>
        <view class="sheet-header">
          <text class="sheet-title">选择商品分类</text>
          <text class="sheet-close" @tap="categoryPickerVisible = false">取消</text>
        </view>
        <scroll-view class="category-scroll" scroll-y>
          <view
            v-for="node in categoryTree"
            :key="node.id"
            class="category-item"
            :style="{ paddingLeft: (24 + node.level * 32) + 'rpx' }"
            @tap="onSelectCategory(node)"
          >
            <text class="category-item-name">{{ node.name }}</text>
            <text v-if="form.categoryId === node.id" class="category-item-check">✓</text>
          </view>
          <view v-if="categoryTree.length === 0 && !categoryLoading" class="category-empty">
            暂无分类，请先到商品分类创建
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { consumeLibraryFillData, scanForNewProduct } from '@/native/scan'
import { productsApi, createProduct, uploadImage, type CategoryInfo } from '@/api/modules/products'

const formRef = ref<any>(null)
/** 是否命中平台商品库（控制顶部提示条） */
const libraryHit = ref(false)
/** 是否编辑模式（暂未接入 edit 入口） */
const isEdit = ref(false)
/** 分类选择弹层状态（R94-01） */
const categoryPickerVisible = ref(false)
const categoryLoading = ref(false)
const categoryTree = ref<Array<CategoryInfo & { level: number }>>([])

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

/** 将扁平分类列表构建为层级树（parentId -> children，缩进展示） */
function buildCategoryTree(list: CategoryInfo[]): Array<CategoryInfo & { level: number }> {
  const result: Array<CategoryInfo & { level: number }> = []
  const walk = (parentId: number | undefined, level: number) => {
    list
      .filter((c) => (c.parentId ?? undefined) === parentId)
      .forEach((c) => {
        result.push({ ...c, level })
        walk(c.id, level + 1)
      })
  }
  walk(undefined, 0)
  return result
}

/** 打开分类选择弹层（R94-01：加载真实分类接口） */
async function openCategoryPicker() {
  categoryPickerVisible.value = true
  if (categoryTree.value.length > 0) return
  categoryLoading.value = true
  try {
    const list = await productsApi.categories()
    categoryTree.value = buildCategoryTree(list)
  } catch (err) {
    console.error('加载分类失败:', err)
    uni.showToast({ title: '分类加载失败', icon: 'none' })
  } finally {
    categoryLoading.value = false
  }
}

/** 选择分类并回填表单 */
function onSelectCategory(node: CategoryInfo & { level: number }) {
  form.categoryId = node.id
  form.categoryName = node.name
  categoryPickerVisible.value = false
}

/** 选择商品分类 */
function onChooseCategory() {
  openCategoryPicker()
}

/** 上传主图：选择图片后调后端 POST /admin/products/upload-image 获取真实 URL */
function onChooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths?.[0]
      if (!filePath) return
      uni.showLoading({ title: '上传中...' })
      try {
        const url = await uploadImage(filePath)
        form.mainImage = url
        uni.showToast({ title: '上传成功', icon: 'success' })
      } catch (err: any) {
        console.error('上传主图失败:', err)
        uni.showToast({ title: err?.message || '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
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

/** 提交表单：对接后端 POST /admin/products 创建商品 */
async function onSubmit() {
  const ok = await validate()
  if (!ok) {
    uni.showToast({ title: '请完善必填信息', icon: 'none' })
    return
  }
  const retailPrice = Number(form.suggestedRetailPrice) || 0
  if (retailPrice <= 0) {
    uni.showToast({ title: '请输入建议零售价', icon: 'none' })
    return
  }
  const payload = {
    name: form.name,
    categoryId: form.categoryId,
    brand: form.brandName || undefined,
    unit: form.unit || undefined,
    specs: form.specs || undefined,
    mainImage: form.mainImage || undefined,
    saleChannels: ['MINIAPP', 'STORE'],
    alcoholContent: form.alcohol ? Number(parseFloat(form.alcohol)) : undefined,
    origin: form.origin || undefined,
    description: form.description || undefined,
    skus: [
      {
        skuName: form.skuName || form.name,
        barcode: form.barcode || undefined,
        volume: form.volume || undefined,
        packaging: form.packaging || undefined,
        baseUnit: form.baseUnit || undefined,
        boxUnit: form.boxUnit || undefined,
        boxRatio: Number(form.boxRatio) || 1,
        retailPrice,
      },
    ],
  }
  uni.showLoading({ title: '提交中...' })
  try {
    await createProduct(payload)
    uni.hideLoading()
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (err) {
    uni.hideLoading()
    console.error('创建商品失败:', err)
    uni.showToast({ title: '创建失败，请稍后重试', icon: 'none' })
  }
}

onMounted(() => {
  loadLibraryFillData()
})
</script>

<style lang="scss" scoped>
.product-edit-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }

.library-hit-bar {
  margin: 16rpx 24rpx 0;
  padding: 16rpx 20rpx;
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
  border: 2rpx solid $uni-color-primary-soft;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.hit-icon { font-size: 28rpx; color: $uni-color-primary; }
.hit-text { font-size: 24rpx; color: $uni-color-primary-active; line-height: 1.5; flex: 1; }

.edit-form { padding: 0 0 $uni-spacing-lg; }
.form-section {
  margin: $uni-spacing-sm $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-md;
  padding-left: $uni-spacing-sm;
  border-left: 6rpx solid $uni-color-primary;
}
.form-item { padding: $uni-spacing-sm 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.form-item:last-child { border-bottom: none; }
.form-row {
  display: flex;
  gap: $uni-spacing-base;
}
.form-item--half { flex: 1; border-bottom: none; }
.form-label {
  display: block;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-bottom: $uni-spacing-sm;
}
.required { color: $uni-color-error; margin-right: 4rpx; }
.form-input {
  width: 100%;
  height: 72rpx;
  padding: 0 $uni-spacing-md;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  font-size: 26rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.form-input--flex { flex: 1; }
.input-placeholder { color: $uni-gray-300; }
.form-textarea {
  width: 100%;
  min-height: 200rpx;
  padding: $uni-spacing-md;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  font-size: 26rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.form-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72rpx;
  padding: 0 $uni-spacing-md;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
}
.picker-value { font-size: 26rpx; color: $uni-gray-700; }
.picker-placeholder { font-size: 26rpx; color: $uni-gray-300; }
.picker-arrow { font-size: 24rpx; color: $uni-gray-400; }

.input-with-action {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.scan-btn {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-icon { font-size: 32rpx; color: $uni-text-color-inverse; }

.image-upload {
  width: 200rpx;
  height: 200rpx;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
  background: $uni-bg-color-page;
}
.main-image { width: 100%; height: 100%; }
.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $uni-spacing-sm;
  border: 2rpx dashed $uni-gray-300;
  border-radius: $uni-border-radius-xs;
  box-sizing: border-box;
}
.upload-icon { font-size: 48rpx; color: $uni-gray-300; }
.upload-text { font-size: 22rpx; color: $uni-gray-300; }

.submit-section { padding: $uni-spacing-lg $uni-spacing-xl 0; }
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  border: none;
}
.submit-btn::after { border: none; }

.safe-bottom { height: calc(40rpx + env(safe-area-inset-bottom)); }

/* ─── 商品分类选择弹层（R94-01） ─── */
.category-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.category-sheet {
  width: 100%;
  max-height: 70vh;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm $uni-border-radius-sm 0 0;
  display: flex;
  flex-direction: column;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.sheet-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.sheet-close { font-size: 26rpx; color: $uni-gray-400; }
.category-scroll { max-height: 60vh; }
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-base $uni-spacing-lg;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.category-item-name { font-size: 28rpx; color: $uni-gray-700; }
.category-item-check { font-size: 28rpx; color: $uni-color-primary; }
.category-empty {
  padding: 60rpx $uni-spacing-lg;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-400;
}
</style>
