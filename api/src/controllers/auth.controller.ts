import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !password || !name) {
        res.status(400).json({ success: false, error: 'Email, password, and name are required' });
        return;
      }

      const result = await authService.register(email, password, name, role || 'user');
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Email and password are required' });
        return;
      }

      const result = await authService.login(email, password);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  }

  async me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    res.status(200).json({ success: true, data: req.user });
  }
}

export const authController = new AuthController();
