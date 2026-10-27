import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { config } from '../config/index.js';

export interface UserTokenPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export class AuthService {
  async register(
    email: string,
    password: string,
    name: string,
    role: 'admin' | 'user' = 'user'
  ) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new Error('A user with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
    });

    const token = this.generateToken(user);
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user);
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  generateToken(user: IUser): string {
    const payload: UserTokenPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): UserTokenPayload {
    return jwt.verify(token, config.jwtSecret) as UserTokenPayload;
  }
}

export const authService = new AuthService();
