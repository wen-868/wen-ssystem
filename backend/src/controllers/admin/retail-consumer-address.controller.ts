import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import * as addressService from "../../services/miniapp/retail-consumer-address.service.js";

const createAddressSchema = z.object({
  name: z.string().min(1).max(50),
  mobile: z.string().min(1).max(20),
  province: z.string().min(1).max(50),
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
  detail: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const updateAddressSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  mobile: z.string().min(1).max(20).optional(),
  province: z.string().min(1).max(50).optional(),
  city: z.string().min(1).max(50).optional(),
  district: z.string().min(1).max(50).optional(),
  detail: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const listAddresses = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const data = await addressService.listAddresses(userId);
  res.json({ code: "0", message: "ok", data });
});

export const createAddress = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const body = createAddressSchema.parse(req.body);
  const data = await addressService.createAddress(userId, body as Record<string, unknown>);
  res.json({ code: "0", message: "ok", data });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const id = Number(req.params.id);
  const body = updateAddressSchema.parse(req.body);
  await addressService.updateAddress(id, userId, body as Record<string, unknown>);
  res.json({ code: "0", message: "ok", data: null });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const id = Number(req.params.id);
  await addressService.deleteAddress(id, userId);
  res.json({ code: "0", message: "ok", data: null });
});

export const setDefault = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const id = Number(req.params.id);
  await addressService.setDefault(id, userId);
  res.json({ code: "0", message: "ok", data: null });
});