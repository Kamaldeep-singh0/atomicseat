import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[API Error]', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.message,
    });
    return;
  }

  if (err.code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate Key / Invariant Conflict',
      details: err.keyValue,
    });
    return;
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
}
