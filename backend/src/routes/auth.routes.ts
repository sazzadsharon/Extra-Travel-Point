import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '';

const registerSchema = z.object({
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  phone: z.string(),
  password: z.string()
});

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { phone, email, fullName, password } = parse.data;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        phone,
        email,
        fullName,
        passwordHash,
        role: 'customer'
      }
    });

    const accessToken = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Set refresh token as HttpOnly cookie (not accessible via JavaScript)
    res.cookie('etp_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth'
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { phone, password } = parse.data;
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const accessToken = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Set refresh token as HttpOnly cookie (not accessible via JavaScript)
    res.cookie('etp_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth'
    });

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  // Support both cookie and body for backward compatibility
  const refreshToken = req.cookies?.etp_refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: number };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newAccessToken = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Set new refresh token as HttpOnly cookie
    res.cookie('etp_refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth'
    });

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res) => {
  // Clear the refresh token cookie
  res.clearCookie('etp_refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth'
  });

  return res.json({ message: 'Logged out successfully' });
});

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'phone and otp are required' });
  }
  return res.status(501).json({ error: 'OTP verification is not configured. Connect an SMS provider to enable this endpoint.' });
});

export default router;
