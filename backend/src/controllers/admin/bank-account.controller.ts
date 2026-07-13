import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as bankAccountService from "../../services/admin/bank-account.service";

export const listBankAccounts = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.listBankAccounts({
    status: req.query.status as string | undefined,
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!
  })));
});

export const getBankAccount = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.getBankAccount(Number(req.params.id), req.tenantId!)));
});

export const createBankAccount = asyncHandler(async (req, res) => {
  const { accountName, bankName, accountNo, accountType, balance } = req.body;
  res.json(ok(await bankAccountService.createBankAccount({ accountName, bankName, accountNo, accountType, balance, tenantId: req.tenantId! })));
});

export const updateBankAccount = asyncHandler(async (req, res) => {
  const { accountName, bankName, accountType } = req.body;
  res.json(ok(await bankAccountService.updateBankAccount(Number(req.params.id), { accountName, bankName, accountType, tenantId: req.tenantId! })));
});

export const freezeBankAccount = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.freezeBankAccount(Number(req.params.id), req.tenantId!)));
});

export const unfreezeBankAccount = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.unfreezeBankAccount(Number(req.params.id), req.tenantId!)));
});

export const closeBankAccount = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.closeBankAccount(Number(req.params.id), req.tenantId!)));
});

export const getTotalBalance = asyncHandler(async (req, res) => {
  res.json(ok(await bankAccountService.getTotalBalance(req.tenantId!)));
});
