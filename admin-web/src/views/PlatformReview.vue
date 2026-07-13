<template>
  <div class="platform-review-page">
    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-primary">
        <div class="stat-icon"><el-icon :size="24"><Star /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">评价总数</div>
          <div class="stat-value">{{ stats.totalCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-icon"><el-icon :size="24"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">好评率</div>
          <div class="stat-value">{{ stats.positiveRate }}%</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon"><el-icon :size="24"><Clock /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">待审核</div>
          <div class="stat-value">{{ stats.pendingCount }}</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon"><el-icon :size="24"><Message /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">已回复</div>
          <div class="stat-value">{{ stats.repliedCount }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>评价趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="chart-header">
              <span>评分分布</span>
            </div>
          </template>
          <div ref="ratingChartRef" class="chart-body"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="平台名称">
          <el-input v-model="searchForm.platformName" placeholder="请输入平台名称" clearable />
        </el-form-item>
        <el-form-item label="审核类型">
          <el-select v-model="searchForm.reviewType" placeholder="请选择类型" clearable>
            <el-option label="商品" :value="1" />
            <el-option label="店铺" :value="2" />
            <el-option label="会员" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="待审核" :value="0" />
            <el-option label="审核通过" :value="1" />
            <el-option label="审核拒绝" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分">
          <el-select v-model="searchForm.rating" placeholder="请选择评分" clearable>
            <el-option label="1星" :value="1" />
            <el-option label="2星" :value="2" />
            <el-option label="3星" :value="3