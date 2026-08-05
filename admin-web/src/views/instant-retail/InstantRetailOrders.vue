<template>
  <div class="page">
    <el-card>
      <div class="filter-bar">
        <div class="filter-left">
          <el-select v-model="statusFilter" placeholder="订单状态" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="待确认" value="PENDING" />
            <el-option label="已确认" value="CONFIRMED" />
            <el-option label="备货中" value="PREPARING" />
            <el-option label="配送中" value="DELIVERING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
            <el-option label="已退款" value="REFUNDED" />
          </el-select>
          <el-select v-model="paymentFilter" placeholder="支付状态" clearable style="width: 120px; margin-right: 12px" @change="loadData">
            <el-option label="未支付" value="UNPAID" />
            <el-option label="已支付" value="PAID" />
            <el-option label="已退款" value="REFUNDED" />
          </el-select>
          <el-select v-model="platformFilter" placeholder="平台类型" clearable style="width: 130px; margin-right: 12px" @change="loadData">
            <el-option label="美团外卖" value="MEITUAN" />
            <el-option label="饿了么" value="ELEME" />
            <el-option label="京东到家" value="JD" />
            <el-option label="自有小程序" value="MINIAPP" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 360px; margin-right: 12px"
            @change="loadData"
          />
        </div>
        <div class="filter-right">
          <el-input
            v-model="keyword"
            placeholder="搜索订单号/用户"
            clearable
            style="width: 220px; margin-right: 12px"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="loadData">
            <el-icon style="margin-right: 4px"><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <el-table :data="orders" v-loading="loading" stripe @row-click="viewDetail">
        <el-table-column prop="orderNo" label="订单号" width="200">
          <template #default="{ row }">
            <span class="order-no-text">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="110">
          <template #default="{ row }">
            <el-tag :type="getPlatformTagType(row.platform)" size="small">{{ getPlatformName(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">
            <div class="user-info">
              <div class="user-name">{{ row.userName }}</div>
              <div class="user-phone">{{ row.userPhone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="商品" width="100" align="center">
          <template #default="{ row }">
            {{ row.itemCount }}件
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="110" align="right">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.totalAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优惠" width="100" align="right">
          <template #default="{ row }">
            <span class="discount-text">-¥{{ Number(row.discountAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="配送费" width="100" align="right">
          <template #default="{ row }">
            <span>¥{{ Number(row.deliveryFee || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实付" width="110" align="right">
          <template #default="{ row }">
            <span class="pay-amount">¥{{ Number(row.payAmount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="配送方式" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.deliveryType === 'DELIVERY'" type="primary" size="small">配送</el-tag>
            <el-tag v-else type="success" size="small">自提</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.paymentStatus === 'PAID'" type="success" size="small">已支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'UNPAID'" type="danger" size="small">未支付</el-tag>
            <el-tag v-else-if="row.paymentStatus === 'REFUNDED'" type="warning" size="small">已退款</el-tag>
            <el-tag v-else size="small">{{ row.paymentStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">{{ getStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="160" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click.stop="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" size="small" link type="success" @click.stop="handleConfirm(row)">确认</el-button>
            <el-button v-if="['PENDING', 'CONFIRMED'].includes(row.status)" size="small" link type="danger" @click.stop="handleCancel(row)">取消</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无订单数据" />
        </template>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-drawer
      v-model="detailVisible"
      title="订单详情"
      size="900px"
      :close-on-click-modal="false"
      class="order-detail-drawer"
    >
      <div v-if="detail" class="detail-content">
        <div class="detail-section">
          <div class="section-title">
            <el-icon><InfoFilled /></el-icon>
            订单基本信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="平台">{{ getPlatformName(detail.platform) }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag :type="getStatusTagType(detail.status)" size="small">{{ getStatusName(detail.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="支付状态">
              <el-tag v-if="detail.paymentStatus === 'PAID'" type="success" size="small">已支付</el-tag>
              <el-tag v-else-if="detail.paymentStatus === 'UNPAID'" type="danger" size="small">未支付</el-tag>
              <el-tag v-else type="warning" size="small">已退款</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="配送方式">{{ detail.deliveryType === 'DELIVERY' ? '配送' : '自提' }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ detail.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ detail.paymentMethod || '-' }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ detail.paidAt || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Location /></el-icon>
            收货信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="收货人">{{ detail.address?.name || detail.userName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.address?.phone || detail.userPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货地址" :span="2">{{ detail.address?.address || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="detail-section" v-if="detail.remark">
          <div class="section-title">
            <el-icon><ChatDotRound /></el-icon>
            订单备注
          </div>
          <div class="remark-box">{{ detail.remark }}</div>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Goods /></el-icon>
            商品明细
          </div>
          <el-table :data="detail.items" size="small" border>
            <el-table-column label="商品图片" width="70" align="center">
              <template #default="{ row }">
                <el-image
                  v-if="row.productImage" lazy
                  :src="row.productImage"
                  fit="cover"
                  style="width: 48px; height: 48px; border-radius: 4px"
                />
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="200" />
            <el-table-column prop="sku" label="SKU" width="120" />
            <el-table-column label="单价" width="100" align="right">
              <template #default="{ row }">
                ¥{{ Number(row.price || 0).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="70" align="center" />
            <el-table-column label="小计" width="110" align="right">
              <template #default="{ row }">
                <span class="amount-text">¥{{ Number(row.subtotal || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Wallet /></el-icon>
            支付信息
          </div>
          <div class="amount-summary">
            <div class="amount-row">
              <span class="amount-label">商品总金额</span>
              <span class="amount-value">¥{{ Number(detail.totalAmount || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">优惠金额</span>
              <span class="amount-value discount-text">-¥{{ Number(detail.discountAmount || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">配送费</span>
              <span class="amount-value">¥{{ Number(detail.deliveryFee || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">包装费</span>
              <span class="amount-value">¥{{ Number(detail.packageFee || 0).toFixed(2) }}</span>
            </div>
            <div class="amount-row total">
              <span class="amount-label">实付金额</span>
              <span class="amount-value pay-amount">¥{{ Number(detail.payAmount || 0).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="detail.deliveryType === 'DELIVERY'">
          <div class="section-title">
            <el-icon><Van /></el-icon>
            配送信息
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="配送员">{{ detail.riderName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="配送员电话">{{ detail.riderPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="预计送达">{{ detail.estimatedDeliveryTime || '-' }}</el-descriptions-item>
            <el-descriptions-item label="实际送达">{{ detail.deliveredAt || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <el-icon><Clock /></el-icon>
            操作日志
          </div>
          <el-timeline>
            <el-timeline-item
              v-for="(log, index) in detail.logs"
              :key="index"
              :timestamp="log.time"
              :type="getLogType(index)"
              placement="top"
            >
              <div class="log-content">
                <span class="log-action">{{ log.action }}</span>
                <span class="log-operator">{{ log.operator }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button v-if="detail?.status === 'PENDING'" type="success" @click="handleConfirm(detail)">确认订单</el-button>
          <el-button v-if="['PENDING', 'CONFIRMED'].includes(detail?.status)" type="danger" @click="handleCancel(detail)">取消订单</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="cancelDialogVisible" title="取消订单" width="480px">
      <el-form :model="cancelForm" :rules="cancelRules" ref="cancelFormRef" label-width="100px">
        <el-form-item label="订单号">
          <el-input v-model="cancelForm.orderNo" disabled />
        </el-form-item>
        <el-form-item label="取消原因" prop="reason">
          <el-select v-model="cancelForm.reason" placeholder="请选择取消原因" style="width: 100%">
            <el-option label="用户取消" value="USER_CANCEL" />
            <el-option label="商家缺货" value="OUT_OF_STOCK" />
            <el-option label="配送超时" value="DELIVERY_TIMEOUT" />
            <el-option label="价格错误" value="PRICE_ERROR" />
            <el-option label="其他原因" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注说明" prop="remark">
          <el-input v-model="cancelForm.remark" type="textarea" :rows="3" placeholder="请输入备注说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialogVisible = false">返回</el-button>
        <el-button type="danger" :loading="cancelLoading" @click="submitCancel">确定取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Search, InfoFilled, Location, ChatDotRound, Goods, Wallet, Van, Clock } from "@element-plus/icons-vue";

const loading = ref(false);
const orders = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const statusFilter = ref("");
const paymentFilter = ref("");
const platformFilter = ref("");
const dateRange = ref<[string, string] | null>(null);

const detailVisible = ref(false);
const detail = ref<any>(null);

const cancelDialogVisible = ref(false);
const cancelFormRef = ref<FormInstance>();
const cancelLoading = ref(false);

const cancelForm = reactive({
  orderNo: "",
  reason: "",
  remark: ""
});

const cancelRules: FormRules = {
  reason: [{ required: true, message: "请选择取消原因", trigger: "change" }]
};

const statusMap: Record<string, { name: string; type: string }> = {
  PENDING: { name: "待确认", type: "primary" },
  CONFIRMED: { name: "已确认", type: "" },
  PREPARING: { name: "备货中", type: "warning" },
  DELIVERING: { name: "配送中", type: "info" },
  COMPLETED: { name: "已完成", type: "success" },
  CANCELLED: { name: "已取消", type: "info" },
  REFUNDED: { name: "已退款", type: "danger" }
};

const platformMap: Record<string, { name: string; type: string }> = {
  MEITUAN: { name: "美团外卖", type: "danger" },
  ELEME: { name: "饿了么", type: "primary" },
  JD: { name: "京东到家", type: "success" },
  MINIAPP: { name: "自有小程序", type: "warning" }
};

function getStatusName(status: string) {
  return statusMap[status]?.name || status;
}

function getStatusTagType(status: string) {
  return statusMap[status]?.type || "info";
}

function getPlatformName(platform: string) {
  return platformMap[platform]?.name || platform;
}

function getPlatformTagType(platform: string) {
  return platformMap[platform]?.type || "info";
}

function getLogType(index: number) {
  const types = ["primary", "success", "warning", "info", ""];
  return types[index % types.length];
}

const mockOrders = Array.from({ length: 28 }, (_, i) => {
  const statuses = ["PENDING", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED", "REFUNDED"];
  const platforms = ["MEITUAN", "ELEME", "JD", "MINIAPP"];
  const paymentStatuses = ["PAID", "UNPAID", "PAID", "PAID", "PAID", "PAID", "REFUNDED"];
  const status = statuses[i % 7];
  const total = [25.9, 68.5, 128.0, 45.6, 89.9, 35.0, 156.8][i % 7];
  const discount = [0, 5, 10, 0, 15, 3, 20][i % 7];
  const deliveryFee = [3, 5, 0, 4, 6, 0, 5][i % 7];
  
  return {
    id: i + 1,
    orderNo: `IR${String(20240101 + i).padStart(10, '0')}${String(i + 1).padStart(4, '0')}`,
    platform: platforms[i % 4],
    userName: ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九"][i % 7],
    userPhone: `138${String(10000000 + i * 137).slice(0, 8)}`,
    itemCount: Math.floor(Math.random() * 5) + 1,
    totalAmount: total,
    discountAmount: discount,
    deliveryFee: deliveryFee,
    packageFee: 2,
    payAmount: total - discount + deliveryFee + 2,
    deliveryType: i % 5 === 0 ? "PICKUP" : "DELIVERY",
    paymentStatus: paymentStatuses[i % 7],
    paymentMethod: ["微信支付", "支付宝", "微信支付", "微信支付", "支付宝"][i % 5],
    status: status,
    createdAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')} ${String(10 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    paidAt: status === 'UNPAID' || status === 'CANCELLED' ? null : `2024-01-${String((i % 28) + 1).padStart(2, '0')} ${String(10 + (i % 12)).padStart(2, '0')}:${String((i * 7 + 1) % 60).padStart(2, '0')}:30`,
    address: {
      name: ["张三", "李四", "王五", "赵六", "钱七"][i % 5],
      phone: `138${String(10000000 + i * 137).slice(0, 8)}`,
      address: `北京市朝阳区望京街道${i + 1}号院${i + 1}号楼${i + 1}单元${i + 1}01室`
    },
    remark: i % 3 === 0 ? "请尽快送达，谢谢！" : (i % 5 === 0 ? "不要放门口，敲门" : ""),
    riderName: i % 3 === 0 ? "骑手小王" : (i % 3 === 1 ? "骑手小李" : ""),
    riderPhone: i % 3 === 0 ? "15012345678" : (i % 3 === 1 ? "15187654321" : ""),
    estimatedDeliveryTime: i % 3 === 0 ? "30-45分钟" : "",
    deliveredAt: status === 'COMPLETED' ? `2024-01-${String((i % 28) + 1).padStart(2, '0')} ${String(11 + (i % 12)).padStart(2, '0')}:${String((i * 7 + 30) % 60).padStart(2, '0')}:00` : null,
    items: [
      {
        id: 1,
        productName: "有机西红柿 500g",
        sku: "SKU000001",
        productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=tomato%20product&image_size=square",
        price: 5.99,
        quantity: 2,
        subtotal: 11.98
      },
      {
        id: 2,
        productName: "富士苹果 约1kg",
        sku: "SKU000002",
        productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=apple%20product&image_size=square",
        price: 12.9,
        quantity: 1,
        subtotal: 12.9
      },
      {
        id: 3,
        productName: "伊利纯牛奶 250ml*12盒",
        sku: "SKU000003",
        productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=milk%20product&image_size=square",
        price: 45.0,
        quantity: 1,
        subtotal: 45.0
      }
    ].slice(0, (i % 3) + 1),
    logs: [
      { time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7) % 60).padStart(2, '0')}:00`, action: "用户下单", operator: "用户" },
      ...(status !== 'PENDING' ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7 + 2) % 60).padStart(2, '0')}:00`, action: "商家确认订单", operator: "商家-张店长" }] : []),
      ...(['PREPARING', 'DELIVERING', 'COMPLETED'].includes(status) ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7 + 5) % 60).padStart(2, '0')}:00`, action: "开始备货", operator: "商家-李拣货" }] : []),
      ...(['DELIVERING', 'COMPLETED'].includes(status) ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7 + 15) % 60).padStart(2, '0')}:00`, action: "骑手已取货", operator: "骑手小王" }] : []),
      ...(status === 'COMPLETED' ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7 + 35) % 60).padStart(2, '0')}:00`, action: "订单已完成", operator: "系统" }] : []),
      ...(status === 'CANCELLED' ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 10:${String((i * 7 + 3) % 60).padStart(2, '0')}:00`, action: "订单已取消", operator: "用户" }] : []),
      ...(status === 'REFUNDED' ? [{ time: `2024-01-${String((i % 28) + 1).padStart(2, '0')} 11:${String((i * 7) % 60).padStart(2, '0')}:00`, action: "退款已完成", operator: "系统" }] : [])
    ]
  };
});

function loadData() {
  loading.value = true;
  setTimeout(() => {
    let filtered = [...mockOrders];
    
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      filtered = filtered.filter(o => 
        o.orderNo.toLowerCase().includes(kw) || 
        o.userName.toLowerCase().includes(kw)
      );
    }
    if (statusFilter.value) {
      filtered = filtered.filter(o => o.status === statusFilter.value);
    }
    if (paymentFilter.value) {
      filtered = filtered.filter(o => o.paymentStatus === paymentFilter.value);
    }
    if (platformFilter.value) {
      filtered = filtered.filter(o => o.platform === platformFilter.value);
    }
    if (dateRange.value?.[0] && dateRange.value?.[1]) {
      filtered = filtered.filter(o => 
        o.createdAt >= dateRange.value![0] && o.createdAt <= dateRange.value![1]
      );
    }
    
    const start = (page.value - 1) * pageSize.value;
    orders.value = filtered.slice(start, start + pageSize.value);
    total.value = filtered.length;
    loading.value = false;
  }, 300);
}

function resetFilters() {
  keyword.value = "";
  statusFilter.value = "";
  paymentFilter.value = "";
  platformFilter.value = "";
  dateRange.value = null;
  page.value = 1;
  loadData();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  page.value = 1;
  loadData();
}

function handlePageChange(p: number) {
  page.value = p;
  loadData();
}

function viewDetail(row: any) {
  detail.value = row;
  detailVisible.value = true;
}

function handleConfirm(row: any) {
  ElMessageBox.confirm(`确定要确认订单「${row.orderNo}」吗？`, "确认订单", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    const item = orders.value.find(o => o.id === row.id);
    if (item) {
      item.status = "CONFIRMED";
      item.logs?.push({
        time: new Date().toLocaleString(),
        action: "商家确认订单",
        operator: "商家-张店长"
      });
    }
    if (detail.value?.id === row.id) {
      detail.value.status = "CONFIRMED";
    }
    ElMessage.success("订单已确认");
  }).catch(() => {});
}

function handleCancel(row: any) {
  cancelForm.orderNo = row.orderNo;
  cancelForm.reason = "";
  cancelForm.remark = "";
  cancelDialogVisible.value = true;
}

function submitCancel() {
  if (!cancelFormRef.value) return;
  cancelFormRef.value.validate((valid) => {
    if (!valid) return;
    cancelLoading.value = true;
    setTimeout(() => {
      const orderNo = cancelForm.orderNo;
      const item = orders.value.find(o => o.orderNo === orderNo);
      if (item) {
        item.status = "CANCELLED";
        item.logs?.push({
          time: new Date().toLocaleString(),
          action: `订单已取消（${cancelForm.reason}）`,
          operator: "商家"
        });
      }
      if (detail.value?.orderNo === orderNo) {
        detail.value.status = "CANCELLED";
      }
      ElMessage.success("订单已取消");
      cancelLoading.value = false;
      cancelDialogVisible.value = false;
    }, 500);
  });
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  padding: 20px;
}
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.filter-left, .filter-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}
.order-no-text {
  font-family: monospace;
  color: var(--el-color-primary);
  cursor: pointer;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-name {
  font-weight: 500;
}
.user-phone {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.amount-text {
  font-weight: 500;
}
.discount-text {
  color: var(--el-color-success);
}
.pay-amount {
  color: var(--el-color-danger);
  font-weight: 600;
  font-size: 15px;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.detail-content {
  padding: 0 4px;
}
.detail-section {
  margin-bottom: 24px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
.remark-box {
  padding: 12px 16px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.amount-summary {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px 16px;
}
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.amount-row.total {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 6px;
  padding-top: 12px;
  font-size: 16px;
}
.amount-label {
  color: var(--el-text-color-regular);
}
.log-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.log-action {
  font-weight: 500;
}
.log-operator {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
