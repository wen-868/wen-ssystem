<template>
  <div class="purchase-warehousing-view">
    <van-nav-bar title="采购入库" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="loading" />

    <template v-else-if="detail">
      <van-cell-group inset>
        <van-cell title="采购单号" :value="detail.purchaseNo" />
        <van-cell title="供应商" :value="detail.supplierName" />
        <van-cell title="仓库" :value="detail.warehouseName" />
        <van-cell title="采购金额" :value="`¥${formatMoney(detail.totalAmount)}`" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="入库商品" />
        <div class="items-list">
          <div
            v-for="(item, _index) in warehousingItems"
            :key="item.skuId"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-name">{{ item.skuName }}</div>
              <div class="item-qty">采购: {{ item.orderQty }}</div>
            </div>
            <div class="item-body">
              <van-field
                v-model="item.thisQty"
                type="number"
                label="本次入库"
                placeholder="请输入数量"
                :max="item.orderQty - item.warehousedQty"
              />
              <van-field
                v-model="item.batchNo"
                label="批次号"
                placeholder="请输入批次号"
              />
              <van-field
                v-model="item.productionDate"
                is-link
                readonly
                label="生产日期"
                placeholder="请选择日期"
                @click="showDatePicker = true"
              />
              <van-field
                v-model="item.qualityResult"
                is-link
                readonly
                label="质检结果"
                placeholder="请选择"
                @click="showQualityPicker = true"
              />
            </div>
          </div>
        </div>
      </van-cell-group>

      <div class="footer">
        <van-button type="primary" block round @click="submitWarehousing">
          确认入库
        </van-button>
      </div>
    </template>

    <van-empty v-else description="采购单不存在" />

    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="currentDate"
        title="选择日期"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showQualityPicker" position="bottom" round>
      <van-picker
        :columns="qualityOptions"
        @confirm="onQualityConfirm"
        @cancel="showQualityPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  fetchPurchaseOrderDetail,
  purchaseInStock,
  type PurchaseOrderDetail
} from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const detail = ref<PurchaseOrderDetail | null>(null)
const warehousingItems = ref<Array<{
  skuId: number
  skuName: string
  orderQty: number
  warehousedQty: number
  thisQty: number
  batchNo: string
  productionDate: string
  qualityResult: string
}>>([])

const showDatePicker = ref(false)
const showQualityPicker = ref(false)
const currentDate = ref(['2024', '01', '01'])
const currentEditIndex = ref(-1)

const qualityOptions = ref([
  { text: '合格', value: 'PASS' },
  { text: '不合格', value: 'FAIL' }
])

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

async function loadDetail() {
  loading.value = true
  try {
    const purchaseNo = route.params.purchaseNo as string
    const res = await fetchPurchaseOrderDetail(purchaseNo)
    detail.value = res.data as any

    warehousingItems.value = (detail.value!.items || []).map((item: any) => ({
      skuId: item.skuId,
      skuName: item.skuName,
      orderQty: item.quantity || 0,
      warehousedQty: item.warehousedQty || 0,
      thisQty: (item.quantity || 0) - (item.warehousedQty || 0),
      batchNo: item.batchNo || '',
      productionDate: item.productionDate || '',
      qualityResult: item.qualityResult || 'PASS'
    }))
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function onDateConfirm({ selectedValues }: any) {
  if (currentEditIndex.value >= 0) {
    warehousingItems.value[currentEditIndex.value].productionDate = selectedValues.join('-')
  }
  showDatePicker.value = false
}

function onQualityConfirm({ selectedOptions }: any) {
  if (currentEditIndex.value >= 0) {
    warehousingItems.value[currentEditIndex.value].qualityResult = selectedOptions[0].value
  }
  showQualityPicker.value = false
}

async function submitWarehousing() {
  if (!detail.value) return

  const items = warehousingItems.value
    .filter(item => item.thisQty > 0)
    .map(item => ({
      skuId: item.skuId,
      quantity: item.thisQty,
      batchNo: item.batchNo || undefined,
      productionDate: item.productionDate || undefined,
      qualityResult: item.qualityResult
    }))

  if (items.length === 0) {
    showToast('请填写入库数量')
    return
  }

  try {
    await purchaseInStock({
      purchaseNo: detail.value.purchaseNo,
      items
    })
    showToast('入库成功')
    router.back()
  } catch {
    showToast('入库失败')
  }
}

onMounted(loadDetail)
</script>

<style scoped>
.purchase-warehousing-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.loading {
  display: block;
  margin: 40px auto;
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

.footer {
  padding: 20px 16px;
}
</style>
