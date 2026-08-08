<template>
  <div class="data-table">
    <el-table :data="data" v-loading="loading" stripe style="width: 100%">
      <el-table-column
        v-for="col in columns"
        :key="col.prop || col.label"
        v-bind="col"
      >
        <template v-if="col.slot" #[col.slot]="scope">
          <slot :name="col.slot" v-bind="scope" />
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText" :image-size="80">
          <template v-if="$slots.empty" #default>
            <slot name="empty" />
          </template>
        </el-empty>
      </template>
      <slot name="append" />
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="pageSizes"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface ColumnConfig {
  prop?: string;
  label: string;
  width?: string | number;
  minWidth?: string | number;
  fixed?: string | boolean;
  slot?: string;
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    columns: ColumnConfig[];
    data: any[];
    loading?: boolean;
    total?: number;
    page?: number;
    pageSize?: number;
    pageSizes?: number[];
    emptyText?: string;
  }>(),
  {
    loading: false,
    total: 0,
    page: 1,
    pageSize: 20,
    pageSizes: () => [10, 20, 50, 100],
    emptyText: "暂无数据"
  }
);

const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();

function handleSizeChange(size: number) {
  emit("update:pageSize", size);
  emit("update:page", 1);
}

function handlePageChange(p: number) {
  emit("update:page", p);
}
</script>

<style scoped>
.data-table {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-card);
}
.data-table :deep(.el-table) {
  --el-table-border-color: var(--table-border);
  --el-table-header-bg-color: var(--table-header-bg);
}
</style>
