<template>
  <view class="product-detail-page">
    <view class="product-gallery">
      <image class="product-image" :src="product.image" mode="aspectFill" />
      <view class="product-status-tag" v-if="product.status">
        <text class="status-text">{{ product.statusLabel }}</text>
      </view>
      <view class="offline-badge" v-if="product.allowOnlineSale === 0">
        <text class="offline-badge-text">仅线下销售</text>
      </view>
    </view>

    <view class="info-section">
      <view class="section-title">基本信息</view>
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">商品名称</text>
          <text class="info-value">{{ product.name }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">商品编码</text>
          <text class="info-value">{{ product.skuCode }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">分类</text>
          <text class="info-value">{{ product.categoryName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">品牌</text>
          <text class="info-value">{{ product.brandName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">规格</text>
          <text class="info-value">{{ product.spec }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">单位</text>
          <text class="info-value">{{ product.unit }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">线上销售</text>
          <text class="info-value" :class="{ 'info-value--danger': product.allowOnlineSale === 0 }">
            {{ product.allowOnlineSale === 0 ? '禁止（仅线下）' : '允许' }}
          </text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <view class="section-title">价格信息</view>
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">零售价</text>
          <text class="info-value info-value--price">¥{{ product.retailPrice }}</text>
        </view>
        <view class="info-row" v-if="isWholesaleCustomer()">
          <text class="info-label">批发价</text>
          <text class="info-value info-value--price info-value--wholesale">¥{{ product.wholesalePrice }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">成本价</text>
          <text class="info-value">¥{{ product.costPrice }}</text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <view class="section-title">库存信息</view>
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">当前库存</text>
          <text class="info-value info-value--stock">{{ product.stockQuantity }} {{ product.unit }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">安全库存</text>
          <text class="info-value">{{ product.safetyStock }} {{ product.unit }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">仓库</text>
          <text class="info-value">{{ product.warehouseName }}</text>
        </view>
      </view>
    </view>

    <view class="info-section">
      <view class="section-title">库存调整</view>
      <form ref="formRef" :model="adjustForm" class="adjust-form">
        <view class="form-item">
          <text class="form-label">调整类型</text>
          <view class="form-control">
            <picker :range="adjustTypeOptions" :range-key="'label'" @change="onAdjustTypeChange">
              <view class="picker-value">
                <text>{{ adjustTypeLabel }}</text>
                <image class="picker-arrow ic" src="/static/icons/ic/chevron-down.svg" mode="aspectFit"/>
              </view>
            </picker>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">调整数量</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="adjustForm.quantity"
              type="number"
              placeholder="请输入调整数量"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">备注</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="adjustForm.remark"
              type="text"
              placeholder="请输入备注"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <text class="error-text" v-if="errors.quantity">{{ errors.quantity }}</text>
        <button class="submit-btn" @tap="onSubmitAdjust">确认调整</button>
      </form>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { isWholesaleCustomer } from '@/utils/price'
import { productsApi } from '@/api/modules/products'

const formRef = ref<any>(null)
const adjustForm = reactive({
  adjustType: 'in',
  quantity: '',
  remark: '',
})
const adjustRules: Rules = {
  quantity: [
    { required: true, message: '请输入调整数量' },
    { validator: (v: any) => Number(v) >= 1, message: '数量至少为1' },
  ],
}
const { errors, validate, clearError } = useFormValidation(adjustForm, adjustRules)

const adjustTypeOptions = [
  { label: '入库', value: 'in' },
  { label: '出库', value: 'out' },
  { label: '盘点', value: 'check' },
]
const adjustTypeLabel = ref('入库')

const product = ref<any>({
  id: 0,
  name: '',
  skuCode: '',
  categoryName: '',
  brandName: '',
  spec: '',
  unit: '瓶',
  image: '',
  retailPrice: '0.00',
  wholesalePrice: '0.00',
  costPrice: '0.00',
  stockQuantity: 0,
  safetyStock: 0,
  warehouseName: '',
  status: 'on_sale',
  statusLabel: '在售',
  allowOnlineSale: 1,
})

function onAdjustTypeChange(e: any) {
  const idx = e.detail.value
  adjustForm.adjustType = adjustTypeOptions[idx].value
  adjustTypeLabel.value = adjustTypeOptions[idx].label
}

async function onSubmitAdjust() {
  const valid = await validate()
  if (!valid) return
  uni.showModal({
    title: '确认调整',
    content: `确认${adjustTypeLabel.value} ${adjustForm.quantity} ${product.value.unit}？`,
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '调整成功', icon: 'success' })
        adjustForm.quantity = ''
        adjustForm.remark = ''
      }
    }
  })
}

async function loadProduct(id: number) {
  try {
    const res = await productsApi.detail(id)
    Object.assign(product.value, res)
  } catch (err) {
    console.error('加载商品详情失败:', err)
  }
}

onLoad((options: any) => {
  const id = options?.id ? Number(options.id) : 0
  if (id > 0) {
    loadProduct(id)
  }
  uni.setNavigationBarTitle({ title: '商品详情' })
})
</script>

<style lang="scss" scoped>
.product-detail-page { min-height: 100vh; background: $uni-color-primary-soft; }
.product-gallery {
  width: 100%;
  height: 400rpx;
  background: $uni-bg-color;
  position: relative;
}
.product-image { width: 100%; height: 100%; background: $uni-bg-color-grey; }
.product-status-tag {
  position: absolute;
  top: 24rpx; right: 24rpx;
  padding: 8rpx 20rpx;
  background: rgba(0,0,0,0.6);
  border-radius: 20rpx;
}
.status-text { font-size: 22rpx; color: $uni-text-color-inverse; }
.offline-badge {
  position: absolute;
  bottom: 24rpx; left: 24rpx;
  padding: 8rpx 20rpx;
  background: rgba(255, 77, 79, 0.9);
  border-radius: 8rpx;
}
.offline-badge-text { font-size: 22rpx; color: $uni-text-color-inverse; font-weight: 500; }
.info-value--danger { color: $uni-color-error; font-weight: 600; }
.info-section { padding: $uni-spacing-base; }
.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
}
.info-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-sm 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 26rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--price { color: $uni-color-error; font-weight: 600; }
.info-value--wholesale { color: $uni-color-success; }
.info-value--stock { color: $uni-color-primary; font-weight: 600; }
.adjust-form {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.form-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.form-item:last-of-type { border-bottom: none; }
.form-label {
  width: 160rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}
.form-control { flex: 1; }
.form-input {
  width: 100%;
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
}
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.picker-value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $uni-spacing-xs;
}
.picker-value text { font-size: 26rpx; color: $uni-gray-700; }
.picker-arrow { font-size: 24rpx; color: $uni-gray-400; }
.error-text {
  display: block;
  font-size: 22rpx;
  color: $uni-color-error;
  margin-top: $uni-spacing-xs;
  text-align: right;
}
.submit-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-top: 24rpx;
  border: none;
}
.submit-btn::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>

