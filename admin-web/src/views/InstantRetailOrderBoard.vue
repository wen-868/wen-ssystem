<template>
  <div class="page">
    <PageCard title="接单工作台">
      <template #extra>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </template>
      <el-empty description="60秒接单工作台功能开发中，敬请期待" :image-size="120" />
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import PageCard from "../components/PageCard.vue";

function loadData() {
  // TODO
}
</script>