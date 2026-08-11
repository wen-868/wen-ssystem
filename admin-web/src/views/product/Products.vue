<template>
  <div class="page">
    <!-- 页头：标题 + 说明 + 操作区（列表页骨架示范） -->
    <div class="page-header">
      <div class="page-header-main">
        <h2 class="page-title">商品中心</h2>
        <p class="page-desc">管理商品 SPU 与 SKU 规格、价格与库存</p>
      </div>
      <div class="page-header-actions">
        <el-input
          v-model="keyword" placeholder="搜索商品名称/SKU编码/条码" size="default"
          style="width: 240px" clearable @clear="search" @keyup.enter="search"
        />
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>&nbsp;新增商品
        </el-button>
        <el-button @click="search">刷新</el-button>
      </div>
    </div>

    <StatBar :stats="productStats" />
    <TableSkeleton v-if="loading" />
    <div v-else class="table-card">
      <el-table class="list-table" :data="spuList" stripe row-key="spuId" @expand-change="onExpandChange" :expand-row-keys="expandKeys">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <h4>SKU 列表 ({{ row._skus?.length || 0 }} 个规格)</h4>
              <el-table :data="row._skus" size="small" stripe>
                <el-table-column prop="skuCode" label="SKU编码" width="140" />
                <el-table-column prop="skuName" label="规格名称" min-width="140" />
                <el-table-column prop="barcode" label="条码" width="130" />
                <el-table-column prop="retailPrice" label="零售价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.retailPrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="wholesalePrice" label="批发价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.wholesalePrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="miniappPrice" label="小程序价" width="100">
                  <template #default="{ row: s }">¥{{ Number(s.miniappPrice || 0).toFixed(2) }}</template>
                </el-table-column>
                <el-table-column prop="boxRatio" label="箱瓶比" width="80" />
                <el-table-column prop="temperature" label="温层" width="80">
                  <template #default="{ row: s }">{{ s.temperature === 'CHILLED' ? '冷藏' : '常温' }}</template>
                </el-table-column>
                <el-table-column prop="warningThreshold" label="库存预警" width="90" />
                <el-table-column label="操作" width="160" fixed="right">
                  <template #default="{ row: s }">
                    <el-button size="small" link type="primary" @click="viewSkuPriceHistory(s)">价格历史</el-button>
                    <el-button size="small" link type="warning" @click="openSkuPriceDialog(s)">改价</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="主图" width="70">
          <template #default="{ row }">
            <el-image
              v-if="row.mainImage" lazy :src="row.mainImage" :preview-src-list="[row.mainImage]"
              style="width: 40px; height: 40px; border-radius: 4px" fit="cover"
            />
            <span v-else style="color: var(--gray-300)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="spuCode" label="SPU编码" width="130" />
        <el-table-column prop="name" label="商品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="100" />
        <el-table-column prop="brandName" label="品牌" width="100" />
        <el-table-column prop="alcoholContent" label="酒精度" width="90" align="center">
          <template #default="{ row }">{{ row.alcoholContent ? row.alcoholContent + '%vol' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="origin" label="产地" width="100" />
        <el-table-column label="销售渠道" width="120">
          <template #default="{ row }">
            <template v-if="row.saleChannels">
              <el-tag v-for="ch in parseChannels(row.saleChannels)" :key="ch" size="small" style="margin: 1px">
                {{ ch === 'MINIAPP' ? '小程序' : ch === 'STORE' ? '门店' : ch }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="SKU数" width="70" align="center">
          <template #default="{ row }">{{ row._skus?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="零售价" width="100">
          <template #default="{ row }">¥{{ Number(row._firstRetailPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="批发价" width="100">
          <template #default="{ row }">¥{{ Number(row._firstWholesalePrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="availableQty" label="可用库存" width="100" align="center">
          <template #default="{ row }">{{ row.availableQty ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ON_SALE'" type="success">上架</el-tag>
            <el-tag v-else-if="row.status === 'DRAFT'" type="info">草稿</el-tag>
            <el-tag v-else type="danger">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button size="small" link type="success" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              size="small" link :type="row.status === 'ON_SALE' ? 'danger' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ON_SALE' ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-card-footer">
        <el-pagination
          background layout="total, sizes, prev, pager, next, jumper"
          :total="total" :page-size="pageSize" :current-page="page"
          @size-change="(s: number) => { pageSize = s; page = 1; search(); }"
          @current-change="(p: number) => { page = p; search(); }"
        />
      </div>
    </div>

    <!-- 新增/编辑 SPU -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商品' : '新增商品'" width="900px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px" ref="formRef" :rules="rules">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入商品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类" prop="categoryId">
              <el-tree-select
                v-model="form.categoryId" :data="categoryTree" check-strictly
                :props="{ label: 'name', value: 'id', children: 'children' }"
                placeholder="选择分类" style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品主图">
              <el-input v-model="form.mainImage" placeholder="图片URL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌">
              <el-select v-model="form.brandId" placeholder="选择品牌" clearable style="width: 100%">
                <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="酒精度(%vol)">
              <el-input-number v-model="form.alcoholContent" :min="0" :max="100" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产地">
              <el-input v-model="form.origin" placeholder="产地" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="销售渠道">
              <el-select v-model="form.saleChannels" multiple placeholder="选择渠道" style="width: 100%">
                <el-option label="小程序" value="MINIAPP" />
                <el-option label="门店" value="STORE" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="轮播图">
              <el-input v-model="form.imageUrls" type="textarea" :rows="3" placeholder="每行一个图片URL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="营销标签">
              <el-input v-model="form.marketingTags" placeholder="多个标签用逗号分隔，如：新品,热销,限时" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="如：瓶、箱" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="多单位">
              <el-switch v-model="form.multiUnitEnabled" />
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="form.multiUnitEnabled">
            <el-form-item label="单位组" prop="unitGroupId">
              <el-select v-model="form.unitGroupId" placeholder="选择单位组" style="width: 100%">
                <el-option v-for="g in unitGroupOptions" :key="g.id" :label="g.name" :value="g.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="规格">
              <el-input v-model="form.specs" placeholder="如：500ml*12" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序号">
              <el-input-number v-model="form.sortNo" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="新品">
              <el-switch v-model="form.isNew" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="推荐">
              <el-switch v-model="form.isRecommend" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="成本价">
              <el-input-number v-model="form.costPrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="门店价">
              <el-input-number v-model="form.storePrice" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品描述">
              <el-input v-model="form.description" type="textarea" :rows="2" placeholder="商品描述" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">SKU 信息 (至少添加一个)</el-divider>
        <div v-for="(sku, idx) in form.skus" :key="idx" class="sku-row">
          <div class="sku-header">
            <span>SKU #{{ idx + 1 }}</span>
            <el-button v-if="form.skus.length > 1" size="small" type="danger" link @click="removeSku(idx)">移除</el-button>
          </div>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="规格名称" :prop="'skus.' + idx + '.skuName'" :rules="[{ required: true, message: '必填', trigger: 'blur' }]">
                <el-input v-model="sku.skuName" placeholder="如: 500ml/瓶" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="条码">
                <el-input v-model="sku.barcode" placeholder="商品条码">
                  <template #append>
                    <el-button :icon="Search" :disabled="!sku.barcode || !!skuLookupLoading[idx]" :loading="!!skuLookupLoading[idx]" @click="lookupFromLibrary(idx)" />
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="箱瓶比">
                <el-input-number v-model="sku.boxRatio" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="零售价" :prop="'skus.' + idx + '.retailPrice'" :rules="[{ required: true, message: '必填', trigger: 'blur' }]">
                <el-input-number v-model="sku.retailPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="批发价">
                <el-input-number v-model="sku.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="小程序价">
                <el-input-number v-model="sku.miniappPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="温层">
                <el-select v-model="sku.temperature" style="width: 100%">
                  <el-option label="常温" value="NORMAL" />
                  <el-option label="冷藏" value="CHILLED" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="库存预警">
                <el-input-number v-model="sku.warningThreshold" :min="0" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="追溯">
                <el-switch v-model="sku.traceEnabled" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="成本价">
                <el-input-number v-model="sku.costPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="门店价">
                <el-input-number v-model="sku.storePrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="净含量">
                <el-input v-model="sku.volume" placeholder="如：500ml" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="包装类型">
                <el-input v-model="sku.packaging" placeholder="如：瓶装" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="基本单位">
                <el-input v-model="sku.baseUnit" placeholder="如：瓶" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="箱单位">
                <el-input v-model="sku.boxUnit" placeholder="如：箱" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>
        <el-button type="primary" link @click="addSku">+ 添加SKU</el-button>
      </el-form>
      <template #footer>
        <FormFooter
          :loading="submitLoading"
          :show-save-and-add="!isEdit"
          @cancel="dialogVisible = false"
          @save="handleSubmit()"
          @save-add="handleSubmit(true)"
        />
      </template>
    </el-dialog>

    <!-- 详情抽屉 (4 Tab: 商品信息/商品详情/SKU列表/商品标签) -->
    <el-drawer v-model="detailVisible" :title="'商品详情 - ' + (detailSpu?.name || '')" size="720px">
      <template v-if="detailSpu">
        <el-tabs v-model="detailTab">
          <el-tab-pane label="商品信息" name="basic">
            <div class="detail-basic-layout">
              <!-- 左侧：商品大图区（主图 + 图册） -->
              <div class="detail-image-panel">
                <div class="detail-section-title">商品图片</div>
                <el-image
                  v-if="detailSpu.mainImage"
                  :src="detailSpu.mainImage"
                  class="detail-main-img"
                  fit="contain"
                  :preview-src-list="[detailSpu.mainImage]"
                  preview-teleported
                />
                <div v-else class="detail-main-img detail-main-img--empty">
                  <el-icon :size="28"><Picture /></el-icon>
                  <span>暂无主图</span>
                </div>
                <el-input
                  v-model="detailSpu.mainImage" size="small" placeholder="主图 URL（1:1，≥800×800）" clearable :disabled="!detailEditing"
                  @keyup.enter="saveDetailField('mainImage', detailSpu.mainImage, true)"
                >
                  <template #append>
                    <el-button v-if="detailEditing" size="small" @click="saveDetailField('mainImage', detailSpu.mainImage, true)">保存</el-button>
                  </template>
                </el-input>
                <div class="detail-section-title detail-section-title--sub">图册</div>
                <div v-if="detailImageUrls.length" class="detail-gallery-list">
                  <div v-for="(url, i) in detailImageUrls" :key="i" class="detail-gallery-item">
                    <el-image
                      :src="url" fit="cover" :preview-src-list="detailImageUrls" preview-teleported
                      style="width: 52px; height: 52px; border-radius: 6px; background: var(--bg-page);"
                    />
                    <el-icon v-if="detailEditing" class="detail-gallery-del" @click="removeGalleryImage(i)"><Close /></el-icon>
                  </div>
                </div>
                <el-input v-model="galleryInput" size="small" placeholder="输入图册 URL，回车添加" clearable :disabled="!detailEditing" @keyup.enter="addGalleryImage">
                  <template #append>
                    <el-button v-if="detailEditing" size="small" @click="addGalleryImage">添加</el-button>
                  </template>
                </el-input>
                <div class="detail-image-panel-actions">
                  <span v-if="!detailImageUrls.length" class="detail-gallery-empty">暂无图册</span>
                  <el-button v-if="detailEditing" size="small" type="primary" plain :loading="gallerySaving" @click="saveGallery">保存图册</el-button>
                </div>
              </div>
              <!-- 右侧：基本信息 + 扩展信息（两栏表单，适配本系统字段） -->
              <div class="detail-basic-form">
                <div class="detail-section-title">基本信息</div>
                <el-form label-position="top" size="small" class="detail-basic-grid">
                  <el-form-item label="商品名称">
                    <el-input v-model="detailSpu.name" placeholder="商品名称" :disabled="!detailEditing" @change="saveDetailField('name', detailSpu.name, true)" />
                  </el-form-item>
                  <el-form-item label="商品分类">
                    <el-tree-select
                      v-model="detailSpu.categoryId" :data="categoryTree" check-strictly
                      :props="{ label: 'name', value: 'id', children: 'children' }"
                      placeholder="选择分类" style="width: 100%" :disabled="!detailEditing"
                      @change="saveDetailField('category', detailSpu.categoryId, true)"
                    />
                  </el-form-item>
                  <el-form-item label="商品品牌">
                    <el-select v-model="detailSpu.brandId" placeholder="选择品牌" clearable style="width: 100%" :disabled="!detailEditing" @change="saveDetailField('brandId', detailSpu.brandId, true)">
                      <el-option v-for="b in brandList" :key="b.id" :label="b.name" :value="b.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="规格/净含量">
                    <el-input v-model="detailSpu.specs" placeholder="如 500ml×12" :disabled="!detailEditing" @change="saveDetailField('specs', detailSpu.specs, true)" />
                  </el-form-item>
                  <el-form-item label="酒精度(%vol)">
                    <el-input-number v-model="detailSpu.alcoholContent" :min="0" :max="100" :precision="1" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveDetailField('alcoholContent', detailSpu.alcoholContent, true)" />
                  </el-form-item>
                  <el-form-item label="产地">
                    <el-input v-model="detailSpu.origin" placeholder="产地" :disabled="!detailEditing" @change="saveDetailField('origin', detailSpu.origin, true)" />
                  </el-form-item>
                  <el-form-item label="销售渠道">
                    <el-select v-model="detailChannels" multiple placeholder="选择渠道" style="width: 100%" :disabled="!detailEditing" @change="saveDetailChannels">
                      <el-option label="小程序" value="MINIAPP" />
                      <el-option label="门店" value="STORE" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="状态">
                    <el-select v-model="detailSpu.status" style="width: 100%" :disabled="!detailEditing" @change="saveDetailField('status', detailSpu.status, true)">
                      <el-option label="草稿" value="DRAFT" />
                      <el-option label="上架" value="ON_SALE" />
                      <el-option label="下架" value="OFF_SALE" />
                    </el-select>
                  </el-form-item>
                </el-form>
                <div class="detail-section-title">扩展信息</div>
                <div class="detail-extras">
                  <el-checkbox v-model="detailSpu.isNew" :disabled="!detailEditing" @change="saveDetailField('isNew', detailSpu.isNew, true)">新品</el-checkbox>
                  <el-checkbox v-model="detailSpu.isRecommend" :disabled="!detailEditing" @change="saveDetailField('isRecommend', detailSpu.isRecommend, true)">推荐</el-checkbox>
                  <span class="detail-meta">创建 {{ formatDate(detailSpu.createdAt) }} · 更新 {{ formatDate(detailSpu.updatedAt) }}</span>
                </div>
              </div>
            </div>
            <!-- 单位与 SKU 信息：追溯/库存/预警为 SKU 全局设置；单位价格表按瓶/箱拆分 -->
            <div class="detail-section-title detail-section-title--block">单位与 SKU 信息</div>
            <div class="sku-detail-tip">追溯为 SKU 全局设置：开启后该规格所有单位出库均需录入追溯码；库存按基础单位统计</div>
            <el-table :data="detailSpu._skus" size="small" stripe border max-height="240">
              <el-table-column label="规格" min-width="180">
                <template #default="{ row }">
                  <div class="sku-name-cell">
                    <span>{{ row.skuName }}</span>
                    <span class="sku-code-sub">{{ row.skuCode }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="availableQty" label="库存(基础单位)" width="125" align="center" />
              <el-table-column label="预警阈值" width="115">
                <template #default="{ row }">
                  <el-input-number v-model="row.warningThreshold" :min="0" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuInfo(row, 'warningThreshold')" />
                </template>
              </el-table-column>
              <el-table-column label="追溯(全局)" width="115" align="center">
                <template #default="{ row }">
                  <el-switch v-model="row.traceEnabled" inline-prompt active-text="开" inactive-text="关" :disabled="!detailEditing" @change="saveSkuInfo(row, 'traceEnabled')" />
                </template>
              </el-table-column>
            </el-table>
            <div class="detail-section-title detail-section-title--sub">单位价格明细（支持多单位增加与换算：1 单位 = 换算 个基础单位）</div>
            <el-table :data="skuUnitRows" size="small" stripe border max-height="320">
              <el-table-column label="单位" width="122">
                <template #default="{ row }">
                  <div class="sku-unit-name-cell">
                    <el-input v-model="row.unitName" size="small" :disabled="!detailEditing" @change="saveSkuUnitName(row)" />
                    <el-tag v-if="row.isBase" size="small" type="success" class="sku-unit-base-tag">基础</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="换算(折基础)" width="115">
                <template #default="{ row }">
                  <el-input-number v-if="!row.isBase" v-model="row.ratio" :min="0.01" :precision="2" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuUnitRatio(row)" />
                  <span v-else>1</span>
                </template>
              </el-table-column>
              <el-table-column label="条码" width="142">
                <template #default="{ row }">
                  <el-input v-model="row.barcode" size="small" placeholder="录入条码" clearable :disabled="!detailEditing" @change="saveSkuUnitBarcode(row)" />
                </template>
              </el-table-column>
              <el-table-column label="零售价" width="112">
                <template #default="{ row }">
                  <el-input-number v-model="row.retailPrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuUnitPrice(row)" />
                </template>
              </el-table-column>
              <el-table-column label="批发价" width="112">
                <template #default="{ row }">
                  <el-input-number v-model="row.wholesalePrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuUnitPrice(row)" />
                </template>
              </el-table-column>
              <el-table-column label="门店价" width="112">
                <template #default="{ row }">
                  <el-input-number v-model="row.storePrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuUnitPrice(row)" />
                </template>
              </el-table-column>
              <el-table-column label="小程序价" width="112">
                <template #default="{ row }">
                  <el-input-number v-model="row.miniappPrice" :min="0" :precision="2" size="small" controls-position="right" style="width: 100%" :disabled="!detailEditing" @change="saveSkuUnitPrice(row)" />
                </template>
              </el-table-column>
              <el-table-column v-if="detailEditing" label="操作" width="105" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="row.isBase" size="small" link type="primary" @click="addSkuUnit(row)">+ 添加单位</el-button>
                  <el-button v-else size="small" link type="danger" @click="deleteSkuUnit(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <!-- 商品标签（营销标签） -->
            <div class="detail-section-title detail-section-title--block">商品标签</div>
            <el-tabs v-model="tagTypeTab" type="card">
              <el-tab-pane v-for="group in tagGroups" :key="group" :label="tagTypeLabel(group)" :name="group">
                <el-checkbox-group v-model="detailTagIds" class="tag-cb-group">
                  <el-checkbox v-for="tag in tagsByType[group]" :key="tag.id" :label="tag.id" :value="tag.id" :disabled="!detailEditing">{{ tag.name }}</el-checkbox>
                </el-checkbox-group>
              </el-tab-pane>
            </el-tabs>
            <p class="detail-tag-tip">标签随底部「保存 / 保存并增加」一并提交</p>
          </el-tab-pane>
          <el-tab-pane label="商品详情" name="detail">
            <div style="border: 1px solid var(--gray-200); border-radius: 4px">
              <div style="border-bottom: 1px solid var(--gray-200); padding: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('bold') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleBold().run()" style="font-weight: bold;">B</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('italic') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleItalic().run()" style="font-style: italic;">I</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('strike') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleStrike().run()" style="text-decoration: line-through;">S</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('heading', { level: 1 }) ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleHeading({ level: 1 }).run()">H1</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('heading', { level: 2 }) ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('bulletList') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleBulletList().run()">无序列表</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('orderedList') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleOrderedList().run()">有序列表</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('codeBlock') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleCodeBlock().run()">代码块</el-button>
                <el-button size="small" :disabled="!detailEditing" :type="richEditor?.isActive('blockquote') ? 'primary' : 'default'" @click="richEditor?.chain().focus().toggleBlockquote().run()">引用</el-button>
                <el-button size="small" :disabled="!detailEditing" @click="richEditor?.chain().focus().undo().run()">撤销</el-button>
                <el-button size="small" :disabled="!detailEditing" @click="richEditor?.chain().focus().redo().run()">重做</el-button>
              </div>
              <EditorContent :editor="richEditor" class="detail-editor-content" />
            </div>
            <div class="detail-editor-actions">
              <span class="detail-editor-tip">修改后自动保存，也可手动保存</span>
              <div v-if="detailEditing" class="detail-editor-btns">
                <el-button size="small" @click="resetDetailEditor">恢复</el-button>
                <el-button size="small" type="primary" @click="flushDetailSave">保存详情</el-button>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
      <template #footer>
        <div class="detail-footer">
          <span class="detail-footer-tip">{{ detailEditing ? '编辑模式：修改后点保存' : '查看模式：点修改进入编辑' }}</span>
          <div class="detail-footer-btns">
            <el-button :type="detailEditing ? 'default' : 'primary'" @click="toggleDetailEdit">
              {{ detailEditing ? '取消修改' : '修改' }}
            </el-button>
            <el-button type="primary" :disabled="!detailEditing" :loading="detailSaving" @click="saveDetailAll">保存</el-button>
            <el-button type="success" :disabled="!detailEditing" :loading="detailSaving" @click="saveDetailAndAdd">保存并增加</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- SKU 价格历史 -->
    <el-dialog v-model="priceHistoryVisible" title="价格历史" width="720px">
      <el-table :data="priceHistory" size="small" stripe v-loading="priceHistoryLoading">
        <el-table-column prop="priceType" label="价格类型" width="100" />
        <el-table-column prop="oldPrice" label="旧价格" width="100">
          <template #default="{ row }">¥{{ Number(row.oldPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="newPrice" label="新价格" width="100">
          <template #default="{ row }">¥{{ Number(row.newPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="actionType" label="操作" width="80" />
        <el-table-column prop="createdAt" label="时间" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- SKU 改价 -->
    <el-dialog v-model="skuPriceVisible" title="改价" width="480px">
      <template v-if="skuPriceTarget">
        <el-form label-width="100px">
          <el-form-item label="SKU名称"><span>{{ skuPriceTarget.skuName }}</span></el-form-item>
          <el-form-item label="零售价">
            <el-input-number v-model="skuPriceForm.retailPrice" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="批发价">
            <el-input-number v-model="skuPriceForm.wholesalePrice" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="小程序价">
            <el-input-number v-model="skuPriceForm.miniappPrice" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="skuPriceVisible = false">取消</el-button>
        <el-button type="primary" :loading="skuPriceLoading" @click="handleSkuPriceUpdate">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Close, Picture, Plus, Search } from "@element-plus/icons-vue";
import FormFooter from "../../components/FormFooter.vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { api } from "../../api";
import { lookupLibraryByBarcode } from "../../api/library";
import { formatDate } from "../../utils/format";
import TableSkeleton from "../../components/TableSkeleton.vue";
import StatBar from "../../components/StatBar.vue";

// ---------- State ----------
const loading = ref(false);
const submitLoading = ref(false);
const tagSubmitLoading = ref(false);
const priceHistoryLoading = ref(false);
const skuPriceLoading = ref(false);
const skuLookupLoading = reactive<Record<number, boolean>>({});
const spuList = ref<any[]>([]);

/** 商品统计条（对标设计稿 p05） */
const productStats = computed(() => {
  const list = spuList.value;
  const onSale = list.filter((p) => p.status === "ON_SALE").length;
  const draft = list.filter((p) => p.status === "DRAFT").length;
  const lowStock = list.filter((p) => Number(p.availableQty ?? 0) <= 10).length;
  return [
    { label: "全部商品", value: list.length, primary: true },
    { label: "在售", value: onSale },
    { label: "草稿", value: draft },
    { label: "低库存", value: lowStock },
  ];
});
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");
const dialogVisible = ref(false);
const detailVisible = ref(false);
const priceHistoryVisible = ref(false);
const skuPriceVisible = ref(false);
const isEdit = ref(false);
const editSpuId = ref<number | null>(null);
const expandKeys = ref<number[]>([]);
const detailTab = ref("basic");
const tagTypeTab = ref("");
const formRef = ref<FormInstance>();

const categoryTree = ref<any[]>([]);
const brandList = ref<any[]>([]);
const unitGroupOptions = ref<any[]>([]);
const detailSpu = ref<any>(null);
const priceHistory = ref<any[]>([]);
const skuPriceTarget = ref<any>(null);
const tagGroups = ref<string[]>([]);
const tagsByType = ref<Record<string, any[]>>({});
const detailTagIds = ref<number[]>([]);
const detailImageUrls = ref<string[]>([]);
const detailChannels = ref<string[]>([]);
const galleryInput = ref("");
const gallerySaving = ref(false);
const detailEditing = ref(false);
const detailSaving = ref(false);

/** SKU 单位行：将多单位平铺（基础单位在前，非基础单位价格空时后端已按换算推导） */
const skuUnitRows = computed(() => {
  const rows: any[] = [];
  for (const s of (detailSpu.value?._skus || [])) {
    const units = Array.isArray(s.units) && s.units.length > 0
      ? s.units
      : [
          { unitName: s.baseUnit || "瓶", ratio: 1, barcode: s.barcode || "", isBase: 1, retailPrice: s.retailPrice, wholesalePrice: s.wholesalePrice, storePrice: s.storePrice, miniappPrice: s.miniappPrice },
          {
            unitName: s.boxUnit || "箱",
            ratio: Number(s.boxRatio || 1),
            barcode: s.boxBarcode || "",
            isBase: 0,
            retailPrice: Number(s.retailPrice || 0) * Number(s.boxRatio || 1),
            wholesalePrice: s.wholesalePrice === null || s.wholesalePrice === undefined ? null : Number(s.wholesalePrice) * Number(s.boxRatio || 1),
            storePrice: s.storePrice === null || s.storePrice === undefined ? null : Number(s.storePrice) * Number(s.boxRatio || 1),
            miniappPrice: s.miniappPrice === null || s.miniappPrice === undefined ? null : Number(s.miniappPrice) * Number(s.boxRatio || 1),
          },
        ];
    for (const u of units) {
      rows.push({ ...s, ...u, rowKey: `u-${s.skuId}-${u.id || u.unitName || ""}` });
    }
  }
  return rows;
});

const TAG_LABELS: Record<string, string> = {
  aroma: "香型", alcohol_level: "度数段", region: "产区", scene: "场景", vintage: "年份"
};
function tagTypeLabel(t: string) { return TAG_LABELS[t] || t; }

// ---------- Rich Text Editor (tiptap) ----------
let richEditorSaveTimer: ReturnType<typeof setTimeout> | null = null;

const richEditor = useEditor({
  content: "",
  extensions: [StarterKit],
  onUpdate: () => {
    if (richEditorSaveTimer) clearTimeout(richEditorSaveTimer);
    richEditorSaveTimer = setTimeout(() => {
      if (detailSpu.value && detailSpu.value.spuId) {
        saveDetailField("detail", richEditor.value?.getHTML() || "");
      }
    }, 1500);
  },
});

// 当详情数据变化时，同步编辑器内容
watch(detailSpu, (val) => {
  if (val && richEditor.value) {
    const currentHTML = richEditor.value.getHTML();
    if (currentHTML !== val.detail) {
      richEditor.value.commands.setContent(val.detail || "", { emitUpdate: false });
    }
  }
});

onBeforeUnmount(() => {
  if (richEditorSaveTimer) clearTimeout(richEditorSaveTimer);
  richEditor.value?.destroy();
});

// ---------- Default Form ----------
const defaultForm = {
  name: "",
  categoryId: null as number | null,
  mainImage: "",
  brandId: null as number | null,
  alcoholContent: null as number | null,
  origin: "",
  saleChannels: ["MINIAPP", "STORE"] as string[],
  unit: "",
  multiUnitEnabled: false,
  unitGroupId: null as number | null,
  specs: "",
  sortNo: 0,
  isNew: false,
  isRecommend: false,
  description: "",
  imageUrls: "",
  marketingTags: "",
  costPrice: 0,
  storePrice: 0,
  skus: [{ skuName: "", barcode: "", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 0, retailPrice: 0, wholesalePrice: null as number | null, miniappPrice: null as number | null, costPrice: 0, storePrice: 0, volume: "", packaging: "", baseUnit: "", boxUnit: "" }]
};
const form = reactive(JSON.parse(JSON.stringify(defaultForm)));

const rules: FormRules = {
  name: [{ required: true, message: "请输入商品名称", trigger: "blur" }],
  categoryId: [{ required: true, message: "请选择分类", trigger: "change" }]
};

const skuPriceForm = reactive({ retailPrice: 0, wholesalePrice: 0, miniappPrice: 0 });

// ---------- Group raw backend rows into SPU + nested SKUs ----------
function groupSpus(raw: any[]): any[] {
  const map = new Map<number, any>();
  for (const r of raw) {
    let spu = map.get(r.spuId);
    if (!spu) {
      spu = {
        spuId: r.spuId, spuCode: r.spuCode, name: r.name, mainImage: r.mainImage,
        alcoholContent: r.alcoholContent, origin: r.origin, saleChannels: r.saleChannels,
        unit: r.unit, specs: r.specs, sortNo: r.sortNo, isNew: r.isNew, isRecommend: r.isRecommend,
        detail: r.detail, description: r.description, imageUrls: r.imageUrls, marketingTags: r.marketingTags,
        availableQty: r.availableQty,
        categoryName: r.categoryName, brandName: r.brandName,
        status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
        _skus: [] as any[]
      };
      map.set(r.spuId, spu);
    }
    spu._skus.push({
      skuId: r.skuId, skuCode: r.skuCode, skuName: r.skuName, barcode: r.barcode,
      boxBarcode: r.boxBarcode,
      retailPrice: r.retailPrice, wholesalePrice: r.wholesalePrice,
      miniappPrice: r.miniappPrice, storePrice: r.storePrice, costPrice: r.costPrice,
      boxRatio: r.boxRatio, temperature: r.temperature, traceEnabled: !!r.traceEnabled,
      warningThreshold: r.warningThreshold,
      volume: r.volume, packaging: r.packaging, baseUnit: r.baseUnit, boxUnit: r.boxUnit,
      availableQty: r.availableQty ?? 0
    });
  }
  for (const [_, spu] of map) {
    spu._firstRetailPrice = spu._skus[0]?.retailPrice;
    spu._firstWholesalePrice = spu._skus[0]?.wholesalePrice;
  }
  return Array.from(map.values());
}

function parseChannels(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

// ---------- API ----------
async function search() {
  loading.value = true;
  try {
    const { data } = await api.get("/admin/products", {
      params: { keyword: keyword.value, page: page.value, pageSize: pageSize.value }
    });
    const res = data.data || {};
    spuList.value = groupSpus(res.records || []);
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "加载失败");
  } finally { loading.value = false; }
}

function onExpandChange(row: any, expandedRows: any[]) {
  expandKeys.value = expandedRows.map(r => r.spuId);
}

function openCreateDialog() {
  isEdit.value = false;
  editSpuId.value = null;
  Object.assign(form, JSON.parse(JSON.stringify(defaultForm)));
  dialogVisible.value = true;
}

function openEditDialog(row: any) {
  isEdit.value = true;
  editSpuId.value = row.spuId;
  form.name = row.name;
  form.categoryId = row.categoryId || null;
  form.mainImage = row.mainImage || "";
  form.brandId = row.brandId || null;
  form.alcoholContent = row.alcoholContent || null;
  form.origin = row.origin || "";
  form.saleChannels = parseChannels(row.saleChannels);
  form.unit = row.unit || "";
  form.multiUnitEnabled = !!row.multiUnitEnabled;
  form.unitGroupId = row.unitGroupId || null;
  form.specs = row.specs || "";
  form.sortNo = row.sortNo || 0;
  form.isNew = !!row.isNew;
  form.isRecommend = !!row.isRecommend;
  form.description = row.description || "";
  form.imageUrls = row.imageUrls || "";
  form.marketingTags = row.marketingTags || "";
  form.costPrice = row.costPrice || 0;
  form.storePrice = row.storePrice || 0;
  form.skus = (row._skus || []).map((s: any) => ({
    skuName: s.skuName, barcode: s.barcode, boxRatio: s.boxRatio || 1,
    temperature: s.temperature || "NORMAL", traceEnabled: !!s.traceEnabled,
    warningThreshold: s.warningThreshold || 0,
    retailPrice: s.retailPrice || 0, wholesalePrice: s.wholesalePrice || null,
    miniappPrice: s.miniappPrice || null,
    costPrice: s.costPrice || 0, storePrice: s.storePrice || 0,
    volume: s.volume || "", packaging: s.packaging || "",
    baseUnit: s.baseUnit || "", boxUnit: s.boxUnit || ""
  }));
  if (form.skus.length === 0) {
    form.skus = [JSON.parse(JSON.stringify(defaultForm.skus[0]))];
  }
  dialogVisible.value = true;
}

function addSku() {
  form.skus.push({ skuName: "", barcode: "", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 0, retailPrice: 0, wholesalePrice: null, miniappPrice: null, costPrice: 0, storePrice: 0, volume: "", packaging: "", baseUnit: "", boxUnit: "" });
}
function removeSku(idx: number) { form.skus.splice(idx, 1); }

/**
 * 按条码查询平台商品库并自动填充表单（不含分类，保留商户已填内容）
 */
async function lookupFromLibrary(idx: number) {
  const sku = form.skus[idx];
  const barcode = (sku.barcode || "").trim();
  if (!barcode) {
    ElMessage.warning("请先输入条码");
    return;
  }
  skuLookupLoading[idx] = true;
  try {
    const res = await lookupLibraryByBarcode(barcode);
    if (!res?.matched) {
      ElMessage.info("未在商品库中匹配到该条码，请手动录入");
      return;
    }
    const { spu, sku: libSku, brand } = res;

    // ---------- 填充 SPU 字段（仅空字段，保留商户已填内容）----------
    if (spu) {
      if (!form.name) form.name = spu.name || "";
      if (!form.specs) form.specs = spu.specs || "";
      if (!form.unit) form.unit = spu.unit || "";
      if (!form.mainImage) form.mainImage = spu.mainImage || "";
      if (!form.imageUrls && spu.imageUrls) {
        form.imageUrls = typeof spu.imageUrls === "string" ? spu.imageUrls : JSON.stringify(spu.imageUrls);
      }
      if (!form.description) form.description = spu.description || "";

      // properties 解析：酒精度/产地/香型等
      if (spu.properties) {
        const props: Record<string, any> = typeof spu.properties === "string"
          ? (() => { try { return JSON.parse(spu.properties as string); } catch { return {}; } })()
          : (spu.properties as Record<string, any>);
        if (form.alcoholContent == null && props.alcoholContent != null) form.alcoholContent = Number(props.alcoholContent);
        if (!form.origin && props.origin) form.origin = String(props.origin);
        // 其他 property 可后续扩展标签映射
      }
    }

    // ---------- 匹配品牌（根据 brandName 在本地 brandList 中查找，找不到留空让商户选）----------
    if (form.brandId == null && brandList.value?.length) {
      const targetName = brand?.name || spu?.brandName;
      if (targetName) {
        const matched = brandList.value.find((b: any) =>
          String(b.name || b.brandName || "").trim() === String(targetName).trim()
        );
        if (matched?.brandId != null) form.brandId = matched.brandId;
        else if (matched?.id != null) form.brandId = matched.id;
      }
    }
    // brand 可能返回独立 brandId（商品库中的 brand.id），但这里不用强制覆盖 — 商户自行确认

    // ---------- 填充当前 SKU 字段（仅空字段）----------
    if (libSku) {
      // 条码已填且匹配，不覆盖
      if (!sku.skuName) sku.skuName = libSku.skuName || spu?.specs || "";
      if (!sku.volume) sku.volume = libSku.volume || "";
      if (!sku.packaging) sku.packaging = libSku.packaging || "";
      if (!sku.baseUnit) sku.baseUnit = libSku.baseUnit || "";
      if (!sku.boxUnit) sku.boxUnit = libSku.boxUnit || "";
      if (sku.boxRatio == null || sku.boxRatio === 1) {
        const br = Number(libSku.boxRatio);
        if (!Number.isNaN(br) && br > 0) sku.boxRatio = br;
      }
      // 价格类：如果 SPU 返回了 suggestedRetailPrice 且 sku 的零售/批发/小程序价都为 0，则覆盖
      if (sku.retailPrice === 0 && spu?.suggestedRetailPrice != null) {
        const p = Number(spu.suggestedRetailPrice);
        if (!Number.isNaN(p) && p > 0) sku.retailPrice = p;
      }
    }

    ElMessage.success("已从商品库自动填充信息，请补充分类等剩余字段");
  } catch (e: any) {
    ElMessage.error("查询商品库失败：" + (e?.message || String(e)));
  } finally {
    skuLookupLoading[idx] = false;
  }
}

async function handleSubmit(keepOpen = false) {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitLoading.value = true;
    try {
      if (isEdit.value && editSpuId.value) {
        await api.put(`/admin/products/${editSpuId.value}`, {
          name: form.name, category: form.categoryId, brand: form.brandId,
          alcoholContent: form.alcoholContent, origin: form.origin,
          unit: form.unit, multiUnitEnabled: form.multiUnitEnabled,
          unitGroupId: form.unitGroupId || undefined,
          specs: form.specs, sortNo: form.sortNo,
          isNew: form.isNew, isRecommend: form.isRecommend,
          description: form.description,
          imageUrls: form.imageUrls || undefined,
          marketingTags: form.marketingTags || undefined
        });
        ElMessage.success("更新成功");
      } else {
        await api.post("/admin/products", {
          name: form.name, categoryId: form.categoryId, brandId: form.brandId || undefined,
          mainImage: form.mainImage || undefined,
          unit: form.unit, multiUnitEnabled: form.multiUnitEnabled,
          unitGroupId: form.unitGroupId || undefined,
          specs: form.specs, sortNo: form.sortNo,
          isNew: form.isNew, isRecommend: form.isRecommend,
          description: form.description,
          imageUrls: form.imageUrls || undefined,
          marketingTags: form.marketingTags || undefined,
          costPrice: form.costPrice, storePrice: form.storePrice,
          saleChannels: form.saleChannels,
          skus: form.skus.map((s: any) => ({
            skuName: s.skuName, barcode: s.barcode, boxRatio: s.boxRatio,
            temperature: s.temperature, traceEnabled: s.traceEnabled,
            warningThreshold: s.warningThreshold,
            costPrice: s.costPrice, retailPrice: s.retailPrice,
            wholesalePrice: s.wholesalePrice, miniappPrice: s.miniappPrice,
            storePrice: s.storePrice,
            volume: s.volume, packaging: s.packaging,
            baseUnit: s.baseUnit, boxUnit: s.boxUnit
          }))
        });
        ElMessage.success("创建成功");
      }
      if (!keepOpen) dialogVisible.value = false;
      search();
      if (keepOpen) openCreateDialog();
    } catch (e: any) {
      ElMessage.error(e.response?.data?.msg || "保存失败");
    } finally { submitLoading.value = false; }
  });
}

async function toggleStatus(row: any) {
  const newStatus = row.status === "ON_SALE" ? "OFF_SALE" : "ON_SALE";
  try {
    await api.patch(`/admin/products/${row.spuId}/status`, { status: newStatus });
    ElMessage.success(newStatus === "ON_SALE" ? "已上架" : "已下架");
    search();
  } catch (e: any) { ElMessage.error(e.response?.data?.msg || "操作失败"); }
}

// ---------- Detail Drawer ----------
async function openDetail(row: any) {
  // 切换商品时清空上一商品的富文本自动保存定时器，避免误写
  if (richEditorSaveTimer) { clearTimeout(richEditorSaveTimer); richEditorSaveTimer = null; }
  detailEditing.value = false;
  richEditor.value?.setEditable(false);
  detailSpu.value = { ...row, _skus: row._skus || [] };
  detailVisible.value = true;
  detailTab.value = "basic";
  // 拉取完整详情（含 SKU 库存/单位/追溯等完整字段）
  try {
    const { data: rd } = await api.get(`/admin/products/${row.spuId}`);
    const full = rd.data || {};
    detailSpu.value = {
      ...detailSpu.value,
      ...full,
      _skus: (full.skus || detailSpu.value?._skus || []).map((s: any) => ({
        ...s,
        availableQty: s.availableQty ?? 0,
        traceEnabled: !!s.traceEnabled,
      })),
    };
    detailChannels.value = parseChannels(detailSpu.value?.saleChannels);
    detailImageUrls.value = parseImageUrls(full.imageUrls);
  } catch {
    detailChannels.value = parseChannels(detailSpu.value?.saleChannels);
    detailImageUrls.value = parseImageUrls(detailSpu.value?.imageUrls);
  }
  // 加载标签
  try {
    const { data: td } = await api.get(`/admin/products/${row.spuId}/tags`);
    detailTagIds.value = (td.data || []).map((t: any) => t.id);
    const { data: r1 } = await api.get("/product-tags/by-type");
    const grouped = r1.data || {};
    tagsByType.value = grouped;
    tagGroups.value = Object.keys(grouped);
    if (tagGroups.value.length > 0) tagTypeTab.value = tagGroups.value[0];
  } catch { /* ignore */ }
}

/** 解析图册 URL（兼容 JSON 字符串与数组） */
function parseImageUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(Boolean) : raw ? [raw] : [];
    } catch { return raw ? [raw] : []; }
  }
  return [];
}

function addGalleryImage() {
  if (!detailEditing.value) return;
  const url = (galleryInput.value || "").trim();
  if (!url) return;
  detailImageUrls.value = [...detailImageUrls.value, url];
  galleryInput.value = "";
}

function removeGalleryImage(i: number) {
  if (!detailEditing.value) return;
  detailImageUrls.value = detailImageUrls.value.filter((_, idx) => idx !== i);
}

/** 保存销售渠道（多选） */
function saveDetailChannels() {
  if (!detailSpu.value?.spuId) return;
  detailSpu.value.saleChannels = detailChannels.value;
  saveDetailField("saleChannels", detailChannels.value, true);
}

async function saveGallery(showMsg = true) {
  if (!detailSpu.value?.spuId) return;
  gallerySaving.value = true;
  try {
    await api.put(`/admin/products/${detailSpu.value.spuId}`, { imageUrls: detailImageUrls.value });
    if (showMsg) ElMessage.success("图册已保存");
  } catch (e: any) {
    if (showMsg) ElMessage.error(e.response?.data?.msg || "图册保存失败");
  } finally { gallerySaving.value = false; }
}

async function saveDetailField(field: string, value: any, showMsg = false) {
  if (!detailSpu.value?.spuId) return;
  try {
    await api.put(`/admin/products/${detailSpu.value.spuId}`, { [field]: value });
    if (showMsg) ElMessage.success("已保存");
  } catch (e: any) {
    if (showMsg) ElMessage.error(e.response?.data?.msg || "保存失败");
    else throw e;
  }
}

/** 保存 SKU 条码（每个 SKU 可录入/修改条码） */
async function saveSkuBarcode(row: any) {
  if (!row?.skuId) return;
  try {
    await api.put(`/admin/products/skus/${row.skuId}/barcode`, {
      barcode: row.barcode || "",
    });
    ElMessage.success("条码已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "条码保存失败，请重试");
  }
}

/** 保存 SKU 档案字段（规格名称/单位/箱瓶比/预警/追溯等非价格字段） */
async function saveSkuInfo(row: any, field: string) {
  if (!row?.skuId) return;
  const payload: Record<string, unknown> = {};
  if (field === "traceEnabled") payload.traceEnabled = !!row.traceEnabled;
  else if (field === "boxRatio") payload.boxRatio = Number(row.boxRatio || 1);
  else if (field === "warningThreshold") payload.warningThreshold = Number(row.warningThreshold || 0);
  else payload[field] = row[field] ?? "";
  try {
    await api.put(`/admin/products/skus/${row.skuId}`, payload);
    ElMessage.success(field === "traceEnabled" ? (row.traceEnabled ? "已启用追溯" : "已关闭追溯") : "已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败，请重试");
  }
}

/** 保存 SKU 价格（零售/批发/门店/小程序一次性提交，保留价格历史） */
async function saveSkuPrice(row: any) {
  if (!row?.skuId) return;
  try {
    await api.put(`/admin/products/${row.skuId}/price`, {
      retailPrice: Number(row.retailPrice || 0),
      wholesalePrice: row.wholesalePrice === null || row.wholesalePrice === undefined ? null : Number(row.wholesalePrice),
      storePrice: row.storePrice === null || row.storePrice === undefined ? null : Number(row.storePrice),
      miniappPrice: row.miniappPrice === null || row.miniappPrice === undefined ? null : Number(row.miniappPrice),
    });
    ElMessage.success("价格已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "价格保存失败");
  }
}

/** 添加/删除单位后刷新 SKU 明细，保持与后端一致 */
async function refreshDetailSkus() {
  if (!detailSpu.value?.spuId) return;
  try {
    const { data: rd } = await api.get(`/admin/products/${detailSpu.value.spuId}`);
    const full = rd.data || {};
    detailSpu.value._skus = (full.skus || []).map((s: any) => ({
      ...s,
      availableQty: s.availableQty ?? 0,
      traceEnabled: !!s.traceEnabled,
    }));
  } catch { /* ignore */ }
}

/** 保存单位名称（基础单位改名同步到 SKU 基础单位） */
async function saveSkuUnitName(row: any) {
  if (!row?.skuId || !row?.id) return;
  try {
    await api.put(`/admin/products/skus/${row.skuId}/units/${row.id}`, { unitName: row.unitName });
    ElMessage.success("单位名称已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败，请重试");
  }
}

/** 保存单位换算比例（1 单位 = 换算 个基础单位） */
async function saveSkuUnitRatio(row: any) {
  if (!row?.skuId || !row?.id) return;
  try {
    await api.put(`/admin/products/skus/${row.skuId}/units/${row.id}`, { ratio: Number(row.ratio || 1) });
    ElMessage.success("换算比例已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "保存失败，请重试");
  }
}

/** 保存单位条码（一品多码） */
async function saveSkuUnitBarcode(row: any) {
  if (!row?.skuId || !row?.id) return;
  try {
    await api.put(`/admin/products/skus/${row.skuId}/units/${row.id}`, { barcode: row.barcode || "" });
    ElMessage.success("条码已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "条码保存失败，请重试");
  }
}

/** 保存单位价格：基础单位走 SKU 价格（保留价格历史），非基础单位写单位价格 */
async function saveSkuUnitPrice(row: any) {
  if (!row?.skuId) return;
  if (row.isBase) {
    await saveSkuPrice(row);
    return;
  }
  if (!row?.id) return;
  try {
    await api.put(`/admin/products/skus/${row.skuId}/units/${row.id}`, {
      retailPrice: Number(row.retailPrice || 0),
      wholesalePrice: row.wholesalePrice === null || row.wholesalePrice === undefined ? null : Number(row.wholesalePrice),
      storePrice: row.storePrice === null || row.storePrice === undefined ? null : Number(row.storePrice),
      miniappPrice: row.miniappPrice === null || row.miniappPrice === undefined ? null : Number(row.miniappPrice),
    });
    ElMessage.success("单位价格已保存");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "价格保存失败");
  }
}

/** 新增单位（多单位增加） */
async function addSkuUnit(row: any) {
  if (!row?.skuId) return;
  try {
    await api.post(`/admin/products/skus/${row.skuId}/units`, { unitName: "新单位", ratio: 1 });
    ElMessage.success("单位已添加，请修改名称与换算比例");
    await refreshDetailSkus();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || "添加单位失败");
  }
}

/** 删除单位（基础单位不可删除） */
async function deleteSkuUnit(row: any) {
  if (!row?.skuId || !row?.id) return;
  try {
    await ElMessageBox.confirm(`确认删除单位「${row.unitName}」？删除后该单位条码与价格将一并移除。`, "删除单位", { type: "warning" });
    await api.delete(`/admin/products/skus/${row.skuId}/units/${row.id}`);
    ElMessage.success("单位已删除");
    await refreshDetailSkus();
  } catch (e: any) {
    if (e !== "cancel" && e !== "close") {
      ElMessage.error(e?.response?.data?.msg || "删除失败");
    }
  }
}

/** 手动保存富文本详情（立即落库） */
function flushDetailSave(showMsg = true) {
  if (!detailSpu.value?.spuId) return;
  if (richEditorSaveTimer) { clearTimeout(richEditorSaveTimer); richEditorSaveTimer = null; }
  return saveDetailField("detail", richEditor.value?.getHTML() || "", showMsg);
}

/** 恢复编辑器内容为已保存的详情 */
function resetDetailEditor() {
  if (richEditor.value) {
    richEditor.value.commands.setContent(detailSpu.value?.detail || "", { emitUpdate: false });
  }
}

/** 修改：切换详情抽屉 查看/编辑 模式 */
function toggleDetailEdit() {
  detailEditing.value = !detailEditing.value;
  richEditor.value?.setEditable(detailEditing.value);
}

/** 保存：提交抽屉内全部待保存内容（富文本详情/图册/标签）并返回查看模式 */
async function saveDetailAll() {
  if (!detailSpu.value?.spuId || !detailEditing.value) return;
  detailSaving.value = true;
  try {
    const results = await Promise.allSettled([
      flushDetailSave(false),
      saveGallery(false),
      saveDetailTags(false),
    ]);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      ElMessage.warning("部分内容保存失败，请检查后重试");
    } else {
      ElMessage.success("保存成功");
    }
    detailEditing.value = false;
    richEditor.value?.setEditable(false);
  } finally {
    detailSaving.value = false;
  }
}

/** 保存并增加：保存当前商品后打开新增商品 */
async function saveDetailAndAdd() {
  if (!detailSpu.value?.spuId || !detailEditing.value) return;
  detailSaving.value = true;
  try {
    await Promise.allSettled([
      flushDetailSave(false),
      saveGallery(false),
      saveDetailTags(false),
    ]);
    detailVisible.value = false;
    detailEditing.value = false;
    richEditor.value?.setEditable(false);
    openCreateDialog();
  } finally {
    detailSaving.value = false;
  }
}

async function saveDetailTags(showMsg = true) {
  if (!detailSpu.value?.spuId) return;
  tagSubmitLoading.value = true;
  try {
    await api.put(`/admin/products/${detailSpu.value.spuId}/tags`, { tagIds: detailTagIds.value });
    if (showMsg) ElMessage.success("标签已保存");
  } catch (e: any) {
    if (showMsg) ElMessage.error(e.response?.data?.msg || "保存失败");
  } finally { tagSubmitLoading.value = false; }
}

// ---------- SKU Price ----------
function viewSkuPriceHistory(sku: any) {
  priceHistoryLoading.value = true;
  priceHistoryVisible.value = true;
  api.get(`/admin/products/${sku.skuId}/price-history`)
    .then(({ data }) => { priceHistory.value = (data.data?.records || data.data || []); })
    .catch(() => ElMessage.error("加载价格历史失败"))
    .finally(() => { priceHistoryLoading.value = false; });
}

function openSkuPriceDialog(sku: any) {
  skuPriceTarget.value = sku;
  skuPriceForm.retailPrice = sku.retailPrice || 0;
  skuPriceForm.wholesalePrice = sku.wholesalePrice || 0;
  skuPriceForm.miniappPrice = sku.miniappPrice || 0;
  skuPriceVisible.value = true;
}

async function handleSkuPriceUpdate() {
  if (!skuPriceTarget.value) return;
  skuPriceLoading.value = true;
  try {
    await api.put(`/admin/products/${skuPriceTarget.value.skuId}/price`, {
      retailPrice: skuPriceForm.retailPrice,
      wholesalePrice: skuPriceForm.wholesalePrice,
      miniappPrice: skuPriceForm.miniappPrice
    });
    ElMessage.success("改价成功");
    skuPriceVisible.value = false;
    search();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.msg || "改价失败");
  } finally { skuPriceLoading.value = false; }
}

// ---------- Ref Data ----------
async function loadRefData() {
  try {
    const [{ data: d1 }, { data: d2 }, { data: d3 }] = await Promise.all([
      api.get("/admin/products/categories"),
      api.get("/admin/brands", { params: { pageSize: 999 } }),
      api.get("/admin/unit-groups")
    ]);
    const list = d1.data || [];
    categoryTree.value = buildTree(list);
    brandList.value = (d2.data?.records || d2.data || []);
    unitGroupOptions.value = (d3.data?.records || d3.data || []).filter((g: any) => g.status === 1);
  } catch { /* ignore */ }
}

function buildTree(list: any[]): any[] {
  if (!list || list.length === 0) return [];
  const map = new Map<number, any>();
  const roots: any[] = [];
  list.forEach((item: any) => map.set(item.id, { ...item, children: [] }));
  list.forEach((item: any) => {
    const node = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(node);
    } else { roots.push(node); }
  });
  return roots;
}

onMounted(() => { search(); loadRefData(); });
</script>

<style scoped>
.page { padding: 0; }
.page-header { margin-bottom: 16px; }
.page-header-actions .el-input { margin-right: 0; }
.expand-content { padding: 8px 20px; background: var(--gray-50); }
.expand-content h4 { margin: 0 0 8px; font-size: 14px; color: var(--gray-700); }
.detail-basic-layout { display: flex; gap: 16px; align-items: flex-start; }
.detail-basic-form { flex: 1; min-width: 0; }
.detail-basic-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
.detail-section-title { font-size: 13px; font-weight: 600; color: var(--gray-700); margin: 4px 0 10px; }
.detail-section-title--sub { margin-top: 14px; }
.detail-extras { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.detail-meta { font-size: 12px; color: var(--gray-300); }
.detail-image-panel { width: 280px; flex: none; border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px; }
.detail-main-img { width: 100%; height: 230px; margin-bottom: 8px; object-fit: contain; border-radius: 6px; background: var(--bg-page); }
.detail-main-img--empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 230px; color: var(--gray-300); font-size: 13px; border: 1px dashed var(--gray-200); border-radius: 6px; }
.detail-gallery-list { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.detail-gallery-item { position: relative; }
.detail-gallery-del { position: absolute; top: -6px; right: -6px; background: var(--el-color-danger); color: #fff; border-radius: 50%; padding: 2px; cursor: pointer; }
.detail-gallery-empty { font-size: 12px; color: var(--gray-300); }
.detail-image-panel-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.detail-editor-content { min-height: 320px; overflow-y: auto; padding: 10px; }
.detail-editor-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.detail-editor-tip { font-size: 12px; color: var(--gray-400); }
.sku-detail-tip { font-size: 12px; color: var(--gray-400); margin-bottom: 8px; }
.sku-name-cell { display: flex; flex-direction: column; gap: 2px; }
.sku-code-sub { font-size: 12px; color: var(--gray-400); }
.sku-unit-name-cell { display: flex; align-items: center; gap: 6px; }
.sku-unit-base-tag { flex: none; }
.detail-footer { display: flex; justify-content: space-between; align-items: center; }
.detail-footer-tip { font-size: 12px; color: var(--gray-400); }
.detail-footer-btns { display: flex; gap: 8px; }
.detail-tag-tip { font-size: 12px; color: var(--gray-400); margin: 8px 0 0; }
.tag-cb-group { display: flex; flex-direction: column; gap: 8px; }
.sku-row { background: var(--gray-50); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.sku-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 500; }
.table-card :deep(.el-table__expanded-cell) {
  background: var(--gray-50);
}

/* tiptap 富文本编辑器样式 */
:deep(.ProseMirror) {
  min-height: 260px;
  outline: none;
}
:deep(.ProseMirror p) { margin: 0.5em 0; }
:deep(.ProseMirror h1) { font-size: 1.5em; margin: 0.5em 0; }
:deep(.ProseMirror h2) { font-size: 1.3em; margin: 0.5em 0; }
:deep(.ProseMirror ul) { padding-left: 20px; list-style: disc; }
:deep(.ProseMirror ol) { padding-left: 20px; list-style: decimal; }
:deep(.ProseMirror blockquote) { border-left: 3px solid var(--gray-200); padding-left: 12px; color: var(--gray-400); margin: 0.5em 0; }
:deep(.ProseMirror pre) { background: var(--bg-page); border-radius: 4px; padding: 8px 12px; font-family: monospace; overflow-x: auto; }
:deep(.ProseMirror code) { background: var(--bg-page); border-radius: 3px; padding: 1px 4px; font-family: monospace; }
</style>
