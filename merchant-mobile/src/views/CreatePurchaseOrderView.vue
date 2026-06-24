<template>
  <div class="create-purchase-view">
    <van-nav-bar title="新建采购单" left-arrow @click-left="$router.back()" />

    <van-form ref="formRef" :model="formData" :rules="formRules">
      <van-cell-group inset>
        <van-field
          v-model="formData.supplierId"
          is-link
          readonly
          label="供应商"
          placeholder="请选择供应商"
          @click="showSupplierPicker = true"
        />
        <van-field
          v-model="formData.warehouseId"
          is-link
          readonly
          label="仓库"
          placeholder="请选择仓库"
          @click="showWarehousePicker = true"
        />
        <van-field
          v-model="formData.expectedDate"
          is-link
          readonly
          label="预计到货"
          placeholder="请选择日期"
          @click="showDatePicker = true"
        />
        <van-field
          v-model="formData.remark"
          type="textarea"
          label="备注"
          placeholder="请输入备注"
          rows="2"
          autosize
        />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="采购商品" />
        <div class="items-list">
          <div
            v-for="(item, index) in formData.items"
            :key="index"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName || '请选择商品' }}</div>
              <van-icon name="cross" @click="removeItem(index)" />
            </div>
            <div class="item-body">
              <van-field
                v-model="item.skuId"
                is-link
                readonly
                label="商品"
                placeholder="选择商品"
                @click="selectProduct(index)"
              />
              <van-field
                v-model="item.quantity"
                type="number"
                label="数量"
                placeholder="请输入数量"
              />
              <van-field
                v-model="item.unitPrice"
                type="number"
                label="单价"
                placeholder="请输入单价"
              />
              <div class="info-row">
                <span class="label">小计：</span>
                <span class="value amount">¥{{ formatMoney((item.quantity || 0) * (item.unitPrice || 0)) }}</span>
              </div>
            </div>
          </div>
        </div>
        <van-button plain block round icon="plus" @click="addItem" style="margin: 12px">
          添加商品
        </van-button>
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="采购总额" :value="`¥${formatMoney(totalAmount)}`" />
      </van-cell-group>
    </van-form>

    <div class="footer">
      <van-button type="primary" block round @click="submitOrder">
        提交采购单
      </van-button>
    </div>

    <van-popup v-model:show="showSupplierPicker" position="bottom" round>
      <van-picker
        :columns="supplierOptions"
        @confirm="onSupplierConfirm"
        @cancel="showSupplierPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showWarehousePicker" position="bottom" round>
      <van-picker
        :columns="warehouseOptions"
        @confirm="onWarehouseConfirm"
        @cancel="showWarehousePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="currentDate"
        title="选择日期"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showProductPicker" position="bottom" round style="height: 60%">
      <div class="product-picker">
        <van-search v-model="productKeyword" placeholder="搜索商品" @search="searchProducts" />
        <van-list
          v-model:loading="productLoading"
          :finished="productFinished"
          finished-text="没有更多了"
          @load="searchProducts"
        >
          <div
            v-for="product in productList"
            :key="product.skuId"
            class="product-item"
            @click="confirmProduct(product)"
          >
            <div class="product-name">{{ product.skuName }}</div>
            <div class="product-price">¥{{ formatMoney(product.retailPrice) }}</div>
          </div>
        </van-list>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  createPurchaseOrder,
  fetchProducts,
  type ProductRecord
} from '../api'

const router = useRouter()

const formData = ref({
  supplierId: '',
  warehouseId: '',
  expectedDate: '',
  remark: '',
  items: [] as Array<{
    skuId: number
    skuName: string
    quantity: number
    unitPrice: number
  }>
})

const formRules = {
  supplierId: [{ required: true, message: '请选择供应商' }],
  warehouseId: [{ required: true, message: '请选择仓库' }]
}

const showSupplierPicker = ref(false)
const showWarehousePicker = ref(false)
const showDatePicker = ref(false)
const showProductPicker = ref(false)
const productKeyword = ref('')
const productList = ref<ProductRecord[]>([])
const productLoading = ref(false)
const productFinished = ref(false)
const currentEditIndex = ref(-1)

const supplierOptions = ref([
  { text: '供应商A', value: '1' },
  { text: '供应商B', value: '2' }
])

const warehouseOptions = ref([
  { text: '主仓库', value: '1' },
  { text: '分仓库', value: '2' }
])

const currentDate = ref(['2024', '01', '01'])

const totalAmount = computed(() => {
  return formData.value.items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unitPrice || 0)
  }, 0)
})

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

function onSupplierConfirm({ selectedOptions }: any) {
  formData.value.supplierId = selectedOptions[0].value
  showSupplierPicker.value = false
}

function onWarehouseConfirm({ selectedOptions }: any) {
  formData.value.warehouseId = selectedOptions[0].value
  showWarehousePicker.value = false
}

function onDateConfirm({ selectedValues }: any) {
  formData.value.expectedDate = selectedValues.join('-')
  showDatePicker.value = false
}

function addItem() {
  formData.value.items.push({
    skuId: 0,
    skuName: '',
    quantity: 1,
    unitPrice: 0
  })
}

function removeItem(index: number) {
  formData.value.items.splice(index, 1)
}

function selectProduct(index: number) {
  currentEditIndex.value = index
  showProductPicker.value = true
  searchProducts()
}

async function searchProducts() {
  productLoading.value = true
  try {
    const res = await fetchProducts({ keyword: productKeyword.value })
    productList.value = res.data as any
    productFinished.value = true
  } catch {
    productFinished.value = true
  } finally {
    productLoading.value = false
  }
}

function confirmProduct(product: ProductRecord) {
  if (currentEditIndex.value >= 0) {
    formData.value.items[currentEditIndex.value].skuId = product.skuId
    formData.value.items[currentEditIndex.value].skuName = product.skuName
    formData.value.items[currentEditIndex.value].unitPrice = product.retailPrice
  }
  showProductPicker.value = false
}

async function submitOrder() {
  if (!formData.value.supplierId) {
    showToast('请选择供应商')
    return
  }
  if (!formData.value.warehouseId) {
    showToast('请选择仓库')
    return
  }
  if (formData.value.items.length === 0) {
    showToast('请添加商品')
    return
  }

  try {
    await createPurchaseOrder({
      supplierId: Number(formData.value.supplierId),
      warehouseId: Number(formData.value.warehouseId),
      expectedDate: formData.value.expectedDate || undefined,
      remark: formData.value.remark || undefined,
      items: formData.value.items.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    })
    showToast('创建成功')
    router.back()
  } catch {
    showToast('创建失败')
  }
}
</script>

<style scoped>
.create-purchase-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.items-list {
  padding: 0 14px;
}

.item-card {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
  margin-top: 8px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.item-body {
  font-size: 13px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0 2px;
}

.label {
  color: #999;
}

.value {
  color: #333;
}

.amount {
  color: #ee0a24;
  font-weight: 600;
}

.footer {
  padding: 20px 16px;
}

.product-picker {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.product-name {
  font-size: 14px;
  color: #333;
}

.product-price {
  color: #ee0a24;
  font-weight: 600;
}
</style>
