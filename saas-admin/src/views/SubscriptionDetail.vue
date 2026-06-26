<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px;">
          <el-button @click="$router.push('/subscriptions')">← 返回</el-button>
          <span>订阅详情</span>
        </div>
      </template>
      <el-empty description="PLAT-04 待实现" />
    </el-card>
  </div>
</template>