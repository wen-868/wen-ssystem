import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  handler: (req: any, res: any, next: any) => Promise<unknown>
): any {
  return (req: any, res: any, next: any) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
