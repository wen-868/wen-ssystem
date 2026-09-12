<template>
  <!--
    商品库 · 类目与品牌管理（设计稿 v1.6 #sec-goods 第 1 个 figure，行 2284~2344）
    作为 LibrarySpus 的 ② 类目管理 / ③ 品牌库 子 Tab 内嵌片段渲染；
    亦可作为独立路由 /library/brands 整页渲染（section 为 undefined 时显示完整「类目与品牌管理」）。
    根节点为内容片段，不写 .pf-main（由 PlatformLayout 包裹）。
    数据：品牌库沿用现有 listBrandsApi/createBrandApi/updateBrandApi/deleteBrandApi（保留并沿用）；
          类目树 / 编辑类目 / 授权状态等无对应接口 → 空态 + TODO。
  -->
  <div class="lib-brands">
    <!-- ════════ 独立路由：完整页头 ════════ -->
    <div v-if="!section" class="pg-hd">
      <div>
        <div class="pt4">类目与品牌管理</div>
        <p class="pd">三级类目树 · 拖拽排序即租户侧展示顺序 · 商标由平台运营上传，未授权品牌不在租户检索侧展示品牌词</p>
      </div>
      <div class="pg-act">
        <span class="btn">+ 新增一级类目</span>
        <span class="btn btn-p">+ 新增品牌</span>
      </div>
    </div>

    <!-- ════════ ② 类目管理 ════════ -->
    <section v-if="section === 'category' || !section">
      <div class="panel">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 2</span>类目管理</span>
          <span class="ph-s">三级树形结构 · 拖拽排序即租户侧展示顺序 · 「对租户可见」控制租户检索侧目录</span>
        </div>
        <div class="p-bd" style="display:grid;grid-template-columns:var(--rbac-side-w) 1fr;gap:var(--space-3);align-items:start">
          <!-- 左：类目树 -->
          <div class="cat-tree">
            <div class="cat-tree-hd">
              <span>类目树（—）</span>
              <span class="btn-t" style="margin-left:auto">+ 新增一级类目</span>
            </div>
            <!-- TODO: 待接入 GET /platform/library/categories —— 返回三级类目树（id/path/挂载商品数/对租户可见） -->
            <div v-if="categories.length === 0" class="empty">暂无类目数据</div>
            <div v-for="c in categories" :key="c.id" class="cat-node">
              <span class="drag">⋮⋮</span>
              <b>{{ c.name }}</b>
              <span class="tag tag-gy">{{ c.countLabel }}</span>
              <span v-if="c.visible" class="small" style="color:var(--g5)">对租户可见</span>
              <span class="tg" :class="{ off: !c.visible }" style="margin-left:auto"></span>
              <span class="btn-t">编辑</span>
            </div>
          </div>

          <!-- 右：编辑类目 -->
          <div class="panel" style="box-shadow:none">
            <div class="p-hd">
              <span class="pt">编辑类目 · —</span>
              <span class="ph-s">三级类目 · 上级：—</span>
            </div>
            <div class="p-bd" style="display:grid;gap:var(--space-3)">
              <div class="frow">
                <span class="fld" style="flex:1">
                  <span>类目名称 <i style="color:var(--color-danger);font-style:normal">*</i></span>
                  <input class="ipt" placeholder="请输入类目名称" v-model="catForm.name" />
                </span>
                <span class="fld" style="width:var(--rbac-perm-col-w)">
                  <span>类目编码</span>
                  <input class="ipt" placeholder="CAT-xx-xxx" v-model="catForm.code" />
                </span>
                <span class="fld" style="width:110px">
                  <span>排序值</span>
                  <input class="ipt" placeholder="30" v-model="catForm.sort" />
                </span>
              </div>
              <div class="frow">
                <span class="fld" style="flex:1">
                  <span>上级类目</span>
                  <span class="sel">请选择上级类目 ▾</span>
                </span>
                <span class="fld" style="width:var(--rbac-perm-col-w)">
                  <span>挂载商品数（只读）</span>
                  <input class="ipt" placeholder="—" readonly />
                </span>
                <span class="cat-visible">
                  <span class="tg" :class="{ off: !catForm.visible }" @click="catForm.visible = !catForm.visible"></span>
                  <b style="white-space:nowrap">对租户可见</b>
                  <span class="tag" :class="catForm.visible ? 'tag-g' : 'tag-gy'">{{ catForm.visible ? '已开启' : '已关闭' }}</span>
                </span>
              </div>
              <div class="tipbar" style="padding:8px 11px">
                <span class="ic">i</span>
                <span>删除前置校验：<b>存在挂载商品或租户已调取该类目下档案时禁止删除</b>（提示先迁移）；「对租户可见」关闭后租户检索侧隐藏该类目，平台数据保留不删。</span>
              </div>
              <div class="frow" style="justify-content:flex-end">
                <span class="btn" @click="resetCatForm">取消</span>
                <span class="btn btn-p" @click="saveCategory">保存</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════ ③ 品牌库 ════════ -->
    <section v-if="section === 'brand' || !section" :class="{ 'mt12': section === undefined }">
      <div class="panel">
        <div class="p-hd">
          <span class="pt"><span class="tag tag-b" style="margin-right:6px">Tab 3</span>品牌库</span>
          <span class="ph-s">商标图由平台运营上传 · 未授权品牌不在租户检索侧展示品牌词</span>
        </div>
        <div class="p-bd">
          <div class="frow" style="margin-bottom:10px">
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>授权状态</span>
              <span class="sel">全部 ▾</span>
            </span>
            <input class="ipt" style="width:200px" placeholder="搜索品牌名称 / 别名" v-model="brandKeyword" @keyup.enter="searchBrands" />
            <span class="btn btn-p" style="margin-left:auto" @click="openBrandModal()">+ 新增品牌</span>
          </div>

          <div class="tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>商标图</th>
                  <th>品牌名称</th>
                  <th>别名</th>
                  <th>授权状态</th>
                  <th>授权有效期</th>
                  <th class="num">关联商品数</th>
                  <th class="num">本月被调取</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in brandList" :key="b.id">
                  <td>
                    <span v-if="b.logo" class="v16-thumb" style="width:28px;height:28px">
                      <img :src="b.logo" style="width:100%;height:100%;border-radius:var(--radius-sm);object-fit:cover" alt="" />
                    </span>
                    <span v-else class="v16-thumb" style="width:28px;height:28px">标</span>
                  </td>
                  <td><b>{{ b.name }}</b></td>
                  <td class="muted">—</td>
                  <td><span class="tag" :class="b.status === 1 ? 'tag-g' : 'tag-gy'">{{ b.status === 1 ? '已授权' : '不适用' }}</span></td>
                  <td class="muted">—</td>
                  <td class="num">{{ b.spuCount || 0 }}</td>
                  <td class="num muted">—</td>
                  <td>
                    <span class="btn-t" @click="openBrandModal(b)">查看</span>
                    <span class="btn-t" @click="openBrandModal(b)">编辑</span>
                    <span class="btn-t" @click="uploadAuth(b)">上传授权书</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="brandList.length === 0" class="empty">暂无品牌数据</div>

          <div class="pagebar">
            <span>共 {{ brandTotal }} 条 · 每页 {{ brandPageSize }} 条</span>
            <div class="pgbtns">
              <span :class="{ on: brandPage === 1 }" @click="brandPage = 1; fetchBrands()">1</span>
              <span v-if="brandTotalPages > 1" @click="brandPage++; fetchBrands()">›</span>
            </div>
          </div>

          <div class="tipbar mt8" style="padding:8px 11px">
            <span class="ic">i</span>
            <span>授权到期前 <b>30 / 7 天</b>提醒平台运营续期；<b>已过期品牌自动停止在租户检索侧展示</b>（存量租户档案不受影响）；疑似侵权商标接入审核流，风险品牌自动屏蔽。</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════ 新增/编辑品牌弹窗（内容包一层 zx-scope） ════════ -->
    <div v-if="brandModal" class="ov" @click.self="brandModal = false"></div>
    <div v-if="brandModal" class="modal">
      <div class="m-hd">
        <span class="pt">{{ editingBrandId ? '编辑品牌' : '新增品牌' }}</span>
        <span class="d-x" @click="brandModal = false">✕</span>
      </div>
      <div class="m-bd">
        <div class="zx-scope">
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>品牌名称 <i style="color:var(--color-danger);font-style:normal">*</i></span>
              <input class="ipt" placeholder="如：农夫山泉" v-model="brandForm.name" />
            </span>
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>别名</span>
              <input class="ipt" placeholder="如：NONGFU SPRING" v-model="brandForm.alias" />
            </span>
          </div>
          <div class="frow">
            <span class="fld" style="flex:1">
              <span>商标图 URL</span>
              <input class="ipt" placeholder="https://.../logo.png" v-model="brandForm.logo" />
            </span>
            <span class="fld" style="width:var(--rbac-perm-col-w)">
              <span>授权状态</span>
              <span class="sel">请选择 ▾</span>
            </span>
          </div>
          <div class="frow">
            <span class="fld" style="width:160px">
              <span>授权有效期</span>
              <input class="ipt" placeholder="如：2027-12-31" v-model="brandForm.expiry" />
            </span>
            <span class="fld" style="flex:1">
              <span>关联商品数（只读）</span>
              <input class="ipt" :value="editingBrandId ? brandForm.spuCount : 0" readonly />
            </span>
          </div>
          <div class="tipbar" style="padding:8px 11px">
            <span class="ic">i</span>
            <span>授权到期前 30 / 7 天提醒续期；已过期品牌自动停止在租户检索侧展示。</span>
          </div>
        </div>
      </div>
      <div class="m-ft">
        <span class="btn" @click="brandModal = false">取消</span>
        <span class="btn btn-p" @click="saveBrand">保存</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listBrandsApi, createBrandApi, updateBrandApi,
  type BrandItem,
} from '../../api/library'

// section: 'category' | 'brand' | undefined（独立整页）
defineProps<{ section?: string }>()

/* ───────── 类目树（无接口，空态） ───────── */
// TODO: 待接入 GET /platform/library/categories —— 返回三级类目树（id / name / path / 挂载商品数 / 对租户可见）
const categories = ref<any[]>([])
const catForm = reactive({ id: null as number | null, name: '', code: '', sort: '', visible: true })
function resetCatForm() {
  Object.assign(catForm, { id: null, name: '', code: '', sort: '', visible: true })
}
function saveCategory() {
  // TODO: 待接入 POST/PUT /platform/library/categories —— 新增/编辑类目（含对租户可见开关）
  ElMessage.info('保存类目（接口待接入）')
}
function uploadAuth(b: BrandItem) {
  // TODO: 待接入 POST /platform/library/brands/{id}/auth-letter —— 上传授权书
  ElMessage.info(`上传授权书：${b.name}（接口待接入）`)
}

/* ───────── 品牌库（沿用现有接口） ───────── */
const brandList = ref<BrandItem[]>([])
const brandLoading = ref(false)
const brandTotal = ref(0)
const brandPage = ref(1)
const brandPageSize = ref(20)
const brandKeyword = ref('')
const brandTotalPages = computed(() => Math.max(1, Math.ceil(brandTotal.value / brandPageSize.value)))

async function fetchBrands() {
  brandLoading.value = true
  try {
    const res: any = await listBrandsApi({
      page: brandPage.value,
      pageSize: brandPageSize.value,
      keyword: brandKeyword.value || undefined,
    })
    const data = res.data || res
    brandList.value = data.records || data.list || []
    brandTotal.value = data.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载品牌失败')
  } finally {
    brandLoading.value = false
  }
}
function searchBrands() {
  brandPage.value = 1
  fetchBrands()
}

/* ───────── 新增/编辑品牌弹窗（沿用现有接口） ───────── */
const brandModal = ref(false)
const editingBrandId = ref<number | null>(null)
const brandForm = reactive({ name: '', alias: '', logo: '', expiry: '', spuCount: 0 })
function openBrandModal(b?: BrandItem) {
  if (b) {
    editingBrandId.value = b.id
    Object.assign(brandForm, { name: b.name, alias: '', logo: b.logo || '', expiry: '', spuCount: b.spuCount || 0 })
  } else {
    editingBrandId.value = null
    Object.assign(brandForm, { name: '', alias: '', logo: '', expiry: '', spuCount: 0 })
  }
  brandModal.value = true
}
async function saveBrand() {
  if (!brandForm.name) {
    ElMessage.warning('请输入品牌名称')
    return
  }
  try {
    const payload: any = { name: brandForm.name, logo: brandForm.logo || undefined }
    if (editingBrandId.value) {
      await updateBrandApi(editingBrandId.value, payload)
      ElMessage.success('更新品牌成功')
    } else {
      await createBrandApi(payload)
      ElMessage.success('创建品牌成功')
    }
    brandModal.value = false
    fetchBrands()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

onMounted(() => {
  // 类目树无接口，保持空态；品牌库沿用现有调用
  fetchBrands()
})
</script>

<style scoped>
.lib-brands { color: var(--ink); }

/* 类目树容器（设计稿 行2287：边框/圆角/白底，按令牌实现） */
.cat-tree {
  border: 1px solid var(--g2);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}
.cat-tree-hd {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--g1);
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
}
.cat-node {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--g2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin: var(--space-1) var(--space-2);
}
.cat-node .drag { color: var(--g4); }
.cat-visible {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-bottom: var(--space-1);
}

/* v1.6 修订标注（设计稿 .v16-tag / .v16-thumb，components.css 未移植，按令牌实现） */
.v16-tag {
  display: inline-flex;
  align-items: center;
  font-size: var(--ctrl-caret-size);
  line-height: 1;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--text-inverse);
  font-weight: var(--font-semibold);
  letter-spacing: var(--ver-tag-tracking);
  vertical-align: var(--ver-tag-valign);
  white-space: nowrap;
}
.v16-tag.lt {
  background: var(--color-primary-bg);
  color: var(--color-primary-hover);
  border: 1px solid var(--color-primary-soft);
}
.v16-thumb {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--color-primary-bg), var(--color-primary-soft));
  color: var(--chart-1-soft);
  font-size: var(--text-xs);
  flex: none;
}

/* 弹窗（设计稿 .ov / .modal / .m-hd / .m-bd / .m-ft / .d-x，components.css 未移植，按令牌实现） */
.ov {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 30;
}
.modal {
  position: fixed;
  z-index: 31;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: var(--modal-width);
  max-width: 92%;
  max-height: 88%;
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  box-shadow: var(--modal-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.m-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--g2);
  flex: none;
}
.m-hd .pt { font-size: var(--text-md); font-weight: var(--font-bold); }
.d-x {
  color: var(--g4);
  font-size: var(--text-lg);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.d-x:hover { background: var(--g0); color: var(--g6); }
.m-bd {
  padding: var(--space-4);
  overflow-y: auto;
  display: grid;
  gap: var(--space-3);
}
.m-ft {
  border-top: 1px solid var(--g2);
  padding: var(--space-3) var(--space-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  background: var(--g0);
  flex: none;
}
</style>
