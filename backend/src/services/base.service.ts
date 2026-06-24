import { BaseDAO } from "../daos/base.dao.js";
import type { ServiceContext, PageParams, PageResult, ListQuery } from "../types/index.js";

export class BaseService<T = any> {
  protected dao: BaseDAO<T>;

  constructor(dao: BaseDAO<T>) {
    this.dao = dao;
  }

  async getById(id: number | string, ctx: ServiceContext): Promise<T | null> {
    return this.dao.findById(id, ctx.tenantId);
  }

  async getList(where: Record<string, any> = {}, ctx: ServiceContext, orderBy?: string): Promise<T[]> {
    return this.dao.findList(where, ctx.tenantId, orderBy);
  }

  async getPage(
    query: ListQuery,
    where: Record<string, any>,
    ctx: ServiceContext,
    orderBy?: string
  ): Promise<PageResult<T>> {
    const pageParams: PageParams = {
      page: Number(query.page) || 1,
      pageSize: Number(query.pageSize) || 20,
    };
    return this.dao.findPage(where, pageParams, ctx.tenantId, orderBy);
  }

  async create(data: Record<string, any>, ctx: ServiceContext): Promise<{ id: number }> {
    const result = await this.dao.insert(data, ctx.tenantId);
    return { id: result.insertId };
  }

  async update(id: number | string, data: Record<string, any>, ctx: ServiceContext): Promise<boolean> {
    const affected = await this.dao.update(id, data, ctx.tenantId);
    return affected > 0;
  }

  async remove(id: number | string, ctx: ServiceContext): Promise<boolean> {
    const affected = await this.dao.delete(id, ctx.tenantId);
    return affected > 0;
  }

  async count(where: Record<string, any> = {}, ctx: ServiceContext): Promise<number> {
    return this.dao.count(where, ctx.tenantId);
  }
}
