<template>
  <div>
    <div style="display: flex; gap: 12px; margin-bottom: 20px">
      <el-input
        v-model="searchKeyword"
        placeholder="输入会员手机号或卡号搜索"
        style="width: 300px"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button type="primary" @click="showScanDialog = true">扫码识别</el-button>
    </div>

    <!-- 搜索结果列表 -->
    <el-card v-if="searchResults.length > 0" style="margin-bottom: 20px">
      <template #header>
        <span>搜索结果（{{ searchResults.length }}条）</span>
      </template>
      <el-table :data="searchResults" size="small">
        <el-table-column prop="name" label="会员姓名" />
        <el-table-column prop="mobile" label="手机号" width="120" />
        <el-table-column prop="memberNo" label="会员卡号" width="140" />
        <el-table-column prop="level" label="会员等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)" size="small">
              {{ getLevelName(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分余额" width="100">
          <template #default="{ row }">
            <span style="color: #9b1c31; font-weight: bold">{{ row.points || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="storeValue" label="储值余额" width="100">
          <template #default="{ row }">
            {{ formatYuan(row.storeValue || 0) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="loadMemberDetail(row.id)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 会员详情卡片 -->
    <el-card v-if="memberDetail" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>会员信息</span>
          <el-tag :type="getLevelTagType(memberDetail.level)" size="small">
            {{ getLevelName(memberDetail.level) }}
          </el-tag>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="会员卡号">{{ memberDetail.memberNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ memberDetail.name || "-" }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ memberDetail.mobile || "-" }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ memberDetail.gender === "MALE" ? "男" : memberDetail.gender === "FEMALE" ? "女" : "-" }}</el-descriptions-item>
        <el-descriptions-item label="出生日期">{{ memberDetail.birthDate || "-" }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ memberDetail.createdAt || "-" }}</el-descriptions-item>
      </el-descriptions>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px">
        <div class="stat-card">
          <div class="stat-value" style="color: #9b1c31">{{ memberDetail.points || 0 }}</div>
          <div class="stat-label">积分余额</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #67c23a">{{ formatYuan(memberDetail.storeValue || 0) }}</div>
          <div class="stat-label">储值余额</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #409eff">{{ memberDetail.totalConsumption || 0 }}</div>
          <div class="stat-label">累计消费次数</div>
        </div>
      </div>
    </el-card>

    <!-- 积分明细 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>积分明细</span>
          <el-button size="small" @click="loadPointsHistory">刷新</el-button>
        </div>
      </template>
      <el-table :data="pointsHistory" size="small">
        <el-table-column prop="changeType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.changeType === 'INCOME' ? 'success' : 'danger'" size="small">
              {{ row.changeType === 'INCOME' ? '获得' : '消耗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.changeType === 'INCOME' ? '#67c23a' : '#f56c6c' }">
              {{ row.changeType === 'INCOME' ? '+' : '-' }}{{ row.points }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balance" label="余额" width="100" />
        <el-table-column prop="reason" label="原因" />
        <el-table-column prop="createdAt" label="时间" width="160" />
      </el-table>
      <div v-if="pointsHistory.length === 0" style="text-align: center; padding: 20px; color: #999">
        {{ pointsLoading ? "加载中..." : "暂无积分记录" }}
      </div>
    </el-card>

    <!-- 消费记录 -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>消费记录</span>
          <el-button size="small" @click="loadMemberOrders">刷新</el-button>
        </div>
      </template>
      <el-table :data="memberOrders" size="small">
        <el-table-column prop="orderNo" label="订单号" width="140" />
        <el-table-column prop="orderAmount" label="订单金额" width="120">
          <template #default="{ row }">
            {{ formatYuan(row.orderAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="payAmount" label="实付金额" width="120">
          <template #default="{ row }">
            {{ formatYuan(row.payAmount || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="payMethod" label="支付方式" width="100">
          <template #default="{ row }">
            {{ getPayMethodName(row.payMethod) }}
          </template>
        </el-table-column>
        <el-table-column prop="orderStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.orderStatus)" size="small">
              {{ getOrderStatusName(row.orderStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="消费时间" width="160" />
      </el-table>
      <div v-if="memberOrders.length === 0" style="text-align: center; padding: 20px; color: #999">
        {{ ordersLoading ? "加载中..." : "暂无消费记录" }}
      </div>
    </el-card>

    <!-- 扫码弹窗 -->
    <el-dialog v-model="showScanDialog" title="扫码识别会员" width="400px">
      <div style="text-align: center; padding: 20px">
        <div style="width: 200px; height: 200px; margin: 0 auto; background: #f5f7fa; border-radius: 8px; display: flex; align-items: center; justify-content: center">
          <div style="color: #909399">扫码区域</div>
        </div>
        <p style="margin-top: 16px; color: #909399">请使用扫码枪扫描会员二维码或条形码</p>
      </div>
      <el-input v-model="scanInput" placeholder="或手动输入会员卡号/手机号" style="margin-top: 16px" @keyup.enter="handleScan" />
      <template #footer>
        <el-button @click="showScanDialog = false">取消</el-button>
        <el-button type="primary" @click="handleScan">确认识别</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import {
  searchMember,
  getMemberDetail,
  getMemberPointsHistory,
  getMemberOrders
} from "../api";
import { formatYuan } from "../utils/format";

const searchKeyword = ref("");
const searchResults = ref<any[]>([]);
const memberDetail = ref<any>(null);
const pointsHistory = ref<any[]>([]);
const memberOrders = ref<any[]>([]);

const pointsLoading = ref(false);
const ordersLoading = ref(false);
const showScanDialog = ref(false);
const scanInput = ref("");

function getLevelName(level: string) {
  const map: Record<string, string> = {
    VIP: "VIP会员",
    GOLD: "黄金会员",
    SILVER: "白银会员",
    BRONZE: "青铜会员",
    NORMAL: "普通会员"
  };
  return map[level] || level;
}

function getLevelTagType(level: string) {
  const map: Record<string, string> = {
    VIP: "danger",
    GOLD: "warning",
    SILVER: "info",
    BRONZE: "success",
    NORMAL: ""
  };
  return map[level] || "";
}

function getPayMethodName(method: string) {
  const map: Record<string, string> = {
    CASH: "现金",
    WECHAT: "微信",
    ALIPAY: "支付宝",
    STORE_VALUE: "储值卡"
  };
  return map[method] || method;
}

function getOrderStatusName(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "已完成",
    PAID: "已支付",
    CREATED: "已创建",
    CANCELLED: "已取消",
    RETURNED: "已退货"
  };
  return map[status] || status;
}

function getStatusTagType(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "success",
    PAID: "success",
    CREATED: "warning",
    CANCELLED: "danger",
    RETURNED: "info"
  };
  return map[status] || "";
}

async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    ElMessage.warning("请输入搜索关键词");
    return;
  }
  try {
    const data = await searchMember(searchKeyword.value.trim());
    searchResults.value = data?.records || [];
    if (searchResults.value.length === 0) {
      ElMessage.info("未找到匹配的会员");
    }
  } catch {
    ElMessage.warning("搜索失败");
  }
}

async function loadMemberDetail(memberId: number) {
  try {
    const data = await getMemberDetail(memberId);
    memberDetail.value = data;
    searchResults.value = [];
    searchKeyword.value = "";
    await Promise.all([loadPointsHistory(memberId), loadMemberOrders(memberId)]);
  } catch {
    ElMessage.warning("会员详情加载失败");
  }
}

async function loadPointsHistory(memberId?: number) {
  const id = memberId || memberDetail.value?.id;
  if (!id) return;
  pointsLoading.value = true;
  try {
    const data = await getMemberPointsHistory(id);
    pointsHistory.value = data?.records || [];
  } catch {
    ElMessage.warning("积分明细加载失败");
  } finally {
    pointsLoading.value = false;
  }
}

async function loadMemberOrders(memberId?: number) {
  const id = memberId || memberDetail.value?.id;
  if (!id) return;
  ordersLoading.value = true;
  try {
    const data = await getMemberOrders(id);
    memberOrders.value = data?.records || [];
  } catch {
    ElMessage.warning("消费记录加载失败");
  } finally {
    ordersLoading.value = false;
  }
}

function handleScan() {
  if (!scanInput.value.trim()) {
    ElMessage.warning("请输入会员卡号或手机号");
    return;
  }
  searchKeyword.value = scanInput.value.trim();
  showScanDialog.value = false;
  scanInput.value = "";
  handleSearch();
}
</script>

<style scoped>
.stat-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
