#!/usr/bin/env node
/**
 * 启动所有 Agent 协同工作
 * 模拟 Sprint 的执行过程
 */

const AgentCoordinator = require('./agent-coordinator');
const AgentSuran = require('./agent-suran');
const AgentLinxi = require('./agent-linxi');
const AgentAjian = require('./agent-ajian');

async function resetBoard(coordinator) {
  for (const task of coordinator.board.tasks) {
    task.status = 'todo';
    task.progress = 0;
    task.assignee = null;
    delete task.notes;
  }
  for (const agent of coordinator.board.agents) {
    agent.status = 'idle';
    agent.current_task = null;
    agent.progress = 0;
  }
  coordinator.saveBoard();
}

async function runSprint1() {
  console.log('========================================');
  console.log('  智享酒水库存系统 - Sprint 1 启动');
  console.log('========================================\n');

  const coordinator = new AgentCoordinator();
  await resetBoard(coordinator);
  
  coordinator.printBoard();
  
  console.log('\n>>> 分配 Sprint 1 任务...\n');
  
  // 阿坚: T001 (数据库) - 无依赖
  coordinator.assignTask('T001', 'agent-ajian');
  
  console.log('\n>>> 阿坚开始 T001...\n');
  const ajian = new AgentAjian();
  await ajian.startWork();
  
  console.log('\n>>> T001 完成，检查可启动任务...\n');
  coordinator.board = coordinator.loadBoard();
  coordinator.printBoard();
  
  // T001 完成后，阿坚继续 T003，林夕开始 T004
  coordinator.assignTask('T003', 'agent-ajian');
  coordinator.assignTask('T004', 'agent-linxi');
  
  console.log('\n>>> 阿坚开始 T003...\n');
  await ajian.startWork();
  
  console.log('\n>>> 林夕开始 T004...\n');
  const linxi = new AgentLinxi();
  await linxi.startWork();
  
  console.log('\n>>> Sprint 1 完成！\n');
  coordinator.printBoard();
  
  console.log('\n>>> 生成 Sprint 1 日报...\n');
  console.log(JSON.stringify(coordinator.generateDailyReport(), null, 2));
}

async function runSprint2() {
  console.log('\n========================================');
  console.log('  智享酒水库存系统 - Sprint 2 启动');
  console.log('========================================\n');

  const coordinator = new AgentCoordinator();
  coordinator.board = coordinator.loadBoard();
  
  coordinator.assignTask('T002', 'agent-ajian');
  coordinator.assignTask('T005', 'agent-linxi');
  
  console.log('\n>>> 阿坚开始 T002 (微信支付)...\n');
  const ajian = new AgentAjian();
  await ajian.startWork();
  
  console.log('\n>>> 林夕开始 T005 (小程序)...\n');
  const linxi = new AgentLinxi();
  await linxi.startWork();
  
  console.log('\n>>> Sprint 2 完成！\n');
  coordinator.printBoard();
}

async function runSprint3() {
  console.log('\n========================================');
  console.log('  智享酒水库存系统 - Sprint 3 启动');
  console.log('========================================\n');

  const coordinator = new AgentCoordinator();
  coordinator.board = coordinator.loadBoard();
  
  coordinator.assignTask('T006', 'agent-ajian');
  coordinator.assignTask('T007', 'agent-ajian');
  coordinator.assignTask('T008', 'agent-linxi');
  coordinator.assignTask('T009', 'agent-linxi');
  coordinator.assignTask('T010', 'agent-linxi');
  coordinator.assignTask('T011', 'agent-suran');
  coordinator.assignTask('T012', 'agent-ajian');
  
  console.log('\n>>> 阿坚开始 T006 (即时配送)...\n');
  const ajian = new AgentAjian();
  await ajian.startWork();
  
  console.log('\n>>> 阿坚开始 T007 (库存预警)...\n');
  await ajian.startWork();
  
  console.log('\n>>> 林夕开始 T008 (管理后台)...\n');
  const linxi = new AgentLinxi();
  await linxi.startWork();
  
  console.log('\n>>> 林夕开始 T009 (门店终端)...\n');
  await linxi.startWork();
  
  console.log('\n>>> 林夕开始 T010 (数据报表)...\n');
  await linxi.startWork();
  
  console.log('\n>>> 苏然开始 T011 (测试)...\n');
  const suran = new AgentSuran();
  await suran.startWork();
  
  console.log('\n>>> 阿坚开始 T012 (生产环境)...\n');
  await ajian.startWork();
  
  console.log('\n>>> Sprint 3 完成！\n');
  coordinator.printBoard();
}

async function main() {
  const mode = process.argv[2] || 'all';
  
  switch (mode) {
    case 'sprint1':
      await runSprint1();
      break;
    case 'sprint2':
      await runSprint2();
      break;
    case 'sprint3':
      await runSprint3();
      break;
    case 'all':
      await runSprint1();
      await runSprint2();
      await runSprint3();
      break;
    default:
      console.log('用法:');
      console.log('  node run-all-agents.js sprint1  # 运行 Sprint 1');
      console.log('  node run-all-agents.js sprint2  # 运行 Sprint 2');
      console.log('  node run-all-agents.js sprint3  # 运行 Sprint 3');
      console.log('  node run-all-agents.js all      # 运行全部 Sprint');
  }
}

main().catch(console.error);
