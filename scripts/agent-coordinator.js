#!/usr/bin/env node
/**
 * 智能体协同调度器
 * 负责读取 project-board.yaml，分配任务，跟踪进度
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const BOARD_PATH = path.join(__dirname, '..', 'project-board.yaml');

class AgentCoordinator {
  constructor() {
    this.board = this.loadBoard();
  }

  loadBoard() {
    const content = fs.readFileSync(BOARD_PATH, 'utf8');
    return yaml.load(content);
  }

  saveBoard() {
    fs.writeFileSync(BOARD_PATH, yaml.dump(this.board, { indent: 2 }), 'utf8');
  }

  // 获取Agent信息
  getAgent(agentId) {
    return this.board.agents.find(a => a.id === agentId);
  }

  // 获取任务信息
  getTask(taskId) {
    return this.board.tasks.find(t => t.id === taskId);
  }

  // 分配任务给Agent
  assignTask(taskId, agentId) {
    const task = this.getTask(taskId);
    const agent = this.getAgent(agentId);
    
    if (!task) throw new Error(`任务 ${taskId} 不存在`);
    if (!agent) throw new Error(`Agent ${agentId} 不存在`);
    
    // 检查依赖是否完成
    const unmetDeps = task.dependencies.filter(depId => {
      const depTask = this.getTask(depId);
      return depTask && depTask.status !== 'done';
    });
    
    if (unmetDeps.length > 0) {
      throw new Error(`任务 ${taskId} 依赖未满足: ${unmetDeps.join(', ')}`);
    }
    
    task.assignee = agentId;
    task.status = 'in_progress';
    agent.current_task = taskId;
    agent.status = 'working';
    
    this.saveBoard();
    console.log(`[协调器] 任务 ${taskId} 已分配给 ${agent.name}`);
    return task;
  }

  // 更新任务进度
  updateProgress(taskId, progress, notes = '') {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`任务 ${taskId} 不存在`);
    
    task.progress = progress;
    if (notes) task.notes = notes;
    
    const agent = this.getAgent(task.assignee);
    if (agent) {
      agent.progress = progress;
    }
    
    if (progress >= 100) {
      task.status = 'done';
      if (agent) {
        agent.status = 'idle';
        agent.current_task = null;
        agent.progress = 0;
      }
      console.log(`[协调器] 任务 ${taskId} 已完成！`);
      
      // 先保存，再检查依赖
      this.saveBoard();
      
      // 检查是否有依赖此任务的其他任务可以启动
      this.checkDependents(taskId);
    } else {
      this.saveBoard();
    }
    return task;
  }

  // 检查依赖任务，自动分配
  checkDependents(completedTaskId) {
    const readyTasks = this.board.tasks.filter(t => 
      t.status === 'todo' &&
      t.dependencies.includes(completedTaskId) &&
      t.dependencies.every(depId => this.getTask(depId)?.status === 'done')
    );
    
    for (const task of readyTasks) {
      console.log(`[协调器] 任务 ${task.id} 依赖已满足，可以开始`);
      // 可以在这里自动分配或通知
    }
  }

  // 获取当前Sprint进度
  getSprintProgress(sprintId) {
    const sprint = this.board.sprints.find(s => s.id === sprintId);
    if (!sprint) return null;
    
    const tasks = sprint.tasks.map(tid => this.getTask(tid)).filter(Boolean);
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    
    return {
      sprint: sprint.name,
      total,
      done,
      percent: Math.round((done / total) * 100),
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: this.getAgent(t.assignee)?.name || '未分配'
      }))
    };
  }

  // 生成日报
  generateDailyReport() {
    const date = new Date().toISOString().split('T')[0];
    const report = {
      date,
      project: this.board.project.name,
      agents: this.board.agents.map(a => ({
        name: a.name,
        status: a.status,
        current_task: a.current_task ? this.getTask(a.current_task)?.title : '无',
        progress: a.progress
      })),
      tasks_today: this.board.tasks.filter(t => t.status === 'in_progress').map(t => ({
        id: t.id,
        title: t.title,
        assignee: this.getAgent(t.assignee)?.name,
        progress: t.progress
      })),
      tasks_done: this.board.tasks.filter(t => t.status === 'done').length,
      tasks_total: this.board.tasks.length
    };
    
    return report;
  }

  // 打印看板状态
  printBoard() {
    console.log('\n========== 项目看板 ==========');
    console.log(`项目: ${this.board.project.name}`);
    console.log(`状态: ${this.board.project.status}`);
    console.log(`目标日期: ${this.board.project.target_date}`);
    console.log('');
    
    console.log('--- Agent 状态 ---');
    for (const agent of this.board.agents) {
      const task = agent.current_task ? this.getTask(agent.current_task) : null;
      console.log(`${agent.name} (${agent.role}): ${agent.status}`);
      if (task) {
        console.log(`  当前任务: ${task.title} (${task.progress}%)`);
      }
      if (agent.blockers.length > 0) {
        console.log(`  阻塞: ${agent.blockers.join(', ')}`);
      }
    }
    
    console.log('\n--- 任务进度 ---');
    for (const task of this.board.tasks) {
      const agent = task.assignee ? this.getAgent(task.assignee) : null;
      const icon = task.status === 'done' ? '✓' : task.status === 'in_progress' ? '▶' : '○';
      console.log(`${icon} [${task.priority}] ${task.id}: ${task.title} (${agent?.name || '未分配'})`);
    }
    
    console.log('\n--- Sprint 进度 ---');
    for (const sprint of this.board.sprints) {
      const progress = this.getSprintProgress(sprint.id);
      console.log(`${sprint.name}: ${progress.done}/${progress.total} (${progress.percent}%)`);
    }
    console.log('================================\n');
  }
}

// CLI 入口
if (require.main === module) {
  const coordinator = new AgentCoordinator();
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      coordinator.printBoard();
      break;
    case 'assign':
      coordinator.assignTask(process.argv[3], process.argv[4]);
      break;
    case 'progress':
      coordinator.updateProgress(process.argv[3], parseInt(process.argv[4]), process.argv[5]);
      break;
    case 'report':
      console.log(JSON.stringify(coordinator.generateDailyReport(), null, 2));
      break;
    default:
      console.log('用法:');
      console.log('  node agent-coordinator.js status           # 查看看板状态');
      console.log('  node agent-coordinator.js assign <taskId> <agentId>  # 分配任务');
      console.log('  node agent-coordinator.js progress <taskId> <percent> [notes]  # 更新进度');
      console.log('  node agent-coordinator.js report           # 生成日报');
  }
}

module.exports = AgentCoordinator;
