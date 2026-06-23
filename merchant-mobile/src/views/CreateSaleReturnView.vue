<template>
  <div class="create-sale-return-view">
    <van-nav-bar title="创建退货单" left-arrow @click-left="$router.back()" />
    
    <van-form ref="formRef" :model="formData" :rules="formRules">
      <!-- 退货模式选择 -->
      <van-cell-group inset>
        <van-cell title="退货模式" is-link :value="returnMode === 'bill' ? '按销售单退货' : '直接退货'" @click="showModePicker = true" />
      </van-cell-group>
      
      <!-- 按销售单退货 -->
      <van-cell-group inset v-if="returnMode === 'bill'" style="margin-top: 12px">
        <van-field
          v-model="billNo"
          label="销售单号"
          placeholder="请输入销售单号"
          @blur="loadSaleBill"
        />
        
        <div v-if="selectedBill" class="bill-info">
          <div class="info-row">
            <span class="label">客户：</span>
            <span class="value">{{ selectedBill.customerName || '散客' }}</span>
          </div>
          <div class="info-row">
            <span class="label">金额：</span>
            <span class="value">¥{{ formatMoney(selectedBill.receivableAmount) }}</span>
          </div>
        </div>
        
        <div v-if="selectedBill && selectedBill.items" class="items-list">
          <div class="section-title">退货商品</div>
          <div
            v-for="(item, _index) in returnItems"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <van-checkbox v-model="item.selected" />
            </div>
            <div class="item-body">
              <div class="info-row">
                <span class="label">原数量：</span>
                <span class="value">{{ item.originalQty }} 瓶</span>
              </div>
              <van-field
                v-model="item.returnQty"
                type="number"
                label="退货数量"
                placeholder="请输入退货数量"
                :disabled="!item.selected"
              />
            </div>
          </div>
        </div>
      </van-cell-group>
      
      <!-- 直接退货 -->
      <van-cell-group inset v-else style="margin-top: 12px">
        <van-field
          v-model="customerName"
          label="客户名称"
          placeholder="请输入客户名称"
        />
        
        <van-cell title="选择商品" is-link @click="showProductPicker = true">
          <template #value>
            <span v-if="returnItems.length === 0">请选择商品</span>
            <span v-else>已选 {{ returnItems.length }} 件</span>
          </template>
        </van-cell>
        
        <div v-if="returnItems.length > 0" class="items-list">
          <div class="section-title">退货商品</div>
          <div
            v-for="(item, index) in returnItems"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <van-icon name="cross" @click="removeItem(index)" />
            </div>
            <div class="item-body">
              <van-field
                v-model="item.returnQty"
                type="number"
                label="退货数量"
                placeholder="请输入退货数量"
              />
              <van-field
                v-model="item.unitPrice"
                type="number"
                label="单价"
                placeholder="请输入单价"
              />
            </div>
          </div>
        </div>
      </van-cell-group>
      
      <!-- 退货原因 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-field
          v-model="formData.reason"
          type="textarea"
          label="退货原因"
          placeholder="请输入退货原因"
          rows="3"
          autosize
        />
      </van-cell-group>
      
      <!-- 金额汇总 -->
      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货总额" :value="`¥${formatMoney(totalAmount)}`" />
      </van-cell-group>
    </van-form>
    
    <div class="footer">
      <van-button type="primary" block round @click="submitReturn">
        提交退货单
      </van-button>
    </div>
    
    <!-- 退货模式选择弹窗 -->
    <van-popup v-model:show="showModePicker" position="bottom" round>
      <van-picker
        :columns="modeOptions"
        @confirm="onModeConfirm"
        @cancel="showModePicker = false"
      />
    </van-popup>
    
    <!-- 商品选择弹窗 -->
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
            @click="addProduct(product)"
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
import { showToast, showSuccessToast } from 'vant'
import {
  fetchSaleBillDetail,
  createSaleReturn,
  fetchProducts,
  type SaleBillDetail,
  type ProductRecord
} from '../api'

const router = useRouter()

const formRef = ref()
const formData = ref({
  reason: ''
})

const formRules = {
  reason: [{ required: true, message: '请输入退货原因' }]
}

const returnMode = ref('bill')
const showModePicker = ref(false)
const modeOptions = [
  { text: '按销售单退货', value: 'bill' },
  { text: '直接退货', value: 'direct' }
]

const billNo = ref('')
const selectedBill = ref<SaleBillDetail | null>(null)

const customerName = ref('')
const showProductPicker = ref(false)
const productKeyword = ref('')
const productList = ref<ProductRecord[]>([])
const productLoading = ref(false)
const productFinished = ref(false)

interface ReturnItem {
  skuId: number
  skuName: string
  originalQty: number
  returnQty: number
  unitPrice: number
  selected: boolean
}

const returnItems = ref<ReturnItem[]>([])

const totalAmount = computed(() => {
  return returnItems.value
    .filter(item => item.selected)
    .reduce((sum, item) => sum + item.returnQty * item.unitPrice, 0)
})

function onModeConfirm({ selectedOptions }: any) {
  returnMode.value = selectedOptions[0].value
  showModePicker.value = false
  returnItems.value = []
  selectedBill.value = null
  billNo.value = ''
}

async function loadSaleBill() {
  if (!billNo.value.trim()) return
  
  try {
    const res = await fetchSaleBillDetail(billNo.value)
    selectedBill.value = res.data
    
    returnItems.value = selectedBill.value!.items.map(item => ({
      skuId: item.skuId,
      skuName: item.skuName,
      originalQty: item.totalBottleQty,
      returnQty: item.totalBottleQty,
      unitPrice: item.unitPrice,
      selected: true
    }))
  } catch (error) {
    showToast('销售单不存在')
    selectedBill.value = null
    returnItems.value = []
  }
}

async function searchProducts() {
  if (productLoading.value) return
  
  productLoading.value = true
  
  try {
    const res = await fetchProducts({ keyword: productKeyword.value })
    productList.value = res.data.records || []
    productFinished.value = productList.value.length >= 20
  } catch (error) {
    console.error('搜索商品失败', error)
  } finally {
    productLoading.value = false
  }
}

function addProduct(product: ProductRecord) {
  const exists = returnItems.value.find(item => item.skuId === product.skuId)
  if (exists) {
    showToast('商品已添加')
    return
  }
  
  returnItems.value.push({
    skuId: product.skuId,
    skuName: product.skuName,
    originalQty: 0,
    returnQty: 1,
    unitPrice: product.retailPrice,
    selected: true
  })
  
  showProductPicker.value = false
  productKeyword.value = ''
}

function removeItem(index: number) {
  returnItems.value.splice(index, 1)
}

async function submitReturn() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  
  const validItems = returnItems.value.filter(item => item.selected && item.returnQty > 0)
  if (validItems.length === 0) {
    showToast('请添加退货商品')
    return
  }
  
  try {
    const data = {
      sourceBillNo: returnMode.value === 'bill' ? billNo.value : undefined,
      customerName: returnMode.value === 'direct' ? customerName.value : selectedBill.value?.customerName,
      reason: formData.value.reason,
      items: validItems.map(item => ({
        skuId: item.skuId,
        returnBottleQty: item.returnQty,
        totalReturnBottleQty: item.returnQty
      }))
    }
    
    await createSaleReturn(data)
    showSuccessToast('退货单创建成功')
    router.back()
  } catch (error) {
    showToast('创建失败，请重试')
  }
}

function formatMoney(amount: number) {
  return amount.toFixed(2)
}
</script>

<style scoped>
.create-sale-return-view {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.bill-info {
  padding: 12px 16px;
  background: #f7f8fa;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #999;
  font-size: 14px;
}

.value {
  color: #333;
  font-size: 14px;
}

.items-list {
  padding: 12px;
}

.section-title {
  font-weight: 500;
  font-size: 15px;
  margin-bottom: 12px;
}

.item-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-name {
  font-weight: 500;
  font-size: 14px;
}

.item-body {
  padding-left: 8px;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: white;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
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
}

.product-price {
  color: #ee0a24;
  font-weight: 500;
}
</style>
