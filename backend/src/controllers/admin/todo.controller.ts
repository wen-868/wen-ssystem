import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as todoService from "../../services/admin/todo.service.js";

export const listTodos = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type as string | undefined;
  const priority = req.query.priority as string | undefined;
  const status = req.query.status as string | undefined;
  const result = await todoService.listTodos(tenantId, page, pageSize, type, priority, status);
  res.json(ok(result));
});

export const getTodoStats = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await todoService.getTodoStats(tenantId);
  res.json(ok(result));
});

export const createTodo = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const { title, type, priority, dueDate, remark, source } = req.body;
  if (!title || !type || !priority) {
    res.status(400).json({ code: "400", message: "title、type、priority 为必填项" });
    return;
  }
  const result = await todoService.createTodo(tenantId, { title, type, priority, dueDate, remark, source });
  res.json(ok(result));
});

export const completeTodo = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await todoService.completeTodo(tenantId, id);
  res.json(ok(result));
});

export const dismissTodo = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await todoService.dismissTodo(tenantId, id);
  res.json(ok(result));
});

export const deleteTodo = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const id = Number(req.params.id);
  const result = await todoService.deleteTodo(tenantId, id);
  res.json(ok(result));
});