/**
 * PHASE 4: PASSWORD SECURITY & AUTHENTICATION UTILITIES
 * 
 * CRITICAL SECURITY RULES:
 * ❌ NEVER encrypt passwords - they must be HASHED
 * ❌ NEVER store passwords in plaintext
 * ✅ ALWAYS use Argon2id (winner of PHC 2015, recommended by OWASP)
 * ✅ ALWAYS validate passwords on backend
 * ✅ ALWAYS use HTTPS for password transmission
 * 
 * IMPLEMENTATION:
 * - Password hashing: argon2id (PHC winner)
 *   - Memory: 64 MB, Time cost: 3 iterations, Parallelism: 4
 * - Token generation: JWT (JSON Web Tokens)
 * - Token storage: Backend only (never expose to frontend)
 */

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

// Fallback to a demo secret if not provided in .env (for Demo Mode)
const JWT_SECRET = process.env.JWT_SECRET || 'demo-super-secret-key-for-local-testing-only';
const JWT_EXPIRY = '7d'; // 7-day token expiration

if (JWT_SECRET === 'demo-super-secret-key-for-local-testing-only') {
  console.warn('⚠️  WARNING: JWT_SECRET not set in .env. Using fallback demo secret.');
}

/**
 * PASSWORD HASHING - Argon2id (PHC 2015 winner)
 * 
 * Why Argon2id?
 * - Winner of the Password Hashing Competition (PHC) 2015
 * - Recommended by OWASP as the #1 password hashing algorithm
 * - Memory-hard: resistant to GPU/ASIC brute-force attacks
 * - Combines Argon2i (side-channel resistance) and Argon2d (GPU resistance)
 * - Configurable memory, time, and parallelism cost
 * - Automatic salt generation
 * 
 * Parameters used (OWASP recommended minimums for Argon2id):
 * - type: argon2id
 * - memoryCost: 65536 (64 MB)
 * - timeCost: 3 (iterations)
 * - parallelism: 4
 */

/**
 * Hash a password using Argon2id
 * Use this when user registers or changes password
 * 
 * @param password - Raw password from user
 * @returns Promise<string> - Argon2id hashed password (safe to store in DB)
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    if (!password || password.trim().length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Argon2id with OWASP-recommended parameters
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost: 3,        // 3 iterations
      parallelism: 4      // 4 parallel threads
    });
    return hashedPassword;
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error(`Password hashing failed: ${(error as Error).message}`);
  }
}

/**
 * Verify password against hash
 * Use this during login to validate user password
 * 
 * @param password - Raw password from login form
 * @param hash - Stored password hash from database
 * @returns Promise<boolean> - True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) {
      return false;
    }

    const isMatch = await argon2.verify(hash, password);
    return isMatch;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * TOKEN GENERATION - JWT
 */

/**
 * Generate JWT token for authenticated user
 * Store in httpOnly cookie or localStorage (frontend decides)
 * 
 * @param userId - UUID of authenticated user
 * @param email - User email
 * @param gstin - User GSTIN (optional)
 * @returns string - JWT token
 */
export function generateToken(
  userId: string,
  email: string,
  gstin?: string
): string {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured'); // This won't hit anymore due to fallback
    }

    const payload = {
      sub: userId, // subject (user ID)
      email: email,
      gstin: gstin || null,
      iat: Math.floor(Date.now() / 1000), // issued at
      type: 'auth'
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      algorithm: 'HS256'
    });

    return token;
  } catch (error) {
    console.error('Token generation failed:', error);
    throw new Error(`Token generation failed: ${(error as Error).message}`);
  }
}

/**
 * Verify and decode JWT token
 * 
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(token: string): Record<string, any> | null {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });

    return decoded as Record<string, any>;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Expected format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate email format (basic)
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate GSTIN format (15 characters, Indian GST ID)
 * Format: 2 digits (state) + 10 chars (PAN) + 1 char (entity) + 1 char (check)
 */
export function validateGSTIN(gstin: string): boolean {
  // 15 alphanumeric characters
  const gstinRegex = /^[0-9A-Z]{15}$/;
  return gstinRegex.test(gstin);
}

/**
 * Validate mobile number (Indian format)
 */
export function validateMobileNumber(phone: string): boolean {
  // Accept any 10-digit number (with optional +91 or 0 prefix)
  // Accepts standard Indian format (6-9 start) AND test numbers for demo
  const phoneRegex = /^(\+91|0)?\d{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  validateEmail,
  validatePasswordStrength,
  validateGSTIN,
  validateMobileNumber
};
