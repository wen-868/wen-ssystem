<template>
  <div class="page">
    <PageCard title="审核委托管理">
      <el-empty description="审核委托功能待后端支持" :image-size="120">
        <div class="pending-tip">
          审核委托（我的委托/代理我的/历史记录）暂无数据接口，菜单入口保留，功能开发完成后可在此查看与新建委托。
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
