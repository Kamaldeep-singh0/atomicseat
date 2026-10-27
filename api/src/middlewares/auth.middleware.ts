import { Request, Response, NextFunction } from 'express';
import { authService, UserTokenPayload } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // 1. Check for simulated user header (used by rush simulator / load tests)
  const simulatedUserId = req.headers['x-simulated-user-id'] as string;
  if (simulatedUserId) {
    req.user = {
      id: simulatedUserId,
      email: `simulated-${simulatedUserId}@atomicseat.local`,
      name: `Rush User ${simulatedUserId.slice(0, 6)}`,
      role: 'user',
    };
    return next();
  }

  // 2. Standard Authorization header Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    return next();
  } catch (err) {
    return next();
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin privileges required' });
    return;
  }
  next();
}
