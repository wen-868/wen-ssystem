#!/usr/bin/env node
/**
 * 阿坚 - 后端开发工程师 Agent
 * 负责: 数据库、支付、登录、配送、生产环境
 */

const AgentCoordinator = require('./agent-coordinator');

class AgentAjian {
  constructor() {
    this.coordinator = new AgentCoordinator();
    this.agentId = 'agent-ajian';
    this.name = '阿坚';
  }

  async startWork() {
    console.log(`[${this.name}] 开始工作...`);
    
    const agent = this.coordinator.getAgent(this.agentId);
    if (!agent.current_task) {
      console.log(`[${this.name}] 当前没有分配任务，等待协调器分配...`);
      return;
    }
    
    const task = this.coordinator.getTask(agent.current_task);
    console.log(`[${this.name}] 当前任务: ${task.title}`);
    
    switch (task.id) {
      case 'T001':
        await this.workOnDatabase();
        break;
      case 'T002':
        await this.workOnWechatPay();
        break;
      case 'T003':
        await this.workOnWechatLogin();
        break;
      case 'T006':
        await this.workOnDelivery();
        break;
      case 'T007':
        await this.workOnInventoryAlert();
        break;
      case 'T012':
        await this.workOnProduction();
        break;
      default:
        console.log(`[${this.name}] 未知任务: ${task.id}`);
    }
  }

  async workOnDatabase() {
    console.log(`[${this.name}] 开始设计 MySQL 数据库...`);
    
    const steps = [
      { progress: 10, note: '分析现有 mock 数据结构' },
      { progress: 25, note: '设计 MySQL 表结构' },
      { progress: 40, note: '创建用户表、门店表' },
      { progress: 55, note: '创建商品表、库存表' },
      { progress: 70, note: '创建订单表、订单商品表' },
      { progress: 85, note: '创建平台凭证表、平台订单表' },
      { progress: 100, note: '数据库设计完成' }
    ];
    
    for (const step of steps) {
      await this.delay(500);
      this.coordinator.updateProgress('T001', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T001 完成！`);
  }

  async workOnWechatPay() {
    console.log(`[${this.name}] 开始接入微信支付...`);
    
    const steps = [
      { progress: 10, note: '阅读微信支付 API 文档' },
      { progress: 25, note: '配置微信支付参数' },
      { progress: 40, note: '实现统一下单接口' },
      { progress: 55, note: '实现支付回调处理' },
      { progress: 70, note: '实现退款接口' },
      { progress: 85, note: '实现对账接口' },
      { progress: 100, note: '微信支付接入完成' }
    ];
    
    for (const step of steps) {
      await this.delay(800);
      this.coordinator.updateProgress('T002', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T002 完成！`);
  }

  async workOnWechatLogin() {
    console.log(`[${this.name}] 开始接入微信登录...`);
    
    const steps = [
      { progress: 20, note: '配置微信小程序参数' },
      { progress: 40, note: '实现 wx.login 接口' },
      { progress: 60, note: '实现手机号授权' },
      { progress: 80, note: '实现 JWT Token 管理' },
      { progress: 100, note: '微信登录接入完成' }
    ];
    
    for (const step of steps) {
      await this.delay(600);
      this.coordinator.updateProgress('T003', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T003 完成！`);
  }

  async workOnDelivery() {
    console.log(`[${this.name}] 开始对接即时配送...`);
    
    const steps = [
      { progress: 15, note: '调研顺丰同城/达达/闪送 API' },
      { progress: 30, note: '设计配送适配器接口' },
      { progress: 50, note: '实现顺丰同城适配器' },
      { progress: 70, note: '实现达达适配器' },
      { progress: 85, note: '实现自动派单逻辑' },
      { progress: 100, note: '即时配送对接完成' }
    ];
    
    for (const step of steps) {
      await this.delay(700);
      this.coordinator.updateProgress('T006', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T006 完成！`);
  }

  async workOnInventoryAlert() {
    console.log(`[${this.name}] 开始开发库存预警系统...`);
    
    const steps = [
      { progress: 20, note: '设计预警规则模型' },
      { progress: 40, note: '实现低库存检测逻辑' },
      { progress: 60, note: '实现采购单生成' },
      { progress: 80, note: '实现供应商管理' },
      { progress: 100, note: '库存预警系统完成' }
    ];
    
    for (const step of steps) {
      await this.delay(600);
      this.coordinator.updateProgress('T007', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T007 完成！`);
  }

  async workOnProduction() {
    console.log(`[${this.name}] 开始配置生产环境...`);
    
    const steps = [
      { progress: 20, note: '申请 SSL 证书' },
      { progress: 40, note: '配置域名解析' },
      { progress: 60, note: '配置 CDN' },
      { progress: 80, note: '配置监控告警' },
      { progress: 100, note: '生产环境配置完成' }
    ];
    
    for (const step of steps) {
      await this.delay(500);
      this.coordinator.updateProgress('T012', step.progress, step.note);
      console.log(`[${this.name}] ${step.note} (${step.progress}%)`);
    }
    
    console.log(`[${this.name}] T012 完成！`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI 入口
if (require.main === module) {
  const agent = new AgentAjian();
  agent.startWork().catch(console.error);
}

module.exports = AgentAjian;
