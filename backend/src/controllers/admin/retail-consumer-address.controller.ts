import { asyncHandler } from "../../shared/async-handler.js";
import * as addressService from "../../services/miniapp/retail-consumer-address.service.js";

export const listAddresses = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const data = await addressService.listAddresses(userId);
  res.json({ code: "0", message: "ok", data });
});

export const createAddress = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const data = await addressService.createAddress(userId, req.body);
  res.json({ code: "0", message: "ok", data });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const userId = Number(req.user!.id);
  const id = Number(req.params.id);
  await addressService.updateAddress(id, userId, req.body);
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