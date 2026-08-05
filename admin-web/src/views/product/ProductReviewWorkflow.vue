<template>
  <div class="page">
    <PageCard title="审核流程配置">
      <el-empty description="审核流程配置功能待后端支持" :image-size="120">
        <div class="pending-tip">
          审核流程（新建流程/审核级次配置/流程详情）暂无数据接口，菜单入口保留，功能开发完成后可在此配置商品审核流程。
        </div>
      </el-empty>
    </PageCard>
  </div>
</template>

<script setup lang="ts">
import PageCard from "../../components/PageCard.vue";
</script>

<style scoped>
.pending-tip {
  max-width: 480px;
  line-height: 1.7;
  font-size: 13px;
  color: var(--gray-600);
}
</style>
