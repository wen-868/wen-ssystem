<script setup lang="ts">
</script>

<template>
  <section class="page">
    <div class="reports-placeholder">
      <van-icon name="chart-trending-o" size="64" color="var(--color-primary)" />
      <h2>报表</h2>
      <p>即将上线</p>
      <p class="sub-text">销售分析、库存报表、应收统计等功能正在开发中</p>
    </div>
  </section>
</template>

<style scoped>
.reports-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 24px;
}

.reports-placeholder h2 {
  margin: 20px 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.reports-placeholder p {
  margin: 0;
  font-size: 15px;
  color: var(--text-secondary);
}

.sub-text {
  margin-top: 8px !important;
  font-size: 13px !important;
  color: var(--text-muted) !important;
}
</style>
