<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>套装与组合品管理</span>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <!-- ============ 套装商品列表 ============ -->
        <el-tab-pane label="套装管理" name="combo">
          <!-- 搜索栏 -->
          <div class="search-bar">
            <el-input
              v-model="comboSearch.keyword" placeholder="搜索套装名称/编号"
              style="width: 220px" clearable @clear="searchCombo" @keyup.enter="searchCombo"
            />
            <el-select v-model="comboSearch.categoryId" placeholder="分类" clearable style="width: 140px; margin-left: 10px">
              <el-option v-for="c in categoryList" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <el-select v-model="comboSearch.status" placeholder="状态" clearable style="width: 120px; margin-left: 10px">
              <el-option label="上架" value="ON_SALE" />
              <el-option label="下架" value="OFF_SALE" />
              <el-option label="草稿" value="DRAFT" />
            </el-select>
            <el-date-picker
              v-model="comboSearch.dateRange" type="daterange" range-separator="至"
              start-placeholder="开始日期" end-placeholder="结束日期"
              style="margin-left: 10px; width: 260px"
            />
            <el-button type="primary" style="margin-left: 10px" @click="searchCombo">
              <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button @click="resetComboSearch">重置</el-button>
            <div style="flex: 1"></div>
            <el-button type="primary" @click="openComboDialog()">
              <el-icon><Plus /></el-icon> 新建套装
            </el-button>
          </div>

          <!-- 套装列表 -->
          <el-table :data="comboList" v-loading="comboLoading" stripe>
            <el-table-column label="套装图片" width="80" align="center">
              <template #default="{ row }">
                <el-image
                  v-if="row.image" :src="row.image" :preview-src-list="[row.image]"
                  style="width: 50px; height: 50px; border-radius: 4px" fit="cover"
                />
                <span v-else style="color: #ccc">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="comboCode" label="套装编号" width="140" />
            <el-table-column prop="name" label="套装名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="categoryName" label="分类" width="100" />
            <el-table-column label="包含商品" width="100" align="center">
              <template #default="{ row }">{{ row.productCount || 0 }} 件</template>
            </el-table-column>
            <el-table-column label="原价" width="110" align="right">
              <template #default="{ row }">¥{{ Number(row.originalPrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="套装价" width="110" align="right">
              <template #default="{ row }">
                <span style="color: #C0392B; font-weight: 600">¥{{ Number(row.comboPrice || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="优惠金额" width="110" align="right">
              <template #default="{ row }">
                <span style="color: #0EA879">¥{{ Number(row.discountAmount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ON_SALE'" type="success" size="small">上架</el-tag>
                <el-tag v-else-if="row.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
                <el-tag v-else type="danger" size="small">下架</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewComboDetail(row)">查看</el-button>
                <el-button size="small" link type="success" @click="openComboDialog(row)">编辑</el-button>
                <el-button
                  size="small" link
                  :type="row.status === 'ON_SALE' ? 'danger' : 'success'"
                  @click="toggleComboStatus(row)"
                >
                  {{ row.status === 'ON_SALE' ? '下架' : '上架' }}
                </el-button>
                <el-popconfirm title="确定删除该套装？" @confirm="deleteCombo(row.id)">
                  <template #reference><el-button size="small" link type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无套装数据" :image-size="80" /></template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background layout="total, sizes, prev, pager, next, jumper"
              :total="comboTotal" :page-size="comboPageSize" :current-page="comboPage"
              @size-change="(s: number) => { comboPageSize = s; comboPage = 1; searchCombo(); }"
              @current-change="(p: number) => { comboPage = p; searchCombo(); }"
            />
          </div>
        </el-tab-pane>

        <!-- ============ 组合品管理 ============ -->
        <el-tab-pane label="组合品管理" name="group">
          <div class="search-bar">
            <el-input
              v-model="groupSearch.keyword" placeholder="搜索组合名称"
              style="width: 220px" clearable @clear="searchGroup" @keyup.enter="searchGroup"
            />
            <el-select v-model="groupSearch.type" placeholder="组合类型" clearable style="width: 140px; margin-left: 10px" @change="searchGroup">
              <el-option label="固定组合" value="FIXED" />
              <el-option label="可选组合" value="OPTIONAL" />
            </el-select>
            <el-select v-model="groupSearch.status" placeholder="状态" clearable style="width: 120px; margin-left: 10px" @change="searchGroup">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="INACTIVE" />
            </el-select>
            <el-button type="primary" style="margin-left: 10px" @click="searchGroup">搜索</el-button>
            <div style="flex: 1"></div>
            <el-button type="primary" @click="openGroupDialog()">
              <el-icon><Plus /></el-icon> 新建组合
            </el-button>
          </div>

          <el-table :data="groupList" v-loading="groupLoading" stripe>
            <el-table-column prop="groupCode" label="组合编号" width="140" />
            <el-table-column prop="name" label="组合名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'FIXED'" type="primary" size="small">固定组合</el-tag>
                <el-tag v-else type="warning" size="small">可选组合</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="主商品" min-width="160">
              <template #default="{ row }">{{ row.mainProductName || '-' }}</template>
            </el-table-column>
            <el-table-column label="可选配件数" width="110" align="center">
              <template #default="{ row }">{{ row.optionCount || 0 }} 个</template>
            </el-table-column>
            <el-table-column label="基础价格" width="110" align="right">
              <template #default="{ row }">¥{{ Number(row.basePrice || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'ACTIVE'" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="viewGroupDetail(row)">详情</el-button>
                <el-button size="small" link type="success" @click="openGroupDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除该组合？" @confirm="deleteGroup(row.id)">
                  <template #reference><el-button size="small" link type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty><el-empty description="暂无组合品数据" :image-size="80" /></template>
          </el-table>

          <div class="pagination">
            <el-pagination
              background layout="total, sizes, prev, pager, next, jumper"
              :total="groupTotal" :page-size="groupPageSize" :current-page="groupPage"
              @size-change="(s: number) => { groupPageSize = s; groupPage = 1; searchGroup(); }"
              @current-change="(p: number) => { groupPage = p; searchGroup(); }"
            />
          </div>
        </el-tab-pane>

        <!-- ============ 套装销售统计 ============ -->
        <el-tab-pane label="销售统计" name="stats">
          <!-- 筛选条件 -->
          <div class="search-bar">
            <el-date-picker
              v-model="statsDateRange" type="daterange" range-separator="至"
              start-placeholder="开始日期" end-placeholder="结束日期"
              style="width: 280px"
            />
            <el-button type="primary" style="margin-left: 10px" @click="loadStats">查询</el-button>
            <div style="flex: 1"></div>
          </div>

          <!-- 数据概览卡片 -->
          <el-row :gutter="16" style="margin-bottom: 20px">
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">套装销量</div>
                <div class="stat-value">{{ statsSummary.totalSales }} 件</div>
                <div class="stat-trend up">↑ 较上期 +12.5%</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">套装销售额</div>
                <div class="stat-value">¥{{ Number(statsSummary.totalAmount).toFixed(2) }}</div>
                <div class="stat-trend up">↑ 较上期 +18.3%</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">优惠总金额</div>
                <div class="stat-value">¥{{ Number(statsSummary.totalDiscount).toFixed(2) }}</div>
                <div class="stat-trend down">↓ 较上期 -5.2%</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">活跃套装数</div>
                <div class="stat-value">{{ statsSummary.activeComboCount }} 个</div>
                <div class="stat-trend up">↑ 较上期 +3 个</div>
              </el-card>
            </el-col>
          </el-row>

          <!-- 图表 -->
          <el-row :gutter="16">
            <el-col :span="12">
              <el-card shadow="hover">
                <template #header>
                  <div class="chart-header">
                    <span>套装销量排行 TOP10</span>
                  </div>
                </template>
                <div ref="salesRankChartRef" class="chart-container"></div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="hover">
                <template #header>
                  <div class="chart-header">
                    <span>销售额趋势</span>
                  </div>
                </template>
                <div ref="salesTrendChartRef" class="chart-container"></div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" style="margin-top: 16px">
            <el-col :span="24">
              <el-card shadow="hover">
                <template #header>
                  <div class="chart-header">
                    <span>优惠金额统计</span>
                  </div>
                </template>
                <div ref="discountChartRef" class="chart-container-horizontal"></div>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ============ 套装新增/编辑 Dialog ============ -->
    <el-dialog
      v-model="comboDialogVisible"
      :title="comboEditing ? '编辑套装' : '新建套装'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form ref="comboFormRef" :model="comboForm" :rules="comboFormRules" label-width="110px">
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="套装名称" prop="name">
              <el-input v-model="comboForm.name" placeholder="请输入套装名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="套装编号" prop="comboCode">
              <el-input v-model="comboForm.comboCode" placeholder="自动生成或手动输入" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="分类" prop="categoryId">
              <el-select v-model="comboForm.categoryId" placeholder="请选择分类" style="width: 100%">
                <el-option v-for="c in categoryList" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态" prop="status">
              <el-select v-model="comboForm.status" style="width: 100%">
                <el-option label="草稿" value="DRAFT" />
                <el-option label="上架" value="ON_SALE" />
                <el-option label="下架" value="OFF_SALE" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生效时间">
              <el-date-picker
                v-model="comboForm.effectiveDate" type="datetime"
                placeholder="选择生效时间" style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="失效时间">
              <el-date-picker
                v-model="comboForm.expiryDate" type="datetime"
                placeholder="选择失效时间" style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 套装商品 -->
        <el-divider content-position="left">
          <span style="display: flex; align-items: center; gap: 8px">
            套装商品
            <el-button type="primary" size="small" @click="openProductSelector">
              <el-icon><Plus /></el-icon> 添加商品
            </el-button>
          </span>
        </el-divider>
        <el-table :data="comboForm.products" border size="small">
          <el-table-column label="图片" width="60" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.image" :src="row.image"
                style="width: 40px; height: 40px; border-radius: 4px" fit="cover"
              />
              <span v-else style="color: #ccc">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="商品名称" min-width="160" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column label="单价" width="100" align="right">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="数量" width="120" align="center">
            <template #default="{ row, $index }">
              <el-input-number v-model="row.quantity" :min="1" size="small" @change="calcComboPrice" />
            </template>
          </el-table-column>
          <el-table-column label="小计" width="100" align="right">
            <template #default="{ row }">¥{{ Number((row.unitPrice || 0) * (row.quantity || 0)).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button size="small" link type="danger" @click="removeComboProduct($index)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="请添加套装商品" :image-size="60" /></template>
        </el-table>

        <!-- 价格设置 -->
        <el-divider content-position="left">价格设置</el-divider>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="商品原价">
              <el-input :value="'¥' + Number(comboForm.originalPrice).toFixed(2)" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="定价方式" prop="pricingType">
              <el-radio-group v-model="comboForm.pricingType" @change="calcComboPrice">
                <el-radio value="FIXED">固定价</el-radio>
                <el-radio value="DISCOUNT">折扣率</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item v-if="comboForm.pricingType === 'FIXED'" label="套装价格" prop="comboPrice">
              <el-input-number v-model="comboForm.comboPrice" :min="0" :precision="2" style="width: 100%" @change="calcDiscount" />
            </el-form-item>
            <el-form-item v-else label="折扣率" prop="discountRate">
              <el-input-number v-model="comboForm.discountRate" :min="1" :max="99" :precision="1" style="width: 100%" @change="calcByDiscount">
                <template #append>%</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="优惠金额">
              <el-input :value="'¥' + Number(comboForm.discountAmount).toFixed(2)" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 图片和描述 -->
        <el-divider content-position="left">套装图片与描述</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="套装图片">
              <el-upload
                class="avatar-uploader"
                :show-file-list="false"
                :auto-upload="false"
                :on-change="handleImageChange"
              >
                <el-image v-if="comboForm.image" :src="comboForm.image" class="combo-image" fit="cover" />
                <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="套装描述">
              <el-input v-model="comboForm.description" type="textarea" :rows="4" placeholder="请输入套装描述" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="comboDialogVisible = false">取消</el-button>
        <el-button @click="saveComboDraft">保存草稿</el-button>
        <el-button type="primary" :loading="comboSubmitLoading" @click="submitCombo">提交</el-button>
      </template>
    </el-dialog>

    <!-- ============ 商品选择 Dialog ============ -->
    <el-dialog v-model="productSelectorVisible" title="选择商品" width="720px">
      <div class="search-bar" style="margin-bottom: 12px">
        <el-input
          v-model="productSearchKeyword" placeholder="搜索商品名称/SKU编码"
          style="width: 260px" clearable @keyup.enter="searchProductsForSelector"
        />
        <el-button type="primary" style="margin-left: 10px" @click="searchProductsForSelector">搜索</el-button>
      </div>
      <el-table
        :data="selectorProductList" v-loading="selectorLoading"
        border size="small" @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="图片" width="60" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.image" :src="row.image"
              style="width: 36px; height: 36px; border-radius: 4px" fit="cover"
            />
            <span v-else style="color: #ccc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="160" />
        <el-table-column prop="spec" label="规格" width="100" />
        <el-table-column label="零售价" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.retailPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="80" align="center" />
      </el-table>
      <template #footer>
        <el-button @click="productSelectorVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddProducts">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- ============ 套装详情 Drawer ============ -->
    <el-drawer v-model="comboDetailVisible" title="套装详情" size="500px">
      <template v-if="currentCombo">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="套装编号">{{ currentCombo.comboCode }}</el-descriptions-item>
          <el-descriptions-item label="套装名称">{{ currentCombo.name }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ currentCombo.categoryName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentCombo.status === 'ON_SALE'" type="success" size="small">上架</el-tag>
            <el-tag v-else-if="currentCombo.status === 'DRAFT'" type="info" size="small">草稿</el-tag>
            <el-tag v-else type="danger" size="small">下架</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="包含商品数">{{ currentCombo.productCount }} 件</el-descriptions-item>
          <el-descriptions-item label="原价">¥{{ Number(currentCombo.originalPrice || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="套装价">
            <span style="color: #C0392B; font-weight: 600">¥{{ Number(currentCombo.comboPrice || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="优惠金额">
            <span style="color: #0EA879">¥{{ Number(currentCombo.discountAmount || 0).toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentCombo.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px">商品清单</h4>
        <el-table :data="currentCombo.products || []" border size="small">
          <el-table-column prop="name" label="商品名称" min-width="140" />
          <el-table-column prop="spec" label="规格" width="80" />
          <el-table-column prop="quantity" label="数量" width="60" align="center" />
          <el-table-column label="单价" width="80" align="right">
            <template #default="{ row }">¥{{ Number(row.unitPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="80" align="right">
            <template #default="{ row }">¥{{ Number((row.unitPrice || 0) * (row.quantity || 0)).toFixed(2) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>

    <!-- ============ 组合品新增/编辑 Dialog ============ -->
    <el-dialog
      v-model="groupDialogVisible"
      :title="groupEditing ? '编辑组合' : '新建组合'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form ref="groupFormRef" :model="groupForm" :rules="groupFormRules" label-width="110px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="组合名称" prop="name">
              <el-input v-model="groupForm.name" placeholder="请输入组合名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="组合编号" prop="groupCode">
              <el-input v-model="groupForm.groupCode" placeholder="自动生成或手动输入" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="组合类型" prop="type">
              <el-radio-group v-model="groupForm.type">
                <el-radio value="FIXED">固定组合</el-radio>
                <el-radio value="OPTIONAL">可选组合</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="groupForm.status" style="width: 100%">
                <el-option label="启用" value="ACTIVE" />
                <el-option label="停用" value="INACTIVE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="主商品" prop="mainProductId">
              <el-select v-model="groupForm.mainProductId" placeholder="请选择主商品" filterable style="width: 100%">
                <el-option v-for="p in allProducts" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="基础价格" prop="basePrice">
              <el-input-number v-model="groupForm.basePrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 可选配件 -->
        <el-divider content-position="left">
          <span style="display: flex; align-items: center; gap: 8px">
            {{ groupForm.type === 'FIXED' ? '固定商品' : '可选配件' }}
            <el-button type="primary" size="small" @click="openGroupProductSelector">
              <el-icon><Plus /></el-icon> 添加
            </el-button>
          </span>
        </el-divider>
        <el-table :data="groupForm.options" border size="small">
          <el-table-column prop="name" label="商品名称" min-width="160" />
          <el-table-column prop="spec" label="规格" width="100" />
          <el-table-column label="加价" width="120" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.extraPrice" :min="0" :precision="2" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="必选" width="80" align="center" v-if="groupForm.type === 'OPTIONAL'">
            <template #default="{ row }">
              <el-switch v-model="row.required" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button size="small" link type="danger" @click="removeGroupOption($index)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="请添加商品" :image-size="60" /></template>
        </el-table>

        <el-form-item label="组合规则" style="margin-top: 16px">
          <el-input v-model="groupForm.ruleDescription" type="textarea" :rows="3" placeholder="请输入组合规则说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSubmitLoading" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 组合详情 Drawer ============ -->
    <el-drawer v-model="groupDetailVisible" title="组合详情" size="500px">
      <template v-if="currentGroup">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="组合编号">{{ currentGroup.groupCode }}</el-descriptions-item>
          <el-descriptions-item label="组合名称">{{ currentGroup.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag v-if="currentGroup.type === 'FIXED'" type="primary" size="small">固定组合</el-tag>
            <el-tag v-else type="warning" size="small">可选组合</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="主商品">{{ currentGroup.mainProductName }}</el-descriptions-item>
          <el-descriptions-item label="基础价格">¥{{ Number(currentGroup.basePrice || 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag v-if="currentGroup.status === 'ACTIVE'" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">停用</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <h4 style="margin-top: 20px">
          {{ currentGroup.type === 'FIXED' ? '固定商品' : '可选配件' }}
        </h4>
        <el-table :data="currentGroup.options || []" border size="small">
          <el-table-column prop="name" label="商品名称" min-width="140" />
          <el-table-column prop="spec" label="规格" width="80" />
          <el-table-column label="加价" width="80" align="right">
            <template #default="{ row }">+¥{{ Number(row.extraPrice || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column v-if="currentGroup.type === 'OPTIONAL'" label="必选" width="60" align="center">
            <template #default="{ row }">{{ row.required ? '是' : '否' }}</template>
          </el-table-column>
        </el-table>
        <h4 style="margin-top: 20px">组合规则</h4>
        <p style="color: #444444; line-height: 1.6">{{ currentGroup.ruleDescription || '暂无规则说明' }}</p>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage, type FormRules, type ElForm } from "element-plus";
import { Plus, Search } from "@element-plus/icons-vue";
import echarts from "../../utils/echarts";
import { api } from "../../api";
import { formatDate } from "../../utils/format";

// ============================================================
// 通用
// ============================================================
const activeTab = ref("combo");

// 商品列表（用于选择器）
const allProducts = ref<any[]>([]);
const categoryList = ref<any[]>([]);

async function loadBaseData() {
  try {
    // 加载商品
    const { data: prodData } = await api.get("/admin/products", { params: { page: 1, pageSize: 200 } });
    const prodRes = prodData.data || {};
    allProducts.value = prodRes.records || prodRes.list || [];
  } catch {
    // fallback mock
    allProducts.value = mockProducts;
  }
  try {
    // 加载分类
    const { data: catData } = await api.get("/admin/product-categories");
    categoryList.value = (catData.data || []).map((c: any) => ({ id: c.id, name: c.name }));
  } catch {
    categoryList.value = [
      { id: 1, name: "白酒" },
      { id: 2, name: "啤酒" },
      { id: 3, name: "红酒" },
      { id: 4, name: "洋酒" },
      { id: 5, name: "饮料" }
    ];
  }
}

// Mock 商品数据
const mockProducts = [
  { id: 1, name: "飞天茅台53度500ml", spec: "500ml", retailPrice: 2999, image: "", stock: 150 },
  { id: 2, name: "五粮液普五52度500ml", spec: "500ml", retailPrice: 1299, image: "", stock: 200 },
  { id: 3, name: "剑南春水晶剑52度500ml", spec: "500ml", retailPrice: 459, image: "", stock: 300 },
  { id: 4, name: "泸州老窖特曲52度500ml", spec: "500ml", retailPrice: 288, image: "", stock: 250 },
  { id: 5, name: "青岛啤酒经典500ml*24", spec: "500ml*24", retailPrice: 98, image: "", stock: 500 },
  { id: 6, name: "百威啤酒330ml*24", spec: "330ml*24", retailPrice: 118, image: "", stock: 400 },
  { id: 7, name: "张裕解百纳干红750ml", spec: "750ml", retailPrice: 168, image: "", stock: 180 },
  { id: 8, name: "长城干红葡萄酒750ml", spec: "750ml", retailPrice: 88, image: "", stock: 220 },
  { id: 9, name: "人头马XO700ml", spec: "700ml", retailPrice: 1580, image: "", stock: 60 },
  { id: 10, name: "轩尼诗VSOP700ml", spec: "700ml", retailPrice: 598, image: "", stock: 80 },
  { id: 11, name: "可口可乐330ml*24", spec: "330ml*24", retailPrice: 58, image: "", stock: 800 },
  { id: 12, name: "农夫山泉550ml*24", spec: "550ml*24", retailPrice: 35, image: "", stock: 1000 }
];

// ============================================================
// 套装管理
// ============================================================
const comboList = ref<any[]>([]);
const comboLoading = ref(false);
const comboTotal = ref(0);
const comboPage = ref(1);
const comboPageSize = ref(10);

const comboSearch = reactive({
  keyword: "",
  categoryId: null as number | null,
  status: "",
  dateRange: [] as Date[]
});

// Mock 套装数据
const mockComboList = [
  {
    id: 1, comboCode: "CB20260701001", name: "中秋佳节送礼套装",
    categoryName: "白酒", productCount: 3,
    originalPrice: 4757, comboPrice: 3999, discountAmount: 758,
    status: "ON_SALE", createdAt: "2026-07-01 10:30:00",
    image: "",
    products: [
      { id: 1, name: "飞天茅台53度500ml", spec: "500ml", unitPrice: 2999, quantity: 1 },
      { id: 2, name: "五粮液普五52度500ml", spec: "500ml", unitPrice: 1299, quantity: 1 },
      { id: 3, name: "剑南春水晶剑52度500ml", spec: "500ml", unitPrice: 459, quantity: 1 }
    ]
  },
  {
    id: 2, comboCode: "CB20260705002", name: "啤酒畅饮套装",
    categoryName: "啤酒", productCount: 2,
    originalPrice: 216, comboPrice: 188, discountAmount: 28,
    status: "ON_SALE", createdAt: "2026-07-05 14:20:00",
    image: "",
    products: [
      { id: 5, name: "青岛啤酒经典500ml*24", spec: "500ml*24", unitPrice: 98, quantity: 1 },
      { id: 6, name: "百威啤酒330ml*24", spec: "330ml*24", unitPrice: 118, quantity: 1 }
    ]
  },
  {
    id: 3, comboCode: "CB20260708003", name: "红酒品鉴套装",
    categoryName: "红酒", productCount: 2,
    originalPrice: 256, comboPrice: 218, discountAmount: 38,
    status: "DRAFT", createdAt: "2026-07-08 09:15:00",
    image: "",
    products: [
      { id: 7, name: "张裕解百纳干红750ml", spec: "750ml", unitPrice: 168, quantity: 1 },
      { id: 8, name: "长城干红葡萄酒750ml", spec: "750ml", unitPrice: 88, quantity: 1 }
    ]
  },
  {
    id: 4, comboCode: "CB20260710004", name: "洋酒尊享套装",
    categoryName: "洋酒", productCount: 2,
    originalPrice: 2178, comboPrice: 1999, discountAmount: 179,
    status: "OFF_SALE", createdAt: "2026-07-10 16:45:00",
    image: "",
    products: [
      { id: 9, name: "人头马XO700ml", spec: "700ml", unitPrice: 1580, quantity: 1 },
      { id: 10, name: "轩尼诗VSOP700ml", spec: "700ml", unitPrice: 598, quantity: 1 }
    ]
  },
  {
    id: 5, comboCode: "CB20260712005", name: "家庭聚会套装",
    categoryName: "饮料", productCount: 3,
    originalPrice: 151, comboPrice: 128, discountAmount: 23,
    status: "ON_SALE", createdAt: "2026-07-12 11:00:00",
    image: "",
    products: [
      { id: 5, name: "青岛啤酒经典500ml*24", spec: "500ml*24", unitPrice: 98, quantity: 1 },
      { id: 11, name: "可口可乐330ml*24", spec: "330ml*24", unitPrice: 58, quantity: 1 },
      { id: 12, name: "农夫山泉550ml*24", spec: "550ml*24", unitPrice: 35, quantity: 1 }
    ]
  }
];

async function searchCombo() {
  comboLoading.value = true;
  try {
    // 先尝试调用后端 API
    const { data } = await api.get("/admin/product-combos", {
      params: {
        page: comboPage.value,
        pageSize: comboPageSize.value,
        keyword: comboSearch.keyword || undefined,
        categoryId: comboSearch.categoryId || undefined,
        status: comboSearch.status || undefined
      }
    });
    const res = data.data || {};
    comboList.value = res.records || res.list || [];
    comboTotal.value = res.total || 0;
  } catch {
    // 使用 mock 数据
    await new Promise(r => setTimeout(r, 300));
    let filtered = [...mockComboList];
    if (comboSearch.keyword) {
      const kw = comboSearch.keyword.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(kw) || c.comboCode.toLowerCase().includes(kw));
    }
    if (comboSearch.status) {
      filtered = filtered.filter(c => c.status === comboSearch.status);
    }
    comboTotal.value = filtered.length;
    const start = (comboPage.value - 1) * comboPageSize.value;
    comboList.value = filtered.slice(start, start + comboPageSize.value);
  } finally {
    comboLoading.value = false;
  }
}

function resetComboSearch() {
  comboSearch.keyword = "";
  comboSearch.categoryId = null;
  comboSearch.status = "";
  comboSearch.dateRange = [];
  searchCombo();
}

// 套装表单
const comboDialogVisible = ref(false);
const comboEditing = ref(false);
const comboFormRef = ref<InstanceType<typeof ElForm>>();
const comboSubmitLoading = ref(false);

const comboForm = reactive({
  id: null as number | null,
  name: "",
  comboCode: "",
  categoryId: null as number | null,
  status: "DRAFT",
  effectiveDate: null as Date | null,
  expiryDate: null as Date | null,
  products: [] as any[],
  pricingType: "FIXED" as "FIXED" | "DISCOUNT",
  originalPrice: 0,
  comboPrice: 0,
  discountRate: 90,
  discountAmount: 0,
  image: "",
  description: ""
});

const comboFormRules: FormRules = {
  name: [{ required: true, message: "请输入套装名称", trigger: "blur" }],
  comboCode: [{ required: true, message: "请输入套装编号", trigger: "blur" }],
  categoryId: [{ required: true, message: "请选择分类", trigger: "change" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }],
  comboPrice: [{ required: true, message: "请输入套装价格", trigger: "blur" }],
  discountRate: [{ required: true, message: "请输入折扣率", trigger: "blur" }]
};

function openComboDialog(row?: any) {
  comboEditing.value = !!row;
  if (row) {
    Object.assign(comboForm, {
      id: row.id,
      name: row.name,
      comboCode: row.comboCode,
      categoryId: row.categoryId || null,
      status: row.status,
      effectiveDate: row.effectiveDate || null,
      expiryDate: row.expiryDate || null,
      products: row.products ? JSON.parse(JSON.stringify(row.products)) : [],
      pricingType: row.pricingType || "FIXED",
      originalPrice: row.originalPrice || 0,
      comboPrice: row.comboPrice || 0,
      discountRate: row.discountRate || 90,
      discountAmount: row.discountAmount || 0,
      image: row.image || "",
      description: row.description || ""
    });
  } else {
    Object.assign(comboForm, {
      id: null,
      name: "",
      comboCode: "CB" + Date.now().toString().slice(-8),
      categoryId: null,
      status: "DRAFT",
      effectiveDate: null,
      expiryDate: null,
      products: [],
      pricingType: "FIXED",
      originalPrice: 0,
      comboPrice: 0,
      discountRate: 90,
      discountAmount: 0,
      image: "",
      description: ""
    });
  }
  comboDialogVisible.value = true;
}

function calcComboPrice() {
  comboForm.originalPrice = comboForm.products.reduce(
    (sum, p) => sum + (p.unitPrice || 0) * (p.quantity || 0), 0
  );
  if (comboForm.pricingType === "DISCOUNT") {
    calcByDiscount();
  } else {
    calcDiscount();
  }
}

function calcDiscount() {
  comboForm.discountAmount = Math.max(0, comboForm.originalPrice - comboForm.comboPrice);
}

function calcByDiscount() {
  comboForm.comboPrice = Number((comboForm.originalPrice * (comboForm.discountRate / 100)).toFixed(2));
  comboForm.discountAmount = comboForm.originalPrice - comboForm.comboPrice;
}

function removeComboProduct(index: number) {
  comboForm.products.splice(index, 1);
  calcComboPrice();
}

// 商品选择器
const productSelectorVisible = ref(false);
const productSearchKeyword = ref("");
const selectorProductList = ref<any[]>([]);
const selectorLoading = ref(false);
const selectedProducts = ref<any[]>([]);

function openProductSelector() {
  selectorProductList.value = allProducts.value;
  selectedProducts.value = [];
  productSelectorVisible.value = true;
}

function searchProductsForSelector() {
  selectorLoading.value = true;
  setTimeout(() => {
    if (productSearchKeyword.value) {
      const kw = productSearchKeyword.value.toLowerCase();
      selectorProductList.value = allProducts.value.filter(
        p => p.name.toLowerCase().includes(kw) || (p.skuCode || "").toLowerCase().includes(kw)
      );
    } else {
      selectorProductList.value = allProducts.value;
    }
    selectorLoading.value = false;
  }, 200);
}

function handleSelectionChange(selection: any[]) {
  selectedProducts.value = selection;
}

function confirmAddProducts() {
  for (const p of selectedProducts.value) {
    const exists = comboForm.products.find((cp: any) => cp.id === p.id);
    if (!exists) {
      comboForm.products.push({
        id: p.id,
        name: p.name,
        spec: p.spec || "",
        unitPrice: p.retailPrice || p.price || 0,
        quantity: 1,
        image: p.image || p.mainImage || ""
      });
    }
  }
  calcComboPrice();
  productSelectorVisible.value = false;
  ElMessage.success(`已添加 ${selectedProducts.value.length} 个商品`);
}

function handleImageChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => {
    comboForm.image = e.target?.result as string;
  };
  reader.readAsDataURL(file.raw);
}

async function saveComboDraft() {
  comboForm.status = "DRAFT";
  await doSaveCombo();
}

async function submitCombo() {
  if (!comboFormRef.value) return;
  await comboFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      await doSaveCombo();
    }
  });
}

async function doSaveCombo() {
  comboSubmitLoading.value = true;
  try {
    // mock 保存
    await new Promise(r => setTimeout(r, 500));
    ElMessage.success(comboEditing.value ? "编辑成功" : "创建成功");
    comboDialogVisible.value = false;
    searchCombo();
  } catch (e) {
    ElMessage.error("保存失败");
  } finally {
    comboSubmitLoading.value = false;
  }
}

function toggleComboStatus(row: any) {
  const newStatus = row.status === "ON_SALE" ? "OFF_SALE" : "ON_SALE";
  ElMessage.success(`已${newStatus === "ON_SALE" ? "上架" : "下架"}`);
  row.status = newStatus;
}

function deleteCombo(id: number) {
  const index = comboList.value.findIndex(c => c.id === id);
  if (index > -1) comboList.value.splice(index, 1);
  ElMessage.success("删除成功");
}

// 套装详情
const comboDetailVisible = ref(false);
const currentCombo = ref<any>(null);

function viewComboDetail(row: any) {
  currentCombo.value = row;
  comboDetailVisible.value = true;
}

// ============================================================
// 组合品管理
// ============================================================
const groupList = ref<any[]>([]);
const groupLoading = ref(false);
const groupTotal = ref(0);
const groupPage = ref(1);
const groupPageSize = ref(10);

const groupSearch = reactive({
  keyword: "",
  type: "",
  status: ""
});

const mockGroupList = [
  {
    id: 1, groupCode: "GP20260701001", name: "白酒+下酒菜组合",
    type: "FIXED", mainProductName: "飞天茅台53度500ml",
    optionCount: 2, basePrice: 3199, status: "ACTIVE",
    createdAt: "2026-07-01 10:30:00",
    options: [
      { id: 1, name: "飞天茅台53度500ml", spec: "500ml", extraPrice: 0, required: true },
      { id: 2, name: "酒鬼花生200g", spec: "200g", extraPrice: 15, required: true }
    ],
    ruleDescription: "固定组合，商品固定，价格固定，不可调整。"
  },
  {
    id: 2, groupCode: "GP20260703002", name: "啤酒畅饮可选组合",
    type: "OPTIONAL", mainProductName: "青岛啤酒经典500ml*24",
    optionCount: 3, basePrice: 98, status: "ACTIVE",
    createdAt: "2026-07-03 14:20:00",
    options: [
      { id: 5, name: "青岛啤酒经典500ml*24", spec: "500ml*24", extraPrice: 0, required: true },
      { id: 11, name: "可口可乐330ml*24", spec: "330ml*24", extraPrice: 45, required: false },
      { id: 12, name: "农夫山泉550ml*24", spec: "550ml*24", extraPrice: 28, required: false }
    ],
    ruleDescription: "主商品必选，配件可自由搭配，每件配件单独加价。"
  },
  {
    id: 3, groupCode: "GP20260706003", name: "红酒双支礼盒组合",
    type: "FIXED", mainProductName: "张裕解百纳干红750ml",
    optionCount: 2, basePrice: 358, status: "INACTIVE",
    createdAt: "2026-07-06 09:15:00",
    options: [
      { id: 7, name: "张裕解百纳干红750ml", spec: "750ml", extraPrice: 0, required: true },
      { id: 8, name: "长城干红葡萄酒750ml", spec: "750ml", extraPrice: 88, required: true }
    ],
    ruleDescription: "双支装礼盒，固定搭配。"
  }
];

async function searchGroup() {
  groupLoading.value = true;
  try {
    const { data } = await api.get("/admin/product-groups", {
      params: {
        page: groupPage.value,
        pageSize: groupPageSize.value,
        keyword: groupSearch.keyword || undefined,
        type: groupSearch.type || undefined,
        status: groupSearch.status || undefined
      }
    });
    const res = data.data || {};
    groupList.value = res.records || res.list || [];
    groupTotal.value = res.total || 0;
  } catch {
    await new Promise(r => setTimeout(r, 300));
    let filtered = [...mockGroupList];
    if (groupSearch.keyword) {
      const kw = groupSearch.keyword.toLowerCase();
      filtered = filtered.filter(g => g.name.toLowerCase().includes(kw) || g.groupCode.toLowerCase().includes(kw));
    }
    if (groupSearch.type) {
      filtered = filtered.filter(g => g.type === groupSearch.type);
    }
    if (groupSearch.status) {
      filtered = filtered.filter(g => g.status === groupSearch.status);
    }
    groupTotal.value = filtered.length;
    const start = (groupPage.value - 1) * groupPageSize.value;
    groupList.value = filtered.slice(start, start + groupPageSize.value);
  } finally {
    groupLoading.value = false;
  }
}

// 组合品表单
const groupDialogVisible = ref(false);
const groupEditing = ref(false);
const groupFormRef = ref<InstanceType<typeof ElForm>>();
const groupSubmitLoading = ref(false);

const groupForm = reactive({
  id: null as number | null,
  name: "",
  groupCode: "",
  type: "FIXED" as "FIXED" | "OPTIONAL",
  status: "ACTIVE",
  mainProductId: null as number | null,
  basePrice: 0,
  options: [] as any[],
  ruleDescription: ""
});

const groupFormRules: FormRules = {
  name: [{ required: true, message: "请输入组合名称", trigger: "blur" }],
  groupCode: [{ required: true, message: "请输入组合编号", trigger: "blur" }],
  type: [{ required: true, message: "请选择组合类型", trigger: "change" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }],
  mainProductId: [{ required: true, message: "请选择主商品", trigger: "change" }],
  basePrice: [{ required: true, message: "请输入基础价格", trigger: "blur" }]
};

function openGroupDialog(row?: any) {
  groupEditing.value = !!row;
  if (row) {
    Object.assign(groupForm, {
      id: row.id,
      name: row.name,
      groupCode: row.groupCode,
      type: row.type,
      status: row.status,
      mainProductId: row.mainProductId || null,
      basePrice: row.basePrice || 0,
      options: row.options ? JSON.parse(JSON.stringify(row.options)) : [],
      ruleDescription: row.ruleDescription || ""
    });
  } else {
    Object.assign(groupForm, {
      id: null,
      name: "",
      groupCode: "GP" + Date.now().toString().slice(-8),
      type: "FIXED",
      status: "ACTIVE",
      mainProductId: null,
      basePrice: 0,
      options: [],
      ruleDescription: ""
    });
  }
  groupDialogVisible.value = true;
}

function openGroupProductSelector() {
  // 简化：直接添加可选商品
  const existingIds = groupForm.options.map((o: any) => o.id);
  const available = allProducts.value.filter(p => !existingIds.includes(p.id));
  if (available.length > 0) {
    groupForm.options.push({
      id: available[0].id,
      name: available[0].name,
      spec: available[0].spec || "",
      extraPrice: 0,
      required: groupForm.type === "FIXED"
    });
  }
}

function removeGroupOption(index: number) {
  groupForm.options.splice(index, 1);
}

async function saveGroup() {
  if (!groupFormRef.value) return;
  await groupFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      groupSubmitLoading.value = true;
      try {
        await new Promise(r => setTimeout(r, 500));
        ElMessage.success(groupEditing.value ? "编辑成功" : "创建成功");
        groupDialogVisible.value = false;
        searchGroup();
      } catch {
        ElMessage.error("保存失败");
      } finally {
        groupSubmitLoading.value = false;
      }
    }
  });
}

function deleteGroup(id: number) {
  const index = groupList.value.findIndex(g => g.id === id);
  if (index > -1) groupList.value.splice(index, 1);
  ElMessage.success("删除成功");
}

// 组合详情
const groupDetailVisible = ref(false);
const currentGroup = ref<any>(null);

function viewGroupDetail(row: any) {
  currentGroup.value = row;
  groupDetailVisible.value = true;
}

// ============================================================
// 销售统计
// ============================================================
const statsDateRange = ref<Date[]>([]);
const salesRankChartRef = ref<HTMLElement>();
const salesTrendChartRef = ref<HTMLElement>();
const discountChartRef = ref<HTMLElement>();

let salesRankChart: echarts.ECharts | null = null;
let salesTrendChart: echarts.ECharts | null = null;
let discountChart: echarts.ECharts | null = null;

const statsSummary = reactive({
  totalSales: 1286,
  totalAmount: 568920.50,
  totalDiscount: 78650.30,
  activeComboCount: 15
});

async function loadStats() {
  await nextTick();
  initSalesRankChart();
  initSalesTrendChart();
  initDiscountChart();
}

function initSalesRankChart() {
  if (!salesRankChartRef.value) return;
  if (salesRankChart) salesRankChart.dispose();
  salesRankChart = echarts.init(salesRankChartRef.value);

  const data = [
    { name: "中秋佳节送礼套装", value: 328 },
    { name: "啤酒畅饮套装", value: 256 },
    { name: "家庭聚会套装", value: 201 },
    { name: "红酒品鉴套装", value: 178 },
    { name: "洋酒尊享套装", value: 145 },
    { name: "双支白酒礼盒", value: 89 },
    { name: "夏日冰爽套装", value: 76 },
    { name: "商务宴请套装", value: 65 },
    { name: "入门品鉴套装", value: 52 },
    { name: "婚庆喜宴套装", value: 48 }
  ].sort((a, b) => a.value - b.value);

  salesRankChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: data.map(d => d.name),
      axisLabel: { fontSize: 12 }
    },
    series: [{
      type: "bar",
      data: data.map(d => d.value),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#83bff6" },
          { offset: 0.5, color: "#188df0" },
          { offset: 1, color: "#188df0" }
        ])
      },
      barWidth: "60%",
      label: { show: true, position: "right" }
    }]
  });
}

function initSalesTrendChart() {
  if (!salesTrendChartRef.value) return;
  if (salesTrendChart) salesTrendChart.dispose();
  salesTrendChart = echarts.init(salesTrendChartRef.value);

  const days = [];
  const amounts = [];
  const sales = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getMonth() + 1}/${d.getDate()}`);
    amounts.push(Math.round(30000 + Math.random() * 20000));
    sales.push(Math.round(60 + Math.random() * 50));
  }

  salesTrendChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["销售额", "销量"] },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: days, boundaryGap: false },
    yAxis: [
      { type: "value", name: "销售额(元)" },
      { type: "value", name: "销量(件)" }
    ],
    series: [
      {
        name: "销售额",
        type: "line",
        smooth: true,
        data: amounts,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(245, 108, 108, 0.3)" },
            { offset: 1, color: "rgba(245, 108, 108, 0.05)" }
          ])
        },
        lineStyle: { color: "#C0392B", width: 2 },
        itemStyle: { color: "#C0392B" }
      },
      {
        name: "销量",
        type: "bar",
        yAxisIndex: 1,
        data: sales,
        itemStyle: { color: "#0EA879" },
        barWidth: "30%"
      }
    ]
  });
}

function initDiscountChart() {
  if (!discountChartRef.value) return;
  if (discountChart) discountChart.dispose();
  discountChart = echarts.init(discountChartRef.value);

  const categories = ["白酒套装", "啤酒套装", "红酒套装", "洋酒套装", "饮料套装", "混合套装"];
  const originalAmounts = [285000, 62000, 48000, 95000, 32000, 62000];
  const discountAmounts = [42800, 8600, 6200, 12500, 3800, 8900];

  discountChart.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["原价总额", "优惠金额"] },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value", name: "金额(元)" },
    series: [
      {
        name: "原价总额",
        type: "bar",
        data: originalAmounts,
        itemStyle: { color: "#3F6FEF" },
        barWidth: "30%"
      },
      {
        name: "优惠金额",
        type: "bar",
        data: discountAmounts,
        itemStyle: { color: "#D48B3A" },
        barWidth: "30%"
      }
    ]
  });
}

// 响应式调整图表
function resizeCharts() {
  salesRankChart?.resize();
  salesTrendChart?.resize();
  discountChart?.resize();
}

onMounted(() => {
  loadBaseData();
  searchCombo();
  searchGroup();
  loadStats();
  window.addEventListener("resize", resizeCharts);
});
</script>

<style scoped>
.page {
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px 0;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.stat-card {
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: var(--gray-400);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 8px;
}

.stat-trend {
  font-size: 12px;
}

.stat-trend.up {
  color: var(--color-success);
}

.stat-trend.down {
  color: var(--color-danger);
}

.chart-header {
  font-weight: 600;
}

.chart-container {
  height: 320px;
  width: 100%;
}

.chart-container-horizontal {
  height: 280px;
  width: 100%;
}

.avatar-uploader {
  border: 1px dashed var(--gray-200);
  border-radius: 6px;
  cursor: pointer;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-uploader:hover {
  border-color: var(--color-primary);
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
}

.combo-image {
  width: 120px;
  height: 120px;
}
</style>
