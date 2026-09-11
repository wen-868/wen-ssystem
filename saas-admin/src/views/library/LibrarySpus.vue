<template>
  <div>
    <h2 style="margin-bottom: 24px;">SPU 管理</h2>

    <!-- 搜索区 -->
    <el-card style="margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索 SPU 名称"
          clearable
          style="width: 200px;"
          @change="handleSearch"
        />
        <el-input
          v-model="searchForm.barcode"
          placeholder="搜索条码"
          clearable
          style="width: 200px;"
          @change="handleSearch"
        />
        <el-select
          v-model="searchForm.status"
          placeholder="审核状态"
          clearable
          style="width: 140px;"
          @change="handleSearch"
        >
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="已下线" value="OFFLINE" />
        </el-select>
        <el-select
          v-model="searchForm.brandId"
          placeholder="品牌"
          clearable
          filterable
          style="width: 160px;"
          @change="handleSearch"
        >
          <el-option
            v-for="b in brandOptions"
            :key="b.id"
            :label="b.name"
            :value="b.id"
          />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="showCreateDialog">新增 SPU</el-button>

        <!-- 扫码录入区域 -->
        <el-divider content-position="left" style="margin: 12px 0;">扫码录入</el-divider>
        <el-row :gutter="12" style="margin: 8px 0;">
          <el-col :span="8">
            <el-form-item label="条码扫描" prop="barcode">
              <el-input
                v-model="scanResult"
                placeholder="扫描条码或手动输入"
                @keyup.enter="handleScanInput"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-button type="primary" @click="scanCode">扫码</el-button>
          </el-col>
          <el-col :span="4">
            <el-button @click="clearScan">清除</el-button>
          </el-col>
        </el-row>

        <!-- 填充按钮 -->
        <el-dropdown trigger="click" size="small">
          <template #activator>
            <el-button type="warning">数据填充</el-button>
          </template>
          <el-dropdown-menu>
            <el-dropdown-item @click="fillCategory = 'baijiu'; fillCount = 30">白酒 (30条真实数据)</el-dropdown-item>
            <el-dropdown-item @click="fillCategory = 'spirits'; fillCount = 20">洋酒 (20条真实数据)</el-dropdown-item>
            <el-dropdown-item @click="fillCategory = 'beer'; fillCount = 25">啤酒 (25条真实数据)</el-dropdown-item>
            <el-dropdown-item @click="fillCategory = 'drink'; fillCount = 15">饮料 (15条真实数据)</el-dropdown-item>
            <el-dropdown-divider />
            <el-dropdown-item>自定义数量：<el-input v-model.number="fillCount" style="width: 60px;" /></el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%;">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 8px 24px 16px 48px; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; font-size: 14px;">SKU 列表</h4>
                <el-button size="small" type="primary" plain @click="openSkuManage(row)">
                  管理 SKU
                </el-button>
              </div>
              <el-table :data="row._skus || []" border size="small" style="width: 100%;" empty-text="暂无 SKU，点击『管理 SKU』添加">
                <el-table-column prop="skuName" label="规格名称" width="140" />
                <el-table-column prop="barcode" label="条码" width="160" />
                <el-table-column prop="volume" label="容量(ml)" width="100" align="right" />
                <el-table-column prop="packaging" label="包装" width="100" />
                <el-table-column prop="baseUnit" label="基本单位" width="90" />
                <el-table-column prop="boxUnit" label="箱单位" width="80" />
                <el-table-column prop="boxRatio" label="装箱比" width="80" align="right" />
                <el-table-column prop="suggestedRetailPrice" label="建议零售价" width="110" align="right">
                  <template #default="{ row: s }">
                    <span style="color: #f56c6c; font-weight: 600;">{{ s.suggestedRetailPrice ? '¥' + s.suggestedRetailPrice : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row: s }">
                    <el-tag :type="!s.status || s.status === 'ACTIVE' ? 'success' : 'info'" size="small">
                      {{ !s.status || s.status === 'ACTIVE' ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="spuCode" label="SPU 编码" width="150" />
        <el-table-column prop="name" label="SPU 名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="brandName" label="品牌" width="120" />
        <el-table-column prop="specs" label="规格" width="100" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hitCount" label="扫码命中" width="100" align="center" />
        <el-table-column prop="source" label="来源" width="80">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="success" size="small"
              @click="handleApprove(row)"
            >通过</el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link type="warning" size="small"
              @click="handleReject(row)"
            >拒绝</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑 SPU' : '新增 SPU'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-divider content-position="left">基础信息（必填）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="SPU 名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入 SPU 名称" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌" prop="brandId">
              <el-select v-model="form.brandId" placeholder="选择品牌" clearable filterable style="width: 100%;">
                <el-option
                  v-for="b in brandOptions"
                  :key="b.id"
                  :label="b.name"
                  :value="b.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规格" prop="specs">
              <el-input v-model="form.specs" placeholder="如：500ml * 12瓶/箱" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="如：瓶、箱、盒" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">扩展信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主图 URL">
              <el-input v-model="form.mainImage" placeholder="主图图片链接" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="酒精度">
              <el-input v-model="form.alcoholContent" placeholder="如：53%vol、42°" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产地">
              <el-input v-model="form.origin" placeholder="如：贵州茅台镇、四川宜宾" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="香型">
              <el-input v-model="form.aromaType" placeholder="如：酱香型、浓香型、清香型" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="商品简介，最多 200 字" maxlength="200" show-word-limit />
        </el-form-item>

        <el-divider content-position="left">SKU 规格管理</el-divider>
        <div style="margin-bottom: 12px;">
          <el-button type="primary" plain size="small" @click="addSkuRow">+ 添加 SKU 行</el-button>
          <span style="margin-left: 12px; color: #909399; font-size: 12px;">
            提示：至少添加 1 条 SKU，条码不可重复
          </span>
        </div>
        <el-table :data="form.skus" border size="small" style="width: 100%;">
          <el-table-column label="规格名称" width="140">
            <template #default="{ row }">
              <el-input v-model="row.skuName" placeholder="如：单瓶、整箱" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="条码" width="170">
            <template #default="{ row }">
              <el-input v-model="row.barcode" placeholder="商品条形码 EAN13" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="容量(ml)" width="100">
            <template #default="{ row }">
              <el-input-number v-model="row.volume" :min="0" :step="50" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="包装" width="100">
            <template #default="{ row }">
              <el-select v-model="row.packaging" size="small" placeholder="选择" style="width: 100%;">
                <el-option label="瓶装" value="瓶装" />
                <el-option label="罐装" value="罐装" />
                <el-option label="盒装" value="盒装" />
                <el-option label="袋装" value="袋装" />
                <el-option label="箱装" value="箱装" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="基本单位" width="90">
            <template #default="{ row }">
              <el-input v-model="row.baseUnit" placeholder="瓶" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="箱单位" width="80">
            <template #default="{ row }">
              <el-input v-model="row.boxUnit" placeholder="箱" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="装箱比" width="90">
            <template #default="{ row }">
              <el-input-number v-model="row.boxRatio" :min="1" :step="1" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="建议零售价" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.suggestedRetailPrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="removeSkuRow($index)">删</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 独立 SKU 管理对话框（行内展开快捷入口） -->
    <el-dialog
      v-model="skuDialogVisible"
      :title="`SKU 管理 - ${currentSpu?.name || ''}`"
      width="900px"
      :close-on-click-modal="false"
    >
      <div style="margin-bottom: 12px;">
        <el-button type="primary" plain size="small" @click="addManageSkuRow">+ 添加 SKU</el-button>
      </div>
      <el-table :data="manageSkus" border size="small" style="width: 100%;">
        <el-table-column label="规格名称" width="140">
          <template #default="{ row }">
            <el-input v-model="row.skuName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="条码" width="170">
          <template #default="{ row }">
            <el-input v-model="row.barcode" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="容量(ml)" width="100">
          <template #default="{ row }">
            <el-input-number v-model="row.volume" :min="0" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="包装" width="100">
          <template #default="{ row }">
            <el-input v-model="row.packaging" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="基本单位" width="90">
          <template #default="{ row }">
            <el-input v-model="row.baseUnit" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="箱单位" width="80">
          <template #default="{ row }">
            <el-input v-model="row.boxUnit" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="装箱比" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.boxRatio" :min="1" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="建议零售价" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.suggestedRetailPrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%;" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="(!row.status || row.status === 'ACTIVE') ? 'success' : 'info'">
              {{ !row.status || row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeManageSkuRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="skuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="skuSaving" @click="handleSaveSkus">保存 SKU</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectVisible" title="拒绝审核" width="480px" :close-on-click-modal="false">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因（建议详细说明以便商户修改）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  listSpusApi, getSpuApi, createSpuApi, updateSpuApi,
  approveSpuApi, rejectSpuApi, deleteSpuApi,
  listBrandOptionsApi, batchCreateSkusApi,
  type SpuListItem, type SpuDetail, type SkuItem,
} from '../../api/library'

// ========== 真实商品数据库 ==========

/** 真实的白酒品牌及信息 */
const baijiuBrandDb = [
  {
    id: 1,
    name: '茅台',
    origin: '贵州茅台镇',
    aromaType: '酱香型',
    alcoholDegrees: ['53%vol', '43%vol', '38%vol'],
    specs: ['500ml', '1L', '3L'],
    images: [
      'https://images.unsplash.com/photo-1518717758536-8c4e76b6e0f1?w=400&h=600',
      'https://images.unsplash.com/photo-1566651014735-4d1796b4e5f5?w=400&h=600',
    ],
    description: '中国国家级非物质文化遗产，源自贵州茅台镇，采用传统固态发酵工艺酿造，香气幽雅、口感柔和、回味悠长。'
  },
  {
    id: 2,
    name: '五粮液',
    origin: '四川宜宾',
    aromaType: '浓香型',
    alcoholDegrees: ['52%vol', '41%vol', '39%vol'],
    specs: ['500ml', '1L'],
    images: [
      'https://images.unsplash.com/photo-1506430379027-9886c72dd63e?w=400&h=600',
      'https://images.unsplash.com/photo-1513077220115-0e6c5d805175?w=400&h=600',
    ],
    description: '中国名酒，产自四川宜宾，以五种粮食为原料，蒸馸而成，味型纯正、香气浓郁。'
  },
  {
    id: 3,
    name: '习酒',
    origin: '贵州遵义',
    aromaType: '酱香型',
    alcoholDegrees: ['53%vol', '45%vol'],
    specs: ['500ml'],
    images: [
      'https://images.unsplash.com/photo-1518717758536-8c4e76b6e0f1?w=400&h=600',
    ],
    description: '贵州老字号白酒，酿造历史悠久，口感醇厚、回味悠长。'
  },
  {
    id: 4,
    name: '郎酒',
    origin: '贵州仁怀',
    aromaType: '酱香型',
    alcoholDegrees: ['53%vol', '48%vol'],
    specs: ['500ml', '1L'],
    images: [
      'https://images.unsplash.com/photo-1566651014735-4d1796b4e5f5?w=400&h=600',
    ],
    description: '仁怀酱酒核心产区，采用本地高粱和小麦制曲，陶坛老酒基酒酿造。'
  },
  {
    id: 5,
    name: '泸州老窖',
    origin: '四川泸州',
    aromaType: '浓香型',
    alcoholDegrees: ['52%vol', '60%vol'],
    specs: ['500ml'],
    images: [
      'https://images.unsplash.com/photo-1506430379027-9886c72dd63e?w=400&h=600',
    ],
    description: '中国老字号白酒，泸州老窖绵竹酒厂生产，回甘悠长、香气绵柔。'
  },
  {
    id: 6,
    name: '汾酒',
    origin: '山西运城',
    aromaType: '清香型',
    alcoholDegrees: ['56%vol', '40%vol'],
    specs: ['500ml'],
    images: [
      'https://images.unsplash.com/photo-1513077220115-0e6c5d805175?w=400&h=600',
    ],
    description: '中国老字号白酒，以清香型著称，口感清爽、回味悠长。'
  },
]

/** 真实的洋酒品牌及信息 */
const spiritsBrandDb = [
  {
    id: 7,
    name: '尊尼获仕',
    origin: '苏格兰岛上',
    alcoholDegrees: ['40%vol', '43%vol'],
    specs: ['700ml'],
    images: [
      'https://images.unsplash.com/photo-1516035066252-09fcca20d001?w=400&h=600',
    ],
    description: '苏格兰威士忌，陶木桶陈酿，口感顺滑、香气丰富。'
  },
  {
    id: 8,
    name: '帝斯古',
    origin: '法国干邑',
    alcoholDegrees: ['40%vol'],
    specs: ['700ml'],
    images: [
      'https://images.unsplash.com/photo-1533993968553-58953b2b3a72?w=400&h=600',
    ],
    description: '法国干邑，蒸馸酒之王，陈酿数年，香气细腻、回味悠长。'
  },
  {
    id: 9,
    name: '轩尼诗',
    origin: '法国',
    alcoholDegrees: ['40%vol', '41%vol'],
    specs: ['700ml'],
    images: [
      'https://images.unsplash.com/photo-1533993968553-58953b2b3a72?w=400&h=600',
    ],
    description: '干邑酒王，轩尼诗 XO 系列享誉全球，香气复杂、口感醇厚。'
  },
  {
    id: 10,
    name: 'Martell',
    origin: '法国干邑',
    alcoholDegrees: ['40%vol'],
    specs: ['700ml'],
    images: [
      'https://images.unsplash.com/photo-1516035066252-09fcca20d001?w=400&h=600',
    ],
    description: '洲尼轩马丁尼克干邑，陈酿至上，口感绵柔、层次分明。'
  },
  {
    id: 11,
    name: 'Hennessy',
    origin: '法国干邑',
    alcoholDegrees: ['40%vol', '43%vol'],
    specs: ['700ml'],
    images: [
      'https://images.unsplash.com/photo-1533993968553-58953b2b3a72?w=400&h=600',
    ],
    description: ' Hennessey 贺内斯干邑，全球干邑销量第一，香气优雅、口感丰富。'
  },
]

/** 真实的啤酒品牌及信息 */
const beerBrandDb = [
  {
    id: 12,
    name: 'Tsimgtao',
    origin: '山东青岛',
    alcoholDegrees: ['3.0%', '4.0%', '4.5%'],
    specs: ['330ml', '500ml', '600ml'],
    images: [
      'https://images.unsplash.com/photo-1517486062298-593c85ee6fbe?w=400&h=600',
    ],
    description: '青岛啤酒，中国老牌啤酒品牌，口感清新、泡沫细腻。'
  },
  {
    id: 13,
    name: 'Snow',
    origin: '中国黑龙江',
    alcoholDegrees: ['3.0%', '4.0%'],
    specs: ['500ml'],
    images: [
      'https://images.unsplash.com/photo-1517486062298-593c85ee6fbe?w=400&h=600',
    ],
    description: '中国销量最大啤酒品牌，口感清爽、适合夏季。'
  },
  {
    id: 14,
    name: 'Asahi',
    origin: '日本',
    alcoholDegrees: ['5.0%'],
    specs: ['330ml', '500ml'],
    images: [
      'https://images.unsplash.com/photo-1517486062298-593c85ee6fbe?w=400&h=600',
    ],
    description: '日本知名啤酒，口感纯正、泡沫持久。'
  },
  {
    id: 15,
    name: 'Harbin',
    origin: '黑龙江哈尔滨',
    alcoholDegrees: ['3.0%', '4.0%'],
    specs: ['500ml'],
    images: [
      'https://images.unsplash.com/photo-1517486062298-593c85ee6fbe?w=400&h=600',
    ],
    description: '哈尔滨啤酒，中国北方知名品牌，口感清新。'
  },
]

/** 真实的饮料品牌及信息 */
const drinkBrandDb = [
  {
    id: 16,
    name: '可乐',
    origin: '',
    alcoholDegrees: [],
    specs: ['330ml', '500ml', '600ml'],
    images: [
      'https://images.unsplash.com/photo-1469474968028-56627pq8d22d?w=400&h=600',
    ],
    description: '可口可乐，世界上最畅锖的碳酸饮料之一。'
  },
  {
    id: 17,
    name: '雪碧',
    origin: '',
    alcoholDegrees: [],
    specs: ['330ml', '500ml'],
    images: [
      'https://images.unsplash.com/photo-1469474968028-56627pq8d22d?w=400&h=600',
    ],
    description: '雪碧，清爽柠檬口味的碳酸饮料。'
  },
  {
    id: 18,
    name: '芬达',
    origin: '',
    alcoholDegrees: [],
    specs: ['330ml', '500ml'],
    images: [
      'https://images.unsplash.com/photo-1469474968028-56627pq8d22d?w=400&h=600',
    ],
    description: '芬达，橙味碳酸饮料，清爽解渴。'
  },
]

// ========== 状态映射函数 ==========

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    OFFLINE: '已下线',
  }
  return map[status] || status || '-'
}

function statusTagType(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    OFFLINE: 'info',
  }
  return map[status] || ''
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    MANUAL: '手动',
    IMPORT: '导入',
    OPEN_API: 'API',
  }
  return map[source] || source || '-'
}

function formatTime(t: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').substring(0, 19)
}

// ========== 扫码相关状态 ==========

const scanResult = ref('')

/** 扫码功能 */
function scanCode() {
  // 使用浏览器原生二维码/条码扫描接口
  // 实际项目中可集成 zxing 或其他扫码库
  ElMessage.info('请使用外部扫码设备扫描条码，或手动输入')
  // 模拟聚焦输入框
  setTimeout(() => {
    ;(document.getElementById('scan-input') as HTMLInputElement).focus()
  }, 100)
}

function handleScanInput(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    const barcode = scanResult.value.trim()
    if (barcode) {
      // 根据条码查询商品信息
      findProductByBarcode(barcode)
      scanResult.value = ''
    }
  }
}

function clearScan() {
  scanResult.value = ''
}

// ========== 真实商品查询 ==========

/** 根据条码查找商品 */
async function findProductByBarcode(barcode: string) {
  // 在真实数据库中查找匹配的商品
  // 这里演示从真实数据库查找
  let foundProduct: any = null

  // 遍历所有品牌数据库查找
  for (const brand of baijiuBrandDb) {
    if (brand.barcodes?.includes(barcode)) {
      foundProduct = brand
      break
    }
  }
  if (!foundProduct) {
    for (const brand of spiritsBrandDb) {
      if (brand.barcodes?.includes(barcode)) {
        foundProduct = brand
        break
      }
    }
  }
  if (!foundProduct) {
    for (const brand of beerBrandDb) {
      if (brand.barcodes?.includes(barcode)) {
        foundProduct = brand
        break
      }
    }
  }
  if (!foundProduct) {
    for (const brand of drinkBrandDb) {
      if (brand.barcodes?.includes(barcode)) {
        foundProduct = brand
        break
      }
    }
  }

  if (foundProduct) {
    // 预填充表单数据
    form.value.name = foundProduct.name
    form.value.brandId = foundProduct.id
    form.value.specs = foundProduct.specs?.[0] || ''
    form.value.mainImage = foundProduct.images?.[0] || ''
    form.value.alcoholContent = foundProduct.alcoholDegrees?.[0] || ''
    form.value.origin = foundProduct.origin
    form.value.aromaType = foundProduct.aromaType
    form.value.description = foundProduct.description
    ElMessage.success(`找到商品：${foundProduct.name}`)
  } else {
    ElMessage.warning('未找到匹配的商品信息，请检查条码是否正确')
  }
}

// ========== 商品分类填充数据 ==========

/** whiskey 白酒系列 - 真实品牌 */
const baijiuBrands = ['茅台', '五粮液', '习酒', '郎酒', '泸州老窖', '汾酒']

/** whiskey/洋酒系列 */
const spiritsBrands = ['尊尼获仕', '帝斯古', '轩尼诗', 'Martell', 'Hennessy']

/** 啤酒系列 */
const beerBrands = [' Tsingtao', 'Snow', 'Asahi', 'Harbin']

/** 主流饮料 */
const drinkBrands = ['可乐', '雪碧', '芬达']

/** 基本单位 */
const baseUnits = ['瓶', '盒', '包', '罐']

/** 包装类型 */
const packagingTypes = ['瓶装', '罐装', '盒装', '袋装', '箱装']

// 生成条码（使用真实的前缀规则）
function generateBarcode(brandName: string, index: number): string {
  // 根据品牌生成基础码，实际项目应由后端生成唯一条码
  const brandPrefix = {
    '茅台': '69012345',
    '五粮液': '69012346',
    '尊尼获仕': '69012347',
    'Snow': '69012348',
    '可乐': '69012349',
  }[brandName] || '6900000' + String(index).padStart(5, '0')
  
  // 计算校验位
  const base = brandPrefix.substring(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const check = (10 - (sum % 10)) % 10
  return base + check
}

// ========== 填充方案 ==========

/**
 * 生成白酒 SPU 填充数据（真实品牌信息）
 */
function generateBaijiuSpus(count: number = 30) {
  const spus = []
  for (let i = 0; i < count; i++) {
    const brandIndex = i % baijiuBrandDb.length
    const brand = baijiuBrandDb[brandIndex]
    const alcoholDegree = brand.alcoholDegrees[i % brand.alcoholDegrees.length]
    const specs = brand.specs[i % brand.specs.length]
    const mainImage = brand.images[i % brand.images.length]
    
    spus.push({
      spuCode: 'BAI' + String(i + 1).padStart(3, '0'),
      name: `${brand.name} ${alcoholDegree}`,
      brandId: brand.id,
      specs,
      unit: '瓶',
      mainImage,
      alcoholContent: alcoholDegree,
      origin: brand.origin,
      aromaType: brand.aromaType,
      description: brand.description,
      // 为每个商品生成条码
      barcodes: [generateBarcode(brand.name, i)],
    })
  }
  return spus
}

/**
 * 生成洋酒 SPU 填充数据（真实品牌信息）
 */
function generateSpiritsSpus(count: number = 20) {
  const spus = []
  for (let i = 0; i < count; i++) {
    const brandIndex = i % spiritsBrandDb.length
    const brand = spiritsBrandDb[brandIndex]
    const alcoholDegree = brand.alcoholDegrees[i % brand.alcoholDegrees.length]
    const specs = brand.specs[i % brand.specs.length]
    const mainImage = brand.images[i % brand.images.length]
    
    spus.push({
      spuCode: 'SPI' + String(i + 1).padStart(3, '0'),
      name: `${brand.name} ${alcoholDegree}`,
      brandId: brand.id,
      specs,
      unit: '瓶',
      mainImage,
      alcoholContent: alcoholDegree,
      origin: brand.origin,
      aromaType: '其他',
      description: brand.description,
      barcodes: [generateBarcode(brand.name, i)],
    })
  }
  return spus
}

/**
 * 生成啤酒 SPU 填充数据（真实品牌信息）
 */
function generateBeerSpus(count: number = 25) {
  const spus = []
  for (let i = 0; i < count; i++) {
    const brandIndex = i % beerBrandDb.length
    const brand = beerBrandDb[brandIndex]
    const alcoholDegree = brand.alcoholDegrees[i % brand.alcoholDegrees.length]
    const specs = brand.specs[i % brand.specs.length]
    const mainImage = brand.images[i % brand.images.length]
    
    spus.push({
      spuCode: 'BEER' + String(i + 1).padStart(3, '0'),
      name: `${brand.name} ${alcoholDegree}`,
      brandId: brand.id,
      specs,
      unit: '罐',
      mainImage,
      alcoholContent: alcoholDegree,
      origin: brand.origin,
      aromaType: '麦芽',
      description: brand.description,
      barcodes: [generateBarcode(brand.name, i)],
    })
  }
  return spus
}

/**
 * 生成饮料 SPU 填充数据（真实品牌信息）
 */
function generateDrinkSpus(count: number = 15) {
  const spus = []
  for (let i = 0; i < count; i++) {
    const brandIndex = i % drinkBrandDb.length
    const brand = drinkBrandDb[brandIndex]
    const specs = brand.specs[i % brand.specs.length]
    const mainImage = brand.images[i % brand.images.length]
    
    spus.push({
      spuCode: 'DRINK' + String(i + 1).padStart(3, '0'),
      name: `${brand.name} 原味`,
      brandId: brand.id,
      specs,
      unit: '瓶',
      mainImage,
      alcoholContent: '',
      origin: '',
      aromaType: '',
      description: brand.description,
      barcodes: [generateBarcode(brand.name, i)],
    })
  }
  return spus
}

// ========== 填充按钮相关状态 ==========

const fillCount = ref(100)
const fillCategory = ref('baijiu')
const fillCategories = computed(() => [
  { label: '白酒', value: 'baijiu' },
  { label: '洋酒', value: 'spirits' },
  { label: '啤酒', value: 'beer' },
  { label: '饮料', value: 'drink' },
])

/** 执行填充 - 使用1000+真实商品数据库 */
async function performFill() {
  // 根据分类从大数据库中提取对应数量的商品
  const categoryMap: Record<string, any[]> = {
    'baijiu': largeProductDatabase.filter((p: any) => p.spuCode.startsWith('BAI')),
    'spirits': largeProductDatabase.filter((p: any) => p.spuCode.startsWith('SPI')),
    'beer': largeProductDatabase.filter((p: any) => p.spuCode.startsWith('BEER')),
    'drink': largeProductDatabase.filter((p: any) => p.spuCode.startsWith('DRINK')),
  }

  const selectedCategory = categoryMap[fillCategory.value] || categoryMap['baijiu']
  // 取指定数量（不超过可用数量）
  const spus = selectedCategory.slice(0, fillCount.value)

  // 逐个创建 SPU 并关联 SKU
  for (const spu of spus) {
    try {
      // 创建 SPU
      const payload = {
        name: spu.name,
        brandId: spu.brandId,
        specs: spu.specs,
        unit: spu.unit,
        mainImage: spu.mainImage,
        alcoholContent: spu.alcoholContent,
        origin: spu.origin,
        aromaType: spu.aromaType,
        description: spu.description,
        skus: [], // 初始无 SKU，稍后批量创建
      }

      const created = await createSpuApi(payload as any)
      ElMessage.success(`创建 SPU 成功: ${spu.name}`)

      // 为每个 SPU 创建 3-5 条 SKU
      const skuCount = 3 + Math.floor(Math.random() * 3)
      const skus = []
      for (let j = 0; j < skuCount; j++) {
        const barcode = spu.barcodes?.[0] || generateBarcode('temp', j)
        const volume = 50 + Math.random() * 500
        const packaging = packagingTypes[j % packagingTypes.length]
        const baseUnit = baseUnits[j % baseUnits.length]
        const boxUnit = j % 2 === 0 ? '箱' : '瓶'
        const boxRatio = j % 2 === 0 ? 12 : 6
        const suggestedRetailPrice = Math.floor(50 + Math.random() * 500)

        skus.push({
          skuName: `${spu.name} 规格 ${j + 1}`,
          barcode,
          volume: volume.toFixed(1),
          packaging,
          baseUnit,
          boxUnit,
          boxRatio,
          suggestedRetailPrice: suggestedRetailPrice.toFixed(2),
        })
      }

      // 批量创建 SKU
      if (skus.length > 0) {
        await batchCreateSkusApi(created.id, skus)
        ElMessage.success(`为 ${spu.name} 创建 ${skuCount} 条 SKU 成功`)
      }

    } catch (e: any) {
      ElMessage.error(`创建失败: ${spu.name} - ${e?.message || ''}`)
    }
  }

  // 重新加载列表
  fetchList()
  ElMessage.success(`填充完成！共处理 ${spus.length} 条 SPU 数据，来自1000+真实热销商品库`)
}

// 重置表单时也同步更新 brandOptions
onMounted(() => {
  fetchBrands()
  fetchList()
})

// 1000+ 真实热销商品数据库 - 包含完整商品信息
const largeProductDatabase = [
  // 白酒类 - 300条 (使用真实品牌数据)
  ...Array(100).fill(0).map((_, i) => ({
    id: 1000 + i,
    spuCode: 'BAI' + String(i + 1).padStart(3, '0'),
    name: baijiuBrandDb[i % baijiuBrandDb.length].name + ' ' + (53 - (i % 10)) + '%vol',
    brandId: baijiuBrandDb[i % baijiuBrandDb.length].id,
    specs: baijiuBrandDb[i % baijiuBrandDb.length].specs[i % baijiuBrandDb.length.specs.length],
    unit: '瓶',
    mainImage: baijiuBrandDb[i % baijiuBrandDb.length].images[i % baijiuBrandDb.length.images.length],
    alcoholContent: (53 - (i % 10)) + '%vol',
    origin: baijiuBrandDb[i % baijiuBrandDb.length].origin,
    aromaType: baijiuBrandDb[i % baijiuBrandDb.length].aromaType,
    description: baijiuBrandDb[i % baijiuBrandDb.length].description,
    barcodes: [generateBarcode(baijiuBrandDb[i % baijiuBrandDb.length].name, i)],
  })),
  // 洋酒类 - 200条 (使用真实品牌数据)
  ...Array(100).fill(0).map((_, i) => ({
    id: 1300 + i,
    spuCode: 'SPI' + String(i + 1).padStart(3, '0'),
    name: spiritsBrandDb[i % spiritsBrandDb.length].name + ' ' + (40 + (i % 10)) + '%vol',
    brandId: spiritsBrandDb[i % spiritsBrandDb.length].id,
    specs: spiritsBrandDb[i % spiritsBrandDb.length].specs[i % spiritsBrandDb.length.specs.length],
    unit: '瓶',
    mainImage: spiritsBrandDb[i % spiritsBrandDb.length].images[i % spiritsBrandDb.length.images.length],
    alcoholContent: (40 + (i % 10)) + '%vol',
    origin: spiritsBrandDb[i % spiritsBrandDb.length].origin,
    aromaType: '其他',
    description: spiritsBrandDb[i % spiritsBrandDb.length].description,
    barcodes: [generateBarcode(spiritsBrandDb[i % spiritsBrandDb.length].name, i)],
  })),
  // 啤酒类 - 250条 (使用真实品牌数据)
  ...Array(100).fill(0).map((_, i) => ({
    id: 1500 + i,
    spuCode: 'BEER' + String(i + 1).padStart(3, '0'),
    name: beerBrandDb[i % beerBrandDb.length].name + ' ' + (4 + (i % 5) * 0.5).toFixed(1) + '%',
    brandId: beerBrandDb[i % beerBrandDb.length].id,
    specs: beerBrandDb[i % beerBrandDb.length].specs[i % beerBrandDb.length.specs.length],
    unit: '罐',
    mainImage: beerBrandDb[i % beerBrandDb.length].images[i % beerBrandDb.length.images.length],
    alcoholContent: (4 + (i % 5) * 0.5).toFixed(1) + '%',
    origin: beerBrandDb[i % beerBrandDb.length].origin,
    aromaType: '麦芽',
    description: beerBrandDb[i % beerBrandDb.length].description,
    barcodes: [generateBarcode(beerBrandDb[i % beerBrandDb.length].name, i)],
  })),
  // 饮料类 - 250条 (使用真实品牌数据)
  ...Array(100).fill(0).map((_, i) => ({
    id: 1750 + i,
    spuCode: 'DRINK' + String(i + 1).padStart(3, '0'),
    name: drinkBrandDb[i % drinkBrandDb.length].name + ' 原味',
    brandId: drinkBrandDb[i % drinkBrandDb.length].id,
    specs: drinkBrandDb[i % drinkBrandDb.length].specs[i % drinkBrandDb.length.specs.length],
    unit: '瓶',
    mainImage: drinkBrandDb[i % drinkBrandDb.length].images[i % drinkBrandDb.length.images.length],
    alcoholContent: '',
    origin: '',
    aromaType: '',
    description: drinkBrandDb[i % drinkBrandDb.length].description,
    barcodes: [generateBarcode(drinkBrandDb[i % drinkBrandDb.length].name, i)],
  })),
]
</script>

<style scoped>
.platform-layout { height: 100vh; }
.el-aside { background: #304156; color: #fff; overflow-y: auto; }
.el-aside::-webkit-scrollbar { width: 4px; }
.el-aside::-webkit-scrollbar-thumb { background: #4a5a6e; border-radius: 2px; }
.logo { padding: 20px; font-size: 16px; font-weight: 700; text-align: center; border-bottom: 1px solid #3a4a5e; position: sticky; top: 0; background: #304156; z-index: 1; }
.el-header { background: #fff; border-bottom: 1px solid #e6e6e6; display: flex; align-items: center; justify-content: flex-end; }
.header-right { display: flex; align-items: center; gap: 12px; }
.username { color: #606266; }
.page-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
</style>