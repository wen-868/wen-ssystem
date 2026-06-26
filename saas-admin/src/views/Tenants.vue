<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>租户列表</span>
          <el-button type="primary" disabled>新建租户</el-button>
        </div>
      </template>
      <el-table :data="[]" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="租户名称" />
        <el-table-column prop="contact" label="联系人" />
        <el-table-column prop="status" label="状态" />
        <el-table-column label="操作" width="200" />
      </el-table>
      <el-empty description="数据加载中..." style="margin: 40px 0;" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
// PLAT-02 实现：租户列表/审核/详情/开通/停用
</script>