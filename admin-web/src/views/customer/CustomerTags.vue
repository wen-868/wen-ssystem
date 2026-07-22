<template>
  <div class="page">
    <PageCard title="客户标签管理">
      <template #extra>
        <el-button type="primary" @click="openDialog()">新增标签</el-button>
        <el-button @click="openTagCustomerDialog">打标签</el-button>
        <el-button @click="loadData">刷新</el-button>
      </template>

      <div class="search-bar">
        <el-input v-model="searchForm.keyword" placeholder="标签名称" clearable style="width: 180px" />
        <el-select v-model="searchForm.tagGroup" placeholder="分组" clearable style="width: 150px; margin-left: 12px">
          <el-option v-for="g in tagGroups" :key="g" :label="g" :value="g" />
        </el-select>
        <el-select v-model="searchForm.tagType" placeholder="类型" clearable style="width: 120px; margin-left: 12px">
          <el-option label="手动" value="MANUAL" />
          <el-option label="自动" value="AUTO" />
        </el-select>
        <el-button type="primary" style="margin-left: 12px" @click="search">搜索</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="标签名称" min-width="120" />
        <el-table-column prop="tagGroup" label="分组" width="120" />
        <el-table-column prop="tagType" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.tagType === 'MANUAL' ? '' : 'info'">{{ row.tagType === 'MANUAL' ? '手动' : '自动' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" width="100" align="center">
          <template #default="{ row }">
            <div class="color-dot" :style="{ background: row.color }" />
          </template>
        </el-table-column>
        <el-table-column prop="customerCount" label="关联客户数" width="110" align="center" />
        <el-table-column prop="sortNo" label="排序" width="80" align="center" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" :image-size="80" /></template>
      </el-table>

      <div class="pagination">
        <el-pagination background layout="total, sizes, prev, pager, next, jumper" :total="total" :page-size="pageSize" :current-page="page" @size-change="(s: number) => { pageSize = s; search(); }" @current-change="(p: number) => { page = p; search(); }" />
      </div>
    </PageCard>

    <!-- 标签表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑标签' : '新增标签'" width="480px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="标签名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="分组" prop="tagGroup">
          <el-input v-model="form.tagGroup" placeholder="如：消费偏好、会员等级" />
        </el-form-item>
        <el-form-item label="类型" prop="tagType">
          <el-select v-model="form.tagType" style="width: 100%">
            <el-option label="手动" value="MANUAL" />
            <el-option label="自动" value="AUTO" />
          </el-select>
        </el-form-item>
        <el-form-item label="颜色">
          <div class="color-picker-row">
            <el-color-picker v-model="form.color" :predefine="colorPresets" />
            <el-input v-model="form.color" placeholder="#409EFF" style="width: 120px; margin-left: 8px" />
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortNo" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 打标签弹窗 -->
    <el-dialog v-model="tagCustomerVisible" title="为客户打标签" width="560px">
      <el-form label-width="100px">
        <el-form-item label="选择客户">
          <el-select v-model="tagCustomerForm.memberId" placeholder="搜索客户" filterable remote :remote-method="searchMembers" :loading="memberLoading" style="width: 100%">
            <el-option v-for="m in memberOptions" :key="m.memberId" :label="`${m.name} (${m.mobile})`" :value="m.memberId" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择标签">
          <el-select v-model="tagCustomerForm.tagIds" placeholder="选择标签" multiple style="width: 100%">
            <el-option v-for="t in allTags" :key="t.id" :label="t.name" :value="t.id">
              <div class="tag-option">
                <div class="color-dot" :style="{ background: t.color }" />
                <span>{{ t.name }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagCustomerVisible = false">取消</el-button>
        <el-button type="primary" :loading="tagLoading" @click="handleAddTag">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormRules } from "element-plus";
import PageCard from "../../components/PageCard.vue";
import { fetchCustomerTags, createCustomerTag, updateCustomerTag, deleteCustomerTag, addCustomerTag, fetchMembers } from "../../api";

const colorPresets = ["#409EFF", "#67C23A", "#E6A23C", "#F56C6C", "#909399", "#1890FF", "#13C2C2", "#722ED1"];

const list = ref<any[]>([]);
const allTags = ref<any[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const tagGroups = ref<string[]>([]);

const searchForm = reactive({ keyword: "", tagGroup: "", tagType: "" });
const form = reactive({ name: "", tagGroup: "", tagType: "", color: "#409EFF", sortNo: 0 });

const formRules: FormRules = {
  name: [{ required: true, message: '请输入标签名称' }],
  tagGroup: [{ required: true, message: '请输入分组' }],
  tagType: [{ required: true, message: '请选择类型' }]
};
const dialogVisible = ref(false);
const editing = ref(false);
const editingItem = ref<any>(null);
const formRef = ref();
const submitLoading = ref(false);

const tagCustomerVisible = ref(false);
const tagCustomerForm = reactive({ memberId: null as number | null, tagIds: [] as number[] });
const tagLoading = ref(false);
const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);

async function search() {
  loading.value = true;
  try {
    const res = await fetchCustomerTags({
      tagGroup: searchForm.tagGroup || undefined,
      page: page.value,
      pageSize: pageSize.value
    });
    const records = res.records || res.list || [];
    list.value = records;
    total.value = res.total || 0;
    tagGroups.value = [...new Set(records.map((r: any) => r.tagGroup).filter(Boolean))] as string[];
  } catch { ElMessage.error("加载标签失败"); }
  finally { loading.value = false; }
}

async function loadAllTags() {
  try {
    const res = await fetchCustomerTags({ page: 1, pageSize: 999 });
    allTags.value = (res.records || res.list || []);
  } catch { /* ignore */ }
}

async function loadData() { await search(); await loadAllTags(); }

function openDialog(row?: any) {
  editingItem.value = row || null;
  editing.value = !!row;
  if (row) {
    form.name = row.name; form.tagGroup = row.tagGroup; form.tagType = row.tagType;
    form.color = row.color || "#409EFF"; form.sortNo = row.sortNo || 0;
  } else {
    form.name = ""; form.tagGroup = ""; form.tagType = ""; form.color = "#409EFF"; form.sortNo = 0;
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitLoading.value = true;
  try {
    if (editing.value) {
      await updateCustomerTag(editingItem.value.id, { name: form.name, tagGroup: form.tagGroup, color: form.color, sortNo: form.sortNo });
      ElMessage.success("更新成功");
    } else {
      await createCustomerTag({ name: form.name, tagGroup: form.tagGroup, tagType: form.tagType, color: form.color, sortNo: form.sortNo });
      ElMessage.success("创建成功");
    }
    dialogVisible.value = false;
    await search();
  } catch { ElMessage.error("操作失败"); }
  finally { submitLoading.value = false; }
}

async function handleDelete(id: number) {
  try { await deleteCustomerTag(id); ElMessage.success("删除成功"); await search(); }
  catch { ElMessage.error("删除失败"); }
}

function openTagCustomerDialog() {
  tagCustomerForm.memberId = null;
  tagCustomerForm.tagIds = [];
  tagCustomerVisible.value = true;
}

async function searchMembers(query: string) {
  if (!query || query.length < 1) { memberOptions.value = []; return; }
  memberLoading.value = true;
  try {
    const res = await fetchMembers({ keyword: query, pageSize: 20 });
    memberOptions.value = (res.records || res.list || []);
  } catch { memberOptions.value = []; }
  finally { memberLoading.value = false; }
}

async function handleAddTag() {
  if (!tagCustomerForm.memberId || tagCustomerForm.tagIds.length === 0) {
    ElMessage.warning("请选择客户和标签");
    return;
  }
  tagLoading.value = true;
  try {
    await addCustomerTag({ customerId: tagCustomerForm.memberId, tagId: tagCustomerForm.tagIds[0] });
    ElMessage.success("打标签成功");
    tagCustomerVisible.value = false;
    await search();
  } catch { ElMessage.error("打标签失败"); }
  finally { tagLoading.value = false; }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.search-bar { display: flex; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
.color-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 1px solid #ddd; }
.color-picker-row { display: flex; align-items: center; }
.tag-option { display: flex; align-items: center; gap: 6px; }
</style>