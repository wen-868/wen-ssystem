<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px;">
          <el-button @click="$router.push('/packages')">← 返回</el-button>
          <span>{{ isEdit ? "编辑套餐" : "新建套餐" }}</span>
        </div>
      </template>
      <el-empty description="PLAT-03 待实现" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isEdit = computed(() => !!route.params.id);
</script>