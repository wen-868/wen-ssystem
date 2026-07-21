<template>
  <div class="page">
    <PageCard title="商品标签管理">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增标签</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input v-model="searchForm.keyword" placeholder="标签名称" clearable style="width: 180px" />
        <el-select v-model="searchForm.tagType" placeholder="标签类型" clearable style="width: 150px; margin-left: 12px">
          <el-option v-for="t in tagTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 120px; margin-left: 12px">
          <el-option label="启用" value="active" /><el-option label="停用" value="inactive" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchTags">搜索</el-button>
      </div>

      <el-table :data="tags" v-loading="loading" stripe>
        <el-table-column prop="name" label="标签名称" min-width="120" />
        <el-table-column prop="tagType" label="标签类型" width="120" align="center">
          <template #default="{ row }"><el-tag>{{ tagTypeLabel(row.tagType) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="sortNo" label="排序" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="deleteItem(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; searchTags(); }" @current-change="(p: number) => { page = p; searchTags(); }" />
      </div>
    </PageCard>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑标签' : '新增标签'" width="480px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="标签名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="标签类型" prop="tagType">
          <el-select v-model="form.tagType" placeholder="请选择标签类型" style="width: 100%">
            <el-option v-for="t in tagTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { formatDate } from "../../utils/format";
import { api } from "../../api";

const tagTypes = [
  { value: "aroma", label: "香型" },
  { value: "alcohol_level", label: "度数段" },
  { value: "region", label: "产区" },
  { value: "scene", label: "适用场景" },
  { value: "vintage", label: "年份" }
];
function tagTypeLabel(v: string) { return tagTypes.find(t => t.value === v)?.label || v; }

const tags = ref<any[]>([]);
const loading = ref(false); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const dialogVisible = ref(false); const editing = ref(false); const formRef = ref(); const submitLoading = ref(false);
const editingItem = ref<any>(null);

const searchForm = reactive({ keyword: "", tagType: "", status: "" });
const form = reactive({ name: "", tagType: "", sortNo: 0, remark: "" });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入标签名称' }],
  tagType: [{ required: true, message: '请选择标签类型' }]
};

async function searchTags() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/product-tags", { params: { page: page.value, pageSize: pageSize.value, keyword: searchForm.keyword || undefined, tagType: searchForm.tagType || undefined, status: searchForm.status || undefined } });
    const res = data.data || {};
    tags.value = res.records || res.list || [];
    total.value = res.total || 0;
  } catch { ElMessage.error("加载标签失败"); }
  finally { loading.value = false; }
}

function openDialog(row?: any) {
  editingItem.value = row || null; editing.value = !!row;
  if (row) { form.name = row.name; form.tagType = row.tagType; form.sortNo = row.sortNo || 0; form.remark = row.remark || ""; }
  else { form.name = ""; form.tagType = ""; form.sortNo = 0; form.remark = ""; }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (editing.value) {
      await api.put(`/admin/product-tags/${editingItem.value.id}`, { name: form.name, tagType: form.tagType, sortNo: form.sortNo, remark: form.remark });
      ElMessage.success("标签更新成功");
    } else {
      await api.post("/admin/product-tags", { name: form.name, tagType: form.tagType, sortNo: form.sortNo, remark: form.remark });
      ElMessage.success("标签创建成功");
    }
    dialogVisible.value = false; await searchTags();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function deleteItem(id: number) {
  try { await api.delete(`/admin/product-tags/${id}`); ElMessage.success("删除成功"); await searchTags(); }
  catch { ElMessage.error("删除失败"); }
}

async function loadData() { await searchTags(); }
onMounted(() => { loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>