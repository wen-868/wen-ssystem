<template>
  <div class="statement-payment-view">
    <van-nav-bar title="登记付款" left-arrow @click-left="$router.back()" />

    <van-cell-group inset>
      <van-cell title="客户名称" :value="customerName" />
      <van-cell title="期末余额">
        <template #value>
          <span class="amount" :class="{ positive: closingBalance > 0 }">
            ¥{{ formatMoney(closingBalance) }}
          </span>
        </template>
      </van-cell>
    </van-cell-group>

    <van-form ref="formRef" :model="formData" :rules="formRules">
      <van-cell-group inset style="margin-top: 12px">
        <van-field
          v-model="formData.amount"
          type="number"
          label="付款金额"
          placeholder="请输入金额"
          :max="closingBalance"
        />
        <van-field
          v-model="formData.paymentMethod"
          is-link
          readonly
          label="付款方式"
          placeholder="请选择"
          @click="showMethodPicker = true"
        />
        <van-field
          v-model="formData.paymentDate"
          is-link
          readonly
          label="付款日期"
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
    </van-form>

    <div class="footer">
      <van-button type="primary" block round @click="submitPayment">
        确认登记
      </van-button>
    </div>

    <van-popup v-model:show="showMethodPicker" position="bottom" round>
      <van-picker
        :columns="methodOptions"
        @confirm="onMethodConfirm"
        @cancel="showMethodPicker = false"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { recordStatementPayment } from '../api'

const route = useRoute()
const router = useRouter()

const customerName = ref('')
const closingBalance = ref(0)

const formData = ref({
  amount: '',
  paymentMethod: '',
  paymentDate: '',
  remark: ''
})

const formRules = {
  amount: [{ required: true, message: '请输入金额' }],
  paymentMethod: [{ required: true, message: '请选择付款方式' }],
  paymentDate: [{ required: true, message: '请选择付款日期' }]
}

const showMethodPicker = ref(false)
const showDatePicker = ref(false)
const currentDate = ref(['2024', '01', '01'])

const methodOptions = ref([
  { text: '银行转账', value: 'BANK_TRANSFER' },
  { text: '现金', value: 'CASH' },
  { text: '微信支付', value: 'WECHAT' },
  { text: '支付宝', value: 'ALIPAY' },
  { text: '支票', value: 'CHECK' }
])

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

function onMethodConfirm({ selectedOptions }: any) {
  formData.value.paymentMethod = selectedOptions[0].value
  showMethodPicker.value = false
}

function onDateConfirm({ selectedValues }: any) {
  formData.value.paymentDate = selectedValues.join('-')
  showDatePicker.value = false
}

async function submitPayment() {
  if (!formData.value.amount || Number(formData.value.amount) <= 0) {
    showToast('请输入有效金额')
    return
  }
  if (!formData.value.paymentMethod) {
    showToast('请选择付款方式')
    return
  }
  if (!formData.value.paymentDate) {
    showToast('请选择付款日期')
    return
  }

  const statementNo = route.params.statementNo as string

  try {
    await recordStatementPayment(statementNo, {
      amount: Number(formData.value.amount),
      paymentMethod: formData.value.paymentMethod,
      paymentDate: formData.value.paymentDate,
      remark: formData.value.remark || undefined
    })
    showToast('登记成功')
    router.back()
  } catch {
    showToast('登记失败')
  }
}

onMounted(() => {
  customerName.value = (route.query.customerName as string) || ''
  closingBalance.value = Number(route.query.closingBalance) || 0
})
</script>

<style scoped>
.statement-payment-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.amount {
  color: #10b981;
  font-weight: 600;
}

.amount.positive {
  color: #ef4444;
}

.footer {
  padding: 20px 16px;
}
</style>
