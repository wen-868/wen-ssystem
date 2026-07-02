import { asyncHandler } from "../../shared/async-handler.js";
import * as addressService from "../../services/miniapp/retail-consumer-address.service.js";

export const listAddresses = asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const data = await addressService.listAddresses(userId);
    res.json({ code: "0", message: "ok", data });
  } catch (error: any) {
    res.json({ code: "400", message: error.message || "获取地址列表失败" });
  }
});

export const createAddress = asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const data = await addressService.createAddress(userId, req.body);
    res.json({ code: "0", message: "ok", data });
  } catch (error: any) {
    res.json({ code: "400", message: error.message || "创建地址失败" });
  }
});

export const updateAddress = asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const id = Number(req.params.id);
    await addressService.updateAddress(id, userId, req.body);
    res.json({ code: "0", message: "ok", data: null });
  } catch (error: any) {
    res.json({ code: "400", message: error.message || "更新地址失败" });
  }
});

export const deleteAddress = asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const id = Number(req.params.id);
    await addressService.deleteAddress(id, userId);
    res.json({ code: "0", message: "ok", data: null });
  } catch (error: any) {
    res.json({ code: "400", message: error.message || "删除地址失败" });
  }
});

export const setDefault = asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user!.id);
    const id = Number(req.params.id);
    await addressService.setDefault(id, userId);
    res.json({ code: "0", message: "ok", data: null });
  } catch (error: any) {
    res.json({ code: "400", message: error.message || "设置默认地址失败" });
  }
});