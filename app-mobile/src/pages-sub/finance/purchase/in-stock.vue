<template>
  <!-- 采购入库与快速开单（create-sale 的采购入库模式）为同一张单据（t_purchase_in_stock），
       页面与逻辑统一复用快速开单完整流程（商品明细/税率/批次/到票状态），本页仅作转发 -->
  <view class="in-stock-redirect"></view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

// 旧入口（首页快捷入口/采购订单页入库/库存页）统一重定向，避免出现第二套残缺入库表单
onLoad(() => {
  uni.redirectTo({ url: '/pages/sales/create-sale?doc=pur_inbound' })
})
</script>

<script lang="ts">
export default {}
</script>

<style lang="scss" scoped>
.in-stock-redirect {
  min-height: 100vh;
  background: $uni-bg-color-grey;
}
</style>
