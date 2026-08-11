<template>
<div class="page">
<div class="page-header">
  <div class="page-header-main">
    <h2 class="page-title">品牌管理</h2>
    <p class="page-desc">商品品牌维护</p>
  </div>
  <div class="page-header-actions">
    <el-button type="primary" @click="openDialog()">新增品牌</el-button>
    <el-button @click="loadData">刷新</el-button>
  </div>
</div>

      

      <div class="filter-bar">
        <el-input v-model="searchForm.keyword" placeholder="品牌名称" clearable style="width: 200px" />
        <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 120px; margin-left: 12px">
          <el-option label="启用" value="active" /><el-option label="停用" value="inactive" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="searchBrands">搜索</el-button>
      </div>

      <div class="table-card">
<el-table :data="brands" v-loading="loading" stripe>
        <el-table-column prop="name" label="品牌名称" min-width="120" />
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

      <div class="table-card-footer">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; searchBrands(); }" @current-change="(p: number) => { page = p; searchBrands(); }" />
      </div>
</div>
    

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑品牌' : '新增品牌'" width="480px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入品牌名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <FormFooter
          :loading="submitLoading"
          :show-save-and-add="!editing"
          @cancel="dialogVisible = false"
          @save="handleSubmit()"
          @save-add="handleSubmit(true)"
        />
      </template>
    </el-dialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import { formatDate } from "../../utils/format";
import { api } from "../../api";
import FormFooter from "../../components/FormFooter.vue";

const brands = ref<any[]>([]);
const loading = ref(false); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const dialogVisible = ref(false); const editing = ref(false); const formRef = ref(); const submitLoading = ref(false);
const editingItem = ref<any>(null);

const searchForm = reactive({ keyword: "", status: "" });
const form = reactive({ name: "", sortNo: 0, remark: "" });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入品牌名称' }]
};

async function searchBrands() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/brands", { params: { page: page.value, pageSize: pageSize.value, keyword: searchForm.keyword || undefined, status: searchForm.status || undefined } });
    const res = data.data || {};
    brands.value = res.records || res.list || [];
    total.value = res.total || 0;
  } catch { ElMessage.error("加载品牌列表失败"); }
  finally { loading.value = false; }
}

function openDialog(row?: any) {
  editingItem.value = row || null; editing.value = !!row;
  if (row) { form.name = row.name; form.sortNo = row.sortNo || 0; form.remark = row.remark || ""; }
  else { form.name = ""; form.sortNo = 0; form.remark = ""; }
  dialogVisible.value = true;
}

async function handleSubmit(keepOpen = false) {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (editing.value) {
      await api.put(`/admin/brands/${editingItem.value.id}`, { name: form.name, sortNo: form.sortNo, remark: form.remark });
      ElMessage.success("品牌更新成功");
    } else {
      await api.post("/admin/brands", { name: form.name, sortNo: form.sortNo, remark: form.remark });
      ElMessage.success("品牌创建成功");
    }
    if (!keepOpen) dialogVisible.value = false;
    await searchBrands();
    if (keepOpen) openDialog();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function deleteItem(id: number) {
  try { await api.delete(`/admin/brands/${id}`); ElMessage.success("删除成功"); await searchBrands(); }
  catch { ElMessage.error("删除失败"); }
}

async function loadData() { await searchBrands(); }
onMounted(() => { loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
