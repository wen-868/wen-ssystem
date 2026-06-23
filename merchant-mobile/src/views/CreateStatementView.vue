<template>
  <div class="create-statement-view">
    <van-nav-bar title="生成对账单" left-arrow @click-left="$router.back()" />

    <van-form ref="formRef" :model="formData" :rules="formRules">
      <van-cell-group inset>
        <van-field
          v-model="formData.memberId"
          is-link
          readonly
          label="客户"
          placeholder="请选择客户"
          @click="showCustomerPicker = true"
        />
        <van-field
          v-model="formData.periodStart"
          is-link
          readonly
          label="账期开始"
          placeholder="请选择日期"
          @click="showStartPicker = true"
        />
        <van-field
          v-model="formData.periodEnd"
          is-link
          readonly
          label="账期结束"
          placeholder="请选择日期"
          @click="showEndPicker = true"
        />
      </van-cell-group>
    </van-form>

    <div class="footer">
      <van-button type="primary" block round @click="submitStatement">
        生成对账单
      </van-button>
    </div>

    <van-popup v-model:show="showCustomerPicker" position="bottom" round style="height: 60%">
      <div class="customer-picker">
        <van-search v-model="customerKeyword" placeholder="搜索客户" @search="searchCustomers" />
        <van-list
          v-model:loading="customerLoading"
          :finished="customerFinished"
          finished-text="没有更多了"
          @load="searchCustomers"
        >
          <div
            v-for="customer in customerList"
            :key="customer.memberId"
            class="customer-item"
            @click="selectCustomer(customer)"
          >
            <div class="customer-name">{{ customer.name }}</div>
            <div class="customer-mobile">{{ customer.mobile }}</div>
          </div>
        </van-list>
      </div>
    </van-popup>

    <van-popup v-model:show="showStartPicker" position="bottom" round>
      <van-date-picker
        v-model="startDate"
        title="选择开始日期"
        @confirm="onStartConfirm"
        @cancel="showStartPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showEndPicker" position="bottom" round>
      <van-date-picker
        v-model="endDate"
        title="选择结束日期"
        @confirm="onEndConfirm"
        @cancel="showEndPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  generateStatement,
  fetchCustomers,
  type CustomerRecord
} from '../api'

const router = useRouter()

const formData = ref({
  memberId: '',
  memberName: '',
  periodStart: '',
  periodEnd: ''
})

const formRules = {
  memberId: [{ required: true, message: '请选择客户' }],
  periodStart: [{ required: true, message: '请选择开始日期' }],
  periodEnd: [{ required: true, message: '请选择结束日期' }]
}

const showCustomerPicker = ref(false)
const showStartPicker = ref(false)
const showEndPicker = ref(false)
const customerKeyword = ref('')
const customerList = ref<CustomerRecord[]>([])
const customerLoading = ref(false)
const customerFinished = ref(false)

const startDate = ref(['2024', '01', '01'])
const endDate = ref(['2024', '01', '31'])

async function searchCustomers() {
  customerLoading.value = true
  try {
    const res = await fetchCustomers({ keyword: customerKeyword.value })
    customerList.value = res.data as any
    customerFinished.value = true
  } catch {
    customerFinished.value = true
  } finally {
    customerLoading.value = false
  }
}

function selectCustomer(customer: CustomerRecord) {
  formData.value.memberId = customer.memberId.toString()
  formData.value.memberName = customer.name
  showCustomerPicker.value = false
}

function onStartConfirm({ selectedValues }: any) {
  formData.value.periodStart = selectedValues.join('-')
  showStartPicker.value = false
}

function onEndConfirm({ selectedValues }: any) {
  formData.value.periodEnd = selectedValues.join('-')
  showEndPicker.value = false
}

async function submitStatement() {
  if (!formData.value.memberId) {
    showToast('请选择客户')
    return
  }
  if (!formData.value.periodStart) {
    showToast('请选择开始日期')
    return
  }
  if (!formData.value.periodEnd) {
    showToast('请选择结束日期')
    return
  }

  try {
    await generateStatement({
      memberId: Number(formData.value.memberId),
      periodStart: formData.value.periodStart,
      periodEnd: formData.value.periodEnd
    })
    showToast('生成成功')
    router.back()
  } catch {
    showToast('生成失败')
  }
}
</script>

<style scoped>
.create-statement-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.footer {
  padding: 20px 16px;
}

.customer-picker {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.customer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.customer-name {
  font-size: 14px;
  color: #333;
}

.customer-mobile {
  font-size: 13px;
  color: #999;
}
</style>
