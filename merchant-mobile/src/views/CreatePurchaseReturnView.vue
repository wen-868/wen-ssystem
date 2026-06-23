<template>
  <div class="create-return-view">
    <van-nav-bar title="创建退货单" left-arrow @click-left="$router.back()" />

    <van-form ref="formRef" :model="formData" :rules="formRules">
      <van-cell-group inset>
        <van-field
          v-model="formData.purchaseNo"
          is-link
          readonly
          label="采购单号"
          placeholder="请选择采购单"
          @click="showPurchasePicker = true"
        />
        <van-field
          v-model="formData.reason"
          label="退货原因"
          placeholder="请输入退货原因"
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

      <van-cell-group inset style="margin-top: 12px" v-if="selectedPurchase">
        <van-cell title="退货商品" />
        <div class="items-list">
          <div
            v-for="(item, index) in formData.items"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <div class="item-qty">已入库: {{ item.warehousedQty }}</div>
            </div>
            <div class="item-body">
              <van-field
                v-model="item.returnQty"
                type="number"
                label="退货数量"
                placeholder="请输入数量"
                :max="item.warehousedQty"
              />
              <van-field
                v-model="item.returnPrice"
                type="number"
                label="退货单价"
                placeholder="请输入单价"
              />
              <div class="info-row">
                <span class="label">退货金额：</span>
                <span class="value amount">¥{{ formatMoney((item.returnQty || 0) * (item.returnPrice || 0)) }}</span>
              </div>
            </div>
          </div>
        </div>
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="退货总额" :value="`¥${formatMoney(totalAmount)}`" />
      </van-cell-group>
    </van-form>

    <div class="footer">
      <van-button type="primary" block round @click="submitReturn">
        提交退货单
      </van-button>
    </div>

    <van-popup v-model:show="showPurchasePicker" position="bottom" round style="height: 60%">
      <div class="purchase-picker">
        <van-search v-model="purchaseKeyword" placeholder="搜索采购单" @search="searchPurchases" />
        <van-list
          v-model:loading="purchaseLoading"
          :finished="purchaseFinished"
          finished-text="没有更多了"
          @load="searchPurchases"
        >
          <div
            v-for="purchase in purchaseList"
            :key="purchase.purchaseNo"
            class="purchase-item"
            @click="selectPurchase(purchase)"
          >
            <div class="purchase-no">{{ purchase.purchaseNo }}</div>
            <div class="purchase-info">
              <div>{{ purchase.supplierName }}</div>
              <div>¥{{ formatMoney(purchase.totalAmount) }}</div>
            </div>
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
  createPurchaseReturn,
  fetchPurchaseOrders,
  fetchPurchaseOrderDetail,
  type PurchaseOrderRecord,
  type PurchaseOrderDetail
} from '../api'

const router = useRouter()

const formData = ref({
  purchaseNo: '',
  reason: '',
  remark: '',
  items: [] as Array<{
    skuId: number
    skuName: string
    warehousedQty: number
    returnQty: number
    returnPrice: number
  }>
})

const formRules = {
  purchaseNo: [{ required: true, message: '请选择采购单' }],
  reason: [{ required: true, message: '请输入退货原因' }]
}

const showPurchasePicker = ref(false)
const purchaseKeyword = ref('')
const purchaseList = ref<PurchaseOrderRecord[]>([])
const purchaseLoading = ref(false)
const purchaseFinished = ref(false)
const selectedPurchase = ref<PurchaseOrderDetail | null>(null)

const totalAmount = computed(() => {
  return formData.value.items.reduce((sum, item) => {
    return sum + (item.returnQty || 0) * (item.returnPrice || 0)
  }, 0)
})

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

async function searchPurchases() {
  purchaseLoading.value = true
  try {
    const res = await fetchPurchaseOrders({
      keyword: purchaseKeyword.value,
      status: 'APPROVED'
    })
    purchaseList.value = res.data as any
    purchaseFinished.value = true
  } catch {
    purchaseFinished.value = true
  } finally {
    purchaseLoading.value = false
  }
}

async function selectPurchase(purchase: PurchaseOrderRecord) {
  formData.value.purchaseNo = purchase.purchaseNo

  try {
    const res = await fetchPurchaseOrderDetail(purchase.purchaseNo)
    selectedPurchase.value = res.data as any

    formData.value.items = (selectedPurchase.value.items || []).map((item: any) => ({
      skuId: item.skuId,
      skuName: item.skuName,
      warehousedQty: item.warehousedQty || 0,
      returnQty: 0,
      returnPrice: item.unitPrice || 0
    }))

    showPurchasePicker.value = false
  } catch {
    showToast('加载失败')
  }
}

async function submitReturn() {
  if (!formData.value.purchaseNo) {
    showToast('请选择采购单')
    return
  }
  if (!formData.value.reason) {
    showToast('请输入退货原因')
    return
  }

  const items = formData.value.items.filter(item => item.returnQty > 0)
  if (items.length === 0) {
    showToast('请填写退货数量')
    return
  }

  try {
    await createPurchaseReturn({
      purchaseNo: formData.value.purchaseNo,
      reason: formData.value.reason,
      remark: formData.value.remark || undefined,
      items: items.map(item => ({
        skuId: item.skuId,
        returnQty: item.returnQty,
        returnPrice: item.returnPrice
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
.create-return-view {
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

.item-qty {
  font-size: 12px;
  color: #999;
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

.purchase-picker {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.purchase-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.purchase-no {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.purchase-info {
  text-align: right;
  font-size: 13px;
  color: #666;
}
</style>
