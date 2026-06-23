import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const approvalRouter = Router();

approvalRouter.use(requireAuthWithTenant);

// ========== 审批规则管理 ==========

// GET /api/admin/approval/rules - 规则列表
approvalRouter.get("/rules", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const businessType = req.query.businessType ? String(req.query.businessType) : null;
  const status = req.query.status !== undefined ? Number(req.query.status) : null;

  let sql = `SELECT id, rule_name AS ruleName, business_type AS businessType,
                    trigger_condition AS triggerCondition, approval_chain AS approvalChain,
                    sla_hours AS slaHours, escalation_level AS escalationLevel,
                    status, created_at AS createdAt, updated_at AS updatedAt
             FROM approval_rule WHERE tenant_id = ?`;
  const params: unknown[] = [tenantId];

  if (businessType) {
    sql += ` AND business_type = ?`;
    params.push(businessType);
  }
  if (status !== null) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const records = await query<any>(sql, params);

  let countSql = `SELECT COUNT(*) AS total FROM approval_rule WHERE tenant_id = ?`;
  const countParams: unknown[] = [tenantId];
  if (businessType) countSql += ` AND business_type = ?`, countParams.push(businessType);
  if (status !== null) countSql += ` AND status = ?`, countParams.push(status);

  const totalRow = await queryOne<any>(countSql, countParams);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/approval/rules - 创建规则
approvalRouter.post("/rules", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    ruleName: z.string().min(1, "规则名称不能为空"),
    businessType: z.enum(["PURCHASE_ORDER", "SALE_RETURN", "PRICE_CHANGE", "CREDIT_LIMIT"]),
    triggerCondition: z.any(),
    approvalChain: z.array(z.object({
      level: z.number().int().positive(),
      approverType: z.enum(["ROLE", "USER", "DEPARTMENT"]),
      approverValue: z.string()
    })).min(1),
    slaHours: z.number().int().positive().default(24),
    escalationLevel: z.number().int().min(1).max(3).default(1)
  }).parse(req.body);

  await query(
    `INSERT INTO approval_rule (rule_name, business_type, trigger_condition, approval_chain, sla_hours, escalation_level, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [body.ruleName, body.businessType, JSON.stringify(body.triggerCondition), JSON.stringify(body.approvalChain), body.slaHours, body.escalationLevel, tenantId]
  );

  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data, tenant_id)
     VALUES (?, ?, 'APPROVAL_RULE', 'CREATE', ?, ?, ?)`,
    [req.user!.id ?? null, req.user!.username ?? "系统用户", body.ruleName, JSON.stringify(body), tenantId]
  );

  res.json(ok({ ruleName: body.ruleName }));
}));

// PUT /api/admin/approval/rules/:id - 更新规则
approvalRouter.put("/rules/:id", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const body = z.object({
    ruleName: z.string().optional(),
    triggerCondition: z.any().optional(),
    approvalChain: z.array(z.object({
      level: z.number().int().positive(),
      approverType: z.enum(["ROLE", "USER", "DEPARTMENT"]),
      approverValue: z.string()
    })).optional(),
    slaHours: z.number().int().positive().optional(),
    escalationLevel: z.number().int().min(1).max(3).optional(),
    status: z.number().optional()
  }).parse(req.body);

  const existing = await queryOne<any>("SELECT id FROM approval_rule WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  if (!existing) {
    res.status(404).json({ code: "404", message: "规则不存在" });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.ruleName !== undefined) {
    updates.push("rule_name = ?");
    params.push(body.ruleName);
  }
  if (body.triggerCondition !== undefined) {
    updates.push("trigger_condition = ?");
    params.push(JSON.stringify(body.triggerCondition));
  }
  if (body.approvalChain !== undefined) {
    updates.push("approval_chain = ?");
    params.push(JSON.stringify(body.approvalChain));
  }
  if (body.slaHours !== undefined) {
    updates.push("sla_hours = ?");
    params.push(body.slaHours);
  }
  if (body.escalationLevel !== undefined) {
    updates.push("escalation_level = ?");
    params.push(body.escalationLevel);
  }
  if (body.status !== undefined) {
    updates.push("status = ?");
    params.push(body.status);
  }

  if (updates.length > 0) {
    params.push(id, tenantId);
    await query(`UPDATE approval_rule SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params);
  }

  res.json(ok({ id, ...body }));
}));

// ========== 审批实例管理 ==========

// GET /api/admin/approval/instances - 实例列表
approvalRouter.get("/instances", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const businessType = req.query.businessType ? String(req.query.businessType) : null;
  const status = req.query.status ? String(req.query.status) : null;
  const applicantId = req.query.applicantId ? Number(req.query.applicantId) : null;

  let sql = `SELECT id, instance_no AS instanceNo, rule_id AS ruleId, business_type AS businessType,
                    business_no AS businessNo, business_title AS businessTitle,
                    applicant_id AS applicantId, applicant_name AS applicantName,
                    current_level AS currentLevel, status, submitted_at AS submittedAt,
                    completed_at AS completedAt, remark,
                    created_at AS createdAt, updated_at AS updatedAt
             FROM approval_instance WHERE tenant_id = ?`;
  const params: unknown[] = [tenantId];

  if (businessType) {
    sql += ` AND business_type = ?`;
    params.push(businessType);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (applicantId) {
    sql += ` AND applicant_id = ?`;
    params.push(applicantId);
  }

  sql += ` ORDER BY submitted_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const records = await query<any>(sql, params);

  let countSql = `SELECT COUNT(*) AS total FROM approval_instance WHERE tenant_id = ?`;
  const countParams: unknown[] = [tenantId];
  if (businessType) countSql += ` AND business_type = ?`, countParams.push(businessType);
  if (status) countSql += ` AND status = ?`, countParams.push(status);
  if (applicantId) countSql += ` AND applicant_id = ?`, countParams.push(applicantId);

  const totalRow = await queryOne<any>(countSql, countParams);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/approval/instances/submit - 提交审批
approvalRouter.post("/instances/submit", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    businessType: z.enum(["PURCHASE_ORDER", "SALE_RETURN", "PRICE_CHANGE", "CREDIT_LIMIT"]),
    businessNo: z.string().min(1),
    businessTitle: z.string().min(1),
    remark: z.string().optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    // 查找匹配的审批规则
    const rules = await query<any>(
      `SELECT id, rule_name, trigger_condition, approval_chain, sla_hours, escalation_level
       FROM approval_rule
       WHERE business_type = ? AND status = 1 AND tenant_id = ?
       ORDER BY id ASC`,
      [body.businessType, tenantId]
    );

    if (rules.length === 0) {
      throw new Error(`未找到业务类型 ${body.businessType} 的审批规则`);
    }

    // 简化：使用第一个匹配的规则（实际应该根据triggerCondition判断）
    const rule = rules[0];
    const triggerCondition = typeof rule.trigger_condition === 'string' ? JSON.parse(rule.trigger_condition) : rule.trigger_condition;
    const approvalChain = typeof rule.approval_chain === 'string' ? JSON.parse(rule.approval_chain) : rule.approval_chain;

    const instanceNo = makeBizNo("SP");

    // 创建审批实例
    await conn.execute(
      `INSERT INTO approval_instance (instance_no, rule_id, business_type, business_no, business_title,
                                      applicant_id, applicant_name, current_level, status, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?, ?)`,
      [instanceNo, rule.id, body.businessType, body.businessNo, body.businessTitle,
       req.user!.id ?? 0, req.user!.username ?? "系统用户", body.remark ?? null, tenantId]
    );

    // 创建审批任务
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + rule.sla_hours);

    for (const chainItem of approvalChain) {
      // 查找审批人
      const approvers = await query<any>(
        `SELECT id, approver_name FROM approval_approver
         WHERE approver_type = ? AND approver_value = ? AND status = 1 AND tenant_id = ?
         LIMIT 1`,
        [chainItem.approverType, chainItem.approverValue, tenantId]
      );

      if (approvers.length === 0) {
        throw new Error(`未找到审批人：${chainItem.approverType} - ${chainItem.approverValue}`);
      }

      const approver = approvers[0];

      await conn.execute(
        `INSERT INTO approval_task (instance_id, approval_level, approver_id, approver_name,
                                    task_status, sla_deadline, tenant_id)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
        [instanceNo, chainItem.level, approver.id, approver.approver_name, slaDeadline, tenantId]
      );

      // 发送通知
      await conn.execute(
        `INSERT INTO approval_notification (instance_id, notification_type, recipient_id, recipient_name,
                                            title, content, channel, tenant_id)
         VALUES (?, 'NEW_TASK', ?, ?, ?, ?, 'SYSTEM', ?)`,
        [instanceNo, approver.id, approver.approver_name,
         `您有新的审批任务：${body.businessTitle}`,
         `业务类型：${body.businessType}，单号：${body.businessNo}，请及时处理。`, tenantId]
      );
    }

    // 记录日志
    await conn.execute(
      `INSERT INTO approval_log (instance_id, action, operator_id, operator_name, from_status, to_status, comment, tenant_id)
       VALUES (?, 'SUBMIT', ?, ?, NULL, 'PENDING', ?, ?)`,
      [instanceNo, req.user!.id ?? 0, req.user!.username ?? "系统用户", body.remark ?? "提交审批", tenantId]
    );

    return { instanceNo, businessType: body.businessType, businessNo: body.businessNo, status: "PENDING" };
  });

  res.json(ok(result));
}));

// GET /api/admin/approval/instances/:instanceNo - 实例详情
approvalRouter.get("/instances/:instanceNo", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const instance = await queryOne<any>(
    `SELECT id, instance_no AS instanceNo, rule_id AS ruleId, business_type AS businessType,
            business_no AS businessNo, business_title AS businessTitle,
            applicant_id AS applicantId, applicant_name AS applicantName,
            current_level AS currentLevel, status, submitted_at AS submittedAt,
            completed_at AS completedAt, remark,
            created_at AS createdAt, updated_at AS updatedAt
     FROM approval_instance WHERE instance_no = ? AND tenant_id = ?`,
    [req.params.instanceNo, tenantId]
  );

  if (!instance) {
    res.status(404).json({ code: "404", message: "审批实例不存在" });
    return;
  }

  const tasks = await query<any>(
    `SELECT id, approval_level AS approvalLevel, approver_id AS approverId,
            approver_name AS approverName, task_status AS taskStatus,
            received_at AS receivedAt, processed_at AS processedAt,
            sla_deadline AS slaDeadline, escalated, approval_comment AS approvalComment
     FROM approval_task WHERE instance_id = ? AND tenant_id = ?
     ORDER BY approval_level ASC`,
    [instance.id, tenantId]
  );

  const logs = await query<any>(
    `SELECT id, task_id AS taskId, action, operator_id AS operatorId,
            operator_name AS operatorName, from_status AS fromStatus,
            to_status AS toStatus, comment, created_at AS createdAt
     FROM approval_log WHERE instance_id = ? AND tenant_id = ?
     ORDER BY created_at ASC`,
    [instance.id, tenantId]
  );

  res.json(ok({ ...instance, tasks, logs }));
}));

// ========== 审批任务处理 ==========

// GET /api/admin/approval/tasks - 我的待办任务
approvalRouter.get("/tasks", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const approverId = req.query.approverId ? Number(req.query.approverId) : req.user!.id;
  const taskStatus = req.query.taskStatus ? String(req.query.taskStatus) : "PENDING";

  let sql = `SELECT t.id, t.instance_id AS instanceId, t.approval_level AS approvalLevel,
                    t.approver_id AS approverId, t.approver_name AS approverName,
                    t.task_status AS taskStatus, t.received_at AS receivedAt,
                    t.processed_at AS processedAt, t.sla_deadline AS slaDeadline,
                    t.escalated, t.approval_comment AS approvalComment,
                    i.instance_no AS instanceNo, i.business_type AS businessType,
                    i.business_no AS businessNo, i.business_title AS businessTitle,
                    i.applicant_name AS applicantName, i.submitted_at AS submittedAt
             FROM approval_task t
             JOIN approval_instance i ON i.instance_no = t.instance_id AND i.tenant_id = t.tenant_id
             WHERE t.approver_id = ? AND t.task_status = ? AND t.tenant_id = ?`;
  const params: unknown[] = [approverId, taskStatus, tenantId];

  sql += ` ORDER BY t.received_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const records = await query<any>(sql, params);

  let countSql = `SELECT COUNT(*) AS total
                  FROM approval_task t
                  WHERE t.approver_id = ? AND t.task_status = ? AND t.tenant_id = ?`;
  const totalRow = await queryOne<any>(countSql, [approverId, taskStatus, tenantId]);

  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/approval/tasks/:id/approve - 审批通过
approvalRouter.post("/tasks/:id/approve", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const taskId = Number(req.params.id);
  const body = z.object({
    comment: z.string().optional()
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const [taskRows] = await conn.query<any[]>(
      `SELECT t.id, t.instance_id, t.approval_level, t.approver_id, t.task_status,
              i.current_level, i.status AS instanceStatus
       FROM approval_task t
       JOIN approval_instance i ON i.instance_no = t.instance_id AND i.tenant_id = t.tenant_id
       WHERE t.id = ? AND t.tenant_id = ? FOR UPDATE`,
      [taskId, tenantId]
    );

    const task = taskRows[0];
    if (!task) throw new Error("审批任务不存在");
    if (task.approver_id !== req.user!.id) throw new Error("无权审批此任务");
    if (task.task_status !== "PENDING") throw new Error("任务已处理");

    // 更新任务状态
    await conn.execute(
      `UPDATE approval_task SET task_status = 'APPROVED', processed_at = NOW(), approval_comment = ?
       WHERE id = ? AND tenant_id = ?`,
      [body.comment ?? null, taskId, tenantId]
    );

    // 检查是否还有下一级审批
    const [nextTasks] = await conn.query<any[]>(
      `SELECT id FROM approval_task
       WHERE instance_id = ? AND approval_level = ? AND task_status = 'PENDING' AND tenant_id = ?`,
      [task.instance_id, task.approval_level + 1, tenantId]
    );

    if (nextTasks.length > 0) {
      // 还有下一级，更新实例的当前层级
      await conn.execute(
        `UPDATE approval_instance SET current_level = ? WHERE instance_no = ? AND tenant_id = ?`,
        [task.approval_level + 1, task.instance_id, tenantId]
      );
    } else {
      // 所有层级都审批完成
      await conn.execute(
        `UPDATE approval_instance SET status = 'APPROVED', completed_at = NOW()
         WHERE instance_no = ? AND tenant_id = ?`,
        [task.instance_id, tenantId]
      );
    }

    // 记录日志
    await conn.execute(
      `INSERT INTO approval_log (instance_id, task_id, action, operator_id, operator_name,
                                 from_status, to_status, comment, tenant_id)
       VALUES (?, ?, 'APPROVE', ?, ?, 'PENDING', 'APPROVED', ?, ?)`,
      [task.instance_id, taskId, req.user!.id ?? 0, req.user!.username ?? "系统用户", body.comment ?? "审批通过", tenantId]
    );

    // 发送通知给申请人
    const [instanceRows] = await conn.query<any[]>(
      `SELECT applicant_id, applicant_name, business_title FROM approval_instance WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );
    const instance = instanceRows[0];

    await conn.execute(
      `INSERT INTO approval_notification (instance_id, task_id, notification_type, recipient_id, recipient_name,
                                          title, content, channel, tenant_id)
       VALUES (?, ?, 'RESULT', ?, ?, ?, ?, 'SYSTEM', ?)`,
      [task.instance_id, taskId, instance.applicant_id, instance.applicant_name,
       `您的审批已通过：${instance.business_title}`,
       `审批意见：${body.comment ?? "审批通过"}`, tenantId]
    );

    return { taskId, taskStatus: "APPROVED", instanceNo: task.instance_id };
  });

  res.json(ok(result));
}));

// POST /api/admin/approval/tasks/:id/reject - 审批驳回
approvalRouter.post("/tasks/:id/reject", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const taskId = Number(req.params.id);
  const body = z.object({
    comment: z.string().min(1, "驳回原因不能为空")
  }).parse(req.body);

  const result = await transaction(async (conn) => {
    const [taskRows] = await conn.query<any[]>(
      `SELECT t.id, t.instance_id, t.approver_id, t.task_status
       FROM approval_task t
       WHERE t.id = ? AND t.tenant_id = ? FOR UPDATE`,
      [taskId, tenantId]
    );

    const task = taskRows[0];
    if (!task) throw new Error("审批任务不存在");
    if (task.approver_id !== req.user!.id) throw new Error("无权审批此任务");
    if (task.task_status !== "PENDING") throw new Error("任务已处理");

    // 更新任务状态
    await conn.execute(
      `UPDATE approval_task SET task_status = 'REJECTED', processed_at = NOW(), approval_comment = ?
       WHERE id = ? AND tenant_id = ?`,
      [body.comment, taskId, tenantId]
    );

    // 更新实例状态为驳回
    await conn.execute(
      `UPDATE approval_instance SET status = 'REJECTED', completed_at = NOW()
       WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );

    // 记录日志
    await conn.execute(
      `INSERT INTO approval_log (instance_id, task_id, action, operator_id, operator_name,
                                 from_status, to_status, comment, tenant_id)
       VALUES (?, ?, 'REJECT', ?, ?, 'PENDING', 'REJECTED', ?, ?)`,
      [task.instance_id, taskId, req.user!.id ?? 0, req.user!.username ?? "系统用户", body.comment, tenantId]
    );

    // 发送通知给申请人
    const [instanceRows] = await conn.query<any[]>(
      `SELECT applicant_id, applicant_name, business_title FROM approval_instance WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );
    const instance = instanceRows[0];

    await conn.execute(
      `INSERT INTO approval_notification (instance_id, task_id, notification_type, recipient_id, recipient_name,
                                          title, content, channel, tenant_id)
       VALUES (?, ?, 'RESULT', ?, ?, ?, ?, 'SYSTEM', ?)`,
      [task.instance_id, taskId, instance.applicant_id, instance.applicant_name,
       `您的审批已驳回：${instance.business_title}`,
       `驳回原因：${body.comment}`, tenantId]
    );

    return { taskId, taskStatus: "REJECTED", instanceNo: task.instance_id };
  });

  res.json(ok(result));
}));

// ========== 审批通知 ==========

// GET /api/admin/approval/notifications - 我的通知
approvalRouter.get("/notifications", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const recipientId = req.query.recipientId ? Number(req.query.recipientId) : req.user!.id;
  const readStatus = req.query.readStatus !== undefined ? Number(req.query.readStatus) : null;

  let sql = `SELECT id, instance_id AS instanceId, task_id AS taskId,
                    notification_type AS notificationType, recipient_id AS recipientId,
                    recipient_name AS recipientName, title, content, channel,
                    read_status AS readStatus, sent_at AS sentAt, read_at AS readAt
             FROM approval_notification
             WHERE recipient_id = ? AND tenant_id = ?`;
  const params: unknown[] = [recipientId, tenantId];

  if (readStatus !== null) {
    sql += ` AND read_status = ?`;
    params.push(readStatus);
  }

  sql += ` ORDER BY sent_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const records = await query<any>(sql, params);

  let countSql = `SELECT COUNT(*) AS total FROM approval_notification WHERE recipient_id = ? AND tenant_id = ?`;
  const countParams: unknown[] = [recipientId, tenantId];
  if (readStatus !== null) countSql += ` AND read_status = ?`, countParams.push(readStatus);

  const totalRow = await queryOne<any>(countSql, countParams);
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/approval/notifications/:id/read - 标记已读
approvalRouter.post("/notifications/:id/read", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);

  await query(
    `UPDATE approval_notification SET read_status = 1, read_at = NOW() WHERE id = ? AND recipient_id = ? AND tenant_id = ?`,
    [id, req.user!.id, tenantId]
  );

  res.json(ok({ id, readStatus: 1 }));
}));
