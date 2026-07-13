<template>
  <PageCard title="系统设置">
    <div class="config-wrapper">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 系统参数 -->
        <el-tab-pane label="系统参数" name="system">
          <el-form ref="formRef" :model="configs" :rules="rules" label-width="140px" class="config-form">
            <el-form-item label="系统名称" prop="system_name">
              <div class="config-field">
                <el-input v-model="configs.system_name" placeholder="请输入系统名称" style="width: 320px" />
                <span class="tip-text">用于系统头部展示</span>
              </div>
            </el-form-item>
            <el-form-item label="系统版本号">
              <div class="config-field">
                <el-input v-model="configs.system_version" placeholder="当前系统版本" style="width: 320px" :disabled="true" />
                <span class="tip-text">系统版本信息，自动获取</span>
              </div>
            </el-form-item>
            <el-form-item label="系统Logo">
              <div class="config-field">
                <div class="logo-upload">
                  <el-upload
                    class="logo-uploader"
                    action="#"
                    :show-file-list="false"
                    :before-upload="handleLogoBeforeUpload"
                    :http-request="() => {}"
                  >
                    <img v-if="configs.system_logo" :src="configs.system_logo" class="logo-preview" />
                    <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
                  </el-upload>
                  <span class="tip-text">建议尺寸 200x60px，支持 PNG/JPG</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="默认首页">
              <div class="config-field">
                <el-select v-model="configs.default_homepage" placeholder="请选择默认首页" style="width: 240px">
                  <el-option label="工作台" value="dashboard" />
                  <el-option label="销售单据" value="sale-bills" />
                  <el-option label="订单列表" value="orders" />
                  <el-option label="库存列表" value="inventory" />
                  <el-option label="报表中心" value="reports" />
                </el-select>
                <span class="tip-text">登录后默认跳转的页面</span>
              </div>
            </el-form-item>
            <el-form-item label="欢迎语">
              <div class="config-field">
                <el-input v-model="configs.welcome_message" placeholder="请输入欢迎语" style="width: 320px" />
                <span class="tip-text">显示在工作台首页的欢迎信息</span>
              </div>
            </el-form-item>
            <el-form-item label="时间格式">
              <div class="config-field">
                <el-select v-model="configs.time_format" placeholder="请选择时间格式" style="width: 200px">
                  <el-option label="12小时制" value="12h" />
                  <el-option label="24小时制" value="24h" />
                </el-select>
                <span class="tip-text">系统显示时间的格式</span>
              </div>
            </el-form-item>
            <el-form-item label="日期格式">
              <div class="config-field">
                <el-select v-model="configs.date_format" placeholder="请选择日期格式" style="width: 200px">
                  <el-option label="YYYY-MM-DD" value="yyyy-mm-dd" />
                  <el-option label="YYYY/MM/DD" value="yyyy/mm/dd" />
                  <el-option label="MM/DD/YYYY" value="mm/dd/yyyy" />
                  <el-option label="DD/MM/YYYY" value="dd/mm/yyyy" />
                </el-select>
                <span class="tip-text">系统显示日期的格式</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 邮件配置 -->
        <el-tab-pane label="邮件配置" name="mail">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="SMTP服务器地址" prop="smtp_host">
              <div class="config-field">
                <el-input v-model="configs.smtp_host" placeholder="如 smtp.qq.com" style="width: 320px" />
                <span class="tip-text">邮件服务器地址</span>
              </div>
            </el-form-item>
            <el-form-item label="SMTP端口" prop="smtp_port">
              <div class="config-field">
                <el-input-number v-model="configs.smtp_port" :min="1" :max="65535" style="width: 160px" />
                <span class="tip-text">常见端口：25、465、587</span>
              </div>
            </el-form-item>
            <el-form-item label="SMTP用户名" prop="smtp_username">
              <div class="config-field">
                <el-input v-model="configs.smtp_username" placeholder="邮箱账号" style="width: 320px" />
                <span class="tip-text">发件邮箱账号</span>
              </div>
            </el-form-item>
            <el-form-item label="SMTP密码">
              <div class="config-field">
                <el-input v-model="configs.smtp_password" type="password" placeholder="请输入密码" style="width: 320px" show-password />
                <span class="tip-text">邮箱授权码或密码</span>
              </div>
            </el-form-item>
            <el-form-item label="发件人地址" prop="mail_from_address">
              <div class="config-field">
                <el-input v-model="configs.mail_from_address" placeholder="如 service@example.com" style="width: 320px" />
                <span class="tip-text">显示的发件人邮箱</span>
              </div>
            </el-form-item>
            <el-form-item label="发件人名称" prop="mail_from_name">
              <div class="config-field">
                <el-input v-model="configs.mail_from_name" placeholder="如 智享全链管理系统" style="width: 320px" />
                <span class="tip-text">显示的发件人名称</span>
              </div>
            </el-form-item>
            <el-form-item label="启用SSL">
              <div class="config-field">
                <el-switch v-model="configs.smtp_ssl" active-value="1" inactive-value="0" />
                <span class="tip-text">启用SSL加密连接</span>
              </div>
            </el-form-item>
            <el-divider content-position="left">邮件模板</el-divider>
            <el-form-item label="验证码邮件模板">
              <div class="config-field">
                <el-input
                  v-model="configs.mail_template_verify"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入验证码邮件模板内容，支持变量 {code} {expire}"
                  style="width: 480px"
                />
                <span class="tip-text">模板变量：{code} 验证码，{expire} 有效期</span>
              </div>
            </el-form-item>
            <el-form-item label="通知邮件模板">
              <div class="config-field">
                <el-input
                  v-model="configs.mail_template_notify"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入通知邮件模板内容"
                  style="width: 480px"
                />
                <span class="tip-text">用于发送系统通知类邮件</span>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="testMailLoading" @click="handleTestMail">
                <el-icon><Share /></el-icon> 测试发送
              </el-button>
              <span class="tip-text" style="margin-left: 12px">测试邮件配置是否正确</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 短信配置 -->
        <el-tab-pane label="短信配置" name="sms">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="短信服务商" prop="sms_provider">
              <div class="config-field">
                <el-select v-model="configs.sms_provider" placeholder="请选择短信服务商" style="width: 200px" @change="handleSmsProviderChange">
                  <el-option label="阿里云" value="aliyun" />
                  <el-option label="腾讯云" value="tencent" />
                </el-select>
                <span class="tip-text">选择短信服务提供商</span>
              </div>
            </el-form-item>
            <el-form-item label="AccessKey ID" prop="sms_access_key">
              <div class="config-field">
                <el-input v-model="configs.sms_access_key" placeholder="请输入AccessKey ID" style="width: 320px" />
                <span class="tip-text">{{ configs.sms_provider === 'aliyun' ? '阿里云AccessKey' : '腾讯云SecretId' }}</span>
              </div>
            </el-form-item>
            <el-form-item label="AccessKey Secret" prop="sms_secret_key">
              <div class="config-field">
                <el-input v-model="configs.sms_secret_key" type="password" placeholder="请输入AccessKey Secret" style="width: 320px" show-password />
                <span class="tip-text">{{ configs.sms_provider === 'aliyun' ? '阿里云AccessKey Secret' : '腾讯云SecretKey' }}</span>
              </div>
            </el-form-item>
            <el-form-item label="短信签名" prop="sms_sign_name">
              <div class="config-field">
                <el-input v-model="configs.sms_sign_name" placeholder="请输入短信签名" style="width: 320px" />
                <span class="tip-text">需在对应平台申请审核</span>
              </div>
            </el-form-item>
            <el-divider content-position="left">短信模板管理</el-divider>
            <div class="template-list">
              <el-table :data="smsTemplates" border style="width: 100%">
                <el-table-column prop="name" label="模板名称" width="150" />
                <el-table-column prop="code" label="模板编码" width="150" />
                <el-table-column prop="content" label="模板内容" min-width="300" />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'">
                      {{ row.status === 'ENABLED' ? '启用' : '禁用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" link type="primary" @click="editSmsTemplate(row)">编辑</el-button>
                    <el-button size="small" link :type="row.status === 'ENABLED' ? 'danger' : 'success'" @click="toggleSmsTemplate(row)">
                      {{ row.status === 'ENABLED' ? '禁用' : '启用' }}
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div style="margin-top: 16px">
              <el-button type="primary" @click="showSmsTemplateDialog = true">
                <el-icon><Plus /></el-icon> 新增模板
              </el-button>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 数据备份设置 -->
        <el-tab-pane label="数据备份" name="backup">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="自动备份">
              <div class="config-field">
                <el-switch v-model="configs.backup_auto" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后系统将自动执行备份</span>
              </div>
            </el-form-item>
            <el-form-item label="备份周期">
              <div class="config-field">
                <el-select v-model="configs.backup_frequency" placeholder="请选择备份周期" style="width: 160px" :disabled="configs.backup_auto !== '1'">
                  <el-option label="每日" value="daily" />
                  <el-option label="每周" value="weekly" />
                  <el-option label="每月" value="monthly" />
                </el-select>
                <span class="tip-text">自动备份的执行频率</span>
              </div>
            </el-form-item>
            <el-form-item label="备份时间">
              <div class="config-field">
                <el-time-select v-model="configs.backup_time" :picker-options="timeSelectOptions" style="width: 140px" :disabled="configs.backup_auto !== '1'">
                  <el-option label="01:00" value="01:00" />
                  <el-option label="02:00" value="02:00" />
                  <el-option label="03:00" value="03:00" />
                  <el-option label="04:00" value="04:00" />
                  <el-option label="05:00" value="05:00" />
                  <el-option label="06:00" value="06:00" />
                  <el-option label="07:00" value="07:00" />
                  <el-option label="08:00" value="08:00" />
                  <el-option label="09:00" value="09:00" />
                  <el-option label="10:00" value="10:00" />
                  <el-option label="11:00" value="11:00" />
                  <el-option label="12:00" value="12:00" />
                  <el-option label="13:00" value="13:00" />
                  <el-option label="14:00" value="14:00" />
                  <el-option label="15:00" value="15:00" />
                  <el-option label="16:00" value="16:00" />
                  <el-option label="17:00" value="17:00" />
                  <el-option label="18:00" value="18:00" />
                  <el-option label="19:00" value="19:00" />
                  <el-option label="20:00" value="20:00" />
                  <el-option label="21:00" value="21:00" />
                  <el-option label="22:00" value="22:00" />
                  <el-option label="23:00" value="23:00" />
                  <el-option label="00:00" value="00:00" />
                </el-time-select>
                <span class="tip-text">每日执行备份的时间点</span>
              </div>
            </el-form-item>
            <el-form-item label="备份保留天数">
              <div class="config-field">
                <el-input-number v-model="configs.backup_retention_days" :min="1" :max="365" style="width: 160px" :disabled="configs.backup_auto !== '1'" />
                <span class="suffix-text">天</span>
                <span class="tip-text">超过此天数的备份将自动删除</span>
              </div>
            </el-form-item>
            <el-form-item label="备份路径">
              <div class="config-field">
                <el-input v-model="configs.backup_path" placeholder="备份文件存储路径" style="width: 400px" />
                <span class="tip-text">留空使用默认路径</span>
              </div>
            </el-form-item>
            <el-divider content-position="left">手动备份</el-divider>
            <el-form-item>
              <el-button type="primary" :loading="manualBackupLoading" @click="handleManualBackup">
                <el-icon><Download /></el-icon> 立即备份
              </el-button>
              <span class="tip-text" style="margin-left: 12px">手动执行一次数据备份</span>
            </el-form-item>
            <el-divider content-position="left">备份历史</el-divider>
            <div class="backup-history">
              <el-table :data="backupHistory" border style="width: 100%">
                <el-table-column prop="backupNo" label="备份编号" width="160" />
                <el-table-column prop="backupTime" label="备份时间" width="180" />
                <el-table-column prop="fileSize" label="文件大小" width="100" />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'SUCCESS' ? 'success' : 'danger'">
                      {{ row.status === 'SUCCESS' ? '成功' : '失败' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" link type="primary" @click="downloadBackup(row)">下载</el-button>
                    <el-button size="small" link type="danger" @click="deleteBackup(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-form>
        </el-tab-pane>

        <!-- 原有配置Tab保留 -->
        <el-tab-pane label="通用配置" name="general">
          <el-form ref="formRef" :model="configs" :rules="rules" label-width="140px" class="config-form">
            <el-form-item label="公司名称" prop="company_name">
              <div class="config-field">
                <el-input v-model="configs.company_name" placeholder="请输入公司名称" style="width: 320px" />
                <span class="tip-text">用于系统头部及报表展示</span>
              </div>
            </el-form-item>
            <el-form-item label="公司Logo">
              <div class="config-field">
                <div class="logo-upload">
                  <el-upload
                    class="logo-uploader"
                    action="#"
                    :show-file-list="false"
                    :before-upload="handleLogoBeforeUpload"
                    :http-request="() => {}"
                  >
                    <img v-if="configs.company_logo" :src="configs.company_logo" class="logo-preview" />
                    <el-icon v-else class="logo-uploader-icon"><Plus /></el-icon>
                  </el-upload>
                  <span class="tip-text">建议尺寸 200x60px，支持 PNG/JPG</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="联系电话">
              <div class="config-field">
                <el-input v-model="configs.contact_phone" placeholder="请输入联系电话" style="width: 320px" />
                <span class="tip-text">用于客户联系及售后热线展示</span>
              </div>
            </el-form-item>
            <el-form-item label="系统主题色">
              <div class="config-field">
                <el-color-picker v-model="configs.theme_color" show-alpha />
                <span class="tip-text">设置系统全局主题色，默认 #1677FF</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="订单配置" name="order">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="自动接单">
              <div class="config-field">
                <el-switch v-model="configs.auto_accept_order" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后新订单将自动确认接单</span>
              </div>
            </el-form-item>
            <el-form-item label="订单超时时间">
              <div class="config-field">
                <el-input-number v-model="configs.order_timeout_minutes" :min="1" :max="1440" style="width: 160px" />
                <span class="suffix-text">分钟后</span>
                <span class="tip-text">订单超过此时间未处理将自动提醒</span>
              </div>
            </el-form-item>
            <el-form-item label="订单自动取消时间">
              <div class="config-field">
                <el-input-number v-model="configs.auto_cancel_minutes" :min="1" :max="10080" style="width: 160px" />
                <span class="suffix-text">分钟后</span>
                <span class="tip-text">订单超过此时间未支付将自动取消</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="支付配置" name="payment">
          <el-form label-width="140px" class="config-form">
            <el-form-item label="微信支付">
              <div class="config-field">
                <el-switch v-model="configs.wechat_pay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持微信扫码支付</span>
              </div>
            </el-form-item>
            <el-form-item label="支付宝">
              <div class="config-field">
                <el-switch v-model="configs.alipay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持支付宝扫码支付</span>
              </div>
            </el-form-item>
            <el-form-item label="线下支付">
              <div class="config-field">
                <el-switch v-model="configs.offline_pay" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后支持现金及线下转账支付</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="库存配置" name="inventory">
          <el-form label-width="160px" class="config-form">
            <el-form-item label="低库存预警阈值">
              <div class="config-field">
                <el-input-number v-model="configs.low_stock_threshold" :min="1" :max="99999" style="width: 160px" />
                <span class="tip-text">库存低于此数量时触发预警通知</span>
              </div>
            </el-form-item>
            <el-form-item label="保质期预警天数">
              <div class="config-field">
                <el-input-number v-model="configs.expiry_warning_days" :min="1" :max="365" style="width: 160px" />
                <span class="tip-text">距保质期不足此天数时触发预警</span>
              </div>
            </el-form-item>
            <el-form-item label="自动补货">
              <div class="config-field">
                <el-switch v-model="configs.auto_replenish" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后库存不足时自动生成采购建议</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="通知配置" name="notification">
          <el-form label-width="140px" class="config-form">
            <el-form-item label="短信通知">
              <div class="config-field">
                <el-switch v-model="configs.sms_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过短信发送订单及库存预警通知</span>
              </div>
            </el-form-item>
            <el-form-item label="微信通知">
              <div class="config-field">
                <el-switch v-model="configs.wechat_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过微信公众号发送相关通知</span>
              </div>
            </el-form-item>
            <el-form-item label="站内信">
              <div class="config-field">
                <el-switch v-model="configs.site_notify" active-value="1" inactive-value="0" />
                <span class="tip-text">开启后通过系统站内信发送通知</span>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="action-bar">
        <el-button type="primary" :loading="saveLoading" @click="handleSave">保存</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 短信模板编辑弹窗 -->
    <el-dialog v-model="showSmsTemplateDialog" :title="isSmsTemplateEdit ? '编辑短信模板' : '新增短信模板'" width="560px">
      <el-form :model="smsTemplateForm" label-width="100px" :rules="smsTemplateRules" ref="smsTemplateFormRef">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="smsTemplateForm.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="模板编码" prop="code">
          <el-input v-model="smsTemplateForm.code" placeholder="请输入模板编码" />
        </el-form-item>
        <el-form-item label="模板内容" prop="content">
          <el-input
            v-model="smsTemplateForm.content"
            type="textarea"
            :rows="4"
            placeholder="请输入短信模板内容，支持变量"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="smsTemplateForm.status" style="width: 100%">
            <el-option label="启用" value="ENABLED" />
            <el-option label="禁用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSmsTemplateDialog = false">取消</el-button>
        <el-button type="primary" :loading="smsTemplateLoading" @click="handleSmsTemplateSubmit">保存</el-button>
      </template>
    </el-dialog>
  </PageCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Plus, Share, Download } from "@element-plus/icons-vue";
import PageCard from "../components/PageCard.vue";
import { api } from "../api";

const activeTab = ref("system");
const saveLoading = ref(false);
const testMailLoading = ref(false);
const manualBackupLoading = ref(false);
const showSmsTemplateDialog = ref(false);
const isSmsTemplateEdit = ref(false);
const smsTemplateLoading = ref(false);
const formRef = ref<FormInstance>();
const smsTemplateFormRef = ref<FormInstance>();

const rules: FormRules = {
  company_name: [{ required: true, message: "请输入公司名称", trigger: "blur" }],
  system_name: [{ required: true, message: "请输入系统名称", trigger: "blur" }],
  smtp_host: [{ required: true, message: "请输入SMTP服务器地址", trigger: "blur" }],
  smtp_port: [{ required: true, message: "请输入SMTP端口", trigger: "blur" }],
  smtp_username: [{ required: true, message: "请输入SMTP用户名", trigger: "blur" }],
  mail_from_address: [{ required: true, message: "请输入发件人地址", trigger: "blur" }],
  mail_from_name: [{ required: true, message: "请输入发件人名称", trigger: "blur" }],
  sms_provider: [{ required: true, message: "请选择短信服务商", trigger: "change" }],
  sms_access_key: [{ required: true, message: "请输入AccessKey ID", trigger: "blur" }],
  sms_secret_key: [{ required: true, message: "请输入AccessKey Secret", trigger: "blur" }],
  sms_sign_name: [{ required: true, message: "请输入短信签名", trigger: "blur" }]
};

const smsTemplateRules: FormRules = {
  name: [{ required: true, message: "请输入模板名称", trigger: "blur" }],
  code: [{ required: true, message: "请输入模板编码", trigger: "blur" }],
  content: [{ required: true, message: "请输入模板内容", trigger: "blur" }]
};

/* ── 默认配置值 ── */
const defaultConfigs: Record<string, string> = {
  // 系统参数
  system_name: "智享全链管理系统",
  system_version: "V6.0.0",
  system_logo: "",
  default_homepage: "dashboard",
  welcome_message: "欢迎使用智享全链管理系统",
  time_format: "24h",
  date_format: "yyyy-mm-dd",
  // 邮件配置
  smtp_host: "",
  smtp_port: "465",
  smtp_username: "",
  smtp_password: "",
  mail_from_address: "",
  mail_from_name: "",
  smtp_ssl: "1",
  mail_template_verify: "您的验证码是：{code}，有效期{expire}分钟。",
  mail_template_notify: "您有新的系统通知，请登录查看。",
  // 短信配置
  sms_provider: "",
  sms_access_key: "",
  sms_secret_key: "",
  sms_sign_name: "",
  // 数据备份
  backup_auto: "0",
  backup_frequency: "daily",
  backup_time: "02:00",
  backup_retention_days: "30",
  backup_path: "",
  // 原有配置
  company_name: "",
  company_logo: "",
  contact_phone: "",
  theme_color: "#1677FF",
  auto_accept_order: "0",
  order_timeout_minutes: "30",
  auto_cancel_minutes: "120",
  wechat_pay: "1",
  alipay: "1",
  offline_pay: "1",
  low_stock_threshold: "10",
  expiry_warning_days: "7",
  auto_replenish: "0",
  sms_notify: "1",
  wechat_notify: "1",
  site_notify: "1"
};

const configs = reactive<Record<string, string>>({ ...defaultConfigs });

/* ── 短信模板列表 ── */
interface SmsTemplate {
  id: number;
  name: string;
  code: string;
  content: string;
  status: "ENABLED" | "DISABLED";
}

const smsTemplates = ref<SmsTemplate[]>([
  { id: 1, name: "验证码短信", code: "SMS_123456", content: "【智享全链】您的验证码是：{code}，有效期{expire}分钟。", status: "ENABLED" },
  { id: 2, name: "订单通知", code: "SMS_123457", content: "【智享全链】您有新的订单，请及时处理。", status: "ENABLED" },
  { id: 3, name: "库存预警", code: "SMS_123458", content: "【智享全链】商品{product}库存不足，请及时补货。", status: "DISABLED" }
]);

const defaultSmsTemplateForm = {
  id: 0,
  name: "",
  code: "",
  content: "",
  status: "ENABLED" as "ENABLED" | "DISABLED"
};

const smsTemplateForm = reactive({ ...defaultSmsTemplateForm });

/* ── 备份历史列表 ── */
interface BackupRecord {
  backupNo: string;
  backupTime: string;
  fileSize: string;
  status: "SUCCESS" | "FAILED";
}

const backupHistory = ref<BackupRecord[]>([
  { backupNo: "BK202401010001", backupTime: "2024-01-01 02:00:00", fileSize: "128MB", status: "SUCCESS" },
  { backupNo: "BK202401020001", backupTime: "2024-01-02 02:00:00", fileSize: "135MB", status: "SUCCESS" },
  { backupNo: "BK202401030001", backupTime: "2024-01-03 02:00:00", fileSize: "142MB", status: "SUCCESS" }
]);

/* ── 时间选择器选项 ── */
const timeSelectOptions = {
  start: "01:00",
  step: "01:00",
  end: "23:00"
};

/* ── 分组与 Tab 名映射 ── */
const tabGroupMap: Record<string, string> = {
  system: "system",
  mail: "mail",
  sms: "sms",
  backup: "backup",
  general: "general",
  order: "order",
  payment: "payment",
  inventory: "inventory",
  notification: "notification"
};

/* ── 加载指定分组配置 ── */
async function loadConfigGroup(group: string) {
  try {
    const { data } = await api.get(`/admin/system/configs/${group}`);
    const items = data.data || data || [];
    const list = Array.isArray(items) ? items : (items.records || items || []);
    for (const item of list) {
      if (item.config_key && item.config_key in configs) {
        configs[item.config_key] = String(item.config_value ?? "");
      }
    }
  } catch {
    // 加载失败时使用默认值
  }
}

/* ── 加载所有分组配置 ── */
async function loadAllConfigs() {
  await Promise.all(Object.values(tabGroupMap).map((g) => loadConfigGroup(g)));
}

/* ── Tab 切换时加载当前分组 ── */
function handleTabChange(tab: string) {
  const group = tabGroupMap[tab];
  if (group) {
    loadConfigGroup(group);
  }
}

/* ── 保存所有配置 ── */
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saveLoading.value = true;
  try {
    const payload = Object.entries(configs).map(([key, value]) => ({
      config_key: key,
      config_value: String(value)
    }));
    await api.put("/admin/system/configs/batch", payload);
    ElMessage.success("配置保存成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "保存失败");
  } finally {
    saveLoading.value = false;
  }
}

/* ── 重置为默认值 ── */
function handleReset() {
  Object.assign(configs, defaultConfigs);
}

/* ── Logo 上传前处理 ── */
function handleLogoBeforeUpload(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    if (activeTab.value === "system") {
      configs.system_logo = (e.target?.result as string) || "";
    } else {
      configs.company_logo = (e.target?.result as string) || "";
    }
  };
  reader.readAsDataURL(file);
  return false;
}

/* ── 测试邮件发送 ── */
async function handleTestMail() {
  testMailLoading.value = true;
  try {
    await api.post("/admin/system/configs/test-mail");
    ElMessage.success("测试邮件发送成功");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "测试邮件发送失败");
  } finally {
    testMailLoading.value = false;
  }
}

/* ── 短信服务商切换 ── */
function handleSmsProviderChange() {
  // 可根据服务商不同显示不同的配置项
}

/* ── 编辑短信模板 ── */
function editSmsTemplate(row: SmsTemplate) {
  isSmsTemplateEdit.value = true;
  Object.assign(smsTemplateForm, {
    id: row.id,
    name: row.name,
    code: row.code,
    content: row.content,
    status: row.status
  });
  showSmsTemplateDialog.value = true;
}

/* ── 切换短信模板状态 ── */
function toggleSmsTemplate(row: SmsTemplate) {
  row.status = row.status === "ENABLED" ? "DISABLED" : "ENABLED";
  ElMessage.success(`短信模板${row.status === "ENABLED" ? "启用" : "禁用"}成功`);
}

/* ── 提交短信模板 ── */
async function handleSmsTemplateSubmit() {
  if (!smsTemplateFormRef.value) return;
  await smsTemplateFormRef.value.validate(async (valid) => {
    if (!valid) return;
    smsTemplateLoading.value = true;
    try {
      if (isSmsTemplateEdit.value) {
        const index = smsTemplates.value.findIndex((t) => t.id === smsTemplateForm.id);
        if (index !== -1) {
          smsTemplates.value[index] = { ...smsTemplateForm };
        }
      } else {
        smsTemplates.value.unshift({
          ...smsTemplateForm,
          id: Date.now()
        });
      }
      showSmsTemplateDialog.value = false;
      Object.assign(smsTemplateForm, defaultSmsTemplateForm);
      ElMessage.success(isSmsTemplateEdit.value ? "更新成功" : "创建成功");
    } catch (e: any) {
      ElMessage.error(e?.response?.data?.msg || "保存失败");
    } finally {
      smsTemplateLoading.value = false;
    }
  });
}

/* ── 手动备份 ── */
async function handleManualBackup() {
  manualBackupLoading.value = true;
  try {
    await api.post("/admin/system/configs/manual-backup");
    ElMessage.success("备份成功");
    // 添加到备份历史
    backupHistory.value.unshift({
      backupNo: `BK${Date.now()}`,
      backupTime: new Date().toLocaleString(),
      fileSize: "150MB",
      status: "SUCCESS"
    });
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || e?.message || "备份失败");
  } finally {
    manualBackupLoading.value = false;
  }
}

/* ── 下载备份 ── */
function downloadBackup(row: BackupRecord) {
  ElMessage.success(`正在下载备份文件：${row.backupNo}`);
}

/* ── 删除备份 ── */
function deleteBackup(row: BackupRecord) {
  const index = backupHistory.value.findIndex((b) => b.backupNo === row.backupNo);
  if (index !== -1) {
    backupHistory.value.splice(index, 1);
    ElMessage.success("删除成功");
  }
}

onMounted(() => {
  loadAllConfigs();
});
</script>

<style scoped>
.config-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.config-form {
  padding: 16px 0 0;
}

.config-form .el-form-item {
  margin-bottom: 22px;
}

.config-field {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tip-text {
  color: #9CA3AF;
  font-size: 13px;
  white-space: nowrap;
}

.suffix-text {
  color: #4B5563;
  font-size: 14px;
}

.logo-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-uploader {
  width: 200px;
  height: 60px;
  border: 1px dashed #D1D5DB;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s;
}

.logo-uploader:hover {
  border-color: #1677FF;
}

.logo-uploader-icon {
  font-size: 24px;
  color: #9CA3AF;
}

.logo-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.action-bar {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.template-list,
.backup-history {
  margin-top: 12px;
}

.el-divider {
  margin: 20px 0;
}
</style>
