<template>
  <div class="statement-detail-view">
    <van-nav-bar title="对账单详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="loading" />

    <template v-else-if="detail">
      <van-cell-group inset>
        <van-cell title="对账单号" :value="detail.statementNo" />
        <van-cell title="客户名称" :value="detail.customerName" />
        <van-cell title="状态">
          <template #value>
            <van-tag :type="getStatusType(detail.status)">
              {{ getStatusText(detail.status) }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="账期" :value="`${detail.periodStart} ~ ${detail.periodEnd}`" />
        <van-cell title="生成时间" :value="formatDate(detail.createdAt)" />
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px">
        <van-cell title="期初余额" :value="`¥${formatMoney(detail.openingBalance)}`" />
        <van-cell title="本期应收" :value="`¥${formatMoney(detail.periodReceivable)}`" />
        <van-cell title="本期已收" :value="`¥${formatMoney(detail.periodReceived)}`" />
        <van-cell title="期末余额">
          <template #value>
            <span class="amount" :class="{ positive: detail.closingBalance > 0 }">
              ¥{{ formatMoney(detail.closingBalance) }}
            </span>
          </template>
        </van-cell>
      </van-cell-group>

      <van-cell-group inset style="margin-top: 12px" v-if="detail.details?.length">
        <van-cell title="往来明细" />
        <div class="details-list">
          <div
            v-for="(item, index) in detail.details"
            :key="index"
            class="detail-item"
          >
            <div class="detail-header">
              <div class="detail-date">{{ item.date }}</div>
              <van-tag size="small" type="primary">{{ item.type }}</van-tag>
            </div>
            <div class="detail-body">
              <div class="detail-info">
                <div class="info-row">
                  <span class="label">单据号：</span>
                  <span class="value">{{ item.billNo }}</span>
                </div>
                <div class="info-row" v-if="item.summary">
                  <span class="label">摘要：</span>
                  <span class="value">{{ item.summary }}</span>
                </div>
              </div>
              <div class="detail-amount">
                <div class="amount-row" v-if="item.debit">
                  <span class="label">借方：</span>
                  <span class="value debit">¥{{ formatMoney(item.debit) }}</span>
                </div>
                <div class="amount-row" v-if="item.credit">
                  <span class="label">贷方：</span>
                  <span class="value credit">¥{{ formatMoney(item.credit) }}</span>
                </div>
                <div class="amount-row">
                  <span class="label">余额：</span>
                  <span class="value balance" :class="{ positive: item.balance > 0 }">
                    ¥{{ formatMoney(item.balance) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </van-cell-group>

      <van-empty v-else description="暂无往来明细" />

      <div class="footer" v-if="detail.status === 'CONFIRMED' && detail.closingBalance > 0">
        <van-button type="primary" block round @click="goPayment">
          登记付款
        </van-button>
      </div>
    </template>

    <van-empty v-else description="对账单不存在" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchStatementDetail, type StatementDetail } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const detail = ref<StatementDetail | null>(null)

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'primary',
    DISPUTED: 'danger'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待确认',
    CONFIRMED: '已确认',
    DISPUTED: '有异议'
  }
  return map[status] || status
}

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

function formatDate(str: string) {
  if (!str) return ''
  return str.replace('T', ' ').slice(0, 16)
}

async function loadDetail() {
  loading.value = true
  try {
    const statementNo = route.params.statementNo as string
    const res = await fetchStatementDetail(statementNo)
    detail.value = res.data as any
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function goPayment() {
  if (detail.value) {
    router.push({
      path: `/statements/${detail.value.statementNo}/payment`,
      query: {
        customerName: detail.value.customerName,
        closingBalance: detail.value.closingBalance.toString()
      }
    })
  }
}

onMounted(loadDetail)
</script>

<style scoped>
.statement-detail-view {
  padding-bottom: 20px;
  background: #f5f5f5;
  min-height: 100vh;
}

.loading {
  display: block;
  margin: 40px auto;
}

.amount {
  color: #10b981;
  font-weight: 600;
}

.amount.positive {
  color: #ef4444;
}

.details-list {
  padding: 0 14px 10px;
}

.detail-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
  margin-top: 8px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-date {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.detail-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail-info {
  flex: 1;
  font-size: 12px;
}

.info-row {
  padding: 2px 0;
}

.label {
  color: #999;
}

.value {
  color: #333;
}

.detail-amount {
  text-align: right;
  font-size: 12px;
}

.amount-row {
  padding: 2px 0;
}

.debit {
  color: #ef4444;
  font-weight: 600;
}

.credit {
  color: #10b981;
  font-weight: 600;
}

.balance {
  color: #10b981;
  font-weight: 600;
}

.balance.positive {
  color: #ef4444;
}

.footer {
  padding: 20px 16px;
}
</style>
