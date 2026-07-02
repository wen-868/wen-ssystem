<template>
  <PageCard title="积分商城">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="商品管理" name="items">
        <div class="search-bar">
          <el-button type="primary" @click="handleAddItem">新增商品</el-button>
        </div>
        <el-table :data="items" v-loading="itemsLoading" stripe empty-text="暂无商品">
          <el-table-column prop="name" label="商品名称" min-width="140" />
          <el-table-column label="图片" width="80">
            <template #default="{ row }">
              <el-image
                v-if="row.image"
                :src="row.image"
                :preview-src-list="[row.image]"
                style="width: 40px; height: 40px; border-radius: 4px"
                fit="cover"
              />
              <span v-else style="color: #c0c4cc">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="points" label="所需积分" width="100" />
          <el-table-column prop="stock" label="库存" width="80" />
          <el-table-column prop="limitPerPerson" label="每人限兑" width="100" />
          <el-table-column label="有效期" width="160">
            <template #default="{ row }">
              {{ row.startDate || '-' }} ~ {{ row.endDate || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ON' ? 'success' : 'info'">
                {{ row.status === 'ON' ? '上架' : '下架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="handleEditItem(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="handleDeleteItem(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background layout="total, sizes, prev, pager, next, jumper"
            :total="itemsTotal" :page-size="itemsPageSize" :current-page="itemsPage"
            @size-change="handleItemsSizeChange" @current-change="handleItemsPageChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="兑换订单" name="orders">
        <div class="search-bar">
          <el-input v-model="orderSearch.keyword" placeholder="订单号/用户" clearable style="width: 200px" />
          <el-select v-model="orderSearch.status" placeholder="状态" clearable style="width: 120px">
            <el-option label="待发货" value="PENDING" />
            <el-option label="已发货" value="DELIVERED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
          <el-button @click="loadOrders">搜索</el-button>
        </div>
        <el-table :data="orders" v-loading="ordersLoading" stripe empty-text="暂无订单">
          <el-table-column prop="orderNo" label="订单号" width="180" />
          <el-table-column label="用户" min-width="120">
            <template #default="{ row }">{{ row.userName || row.userId }}</template>
          </el-table-column>
          <el-table-column prop="itemName" label="商品" min-width="140" />
          <el-table-column prop="points" label="积分" width="100" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="收货人" min-width="140">
            <template #default="{ row }">{{ row.receiverName }} / {{ row.receiverPhone }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'PENDING'" type="warning">待发货</el-tag>
              <el-tag v-else-if="row.status === 'DELIVERED'" type="success">已发货</el-tag>
              <el-tag v-else-if="row.status === 'CANCELLED'" type="info">已取消</el-tag>
              <el-tag v-else>{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="兑换时间" width="170">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-popconfirm
                v-if="row.status === 'PENDING'"
                title="确认发货？"
                @confirm="handleDeliver(row)"
              >
                <template #reference>
                  <el-button size="small" link type="success">发货</el-button>
                </template>
              </el-popconfirm>
              <span v-else style="color: #c0c4cc">-</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background layout="total, sizes, prev, pager, next, jumper"
            :total="ordersTotal" :page-size="ordersPageSize" :current-page="ordersPage"
            @size-change="handleOrdersSizeChange" @current-change="handleOrdersPageChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 商品弹窗 -->
    <el-dialog v-model="itemDialogVisible" :title="editingItem ? '编辑商品' : '新增商品'" width="550px">
      <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="100px">
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="itemForm.name" placeholder="请输入商品名称" />
        </el-form-item>
        <el-form-item label="商品图片">
          <el-input v-model="itemForm.image" placeholder="请输入图片URL" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="itemForm.description" type="textarea" :rows="2" placeholder="请输入商品描述" />
        </el-form-item>
        <el-form-item label="所需积分" prop="points">
          <el-input-number v-model="itemForm.points" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="itemForm.stock" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每人限兑">
          <el-input-number v-model="itemForm.limitPerPerson" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="itemForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="itemForm.status">
            <el-radio value="ON">上架</el-radio>
            <el-radio value="OFF">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="itemSubmitLoading" @click="handleItemSubmit">保存</el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import PageCard from "../components/PageCard.vue";
import { formatDate } from "../utils/format";
import {
  getPointsMallItems, createPointsMallItem, updatePointsMallItem, deletePointsMallItem,
  getPointsMallOrders, deliverPointsMallOrder
} from "../api";

const activeTab = ref("items");

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as any;
  return e?.response?.data?.message || e?.message || fallback;
}

// ── 商品管理 ──
const items = ref<any[]>([]);
const itemsLoading = ref(false);
const itemsTotal = ref(0);
const itemsPage = ref(1);
const itemsPageSize = ref(20);

const itemDialogVisible = ref(false);
const itemSubmitLoading = ref(false);
const itemFormRef = ref<FormInstance>();
const editingItem = ref<any>(null);

const itemForm = reactive({
  name: "",
  image: "",
  description: "",
  points: 100,
  stock: 100,
  limitPerPerson: 1,
  dateRange: [] as string[],
  sortOrder: 0,
  status: "ON"
});

const itemRules: FormRules = {
  name: [{ required: true, message: "请输入商品名称", trigger: "blur" }],
  points: [{ required: true, message: "请输入所需积分", trigger: "blur" }],
  stock: [{ required: true, message: "请输入库存", trigger: "blur" }]
};

async function loadItems() {
  itemsLoading.value = true;
  try {
    const data = await getPointsMallItems({ page: itemsPage.value, pageSize: itemsPageSize.value });
    items.value = data.records || [];
    itemsTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载商品列表失败"));
  } finally {
    itemsLoading.value = false;
  }
}

function handleItemsSizeChange(size: number) {
  itemsPageSize.value = size;
  itemsPage.value = 1;
  loadItems();
}

function handleItemsPageChange(p: number) {
  itemsPage.value = p;
  loadItems();
}

function handleAddItem() {
  editingItem.value = null;
  itemForm.name = "";
  itemForm.image = "";
  itemForm.description = "";
  itemForm.points = 100;
  itemForm.stock = 100;
  itemForm.limitPerPerson = 1;
  itemForm.dateRange = [];
  itemForm.sortOrder = 0;
  itemForm.status = "ON";
  itemDialogVisible.value = true;
}

function handleEditItem(row: any) {
  editingItem.value = row;
  itemForm.name = row.name;
  itemForm.image = row.image || "";
  itemForm.description = row.description || "";
  itemForm.points = row.points;
  itemForm.stock = row.stock;
  itemForm.limitPerPerson = row.limitPerPerson || 1;
  itemForm.dateRange = row.startDate && row.endDate ? [row.startDate, row.endDate] : [];
  itemForm.sortOrder = row.sortOrder || 0;
  itemForm.status = row.status;
  itemDialogVisible.value = true;
}

async function handleItemSubmit() {
  if (!itemFormRef.value) return;
  await itemFormRef.value.validate(async (valid) => {
    if (!valid) return;
    itemSubmitLoading.value = true;
    try {
      const payload: any = {
        name: itemForm.name,
        image: itemForm.image,
        description: itemForm.description,
        points: itemForm.points,
        stock: itemForm.stock,
        limitPerPerson: itemForm.limitPerPerson,
        sortOrder: itemForm.sortOrder,
        status: itemForm.status
      };
      if (itemForm.dateRange && itemForm.dateRange.length === 2) {
        payload.startDate = itemForm.dateRange[0];
        payload.endDate = itemForm.dateRange[1];
      }
      if (editingItem.value) {
        await updatePointsMallItem(editingItem.value.id, payload);
        ElMessage.success("商品已更新");
      } else {
        await createPointsMallItem(payload);
        ElMessage.success("商品已创建");
      }
      itemDialogVisible.value = false;
      loadItems();
    } catch (e: any) {
      ElMessage.error(getErrorMessage(e, "操作失败"));
    } finally {
      itemSubmitLoading.value = false;
    }
  });
}

async function handleDeleteItem(row: any) {
  try {
    await deletePointsMallItem(row.id);
    ElMessage.success("商品已删除");
    loadItems();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "删除失败"));
  }
}

// ── 兑换订单 ──
const orders = ref<any[]>([]);
const ordersLoading = ref(false);
const ordersTotal = ref(0);
const ordersPage = ref(1);
const ordersPageSize = ref(20);
const orderSearch = reactive({ keyword: "", status: "" });

async function loadOrders() {
  ordersLoading.value = true;
  try {
    const data = await getPointsMallOrders({
      page: ordersPage.value,
      pageSize: ordersPageSize.value,
      keyword: orderSearch.keyword || undefined,
      status: orderSearch.status || undefined
    });
    orders.value = data.records || [];
    ordersTotal.value = data.total || 0;
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "加载订单列表失败"));
  } finally {
    ordersLoading.value = false;
  }
}

function handleOrdersSizeChange(size: number) {
  ordersPageSize.value = size;
  ordersPage.value = 1;
  loadOrders();
}

function handleOrdersPageChange(p: number) {
  ordersPage.value = p;
  loadOrders();
}

async function handleDeliver(row: any) {
  try {
    await deliverPointsMallOrder(row.id);
    ElMessage.success("发货成功");
    loadOrders();
  } catch (e: any) {
    ElMessage.error(getErrorMessage(e, "发货失败"));
  }
}

function handleTabChange(name: string) {
  if (name === "orders") loadOrders();
}

onMounted(() => {
  loadItems();
});
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>