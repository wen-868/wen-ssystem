<template>
  <div class="dashboard">
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <el-skeleton :rows="3" animated />
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col v-for="i in 8" :key="i" :xs="24" :sm="12" :md="6" style="margin-bottom: 16px">
          <el-skeleton animated>
            <template #template>
              <el-card style="min-height: 130px">
                <el-skeleton-item variant="text" style="width: 60%" />
                <el-skeleton-item variant="text" style="width: 40%; margin-top: 8px" />
                <el-skeleton-item variant="text" style="width: 80%; margin-top: 8px" />
              </el-card>
            </template>
          </el-skeleton>
        </el-col>
      </el-row>
      <el-row :gutter="16" style="margin-top: 8px">
        <el-col v-for="i in 6" :key="i" :xs="24" :sm="12" style="margin-bottom: 16px">
          <el-skeleton animated>
            <template #template>
              <el-card style="min-height: 300px">
                <el-skeleton-item variant="h3" style="width: 30%" />
                <el-skeleton-item variant="rect" style="height: 240px; margin-top: 16px" />
              </el-card>
            </template>
          </el-skeleton>
        </el-col>
      </el-row>
    </template>

    <!-- 错误状态 -->
    <template v-else-if="error">
      <el-result icon="error" title="数据加载失败" sub-title="请检查网络连接后重试">
        <template #extra>
          <el-button type="primary" @click="loadAllData">重新加载</el-button>
        </template>
      </el-result>
    </template>

    <!-- 正常内容 -->
    <template v-else>
      <!-- 顶部区域：欢迎语 + 日期 + 门店选择器 -->
      <div class="header-bar">
        <div class="header-left">
          <h2 class="welcome-text">{{ greeting }}，管理员</h2>
          <span class="date-text">{{ formattedDate }}</span>
        </div>
        <div class="header-right">
          <el-button
            type="primary"
            size="large"
            class="quick-cashier-btn"
            @click="navTo('/sales/create')"
          >
            <el-icon class="quick-cashier-icon"><ShoppingCart /></el-icon>
            开单收银
          </el-button>
          <el-select
            v-model="selectedStoreIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全部门店"
            clearable
            style="width: 240px"
            @change="onStoreChange"
          >
            <el-option
              v-for="store in storeList"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </div>
      </div>

      <!-- 指标卡片行 -->
      <el-row :gutter="16" style="margin-top: 16px">
        <el-col
          v-for="card in metricCards.slice(0, 4)"
          :key="card.label"
          :xs="24"
          :sm="12"
          :md="6"
          style="margin-bottom: 16px"
        >
          <el-card class="metric-card" shadow="hover">
            <div class="metric-card-inner">
              <div class="metric-header">
                <span class="metric-label">{{ card.label }}</span>
              </div>
              <div class="metric-value">{{ displayValues[card.key] || card.value }}</div>
              <div class="metric-footer">
                <div class="metric-compare">
                  <span class="compare-item" :class="card.momUp ? 'up' : 'down'">
                    <span class="compare-arrow">{{ card.momUp ? '↑' : '↓' }}</span>
                    环比 {{ card.momRate }}
                  </span>
                  <span class="compare-item yoy">
                    同比 {{ card.yoyRate }}
                  </span>
                </div>
              </div>
              <div
                v-if="card.sparkData && card.sparkData.length > 0"
                :ref="(el: any) => setSparkRef(card.key, el as HTMLElement)"
                class="spark-chart"
              />
              <div v-else class="spark-placeholder" />
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ========== 今日焦点（对标设计稿：待办 / 本页可帮你） ========== -->
      <div class="module-section focus-section">
        <el-row :gutter="16">
          <!-- 待办事项 -->
          <el-col :xs="24" :sm="12" :md="12" style="margin-bottom: 16px">
            <el-card class="focus-card">
              <template #header>
                <div class="focus-card-header">
                  <span class="focus-title">待办事项</span>
                  <span v-if="todoCount > 0" class="focus-badge">{{ todoCount }} 件待处理</span>
                </div>
              </template>
              <div v-if="todoCount === 0" class="focus-empty">今日无待办事项</div>
              <div v-else class="todo-list">
                <div v-if="alertData.inventoryAlerts.length" class="todo-item" @click="navTo('/inventory')">
                  <span class="todo-dot todo-dot--warning"></span>
                  <span class="todo-text">{{ alertData.inventoryAlerts.length }} 项库存预警</span>
                  <span class="todo-arrow">›</span>
                </div>
                <div v-if="alertData.expiryAlerts.length" class="todo-item" @click="navTo('/inventory')">
                  <span class="todo-dot todo-dot--warning"></span>
                  <span class="todo-text">{{ alertData.expiryAlerts.length }} 款商品临期</span>
                  <span class="todo-arrow">›</span>
                </div>
                <div v-if="alertData.overdueReceivables.length" class="todo-item" @click="navTo('/credit')">
                  <span class="todo-dot todo-dot--danger"></span>
                  <span class="todo-text">{{ alertData.overdueReceivables.length }} 笔应收待核销</span>
                  <span class="todo-arrow">›</span>
                </div>
                <div v-if="alertData.pendingOrders.length" class="todo-item" @click="navTo('/orders')">
                  <span class="todo-dot todo-dot--primary"></span>
                  <span class="todo-text">{{ alertData.pendingOrders.length }} 个待处理订单</span>
                  <span class="todo-arrow">›</span>
                </div>
              </div>
            </el-card>
          </el-col>

          <!-- 本页可帮你 -->
          <el-col :xs="24" :sm="12" :md="12" style="margin-bottom: 16px">
            <el-card class="focus-card">
              <template #header>
                <div class="focus-card-header">
                  <span class="focus-title">本页可帮你</span>
                </div>
              </template>
              <div class="help-list">
                <div class="help-item" @click="navTo('/finance/reconciliation')">
                  <span class="help-icon help-icon--blue">表</span>
                  <div class="help-content">
                    <div class="help-label">导出今日对账单</div>
                    <div class="help-desc">核对当日收支明细</div>
                  </div>
                  <span class="todo-arrow">›</span>
                </div>
                <div class="help-item" @click="navTo('/marketing/coupon')">
                  <span class="help-icon help-icon--orange">券</span>
                  <div class="help-content">
                    <div class="help-label">给沉睡会员发券</div>
                    <div class="help-desc">唤醒 30 天未消费会员</div>
                  </div>
                  <span class="todo-arrow">›</span>
                </div>
                <div class="help-item" @click="navTo('/credit')">
                  <span class="help-icon help-icon--red">欠</span>
                  <div class="help-content">
                    <div class="help-label">查客户欠款</div>
                    <div class="help-desc">应收账款与信用额度</div>
                  </div>
                  <span class="todo-arrow">›</span>
                </div>
                <div class="help-item" @click="navTo('/messages')">
                  <span class="help-icon help-icon--blue">讯</span>
                  <div class="help-content">
                    <div class="help-label">查看消息中心</div>
                    <div class="help-desc">系统通知与业务提醒</div>
                  </div>
                  <span class="todo-arrow">›</span>
                </div>
              </div>
            </el-card>
          </el-col>

        </el-row>
      </div>

      <!-- ========== 订单与对账（对标设计稿：最新订单 / 订单进度 / 云对账） ========== -->
      <div class="module-section order-section">
        <el-row :gutter="16">
          <!-- 左：最新订单 + 订单进度 -->
          <el-col :xs="24" :md="16" style="margin-bottom: 16px">
            <el-card class="focus-card">
              <template #header>
                <div class="focus-card-header">
                  <span class="focus-title">最新订单</span>
                  <span class="order-live">
                    <span class="assistant-dot"></span>
                    实时 · 共 {{ alertData.pendingOrders.length || 0 }} 单
                  </span>
                </div>
              </template>
              <div v-if="alertData.pendingOrders.length === 0" class="focus-empty">
                暂无最新订单
              </div>
              <el-table
                v-else
                :data="alertData.pendingOrders.slice(0, 6)"
                size="small"
                class="compact-table"
              >
                <el-table-column prop="orderNo" label="订单号" width="110" />
                <el-table-column prop="customerName" label="客户" min-width="100" />
                <el-table-column label="金额" width="110" align="right">
                  <template #default="{ row }">¥{{ Number(row.totalAmount ?? 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="{ row }">
                    <el-tag size="small" :type="orderStatusType(row.orderStatus)">
                      {{ orderStatusText(row.orderStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>

              <!-- 订单进度 -->
              <div class="order-progress">
                <div class="progress-item">
                  <span class="progress-label">待配送</span>
                  <span class="progress-value">{{ pendingCount('PENDING_DELIVERY') }}</span>
                </div>
                <div class="progress-item">
                  <span class="progress-label">待取货</span>
                  <span class="progress-value">{{ pendingCount('PENDING_PICKUP') }}</span>
                </div>
                <div class="progress-item">
                  <span class="progress-label">待收款</span>
                  <span class="progress-value">{{ pendingCount('PENDING_PAYMENT') }}</span>
                </div>
                <div class="progress-item">
                  <span class="progress-label">已完成</span>
                  <span class="progress-value">{{ pendingCount('COMPLETED') }}</span>
                </div>
              </div>
            </el-card>
          </el-col>

          <!-- 右：云对账 -->
          <el-col :xs="24" :md="8" style="margin-bottom: 16px">
            <el-card class="focus-card">
              <template #header>
                <div class="focus-card-header">
                  <span class="focus-title">云对账</span>
                  <span class="focus-badge">本周</span>
                </div>
              </template>
              <div class="recon-body">
                <div class="recon-item" @click="navTo('/finance/reconciliation')">
                  <span class="recon-label">待对账</span>
                  <span class="recon-value">¥{{ formatNum(overview.pendingReconAmount) }}</span>
                </div>
                <div class="recon-item" @click="navTo('/credit')">
                  <span class="recon-label">应收款待核销</span>
                  <span class="recon-value">{{ alertData.overdueReceivables.length }} 笔</span>
                </div>
                <div class="recon-tip">对账周期：本周 · 自动核对平台流水</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 数据分析（折叠展示，工作台保持精简，对标设计稿） ========== -->
      <el-collapse v-model="analysisCollapse" class="analysis-collapse">
        <el-collapse-item name="analysis">
          <!-- 销售统计模块 -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">销售统计</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 销售趋势 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>销售趋势</span>
                  <el-radio-group v-model="trendRange" size="small" @change="onTrendRangeChange">
                    <el-radio-button value="7">近7天</el-radio-button>
                    <el-radio-button value="30">近30天</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div v-if="salesTrendData.length === 0" class="chart-empty">
                <el-empty description="暂无销售数据" :image-size="80" />
              </div>
              <div v-else ref="salesTrendChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 品类占比 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>品类销售占比</span>
                </div>
              </template>
              <div v-if="categoryPieData.length === 0" class="chart-empty">
                <el-empty description="暂无品类数据" :image-size="80" />
              </div>
              <div v-else ref="categoryPieChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 销售排行 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>销售排行</span>
                  <el-radio-group v-model="rankingType" size="small" @change="onRankingTypeChange">
                    <el-radio-button value="product">商品</el-radio-button>
                    <el-radio-button value="customer">客户</el-radio-button>
                    <el-radio-button value="employee">员工</el-radio-button>
                  </el-radio-group>
                </div>
              </template>
              <div v-if="topData.length === 0" class="chart-empty">
                <el-empty description="暂无排行数据" :image-size="80" />
              </div>
              <div v-else ref="topChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 客户分类统计 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户分类统计</span>
                </div>
              </template>
              <div v-if="customerCategoryData.length === 0" class="chart-empty">
                <el-empty description="暂无客户数据" :image-size="80" />
              </div>
              <div v-else ref="customerCategoryChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 库存分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">库存分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 库存统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">库存总量</div>
                <div class="stat-value">{{ formatNum(inventoryStats.totalQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">可用库存</div>
                <div class="stat-value">{{ formatNum(inventoryStats.availableQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">锁定库存</div>
                <div class="stat-value">{{ formatNum(inventoryStats.lockedQty) }}瓶</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">库存价值</div>
                <div class="stat-value">¥{{ formatNum(inventoryStats.totalValue) }}</div>
              </div>
            </el-card>
          </el-col>

          <!-- 库存周转率 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>库存周转率</span>
                </div>
              </template>
              <div v-if="inventoryTurnoverData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="inventoryTurnoverChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 库存价值分析 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>库存价值分析</span>
                </div>
              </template>
              <div v-if="inventoryValueData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="inventoryValueChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 库存预警列表 -->
          <el-col :xs="24" style="margin-bottom: 16px">
            <el-card>
              <template #header>
                <div class="chart-card-header">
                  <span>库存预警</span>
                  <el-badge
                    :value="inventoryWarningData.length"
                    :hidden="inventoryWarningData.length === 0"
                    type="warning"
                    style="margin-left: 8px"
                  />
                </div>
              </template>
              <el-table :data="inventoryWarningData" size="small" empty-text="暂无库存预警">
                <el-table-column prop="skuName" label="商品名称" min-width="160" />
                <el-table-column prop="storeName" label="门店" width="120" />
                <el-table-column prop="currentStock" label="当前库存" width="100" />
                <el-table-column prop="warningThreshold" label="预警阈值" width="100" />
                <el-table-column prop="warningLevel" label="预警级别" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.warningLevel === 'URGENT' ? 'danger' : 'warning'">
                      {{ row.warningLevel === 'URGENT' ? '紧急' : row.warningLevel === 'WARNING' ? '警告' : '提示' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 客户分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">客户分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 客户统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">客户总数</div>
                <div class="stat-value">{{ customerStats.totalCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">今日新增</div>
                <div class="stat-value">{{ customerStats.todayNewCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">活跃客户</div>
                <div class="stat-value">{{ customerStats.activeCount }}人</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">客户留存率</div>
                <div class="stat-value">{{ customerActivity.retentionRate }}%</div>
              </div>
            </el-card>
          </el-col>

          <!-- 客户增长趋势 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户增长趋势</span>
                </div>
              </template>
              <div v-if="customerGrowthData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="customerGrowthChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 客户活跃度 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>客户活跃度分析</span>
                </div>
              </template>
              <div v-if="customerActivity.active30DaysCount === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="customerActivityChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- ========== 供应商分析模块 ========== -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">供应商分析</h3>
        </div>
        <el-row :gutter="16" style="margin-top: 8px">
          <!-- 供应商统计卡片 -->
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">供应商总数</div>
                <div class="stat-value">{{ supplierStats.totalCount }}家</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月新增</div>
                <div class="stat-value">{{ supplierStats.monthlyNewCount }}家</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月采购金额</div>
                <div class="stat-value">¥{{ formatNum(supplierStats.totalPurchaseAmount) }}</div>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="6" style="margin-bottom: 16px">
            <el-card class="stat-card">
              <div class="stat-item">
                <div class="stat-label">本月采购订单</div>
                <div class="stat-value">{{ supplierStats.purchaseOrderCount }}单</div>
              </div>
            </el-card>
          </el-col>

          <!-- 供应商采购排行 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商采购排行</span>
                </div>
              </template>
              <div v-if="supplierPurchaseRanking.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierPurchaseChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 供应商准时率 -->
          <el-col :xs="24" :sm="12" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商交货准时率</span>
                </div>
              </template>
              <div v-if="supplierOnTimeRateData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierOnTimeRateChartRef" class="chart-container" />
            </el-card>
          </el-col>

          <!-- 供应商合作趋势 -->
          <el-col :xs="24" style="margin-bottom: 16px">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-card-header">
                  <span>供应商合作趋势</span>
                </div>
              </template>
              <div v-if="supplierTrendData.length === 0" class="chart-empty">
                <el-empty description="暂无数据" :image-size="80" />
              </div>
              <div v-else ref="supplierTrendChartRef" class="chart-container" />
            </el-card>
          </el-col>
        </el-row>
      </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 预警区 -->
      <div class="module-section">
        <div class="module-header">
          <h3 class="module-title">预警中心</h3>
        </div>
        <el-collapse v-model="activeAlerts" style="margin-top: 8px">
          <!-- 临期预警 -->
          <el-collapse-item name="expiry">
            <template #title>
              <div class="alert-title">
                <span>临期预警</span>
                <el-badge
                  :value="alertData.expiryAlerts.length"
                  :hidden="alertData.expiryAlerts.length === 0"
                  type="danger"
                  style="margin-left: 8px"
                />
              </div>
            </template>
            <el-table :data="alertData.expiryAlerts" size="small" empty-text="暂无临期预警">
              <el-table-column prop="skuName" label="商品名称" min-width="160" />
              <el-table-column prop="batchNo" label="批次号" width="140" />
              <el-table-column prop="expiryDate" label="过期日期" width="120" />
            </el-table>
          </el-collapse-item>

          <!-- 应收逾期 -->
          <el-collapse-item name="overdue">
            <template #title>
              <div class="alert-title">
                <span>应收逾期</span>
                <el-badge
                  :value="alertData.overdueReceivables.length"
                  :hidden="alertData.overdueReceivables.length === 0"
                  type="danger"
                  style="margin-left: 8px"
                />
              </div>
            </template>
            <el-table :data="alertData.overdueReceivables" size="small" empty-text="暂无应收逾期">
              <el-table-column prop="customerName" label="客户名称" min-width="140" />
              <el-table-column label="应收金额" width="120">
                <template #default="{ row }">¥{{ formatNum(row.amount) }}</template>
              </el-table-column>
              <el-table-column prop="overdueDays" label="逾期天数" width="100" />
            </el-table>
          </el-collapse-item>

          <!-- 待处理订单 -->
          <el-collapse-item name="pendingOrders">
            <template #title>
              <div class="alert-title">
                <span>待处理订单</span>
                <el-badge
                  :value="alertData.pendingOrders.length"
                  :hidden="alertData.pendingOrders.length === 0"
                  type="primary"
                  style="margin-left: 8px"
                />
              </div>
            </template>
            <el-table :data="alertData.pendingOrders" size="small" empty-text="暂无待处理订单">
              <el-table-column prop="orderNo" label="订单号" width="160" />
              <el-table-column prop="customerName" label="客户" width="120" />
              <el-table-column label="金额" width="120">
                <template #default="{ row }">¥{{ formatNum(row.amount) }}</template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="100" />
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ShoppingCart } from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import {
  fetchDashboardOverview,
  fetchDashboardSalesTrend,
  fetchDashboardCategoryPie,
  fetchDashboardTopProducts,
  fetchDashboardTopCustomers,
  fetchDashboardRecentAlerts,
  fetchDashboardTopEmployees,
  fetchDashboardInventoryStats,
  fetchDashboardInventoryTurnover,
  fetchDashboardInventoryWarning,
  fetchDashboardInventoryValueAnalysis,
  fetchDashboardCustomerStats,
  fetchDashboardCustomerGrowthTrend,
  fetchDashboardCustomerActivity,
  fetchDashboardCustomerCategoryStats,
  fetchDashboardSupplierStats,
  fetchDashboardSupplierPurchaseRanking,
  fetchDashboardSupplierOnTimeRate,
  fetchDashboardSupplierTrend,
  fetchStores,
} from '../../api';

// ==================== 类型定义 ====================
interface MetricCard {
  key: string;
  label: string;
  value: string;
  momUp: boolean;
  momRate: string;
  yoyRate: string;
  sparkData: number[];
}

interface StoreItem {
  id: number;
  name: string;
}

interface SalesTrendItem {
  date: string;
  amount: number;
  orderCount: number;
}

interface CategoryPieItem {
  name: string;
  value: number;
}

interface TopProductItem {
  name: string;
  salesAmount: number;
  salesQty: number;
}

interface TopCustomerItem {
  name: string;
  amount: number;
}

interface TopEmployeeItem {
  employeeName: string;
  totalAmount: number;
  orderCount: number;
}

interface AlertData {
  inventoryAlerts: any[];
  expiryAlerts: any[];
  overdueReceivables: any[];
  pendingOrders: any[];
}

interface InventoryStats {
  totalQty: number;
  availableQty: number;
  lockedQty: number;
  skuCount: number;
  storeCount: number;
  totalValue: number;
}

interface InventoryTurnoverItem {
  month: string;
  soldQty: number;
  soldAmount: number;
  turnoverRate: number;
}

interface InventoryWarningItem {
  skuName: string;
  currentStock: number;
  warningThreshold: number;
  warningLevel: string;
  storeName: string;
}

interface InventoryValueItem {
  categoryName: string;
  skuCount: number;
  totalQty: number;
  totalValue: number;
  percentage: number;
}

interface CustomerStats {
  totalCount: number;
  todayNewCount: number;
  monthlyNewCount: number;
  wholesaleCount: number;
  retailCount: number;
  activeCount: number;
}

interface CustomerGrowthItem {
  month: string;
  newCustomers: number;
  activeCustomers: number;
}

interface CustomerActivity {
  active30DaysCount: number;
  active60DaysCount: number;
  avgOrderAmount: number;
  retentionRate: number;
}

interface CustomerCategoryItem {
  customerType: string;
  customerTypeLabel: string;
  customerCount: number;
  totalAmount: number;
  orderCount: number;
}

interface SupplierStats {
  totalCount: number;
  monthlyNewCount: number;
  activeCount: number;
  activeSupplierCount: number;
  totalPurchaseAmount: number;
  purchaseOrderCount: number;
}

interface SupplierPurchaseItem {
  supplierName: string;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
}

interface SupplierOnTimeRateItem {
  supplierName: string;
  totalOrders: number;
  onTimeOrders: number;
  delayedOrders: number;
  onTimeRate: number;
}

interface SupplierTrendItem {
  month: string;
  activeSupplierCount: number;
  totalAmount: number;
  orderCount: number;
}

// ==================== 状态 ====================
const loading = ref(true);
const error = ref(false);

// 门店
const storeList = ref<StoreItem[]>([]);
const selectedStoreIds = ref<number[]>([]);

// 概览数据
const overview = ref<any>({});

// 图表数据
const salesTrendData = ref<SalesTrendItem[]>([]);
const categoryPieData = ref<CategoryPieItem[]>([]);
const topProductsData = ref<TopProductItem[]>([]);
const topCustomersData = ref<TopCustomerItem[]>([]);
const topEmployeesData = ref<TopEmployeeItem[]>([]);
const alertData = ref<AlertData>({
  inventoryAlerts: [],
  expiryAlerts: [],
  overdueReceivables: [],
  pendingOrders: [],
});

// 库存分析数据
const inventoryStats = ref<InventoryStats>({
  totalQty: 0,
  availableQty: 0,
  lockedQty: 0,
  skuCount: 0,
  storeCount: 0,
  totalValue: 0,
});
const inventoryTurnoverData = ref<InventoryTurnoverItem[]>([]);
const inventoryWarningData = ref<InventoryWarningItem[]>([]);
const inventoryValueData = ref<InventoryValueItem[]>([]);

// 客户分析数据
const customerStats = ref<CustomerStats>({
  totalCount: 0,
  todayNewCount: 0,
  monthlyNewCount: 0,
  wholesaleCount: 0,
  retailCount: 0,
  activeCount: 0,
});
const customerGrowthData = ref<CustomerGrowthItem[]>([]);
const customerActivity = ref<CustomerActivity>({
  active30DaysCount: 0,
  active60DaysCount: 0,
  avgOrderAmount: 0,
  retentionRate: 0,
});
const customerCategoryData = ref<CustomerCategoryItem[]>([]);

// 供应商分析数据
const supplierStats = ref<SupplierStats>({
  totalCount: 0,
  monthlyNewCount: 0,
  activeCount: 0,
  activeSupplierCount: 0,
  totalPurchaseAmount: 0,
  purchaseOrderCount: 0,
});
const supplierPurchaseRanking = ref<SupplierPurchaseItem[]>([]);
const supplierOnTimeRateData = ref<SupplierOnTimeRateItem[]>([]);
const supplierTrendData = ref<SupplierTrendItem[]>([]);

// 图表控制
const trendRange = ref('7');
const rankingType = ref('product');
const activeAlerts = ref<string[]>([]);
/** 数据分析折叠区（工作台精简，默认收起） */
const analysisCollapse = ref<string[]>([]);

// 当前排行数据（根据 rankingType 动态切换）
const topData = computed(() => {
  switch (rankingType.value) {
    case 'product':
      return topProductsData.value;
    case 'customer':
      return topCustomersData.value;
    case 'employee':
      return topEmployeesData.value;
    default:
      return [];
  }
});

// ==================== 图表 DOM refs ====================
const salesTrendChartRef = ref<HTMLElement | null>(null);
const categoryPieChartRef = ref<HTMLElement | null>(null);
const topChartRef = ref<HTMLElement | null>(null);
const customerCategoryChartRef = ref<HTMLElement | null>(null);
const inventoryTurnoverChartRef = ref<HTMLElement | null>(null);
const inventoryValueChartRef = ref<HTMLElement | null>(null);
const customerGrowthChartRef = ref<HTMLElement | null>(null);
const customerActivityChartRef = ref<HTMLElement | null>(null);
const supplierPurchaseChartRef = ref<HTMLElement | null>(null);
const supplierOnTimeRateChartRef = ref<HTMLElement | null>(null);
const supplierTrendChartRef = ref<HTMLElement | null>(null);

// Spark 图表 DOM refs（动态绑定）
const sparkRefs: Record<string, HTMLElement | null> = {};
function setSparkRef(key: string, el: HTMLElement | null) {
  sparkRefs[key] = el;
}

// ==================== ECharts 实例管理 ====================
let salesTrendChart: echarts.ECharts | null = null;
let categoryPieChart: echarts.ECharts | null = null;
let topChart: echarts.ECharts | null = null;
let customerCategoryChart: echarts.ECharts | null = null;
let inventoryTurnoverChart: echarts.ECharts | null = null;
let inventoryValueChart: echarts.ECharts | null = null;
let customerGrowthChart: echarts.ECharts | null = null;
let customerActivityChart: echarts.ECharts | null = null;
let supplierPurchaseChart: echarts.ECharts | null = null;
let supplierOnTimeRateChart: echarts.ECharts | null = null;
let supplierTrendChart: echarts.ECharts | null = null;
const sparkCharts: Record<string, echarts.ECharts> = {};

// ==================== 计算属性 ====================
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const formattedDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[now.getDay()];
  return `${year}年${month}月${day}日 ${weekDay}`;
});

const metricCards = computed<MetricCard[]>(() => {
  const d = overview.value;
  const getRate = (val: any, defaultVal = '--') => {
    if (val === undefined || val === null) return defaultVal;
    return val;
  };
  const getBool = (val: any) => {
    if (val === undefined || val === null) return false;
    return Number(val) >= 0;
  };
  const getSpark = (val: any) => {
    if (Array.isArray(val) && val.length > 0) return val;
    return [];
  };
  return [
    {
      key: 'sales',
      label: '今日销售额',
      value: d.todaySalesAmount !== undefined ? `¥${formatNum(d.todaySalesAmount)}` : '¥0',
      momUp: getBool(d.salesMomRate),
      momRate: getRate(d.salesMomRate),
      yoyRate: getRate(d.salesYoyRate),
      sparkData: getSpark(d.salesSparkline),
    },
    {
      key: 'orders',
      label: '今日订单数',
      value: d.todayOrderCount !== undefined ? `${d.todayOrderCount}单` : '0单',
      momUp: getBool(d.ordersMomRate),
      momRate: getRate(d.ordersMomRate),
      yoyRate: getRate(d.ordersYoyRate),
      sparkData: getSpark(d.ordersSparkline),
    },
    {
      key: 'profit',
      label: '今日毛利',
      value: d.todayGrossProfit !== undefined ? `¥${formatNum(d.todayGrossProfit)}` : '¥0',
      momUp: getBool(d.profitMomRate),
      momRate: getRate(d.profitMomRate),
      yoyRate: getRate(d.profitYoyRate),
      sparkData: getSpark(d.profitSparkline),
    },
    {
      key: 'avgOrder',
      label: '客单价',
      value: d.avgOrderValue !== undefined ? `¥${formatNum(d.avgOrderValue)}` : '¥0',
      momUp: getBool(d.avgOrderMomRate),
      momRate: getRate(d.avgOrderMomRate),
      yoyRate: getRate(d.avgOrderYoyRate),
      sparkData: getSpark(d.avgOrderSparkline),
    },
    {
      key: 'collection',
      label: '待收款',
      value: d.pendingCollection !== undefined ? `¥${formatNum(d.pendingCollection)}` : '¥0',
      momUp: getBool(d.collectionMomRate),
      momRate: getRate(d.collectionMomRate),
      yoyRate: getRate(d.collectionYoyRate),
      sparkData: getSpark(d.collectionSparkline),
    },
    {
      key: 'inventory',
      label: '库存预警数',
      value: d.inventoryWarningCount !== undefined ? `${d.inventoryWarningCount}个` : '0个',
      momUp: getBool(d.inventoryMomRate),
      momRate: getRate(d.inventoryMomRate),
      yoyRate: getRate(d.inventoryYoyRate),
      sparkData: getSpark(d.inventorySparkline),
    },
    {
      key: 'pendingOrder',
      label: '待处理订单',
      value: d.pendingOrderCount !== undefined ? `${d.pendingOrderCount}个` : '0个',
      momUp: getBool(d.pendingOrderMomRate),
      momRate: getRate(d.pendingOrderMomRate),
      yoyRate: getRate(d.pendingOrderYoyRate),
      sparkData: getSpark(d.pendingOrderSparkline),
    },
    {
      key: 'newCustomer',
      label: '今日新增客户',
      value: d.todayNewCustomers !== undefined ? `${d.todayNewCustomers}个` : '0个',
      momUp: getBool(d.newCustomerMomRate),
      momRate: getRate(d.newCustomerMomRate),
      yoyRate: getRate(d.newCustomerYoyRate),
      sparkData: getSpark(d.newCustomerSparkline),
    },
  ];
});

/** 指标数字滚动显示值（交互打磨：数值从 0 平滑滚动到目标） */
const displayValues = ref<Record<string, string>>({});

/** 解析 "¥8,624.00" / "12单" / "¥0" 并做数字滚动动画 */
function animateMetricValue(key: string, value: string): void {
  const match = value.match(/^([¥￥]?)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) {
    displayValues.value[key] = value;
    return;
  }
  const prefix = match[1] || "";
  const suffix = match[3] || "";
  const target = parseFloat(match[2].replace(/,/g, ""));
  if (Number.isNaN(target)) {
    displayValues.value[key] = value;
    return;
  }
  const duration = 700;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = target * eased;
    displayValues.value[key] =
      prefix +
      val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 概览数据变化时，对前 4 个核心指标做数字滚动
watch(
  () => metricCards.value.slice(0, 4),
  (cards) => {
    cards.forEach((card) => animateMetricValue(card.key, card.value));
  },
  { deep: true }
);

/** 待办总数（库存预警 + 临期 + 应收逾期 + 待处理订单） */
const todoCount = computed(() => {
  return (
    alertData.value.inventoryAlerts.length +
    alertData.value.expiryAlerts.length +
    alertData.value.overdueReceivables.length +
    alertData.value.pendingOrders.length
  );
});

/** 工作台快捷跳转（目标页面不存在时提示） */
const router = useRouter();
function navTo(path: string) {
  const routes = router.getRoutes();
  const exists = routes.some((r) => r.path === path);
  if (exists) {
    router.push(path);
  } else {
    ElMessage.info("该功能开发中");
  }
}

/** 经营助手入口（AI 对话窗口由布局层悬浮组件承载） */
function handleAssistant() {
  ElMessage.info("经营助手已就绪，可点击右下角 AI 悬浮窗发起对话");
}

/** 订单状态文案映射 */
function orderStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: "待处理",
    PENDING_DELIVERY: "待配送",
    PENDING_PICKUP: "待取货",
    PENDING_PAYMENT: "待收款",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
  };
  return map[status] || status || "待处理";
}

/** 订单状态标签类型映射 */
function orderStatusType(status: string): "primary" | "success" | "warning" | "danger" | "info" {
  const map: Record<string, "primary" | "success" | "warning" | "danger" | "info"> = {
    PENDING: "warning",
    PENDING_DELIVERY: "primary",
    PENDING_PICKUP: "warning",
    PENDING_PAYMENT: "danger",
    COMPLETED: "success",
    CANCELLED: "info",
  };
  return map[status] || "info";
}

/** 按状态统计待处理订单数 */
function pendingCount(status: string): number {
  return alertData.value.pendingOrders.filter(
    (o: any) => String(o.orderStatus || o.status || "").toUpperCase() === status
  ).length;
}

// ==================== 工具函数 ====================
function formatNum(num: number): string {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==================== 门店变更 ====================
function onStoreChange() {
  loadAllData();
}

// ==================== 趋势范围切换 ====================
function onTrendRangeChange() {
  loadSalesTrend();
}

// ==================== 排行类型切换 ====================
function onRankingTypeChange() {
  if (rankingType.value === 'product') {
    loadTopProducts();
  } else if (rankingType.value === 'customer') {
    loadTopCustomers();
  } else if (rankingType.value === 'employee') {
    loadTopEmployees();
  }
}

// ==================== 数据加载 ====================
async function loadAllData() {
  loading.value = true;
  error.value = false;
  try {
    await Promise.all([
      loadOverview(),
      loadSalesTrend(),
      loadCategoryPie(),
      loadTopProducts(),
      loadTopCustomers(),
      loadTopEmployees(),
      loadAlerts(),
      loadInventoryData(),
      loadCustomerData(),
      loadSupplierData(),
    ]);
    loading.value = false;
  } catch (e) {
    console.error('加载仪表盘数据失败', e);
    loading.value = false;
    error.value = true;
  }
}

async function loadStores() {
  try {
    const data = await fetchStores();
    storeList.value = Array.isArray(data) ? data : (data?.records || data?.list || []);
  } catch (e) {
    console.error('加载门店列表失败', e);
  }
}

async function loadOverview() {
  try {
    const data = await fetchDashboardOverview();
    overview.value = data || {};
  } catch (e) {
    console.error('加载概览数据失败', e);
  }
}

async function loadSalesTrend() {
  try {
    const data = await fetchDashboardSalesTrend();
    salesTrendData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderSalesTrendChart();
  } catch (e) {
    console.error('加载销售趋势失败', e);
  }
}

async function loadCategoryPie() {
  try {
    const data = await fetchDashboardCategoryPie();
    categoryPieData.value = Array.isArray(data) ? data : [];
    await nextTick();
    renderCategoryPieChart();
  } catch (e) {
    console.error('加载品类占比失败', e);
  }
}

async function loadTopProducts() {
  try {
    const data = await fetchDashboardTopProducts();
    topProductsData.value = Array.isArray(data) ? data : [];
    if (rankingType.value === 'product') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载商品排行失败', e);
  }
}

async function loadTopCustomers() {
  try {
    const data = await fetchDashboardTopCustomers();
    topCustomersData.value = Array.isArray(data) ? data : [];
    if (rankingType.value === 'customer') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载客户排行失败', e);
  }
}

async function loadTopEmployees() {
  try {
    const data = await fetchDashboardTopEmployees();
    topEmployeesData.value = Array.isArray(data) ? data : [];
    if (rankingType.value === 'employee') {
      await nextTick();
      renderTopChart();
    }
  } catch (e) {
    console.error('加载员工排行失败', e);
  }
}

async function loadAlerts() {
  try {
    const data = await fetchDashboardRecentAlerts();
    alertData.value = {
      inventoryAlerts: Array.isArray(data?.inventoryAlerts) ? data.inventoryAlerts : [],
      expiryAlerts: Array.isArray(data?.expiryAlerts) ? data.expiryAlerts : [],
      overdueReceivables: Array.isArray(data?.overdueReceivables) ? data.overdueReceivables : [],
      pendingOrders: Array.isArray(data?.pendingOrders) ? data.pendingOrders : [],
    };
  } catch (e) {
    console.error('加载预警数据失败', e);
  }
}

// 库存分析数据加载
async function loadInventoryData() {
  try {
    const [stats, turnover, warning, value] = await Promise.all([
      fetchDashboardInventoryStats(),
      fetchDashboardInventoryTurnover(),
      fetchDashboardInventoryWarning(),
      fetchDashboardInventoryValueAnalysis(),
    ]);
    inventoryStats.value = stats || { totalQty: 0, availableQty: 0, lockedQty: 0, skuCount: 0, storeCount: 0, totalValue: 0 };
    inventoryTurnoverData.value = Array.isArray(turnover) ? turnover : [];
    inventoryWarningData.value = Array.isArray(warning) ? warning : [];
    inventoryValueData.value = Array.isArray(value) ? value : [];
    await nextTick();
    renderInventoryTurnoverChart();
    renderInventoryValueChart();
  } catch (e) {
    console.error('加载库存分析数据失败', e);
  }
}

// 客户分析数据加载
async function loadCustomerData() {
  try {
    const [stats, growth, activity, category] = await Promise.all([
      fetchDashboardCustomerStats(),
      fetchDashboardCustomerGrowthTrend(),
      fetchDashboardCustomerActivity(),
      fetchDashboardCustomerCategoryStats(),
    ]);
    customerStats.value = stats || { totalCount: 0, todayNewCount: 0, monthlyNewCount: 0, wholesaleCount: 0, retailCount: 0, activeCount: 0 };
    customerGrowthData.value = Array.isArray(growth) ? growth : [];
    customerActivity.value = activity || { active30DaysCount: 0, active60DaysCount: 0, avgOrderAmount: 0, retentionRate: 0 };
    customerCategoryData.value = Array.isArray(category) ? category : [];
    await nextTick();
    renderCustomerGrowthChart();
    renderCustomerActivityChart();
    renderCustomerCategoryChart();
  } catch (e) {
    console.error('加载客户分析数据失败', e);
  }
}

// 供应商分析数据加载
async function loadSupplierData() {
  try {
    const [stats, purchaseRanking, onTimeRate, trend] = await Promise.all([
      fetchDashboardSupplierStats(),
      fetchDashboardSupplierPurchaseRanking(),
      fetchDashboardSupplierOnTimeRate(),
      fetchDashboardSupplierTrend(),
    ]);
    supplierStats.value = stats || { totalCount: 0, monthlyNewCount: 0, activeCount: 0, activeSupplierCount: 0, totalPurchaseAmount: 0, purchaseOrderCount: 0 };
    supplierPurchaseRanking.value = Array.isArray(purchaseRanking) ? purchaseRanking : [];
    supplierOnTimeRateData.value = Array.isArray(onTimeRate) ? onTimeRate : [];
    supplierTrendData.value = Array.isArray(trend) ? trend : [];
    await nextTick();
    renderSupplierPurchaseChart();
    renderSupplierOnTimeRateChart();
    renderSupplierTrendChart();
  } catch (e) {
    console.error('加载供应商分析数据失败', e);
  }
}

// ==================== 图表渲染 ====================
function initChart(container: HTMLElement | null): echarts.ECharts | null {
  if (!container) return null;
  const instance = echarts.init(container);
  return instance;
}

function renderSalesTrendChart() {
  if (!salesTrendChartRef.value) return;
  if (!salesTrendChart) {
    salesTrendChart = initChart(salesTrendChartRef.value);
  }
  if (!salesTrendChart || salesTrendData.value.length === 0) return;

  const dates = salesTrendData.value.map((d: SalesTrendItem) => d.date);
  const amounts = salesTrendData.value.map((d: SalesTrendItem) => d.amount);
  const orders = salesTrendData.value.map((d: SalesTrendItem) => d.orderCount);

  salesTrendChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['销售额', '订单数'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: { rotate: dates.length > 14 ? 45 : 0 },
      },
      yAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
        },
        { type: 'value', name: '订单数', axisLabel: { formatter: (v: number) => v.toString() } },
      ],
      series: [
        {
          name: '销售额',
          type: 'line',
          data: amounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#409eff' },
          itemStyle: { color: '#409eff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,158,255,0.3)' },
              { offset: 1, color: 'rgba(64,158,255,0.05)' },
            ]),
          },
        },
        {
          name: '订单数',
          type: 'line',
          yAxisIndex: 1,
          data: orders,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#67c23a' },
          itemStyle: { color: '#67c23a' },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderCategoryPieChart() {
  if (!categoryPieChartRef.value) return;
  if (!categoryPieChart) {
    categoryPieChart = initChart(categoryPieChartRef.value);
  }
  if (!categoryPieChart || categoryPieData.value.length === 0) return;

  categoryPieChart.setOption(
    {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { type: 'scroll', orient: 'vertical', right: 10, top: 'center', itemWidth: 12, itemHeight: 12 },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: categoryPieData.value,
        },
      ],
    },
    { notMerge: true }
  );
}

function renderTopChart() {
  if (!topChartRef.value) return;
  if (!topChart) {
    topChart = initChart(topChartRef.value);
  }
  if (!topChart || topData.value.length === 0) return;

  let names: string[];
  let amounts: number[];
  let qtys: number[] | undefined;
  let seriesData: any[];

  if (rankingType.value === 'product') {
    const data = topData.value as TopProductItem[];
    names = data.map((d) => d.name).reverse();
    amounts = data.map((d) => d.salesAmount).reverse();
    qtys = data.map((d) => d.salesQty).reverse();
    seriesData = [
      {
        name: '销售额',
        type: 'bar',
        data: amounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#409eff' }, { offset: 1, color: '#79bbff' }]),
          borderRadius: [0, 4, 4, 0],
        },
      },
      {
        name: '销量',
        type: 'bar',
        xAxisIndex: 1,
        data: qtys,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#67c23a' }, { offset: 1, color: '#95d475' }]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ];
  } else if (rankingType.value === 'customer') {
    const data = topData.value as TopCustomerItem[];
    names = data.map((d) => d.name).reverse();
    amounts = data.map((d) => d.amount).reverse();
    seriesData = [
      {
        name: '消费金额',
        type: 'bar',
        data: amounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#e6a23c' }, { offset: 1, color: '#f3d19e' }]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ];
  } else {
    const data = topData.value as TopEmployeeItem[];
    names = data.map((d) => d.employeeName).reverse();
    amounts = data.map((d) => d.totalAmount).reverse();
    qtys = data.map((d) => d.orderCount).reverse();
    seriesData = [
      {
        name: '销售额',
        type: 'bar',
        data: amounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#909399' }, { offset: 1, color: '#c0c4cc' }]),
          borderRadius: [0, 4, 4, 0],
        },
      },
      {
        name: '订单数',
        type: 'bar',
        xAxisIndex: 1,
        data: qtys,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#b37feb' }, { offset: 1, color: '#d3adf7' }]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ];
  }

  const xAxis = rankingType.value === 'customer' ? [
    {
      type: 'value',
      name: '金额 (¥)',
      axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
    },
  ] : [
    {
      type: 'value',
      name: '金额 (¥)',
      axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
    },
    { type: 'value', name: rankingType.value === 'product' ? '销量' : '订单数' },
  ];

  const legendData = rankingType.value === 'customer' ? ['消费金额'] : ['销售额', rankingType.value === 'product' ? '销量' : '订单数'];

  topChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: legendData, bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '4%', containLabel: true },
      xAxis,
      yAxis: { type: 'category', data: names, axisLabel: { width: 100, overflow: 'truncate' } },
      series: seriesData,
    },
    { notMerge: true }
  );
}

function renderCustomerCategoryChart() {
  if (!customerCategoryChartRef.value) return;
  if (!customerCategoryChart) {
    customerCategoryChart = initChart(customerCategoryChartRef.value);
  }
  if (!customerCategoryChart || customerCategoryData.value.length === 0) return;

  const labels = customerCategoryData.value.map((d) => d.customerTypeLabel);
  const amounts = customerCategoryData.value.map((d) => d.totalAmount);
  const counts = customerCategoryData.value.map((d) => d.orderCount);

  customerCategoryChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['消费金额', '订单数'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '4%', containLabel: true },
      xAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
        },
        { type: 'value', name: '订单数' },
      ],
      yAxis: { type: 'category', data: labels },
      series: [
        {
          name: '消费金额',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f56c6c' }, { offset: 1, color: '#f89898' }]),
            borderRadius: [0, 4, 4, 0],
          },
        },
        {
          name: '订单数',
          type: 'bar',
          xAxisIndex: 1,
          data: counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8bc34a' }, { offset: 1, color: '#aed581' }]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderInventoryTurnoverChart() {
  if (!inventoryTurnoverChartRef.value) return;
  if (!inventoryTurnoverChart) {
    inventoryTurnoverChart = initChart(inventoryTurnoverChartRef.value);
  }
  if (!inventoryTurnoverChart || inventoryTurnoverData.value.length === 0) return;

  const months = inventoryTurnoverData.value.map((d) => d.month);
  const soldAmounts = inventoryTurnoverData.value.map((d) => d.soldAmount);
  const turnoverRates = inventoryTurnoverData.value.map((d) => d.turnoverRate);

  inventoryTurnoverChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['销售额', '周转率(%)'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: months, boundaryGap: false },
      yAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
        },
        { type: 'value', name: '周转率(%)', axisLabel: { formatter: (v: number) => `${v}%` } },
      ],
      series: [
        {
          name: '销售额',
          type: 'bar',
          data: soldAmounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#34d399' }]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '周转率(%)',
          type: 'line',
          yAxisIndex: 1,
          data: turnoverRates,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderInventoryValueChart() {
  if (!inventoryValueChartRef.value) return;
  if (!inventoryValueChart) {
    inventoryValueChart = initChart(inventoryValueChartRef.value);
  }
  if (!inventoryValueChart || inventoryValueData.value.length === 0) return;

  const categories = inventoryValueData.value.map((d) => d.categoryName);
  const values = inventoryValueData.value.map((d) => d.totalValue);

  inventoryValueChart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}<br/>库存价值: ¥${formatNum(params.value)}`,
      },
      legend: { type: 'scroll', orient: 'vertical', right: 10, top: 'center', itemWidth: 12, itemHeight: 12 },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: categories.map((name, index) => ({ name, value: values[index] })),
        },
      ],
    },
    { notMerge: true }
  );
}

function renderCustomerGrowthChart() {
  if (!customerGrowthChartRef.value) return;
  if (!customerGrowthChart) {
    customerGrowthChart = initChart(customerGrowthChartRef.value);
  }
  if (!customerGrowthChart || customerGrowthData.value.length === 0) return;

  const months = customerGrowthData.value.map((d) => d.month);
  const newCustomers = customerGrowthData.value.map((d) => d.newCustomers);
  const activeCustomers = customerGrowthData.value.map((d) => d.activeCustomers);

  customerGrowthChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['新增客户', '活跃客户'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: months, boundaryGap: false },
      yAxis: { type: 'value', name: '人数' },
      series: [
        {
          name: '新增客户',
          type: 'line',
          data: newCustomers,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#409eff' },
          itemStyle: { color: '#409eff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,158,255,0.3)' },
              { offset: 1, color: 'rgba(64,158,255,0.05)' },
            ]),
          },
        },
        {
          name: '活跃客户',
          type: 'line',
          data: activeCustomers,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#67c23a' },
          itemStyle: { color: '#67c23a' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(103,194,58,0.3)' },
              { offset: 1, color: 'rgba(103,194,58,0.05)' },
            ]),
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderCustomerActivityChart() {
  if (!customerActivityChartRef.value) return;
  if (!customerActivityChart) {
    customerActivityChart = initChart(customerActivityChartRef.value);
  }
  if (!customerActivityChart || customerActivity.value.active30DaysCount === 0) return;

  const activityData = [
    { name: '近30天活跃', value: customerActivity.value.active30DaysCount },
    { name: '30-60天活跃', value: customerActivity.value.active60DaysCount },
  ];

  customerActivityChart.setOption(
    {
      tooltip: { trigger: 'item', formatter: '{b}: {c}人' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{c}人 ({d}%)' },
          data: activityData,
        },
      ],
    },
    { notMerge: true }
  );
}

function renderSupplierPurchaseChart() {
  if (!supplierPurchaseChartRef.value) return;
  if (!supplierPurchaseChart) {
    supplierPurchaseChart = initChart(supplierPurchaseChartRef.value);
  }
  if (!supplierPurchaseChart || supplierPurchaseRanking.value.length === 0) return;

  const names = supplierPurchaseRanking.value.map((d) => d.supplierName).reverse();
  const amounts = supplierPurchaseRanking.value.map((d) => d.totalAmount).reverse();

  supplierPurchaseChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '4%', top: '4%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '金额 (¥)',
        axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
      },
      yAxis: { type: 'category', data: names, axisLabel: { width: 100, overflow: 'truncate' } },
      series: [
        {
          name: '采购金额',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f56c6c' }, { offset: 1, color: '#f89898' }]),
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderSupplierOnTimeRateChart() {
  if (!supplierOnTimeRateChartRef.value) return;
  if (!supplierOnTimeRateChart) {
    supplierOnTimeRateChart = initChart(supplierOnTimeRateChartRef.value);
  }
  if (!supplierOnTimeRateChart || supplierOnTimeRateData.value.length === 0) return;

  const names = supplierOnTimeRateData.value.map((d) => d.supplierName).reverse();
  const rates = supplierOnTimeRateData.value.map((d) => d.onTimeRate).reverse();

  supplierOnTimeRateChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '4%', top: '4%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '准时率(%)',
        max: 100,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      yAxis: { type: 'category', data: names, axisLabel: { width: 100, overflow: 'truncate' } },
      series: [
        {
          name: '准时率',
          type: 'bar',
          data: rates,
          itemStyle: {
            color: (params: any) => {
              const rate = params.value;
              if (rate >= 95) return '#67c23a';
              if (rate >= 80) return '#e6a23c';
              return '#f56c6c';
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    },
    { notMerge: true }
  );
}

function renderSupplierTrendChart() {
  if (!supplierTrendChartRef.value) return;
  if (!supplierTrendChart) {
    supplierTrendChart = initChart(supplierTrendChartRef.value);
  }
  if (!supplierTrendChart || supplierTrendData.value.length === 0) return;

  const months = supplierTrendData.value.map((d) => d.month);
  const amounts = supplierTrendData.value.map((d) => d.totalAmount);
  const orderCounts = supplierTrendData.value.map((d) => d.orderCount);
  const activeSupplierCounts = supplierTrendData.value.map((d) => d.activeSupplierCount);

  supplierTrendChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['采购金额', '订单数', '活跃供应商'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: months, boundaryGap: false },
      yAxis: [
        {
          type: 'value',
          name: '金额 (¥)',
          axisLabel: { formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toString()) },
        },
        { type: 'value', name: '数量' },
      ],
      series: [
        {
          name: '采购金额',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#409eff' }, { offset: 1, color: '#79bbff' }]),
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '订单数',
          type: 'line',
          yAxisIndex: 1,
          data: orderCounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#67c23a' },
          itemStyle: { color: '#67c23a' },
        },
        {
          name: '活跃供应商',
          type: 'line',
          yAxisIndex: 1,
          data: activeSupplierCounts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
        },
      ],
    },
    { notMerge: true }
  );
}

// ==================== Spark 迷你折线图 ====================
function renderSparkCharts() {
  Object.keys(sparkCharts).forEach((key) => {
    sparkCharts[key]?.dispose();
    delete sparkCharts[key];
  });
  nextTick(() => {
    metricCards.value.forEach((card: MetricCard) => {
      const el = sparkRefs[card.key];
      if (!el || !card.sparkData || card.sparkData.length === 0) return;
      const instance = echarts.init(el);
      sparkCharts[card.key] = instance;
      instance.setOption({
        grid: { left: 0, right: 0, top: 2, bottom: 0 },
        xAxis: { show: false, data: card.sparkData.map((_: number, i: number) => i) },
        yAxis: { show: false, min: (v: { min: number }) => v.min * 0.9, max: (v: { max: number }) => v.max * 1.1 },
        series: [
          {
            type: 'line',
            data: card.sparkData,
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 1.5, color: card.momUp ? '#f56c6c' : '#67c23a' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: card.momUp ? 'rgba(245,108,108,0.2)' : 'rgba(103,194,58,0.2)' },
                { offset: 1, color: 'rgba(255,255,255,0)' },
              ]),
            },
          },
        ],
      });
    });
  });
}

// 监听 metricCards 变化后重绘 spark
watch(metricCards, () => {
  renderSparkCharts();
}, { deep: true });

// ==================== 窗口大小响应 ====================
function handleResize() {
  salesTrendChart?.resize();
  categoryPieChart?.resize();
  topChart?.resize();
  customerCategoryChart?.resize();
  inventoryTurnoverChart?.resize();
  inventoryValueChart?.resize();
  customerGrowthChart?.resize();
  customerActivityChart?.resize();
  supplierPurchaseChart?.resize();
  supplierOnTimeRateChart?.resize();
  supplierTrendChart?.resize();
  Object.values(sparkCharts).forEach((c) => c?.resize());
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await loadStores();
  await loadAllData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  salesTrendChart?.dispose();
  categoryPieChart?.dispose();
  topChart?.dispose();
  customerCategoryChart?.dispose();
  inventoryTurnoverChart?.dispose();
  inventoryValueChart?.dispose();
  customerGrowthChart?.dispose();
  customerActivityChart?.dispose();
  supplierPurchaseChart?.dispose();
  supplierOnTimeRateChart?.dispose();
  supplierTrendChart?.dispose();
  Object.values(sparkCharts).forEach((c) => c?.dispose());
});
</script>

<style scoped>
.dashboard {
  padding: 4px;
}

/* 顶部栏 */
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.welcome-text {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.date-text {
  font-size: 14px;
  color: #909399;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.quick-cashier-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}
.quick-cashier-icon {
  font-size: 16px;
}

/* 指标卡片 */
.metric-card {
  cursor: pointer;
  border: 1px solid var(--border-light);
  transition: box-shadow 0.2s;
}
.metric-card:hover {
  box-shadow: var(--shadow-md);
}
.metric-card :deep(.el-card__body) {
  padding: 16px 20px 12px;
}
.metric-card-inner {
  display: flex;
  flex-direction: column;
}
.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.metric-label {
  font-size: 13px;
  color: var(--text-muted);
}
.metric-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 6px 0 4px;
  line-height: 1.2;
}
.metric-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.metric-compare {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.compare-item {
  display: flex;
  align-items: center;
  gap: 2px;
}
.compare-item.up {
  color: var(--color-danger);
}
.compare-item.down {
  color: var(--color-success);
}
.compare-item.yoy {
  color: var(--text-muted);
}
.compare-arrow {
  font-size: 12px;
}
.spark-chart {
  width: 100%;
  height: 40px;
  margin-top: 6px;
}
.spark-placeholder {
  height: 40px;
  margin-top: 6px;
}

/* ─── 今日焦点（待办 / 本页可帮你 / 经营助手） ─── */
.focus-card {
  border: 1px solid var(--border-light);
}
.focus-card :deep(.el-card__body) {
  padding: 4px 16px 12px;
}
.focus-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.focus-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.focus-badge {
  font-size: 12px;
  color: var(--color-warning);
  background: var(--color-warning-soft);
  padding: 2px 8px;
  border-radius: 4px;
}
.focus-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 0;
}
.todo-list {
  display: flex;
  flex-direction: column;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.todo-item:last-child {
  border-bottom: none;
}
.todo-item:hover .todo-text {
  color: var(--color-primary);
}
.todo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.todo-dot--warning {
  background: var(--color-warning);
}
.todo-dot--danger {
  background: var(--color-danger);
}
.todo-dot--primary {
  background: var(--color-primary);
}
.todo-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  transition: color 150ms;
}
.todo-arrow {
  color: var(--text-placeholder);
  font-size: 15px;
}
.help-list {
  display: flex;
  flex-direction: column;
}
.help-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.help-item:last-child {
  border-bottom: none;
}
.help-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  color: #ffffff;
}
.help-icon--blue {
  background: var(--color-primary);
}
.help-icon--orange {
  background: var(--color-warning);
}
.help-icon--red {
  background: var(--color-danger);
}
.help-content {
  flex: 1;
  min-width: 0;
}
.help-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.help-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.assistant-card {
  background: linear-gradient(180deg, #F8FAFF 0%, #FFFFFF 100%);
}
.assistant-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-success);
}
.assistant-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-success);
}
.assistant-body {
  padding: 8px 0;
}
.assistant-hello {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.assistant-tip {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 8px 0 14px;
  line-height: 1.6;
}
.assistant-actions {
  display: flex;
  gap: 10px;
}
.assistant-chip {
  font-size: 13px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.assistant-chip:hover {
  background: var(--color-primary-bg);
}
.assistant-footnote {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ─── 订单与对账区 ─── */
.order-live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.compact-table :deep(.el-table__header th) {
  background: var(--table-header-bg);
  color: var(--table-header-text);
  font-weight: 600;
  height: 38px;
}
.compact-table :deep(.el-table__row td) {
  height: 38px;
}
.order-progress {
  display: flex;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
.progress-item {
  flex: 1;
  text-align: center;
}
.progress-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}
.progress-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.recon-body {
  display: flex;
  flex-direction: column;
}
.recon-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.recon-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.recon-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}
.recon-tip {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 模块区域 */
.module-section {
  margin-top: 24px;
}
.module-header {
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid var(--color-primary);
  line-height: 1.2;
}
.module-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 统计卡片 */
.stat-card :deep(.el-card__body) {
  padding: 16px;
}
.stat-item {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

/* 图表卡片 */
.chart-card {
  min-height: 360px;
}
.chart-card :deep(.el-card__body) {
  padding: 12px 16px;
}
.chart-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.chart-container {
  width: 100%;
  height: 300px;
}
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
}

/* 预警区 */
.alert-title {
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

/* 响应式 */
@media (max-width: 768px) {
  .header-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .metric-value {
    font-size: 22px;
  }
  .stat-value {
    font-size: 20px;
  }
  .chart-container {
    height: 260px;
  }
  .chart-empty {
    height: 260px;
  }
}
</style>
