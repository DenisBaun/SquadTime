import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

// Middleware hashes req.body.password (if present) before it reaches handlers
export async function hashPassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body.password === 'string' && req.body.password.length > 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(req.body.password, salt);
      // store hashed password in request for downstream handlers
      req.body.password = hash;
    }
    next();
  } catch (err) {
    next(err as Error);
  }
}

export default hashPassword;