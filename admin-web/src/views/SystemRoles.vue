<template>
  <div class="page">
    <PageCard title="角色权限">
      <template #extra>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </template>
      <el-empty description="角色权限管理功能开发中，敬请期待" :image-size="120" />
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import PageCard from "../components/PageCard.vue";

function loadData() {
  // TODO: 角色权限列表加载
}
</script>