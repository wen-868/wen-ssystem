import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { makeBizNo } from "../../shared/id";

export async function listInstances(
  page: number,
  pageSize: number,
  businessType: string | null,
  status: string | null,
  applicantId: number | null,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (businessType) {
    conditions.push("business_type = ?");
    params.push(businessType);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (applicantId) {
    conditions.push("applicant_id = ?");
    params.push(applicantId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const records = await queryWithTenant<any>(
    `SELECT id, instance_no AS instanceNo, rule_id AS ruleId, business_type AS businessType,
            business_no AS businessNo, business_title AS businessTitle,
            applicant_id AS applicantId, applicant_name AS applicantName,
            current_level AS currentLevel, status, submitted_at AS submittedAt,
            completed_at AS completedAt, remark,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_approval_instance
     ${where}
     ORDER BY submitted_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_approval_instance ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function submitApproval(
  body: {
    businessType: "PURCHASE_ORDER" | "SALE_RETURN" | "PRICE_CHANGE" | "CREDIT_LIMIT";
    businessNo: string;
    businessTitle: string;
    remark?: string;
  },
  userId: number | null,
  username: string,
  tenantId: string
) {
  const result = await transaction(async (conn) => {
    const [rules] = await conn.query<any[]>(
      `SELECT id, rule_name, trigger_condition, approval_chain, sla_hours, escalation_level
       FROM t_approval_rule
       WHERE business_type = ? AND status = 1 AND tenant_id = ?
       ORDER BY id ASC`,
      [body.businessType, tenantId]
    );

    if (rules.length === 0) {
      throw new Error(`未找到业务类型 ${body.businessType} 的审批规则`);
    }

    const rule = rules[0];
    const triggerCondition = typeof rule.trigger_condition === 'string' ? JSON.parse(rule.trigger_condition) : rule.trigger_condition;
    const approvalChain = typeof rule.approval_chain === 'string' ? JSON.parse(rule.approval_chain) : rule.approval_chain;

    const instanceNo = makeBizNo("SP");

    await conn.execute(
      `INSERT INTO t_approval_instance (instance_no, rule_id, business_type, business_no, business_title,
                                      applicant_id, applicant_name, current_level, status, remark, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?, ?)`,
      [instanceNo, rule.id, body.businessType, body.businessNo, body.businessTitle,
       userId ?? 0, username, body.remark ?? null, tenantId]
    );

    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + rule.sla_hours);

    for (const chainItem of approvalChain) {
      const [approvers] = await conn.query<any[]>(
        `SELECT id, approver_name FROM t_approval_approver
         WHERE approver_type = ? AND approver_value = ? AND status = 1 AND tenant_id = ?
         LIMIT 1`,
        [chainItem.approverType, chainItem.approverValue, tenantId]
      );

      if (approvers.length === 0) {
        throw new Error(`未找到审批人：${chainItem.approverType} - ${chainItem.approverValue}`);
      }

      const approver = approvers[0];

      await conn.execute(
        `INSERT INTO t_approval_task (instance_id, approval_level, approver_id, approver_name,
                                    task_status, sla_deadline, tenant_id)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
        [instanceNo, chainItem.level, approver.id, approver.approver_name, slaDeadline, tenantId]
      );

      await conn.execute(
        `INSERT INTO t_approval_notification (instance_id, notification_type, recipient_id, recipient_name,
                                            title, content, channel, tenant_id)
         VALUES (?, 'NEW_TASK', ?, ?, ?, ?, 'SYSTEM', ?)`,
        [instanceNo, approver.id, approver.approver_name,
         `您有新的审批任务：${body.businessTitle}`,
         `业务类型：${body.businessType}，单号：${body.businessNo}，请及时处理。`, tenantId]
      );
    }

    await conn.execute(
      `INSERT INTO t_approval_log (instance_id, action, operator_id, operator_name, from_status, to_status, comment, tenant_id)
       VALUES (?, 'SUBMIT', ?, ?, NULL, 'PENDING', ?, ?)`,
      [instanceNo, userId ?? 0, username, body.remark ?? "提交审批", tenantId]
    );

    return { instanceNo, businessType: body.businessType, businessNo: body.businessNo, status: "PENDING" };
  });

  return result;
}

export async function getInstanceDetail(instanceNo: string, tenantId: string) {
  const instance = await queryOneWithTenant<any>(
    `SELECT id, instance_no AS instanceNo, rule_id AS ruleId, business_type AS businessType,
            business_no AS businessNo, business_title AS businessTitle,
            applicant_id AS applicantId, applicant_name AS applicantName,
            current_level AS currentLevel, status, submitted_at AS submittedAt,
            completed_at AS completedAt, remark,
            created_at AS createdAt, updated_at AS updatedAt
     FROM t_approval_instance WHERE instance_no = ?`,
    [instanceNo],
    tenantId
  );

  if (!instance) {
    return null;
  }

  const tasks = await queryWithTenant<any>(
    `SELECT id, approval_level AS approvalLevel, approver_id AS approverId,
            approver_name AS approverName, task_status AS taskStatus,
            received_at AS receivedAt, processed_at AS processedAt,
            sla_deadline AS slaDeadline, escalated, approval_comment AS approvalComment
     FROM t_approval_task WHERE instance_id = ?
     ORDER BY approval_level ASC`,
    [instance.id],
    tenantId
  );

  const logs = await queryWithTenant<any>(
    `SELECT id, task_id AS taskId, action, operator_id AS operatorId,
            operator_name AS operatorName, from_status AS fromStatus,
            to_status AS toStatus, comment, created_at AS createdAt
     FROM t_approval_log WHERE instance_id = ?
     ORDER BY created_at ASC`,
    [instance.id],
    tenantId
  );

  return { ...instance, tasks, logs };
}

export async function listTasks(
  page: number,
  pageSize: number,
  approverId: number,
  taskStatus: string,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<any>(
    `SELECT t.id, t.instance_id AS instanceId, t.approval_level AS approvalLevel,
            t.approver_id AS approverId, t.approver_name AS approverName,
            t.task_status AS taskStatus, t.received_at AS receivedAt,
            t.processed_at AS processedAt, t.sla_deadline AS slaDeadline,
            t.escalated, t.approval_comment AS approvalComment,
            i.instance_no AS instanceNo, i.business_type AS businessType,
            i.business_no AS businessNo, i.business_title AS businessTitle,
            i.applicant_name AS applicantName, i.submitted_at AS submittedAt
     FROM t_approval_task t
     JOIN t_approval_instance i ON i.instance_no = t.instance_id AND i.tenant_id = t.tenant_id
     WHERE t.approver_id = ? AND t.task_status = ?
     ORDER BY t.received_at DESC
     LIMIT ? OFFSET ?`,
    [approverId, taskStatus, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total
     FROM t_approval_task t
     WHERE t.approver_id = ? AND t.task_status = ?`,
    [approverId, taskStatus],
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function approveTask(
  taskId: number,
  comment: string | undefined,
  userId: number | null,
  username: string,
  tenantId: string
) {
  const result = await transaction(async (conn) => {
    const [taskRows] = await conn.query<any[]>(
      `SELECT t.id, t.instance_id, t.approval_level, t.approver_id, t.task_status,
              i.current_level, i.status AS instanceStatus
       FROM t_approval_task t
       JOIN t_approval_instance i ON i.instance_no = t.instance_id AND i.tenant_id = t.tenant_id
       WHERE t.id = ? AND t.tenant_id = ? FOR UPDATE`,
      [taskId, tenantId]
    );

    const task = taskRows[0];
    if (!task) throw new Error("审批任务不存在");
    if (task.approver_id !== userId) throw new Error("无权审批此任务");
    if (task.task_status !== "PENDING") throw new Error("任务已处理");

    await conn.execute(
      `UPDATE t_approval_task SET task_status = 'APPROVED', processed_at = NOW(), approval_comment = ?
       WHERE id = ? AND tenant_id = ?`,
      [comment ?? null, taskId, tenantId]
    );

    const [nextTasks] = await conn.query<any[]>(
      `SELECT id FROM t_approval_task
       WHERE instance_id = ? AND approval_level = ? AND task_status = 'PENDING' AND tenant_id = ?`,
      [task.instance_id, task.approval_level + 1, tenantId]
    );

    if (nextTasks.length > 0) {
      await conn.execute(
        `UPDATE t_approval_instance SET current_level = ? WHERE instance_no = ? AND tenant_id = ?`,
        [task.approval_level + 1, task.instance_id, tenantId]
      );
    } else {
      await conn.execute(
        `UPDATE t_approval_instance SET status = 'APPROVED', completed_at = NOW()
         WHERE instance_no = ? AND tenant_id = ?`,
        [task.instance_id, tenantId]
      );
    }

    await conn.execute(
      `INSERT INTO t_approval_log (instance_id, task_id, action, operator_id, operator_name,
                                 from_status, to_status, comment, tenant_id)
       VALUES (?, ?, 'APPROVE', ?, ?, 'PENDING', 'APPROVED', ?, ?)`,
      [task.instance_id, taskId, userId ?? 0, username, comment ?? "审批通过", tenantId]
    );

    const [instanceRows] = await conn.query<any[]>(
      `SELECT applicant_id, applicant_name, business_title FROM t_approval_instance WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );
    const instance = instanceRows[0];

    await conn.execute(
      `INSERT INTO t_approval_notification (instance_id, task_id, notification_type, recipient_id, recipient_name,
                                          title, content, channel, tenant_id)
       VALUES (?, ?, 'RESULT', ?, ?, ?, ?, 'SYSTEM', ?)`,
      [task.instance_id, taskId, instance.applicant_id, instance.applicant_name,
       `您的审批已通过：${instance.business_title}`,
       `审批意见：${comment ?? "审批通过"}`, tenantId]
    );

    return { taskId, taskStatus: "APPROVED", instanceNo: task.instance_id };
  });

  return result;
}

export async function rejectTask(
  taskId: number,
  comment: string,
  userId: number | null,
  username: string,
  tenantId: string
) {
  const result = await transaction(async (conn) => {
    const [taskRows] = await conn.query<any[]>(
      `SELECT t.id, t.instance_id, t.approver_id, t.task_status
       FROM t_approval_task t
       WHERE t.id = ? AND t.tenant_id = ? FOR UPDATE`,
      [taskId, tenantId]
    );

    const task = taskRows[0];
    if (!task) throw new Error("审批任务不存在");
    if (task.approver_id !== userId) throw new Error("无权审批此任务");
    if (task.task_status !== "PENDING") throw new Error("任务已处理");

    await conn.execute(
      `UPDATE t_approval_task SET task_status = 'REJECTED', processed_at = NOW(), approval_comment = ?
       WHERE id = ? AND tenant_id = ?`,
      [comment, taskId, tenantId]
    );

    await conn.execute(
      `UPDATE t_approval_instance SET status = 'REJECTED', completed_at = NOW()
       WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );

    await conn.execute(
      `INSERT INTO t_approval_log (instance_id, task_id, action, operator_id, operator_name,
                                 from_status, to_status, comment, tenant_id)
       VALUES (?, ?, 'REJECT', ?, ?, 'PENDING', 'REJECTED', ?, ?)`,
      [task.instance_id, taskId, userId ?? 0, username, comment, tenantId]
    );

    const [instanceRows] = await conn.query<any[]>(
      `SELECT applicant_id, applicant_name, business_title FROM t_approval_instance WHERE instance_no = ? AND tenant_id = ?`,
      [task.instance_id, tenantId]
    );
    const instance = instanceRows[0];

    await conn.execute(
      `INSERT INTO t_approval_notification (instance_id, task_id, notification_type, recipient_id, recipient_name,
                                          title, content, channel, tenant_id)
       VALUES (?, ?, 'RESULT', ?, ?, ?, ?, 'SYSTEM', ?)`,
      [task.instance_id, taskId, instance.applicant_id, instance.applicant_name,
       `您的审批已驳回：${instance.business_title}`,
       `驳回原因：${comment}`, tenantId]
    );

    return { taskId, taskStatus: "REJECTED", instanceNo: task.instance_id };
  });

  return result;
}

export async function listNotifications(
  page: number,
  pageSize: number,
  recipientId: number,
  readStatus: number | null,
  tenantId: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["recipient_id = ?"];
  const params: unknown[] = [recipientId];

  if (readStatus !== null) {
    conditions.push("read_status = ?");
    params.push(readStatus);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const records = await queryWithTenant<any>(
    `SELECT id, instance_id AS instanceId, task_id AS taskId,
            notification_type AS notificationType, recipient_id AS recipientId,
            recipient_name AS recipientName, title, content, channel,
            read_status AS readStatus, sent_at AS sentAt, read_at AS readAt
     FROM t_approval_notification
     ${where}
     ORDER BY sent_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM t_approval_notification ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function markNotificationRead(
  id: number,
  userId: number,
  tenantId: string
) {
  await queryWithTenant(
    `UPDATE t_approval_notification SET read_status = 1, read_at = NOW() WHERE id = ? AND recipient_id = ?`,
    [id, userId],
    tenantId
  );

  return { id, readStatus: 1 };
}
