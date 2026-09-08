import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    phone: string;
    role: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, secret) as unknown as { id: number; phone: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isActive: true, role: true } });
      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied: insufficient permissions' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
  };
};

const MASTER_ADMIN_PHONE = process.env.MASTER_ADMIN_PHONE || '';
const MASTER_ADMIN_EMAIL = (process.env.MASTER_ADMIN_EMAIL || '').toLowerCase();

export interface AuthedUser {
  id: number;
  phone: string;
  role: string;
}

export function isMasterAdmin(user: AuthedUser | undefined): boolean {
  if (!user) return false;
  if (user.role === 'master_admin') return true;
  if (MASTER_ADMIN_PHONE && user.phone === MASTER_ADMIN_PHONE) return true;
  return false;
}

export function isPrivilegedRole(role: string): boolean {
  return role === 'admin' || role === 'master_admin';
}
