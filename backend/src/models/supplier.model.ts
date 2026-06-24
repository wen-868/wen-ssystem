export interface Supplier {
  id: number;
  supplierCode: string;
  name: string;
  shortName?: string;
  supplyType?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  creditLevel: string;
  settlementType: string;
  settlementDay?: number;
  taxRate: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  status: number;
  remark?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContact {
  id: number;
  supplierId: number;
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  isPrimary: boolean;
  position?: string;
  remark?: string;
  createdAt: string;
}

export interface SupplierListVO extends Supplier {
  contactPerson?: string;
  phone?: string;
}

export interface SupplierDetailVO extends Supplier {
  contacts: SupplierContact[];
}

export interface SupplierStatsVO {
  totalOrders: number;
  pendingOrders: number;
  approvedOrders: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  productCount: number;
}

export interface CreateSupplierDTO {
  name: string;
  shortName?: string;
  supplyType?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  creditLevel?: string;
  settlementType?: string;
  settlementDay?: number;
  taxRate?: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  remark?: string;
  contactPerson?: string;
  contactMobile?: string;
  contactPhone?: string;
}

export interface UpdateSupplierDTO extends Partial<CreateSupplierDTO> {
  status?: number;
}

export interface CreateContactDTO {
  name: string;
  mobile?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  isPrimary?: boolean;
  position?: string;
  remark?: string;
}
