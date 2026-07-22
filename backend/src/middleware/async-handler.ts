import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}