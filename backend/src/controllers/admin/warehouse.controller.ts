import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../../services/warehouse.service";

export const listWarehousesHandler = asyncHandler(async (req, res) => {
  const items = await listWarehouses(req.tenantId!);
  res.json(ok(items));
});

export const createWarehouseHandler = asyncHandler(async (req, res) => {
  const result = await createWarehouse(req.body || {}, req.tenantId!);
  res.json(ok(result));
});

export const updateWarehouseHandler = asyncHandler(async (req, res) => {
  await updateWarehouse(Number(req.params.id), req.body || {}, req.tenantId!);
  res.json(ok({ id: Number(req.params.id) }));
});

export const deleteWarehouseHandler = asyncHandler(async (req, res) => {
  await deleteWarehouse(Number(req.params.id), req.tenantId!);
  res.json(ok({ id: Number(req.params.id) }));
});
