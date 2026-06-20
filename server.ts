/**
 * PHASE 10 + 12 + 14: COMPLETE BACKEND API SERVER
 * Security Engineer: Enterprise-grade implementation
 * 
 * Features:
 * - JWT Authentication (register, login, logout, me)
 * - CRUD APIs for invoices, tax records, documents
 * - AES-256-GCM file encryption & storage
 * - Gemini Vision OCR
 * - Audit logging
 * - Input validation & SQL injection prevention
 * - Security hardening (HTTPS headers, CORS, rate limiting)
 */

// Load .env before everything else — ESM-compatible way
import 'dotenv/config';

import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler
} from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

// Security imports
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  validateEmail,
  validateGSTIN,
  validateMobileNumber,
  validatePasswordStrength
} from './src/utils/auth';
import { encrypt, decrypt, encryptBuffer, decryptBuffer } from './src/utils/encryption';

// ─── SUPABASE SERVER CLIENT ───────────────────────────────────────────────────────
// Uses process.env directly (NOT import.meta.env which is Vite-only)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseServer: any = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY &&
    !SUPABASE_SERVICE_KEY.startsWith('REPLACE_WITH')) {
  supabaseServer = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  console.log('✅ Supabase server client initialized');
} else {
  console.warn('⚠️  Supabase not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env to enable database operations.');
}


const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://generativelanguage.googleapis.com'],
      frameSrc: ["'self'", 'https://drive.google.com']
    }
  }
}));

// CORS
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED'
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please wait 15 minutes before trying again.',
      code: 'AUTH_RATE_LIMITED'
    });
  }
});

app.use(limiter);

// Body parser with size limits
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// ============================================================================
// TYPES
// ============================================================================

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    gstin?: string;
  };
}

// ============================================================================
// MIDDLEWARE: JWT AUTHENTICATION
// ============================================================================

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No authorization token provided',
      code: 'MISSING_TOKEN'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  req.user = {
    id: decoded.sub,
    email: decoded.email,
    gstin: decoded.gstin
  };

  next();
};

// ============================================================================
// MIDDLEWARE: ASYNC HANDLER
// ============================================================================

const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

const logAudit = async (
  userId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  status: 'success' | 'failure'
) => {
  try {
    if (!supabaseServer) return;
    await supabaseServer.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      status,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Audit logging failed:', error);
  }
};

// ============================================================================
// ROUTES: HEALTH CHECK
// ============================================================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// ============================================================================
// ROUTES: AUTHENTICATION
// ============================================================================

/**
 * POST /api/auth/register
 */
app.post(
  '/api/auth/register',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      email,
      password,
      businessName,
      ownerName,
      gstin,
      mobileNumber
    } = req.body;

    // Validation
    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
    }

    if (!businessName || !ownerName || !gstin) {
      return res.status(400).json({
        success: false,
        error: 'Business name, owner name, and GSTIN are required'
      });
    }

    if (!validateGSTIN(gstin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GSTIN format'
      });
    }

    if (!validateMobileNumber(mobileNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mobile number'
      });
    }

    if (!supabaseServer) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    try {
      // Check if GSTIN exists
      const { data: existing } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('gstin', gstin)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'GSTIN already registered'
        });
      }

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
        email,
        password,
        email_confirm: false
      });

      if (authError || !authData.user) {
        console.error('❌ Supabase registration error:', authError);
        return res.status(500).json({
          success: false,
          error: authError?.message || 'Failed to create user account'
        });
      }

      // Encrypt phone
      const phoneEncrypted = encrypt(mobileNumber);

      // Create user profile
      const { data: profileData, error: profileError } = await supabaseServer
        .from('user_profiles')
        .insert({
          auth_user_id: authData.user.id,
          email,
          business_name: businessName,
          owner_name: ownerName,
          gstin,
          phone_encrypted: phoneEncrypted.ciphertext,
          phone_iv: phoneEncrypted.iv,
          status: 'active'
        })
        .select()
        .single();

      if (profileError || !profileData) {
        console.error('❌ Supabase profile creation error:', profileError);
        await supabaseServer.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json({
          success: false,
          error: profileError?.message || 'Failed to create user profile'
        });
      }

      // Generate JWT
      const token = generateToken(authData.user.id, email, gstin);

      await logAudit(authData.user.id, 'REGISTER', 'user', authData.user.id, 'success');

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: authData.user.id,
            email,
            businessName,
            gstin
          },
          token
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  })
);

/**
 * POST /api/auth/login
 */
app.post(
  '/api/auth/login',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (!supabaseServer) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    try {
      const { data: profileData, error: profileError } = await supabaseServer
        .from('user_profiles')
        .select('id, auth_user_id, email, gstin, business_name')
        .eq('email', email)
        .limit(1)
        .single();

      if (profileError || !profileData) {
        await logAudit(null, 'LOGIN', 'user', null, 'failure');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const { data: signInData, error: signInError } = await supabaseServer.auth.signInWithPassword({
        email,
        password
      });

      if (signInError || !signInData.user) {
        await logAudit(profileData.auth_user_id, 'LOGIN', 'user', profileData.id, 'failure');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const token = generateToken(profileData.auth_user_id, email, profileData.gstin);

      await supabaseServer
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profileData.id);

      await logAudit(profileData.auth_user_id, 'LOGIN', 'user', profileData.id, 'success');

      res.json({
        success: true,
        data: {
          user: {
            id: profileData.auth_user_id,
            email,
            businessName: profileData.business_name,
            gstin: profileData.gstin
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  })
);

/**
 * GET /api/auth/me
 */
app.get(
  '/api/auth/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    try {
      const { data: profileData, error } = await supabaseServer
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (error || !profileData) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      await logAudit(req.user.id, 'GET_PROFILE', 'user', profileData.id, 'success');

      res.json({
        success: true,
        data: {
          id: profileData.auth_user_id,
          email: profileData.email,
          businessName: profileData.business_name,
          gstin: profileData.gstin,
          complianceScore: profileData.compliance_score
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      });
    }
  })
);

// ============================================================================
// ROUTES: INVOICES (CRUD)
// ============================================================================

/**
 * GET /api/invoices
 */
app.get(
  '/api/invoices',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: invoices, error } = await supabaseServer
        .from('invoices')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      await logAudit(req.user.id, 'LIST_INVOICES', 'invoice', null, 'success');

      res.json({
        success: true,
        data: invoices || [],
        count: invoices?.length || 0
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invoices'
      });
    }
  })
);

/**
 * POST /api/invoices
 */
app.post(
  '/api/invoices',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: invoiceData, error } = await supabaseServer
        .from('invoices')
        .insert({
          user_id: profileData.id,
          invoice_number: req.body.invoice_number,
          invoice_date: req.body.invoice_date,
          supplier_name: req.body.supplier_name,
          supplier_gstin: req.body.supplier_gstin,
          buyer_gstin: req.body.buyer_gstin,
          hsn_code: req.body.hsn_code || null,
          taxable_amount: req.body.taxable_amount,
          cgst: req.body.cgst || 0,
          sgst: req.body.sgst || 0,
          igst: req.body.igst || 0,
          total_gst: req.body.total_gst,
          grand_total: req.body.grand_total,
          validation_status: req.body.validation_status || 'pending',
          source: req.body.source || 'manual',
          status: 'active'
        })
        .select()
        .single();

      if (error || !invoiceData) {
        throw error;
      }

      await logAudit(req.user.id, 'CREATE_INVOICE', 'invoice', invoiceData.id, 'success');

      res.status(201).json({
        success: true,
        data: invoiceData,
        message: 'Invoice created successfully'
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      await logAudit(req.user.id, 'CREATE_INVOICE', 'invoice', null, 'failure');
      res.status(500).json({
        success: false,
        error: 'Failed to create invoice'
      });
    }
  })
);

/**
 * PUT /api/invoices/:id
 */
app.put(
  '/api/invoices/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: invoiceData, error } = await supabaseServer
        .from('invoices')
        .update({
          invoice_number: req.body.invoice_number,
          invoice_date: req.body.invoice_date,
          supplier_name: req.body.supplier_name,
          supplier_gstin: req.body.supplier_gstin,
          buyer_gstin: req.body.buyer_gstin,
          hsn_code: req.body.hsn_code,
          taxable_amount: req.body.taxable_amount,
          cgst: req.body.cgst || 0,
          sgst: req.body.sgst || 0,
          igst: req.body.igst || 0,
          total_gst: req.body.total_gst,
          grand_total: req.body.grand_total,
          validation_status: req.body.validation_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .eq('user_id', profileData.id) // RLS: ensure user owns this invoice
        .select()
        .single();

      if (error || !invoiceData) {
        throw error || new Error('Invoice not found');
      }

      await logAudit(req.user.id, 'UPDATE_INVOICE', 'invoice', req.params.id, 'success');

      res.json({
        success: true,
        data: invoiceData,
        message: 'Invoice updated successfully'
      });
    } catch (error) {
      console.error('Update invoice error:', error);
      await logAudit(req.user.id, 'UPDATE_INVOICE', 'invoice', req.params.id, 'failure');
      res.status(500).json({ success: false, error: 'Failed to update invoice' });
    }
  })
);

/**
 * DELETE /api/invoices/:id
 */
app.delete(
  '/api/invoices/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { error } = await supabaseServer
        .from('invoices')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', profileData.id); // RLS: ensure user owns this invoice

      if (error) throw error;

      await logAudit(req.user.id, 'DELETE_INVOICE', 'invoice', req.params.id, 'success');

      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    } catch (error) {
      console.error('Delete invoice error:', error);
      await logAudit(req.user.id, 'DELETE_INVOICE', 'invoice', req.params.id, 'failure');
      res.status(500).json({ success: false, error: 'Failed to delete invoice' });
    }
  })
);

// ============================================================================
// ROUTES: USER PROFILE
// ============================================================================

/**
 * GET /api/profile
 */
app.get(
  '/api/profile',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData, error } = await supabaseServer
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (error || !profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      res.json({
        success: true,
        data: {
          id: profileData.auth_user_id,
          email: profileData.email,
          businessName: profileData.business_name,
          ownerName: profileData.owner_name,
          gstin: profileData.gstin,
          preferredLanguage: profileData.preferred_language || 'en',
          complianceScore: profileData.compliance_score || 0
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
  })
);

/**
 * PUT /api/profile
 */
app.put(
  '/api/profile',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { businessName, ownerName, preferredLanguage, mobileNumber } = req.body;

    try {
      const updateFields: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (businessName) updateFields.business_name = businessName;
      if (ownerName) updateFields.owner_name = ownerName;
      if (preferredLanguage) updateFields.preferred_language = preferredLanguage;

      // Encrypt phone if provided
      if (mobileNumber) {
        const phoneEncrypted = encrypt(mobileNumber);
        updateFields.phone_encrypted = phoneEncrypted.ciphertext;
        updateFields.phone_iv = phoneEncrypted.iv;
      }

      const { data: profileData, error } = await supabaseServer
        .from('user_profiles')
        .update(updateFields)
        .eq('auth_user_id', req.user.id)
        .select()
        .single();

      if (error || !profileData) {
        throw error || new Error('Profile update failed');
      }

      await logAudit(req.user.id, 'UPDATE_PROFILE', 'user', profileData.id, 'success');

      res.json({
        success: true,
        data: {
          businessName: profileData.business_name,
          ownerName: profileData.owner_name,
          gstin: profileData.gstin,
          preferredLanguage: profileData.preferred_language
        },
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
  })
);

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await logAudit(req.user?.id || null, 'LOGOUT', 'user', null, 'success');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.json({ success: true, message: 'Logged out' });
  }
}));

// ============================================================================
// ROUTES: GSTR-2B RECORDS
// ============================================================================

/**
 * GET /api/gstr2b
 */
app.get(
  '/api/gstr2b',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: records, error } = await supabaseServer
        .from('gstr2b_records')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ success: true, data: records || [], count: records?.length || 0 });
    } catch (error) {
      console.error('Get GSTR2B error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch GSTR2B records' });
    }
  })
);

/**
 * POST /api/gstr2b
 */
app.post(
  '/api/gstr2b',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const records = Array.isArray(req.body) ? req.body : [req.body];

      const insertData = records.map((r: any) => ({
        user_id: profileData.id,
        invoice_number: r.invoice_number,
        supplier_name: r.supplier_name,
        supplier_gstin: r.supplier_gstin,
        hsn_code: r.hsn_code,
        taxable_amount: r.taxable_amount,
        cgst: r.cgst || 0,
        sgst: r.sgst || 0,
        igst: r.igst || 0,
        total_gst: r.total_gst,
        grand_total: r.grand_total
      }));

      const { data: insertedRecords, error } = await supabaseServer
        .from('gstr2b_records')
        .upsert(insertData, { onConflict: 'user_id,invoice_number,supplier_gstin' })
        .select();

      if (error) throw error;

      await logAudit(req.user.id, 'IMPORT_GSTR2B', 'gstr2b', null, 'success');

      res.status(201).json({
        success: true,
        data: insertedRecords,
        message: `${insertedRecords?.length || 0} GSTR-2B records imported`
      });
    } catch (error) {
      console.error('Post GSTR2B error:', error);
      res.status(500).json({ success: false, error: 'Failed to import GSTR2B records' });
    }
  })
);

// ============================================================================
// ROUTES: NOTIFICATIONS
// ============================================================================

/**
 * GET /api/notifications
 */
app.get(
  '/api/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: notifs, error } = await supabaseServer
        .from('notifications')
        .select('*')
        .eq('user_id', profileData.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (notifs || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        date: new Date(n.created_at).toLocaleString(),
        read: n.is_read
      }));

      res.json({ success: true, data: mapped });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  })
);

/**
 * POST /api/notifications
 */
app.post(
  '/api/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: notif, error } = await supabaseServer
        .from('notifications')
        .insert({
          user_id: profileData.id,
          title: req.body.title,
          message: req.body.message,
          type: req.body.type || 'info'
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: notif });
    } catch (error) {
      console.error('Post notification error:', error);
      res.status(500).json({ success: false, error: 'Failed to create notification' });
    }
  })
);

/**
 * PUT /api/notifications/read-all — mark all as read
 */
app.put(
  '/api/notifications/read-all',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      await supabaseServer
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', profileData.id);

      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
    }
  })
);

// ============================================================================
// ROUTES: SUPPLIERS
// ============================================================================

/**
 * GET /api/suppliers
 */
app.get(
  '/api/suppliers',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: suppliers, error } = await supabaseServer
        .from('suppliers')
        .select('*')
        .eq('user_id', profileData.id)
        .order('risk_score', { ascending: false });

      if (error) throw error;

      const mapped = (suppliers || []).map((s: any) => ({
        name: s.supplier_name,
        gstin: s.supplier_gstin,
        riskScore: s.risk_score,
        status: s.risk_level,
        errorCount: s.error_count,
        totalInvoices: s.total_invoices
      }));

      res.json({ success: true, data: mapped });
    } catch (error) {
      console.error('Get suppliers error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
    }
  })
);

// ============================================================================
// ROUTES: GEMINI OCR (Keep existing)
// ============================================================================

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not defined');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'gst-mitra-ai',
        }
      }
    });
  }
  return aiClient;
}

app.post(
  '/api/ocr',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data || !mimeType) {
        return res.status(400).json({
          success: false,
          error: 'Missing invoice base64Data or mimeType'
        });
      }

      const client = getGeminiClient();

      const filePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      };

      const textPart = {
        text: "Perform zero-shot high-accuracy Indian GST Invoice OCR. Analyze fields, calculate CGST (Central Tax), SGST (State/UT Tax), and IGST (Integrated Tax). Sum CGST+SGST or find IGST based on location / GSTIN prefixes. Return JSON data formatted precisely using responseSchema."
      };

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [filePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              invoice_number: { type: Type.STRING },
              invoice_date: { type: Type.STRING },
              supplier_name: { type: Type.STRING },
              supplier_gstin: { type: Type.STRING },
              buyer_gstin: { type: Type.STRING },
              hsn_code: { type: Type.STRING },
              taxable_amount: { type: Type.NUMBER },
              cgst: { type: Type.NUMBER },
              sgst: { type: Type.NUMBER },
              igst: { type: Type.NUMBER },
              total_gst: { type: Type.NUMBER },
              grand_total: { type: Type.NUMBER }
            },
            required: [
              'invoice_number', 'invoice_date', 'supplier_name', 'supplier_gstin',
              'buyer_gstin', 'hsn_code', 'taxable_amount', 'cgst', 'sgst', 'igst',
              'total_gst', 'grand_total'
            ]
          }
        }
      });

      const parsedOutput = JSON.parse((response.text || "{}").trim());

      await logAudit(req.user?.id || null, 'OCR_PROCESS', 'invoice', null, 'success');

      res.json({
        success: true,
        data: parsedOutput
      });
    } catch (error: any) {
      console.error('OCR error:', error);
      await logAudit(req.user?.id || null, 'OCR_PROCESS', 'invoice', null, 'failure');
      res.status(500).json({
        success: false,
        error: error.message || 'OCR processing failed'
      });
    }
  })
);

app.post(
  '/api/chat',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, context } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Missing message payload' });
      }

      const client = getGeminiClient();

      const systemInstruction = `You are GST Mitra AI, an elite Chartered Accountant (CA) bot serving small shop owners, merchants, and MSMEs in India.
    
    STRICT COMPLIANCE DIRECTIVE:
    - You must ONLY answer queries directly concerning Indian Goods and Services Tax (GST), goods categories, HSN classification, Input Tax Credit (ITC), GSTR-1 & GSTR-2B reconciliation parameters, and platform workflows.
    - If a user asks about unrelated topics, respond ONLY with: 'I am GST Mitra AI. I can only assist with GST, ITC, Invoices, GSTR-2B, Compliance, Reports, and Platform Guidance.'
    - Do NOT write software code.`;

      const chatHistory = history
        ? history.map((chatUnit: any) => ({
            role: chatUnit.sender === 'user' ? 'user' : 'model',
            parts: [{ text: chatUnit.message }]
          }))
        : [];

      const contents = [...chatHistory, { role: 'user', parts: [{ text: message }] }];

      const result = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.35,
        }
      });

      const aiResponseText = result.text || "I am GST Mitra AI. How can I assist you?";

      res.json({ success: true, text: aiResponseText });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Chat failed'
      });
    }
  })
);

// ============================================================================
// ROUTES: FILE UPLOAD & DOWNLOAD
// ============================================================================

/**
 * POST /api/upload/invoice
 * Encrypts and uploads invoice file to Supabase Storage
 */
app.post(
  '/api/upload/invoice',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { base64Data, filename, mimeType, invoiceId } = req.body;

    if (!base64Data || !filename || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing file payload (base64Data, filename, or mimeType)'
      });
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'
      });
    }

    if (!supabaseServer) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    try {
      const buffer = Buffer.from(base64Data, 'base64');
      
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds the 10MB limit'
        });
      }

      const encrypted = encryptBuffer(buffer);
      const encryptedFilename = `${crypto.randomUUID()}-${filename}.enc`;
      const storagePath = `invoices/${req.user?.id}/${encryptedFilename}`;
      
      const { error: uploadError } = await supabaseServer.storage
        .from('invoice-files')
        .upload(storagePath, Buffer.from(encrypted.ciphertext, 'base64'), {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const fileMetadata = {
        original_filename: filename,
        encrypted_file_path: storagePath,
        encrypted_file_iv: encrypted.iv,
        file_mime_type: mimeType,
        file_size_bytes: buffer.length
      };

      if (invoiceId) {
        const { data: profileData } = await supabaseServer
          .from('user_profiles')
          .select('id')
          .eq('auth_user_id', req.user?.id)
          .limit(1)
          .single();

        if (profileData) {
          await supabaseServer
            .from('invoices')
            .update({
              original_filename: fileMetadata.original_filename,
              encrypted_file_path: fileMetadata.encrypted_file_path,
              encrypted_file_iv: fileMetadata.encrypted_file_iv,
              file_mime_type: fileMetadata.file_mime_type,
              file_size_bytes: fileMetadata.file_size_bytes
            })
            .eq('id', invoiceId)
            .eq('user_id', profileData.id);
        }
      }

      await logAudit(req.user?.id || null, 'UPLOAD_INVOICE_FILE', 'invoice', invoiceId || null, 'success');

      res.status(200).json({
        success: true,
        data: fileMetadata,
        message: 'Invoice file encrypted and stored successfully'
      });
    } catch (error: any) {
      console.error('Invoice file upload error:', error);
      await logAudit(req.user?.id || null, 'UPLOAD_INVOICE_FILE', 'invoice', invoiceId || null, 'failure');
      res.status(500).json({
        success: false,
        error: error.message || 'File upload failed'
      });
    }
  })
);

/**
 * GET /api/download/invoice/:id
 * Fetches encrypted file from storage, decrypts it, and serves it
 */
app.get(
  '/api/download/invoice/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: invoice, error: dbError } = await supabaseServer
        .from('invoices')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', profileData.id)
        .single();

      if (dbError || !invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found or file not associated'
        });
      }

      if (!invoice.encrypted_file_path || !invoice.encrypted_file_iv) {
        return res.status(404).json({
          success: false,
          error: 'No file exists for this invoice'
        });
      }

      const { data: fileData, error: storageError } = await supabaseServer.storage
        .from('invoice-files')
        .download(invoice.encrypted_file_path);

      if (storageError || !fileData) {
        throw storageError || new Error('Could not download file from storage');
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const encryptedBuffer = Buffer.from(arrayBuffer);
      const decrypted = decryptBuffer(encryptedBuffer.toString('base64'), invoice.encrypted_file_iv);

      await logAudit(req.user.id, 'DOWNLOAD_INVOICE_FILE', 'invoice', invoice.id, 'success');

      res.setHeader('Content-Type', invoice.file_mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(invoice.original_filename || 'invoice')}"`
      );
      res.send(decrypted);
    } catch (error: any) {
      console.error('File download/decryption error:', error);
      await logAudit(req.user?.id || null, 'DOWNLOAD_INVOICE_FILE', 'invoice', req.params.id, 'failure');
      res.status(500).json({
        success: false,
        error: error.message || 'File download/decryption failed'
      });
    }
  })
);

// ============================================================================
// ROUTES: TAX RECORDS (CRUD)
// ============================================================================

/**
 * GET /api/tax-records
 */
app.get(
  '/api/tax-records',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: records, error } = await supabaseServer
        .from('tax_records')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ success: true, data: records || [], count: records?.length || 0 });
    } catch (error) {
      console.error('Get tax records error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tax records' });
    }
  })
);

/**
 * POST /api/tax-records
 */
app.post(
  '/api/tax-records',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: record, error } = await supabaseServer
        .from('tax_records')
        .insert({
          user_id: profileData.id,
          financial_year: req.body.financial_year,
          assessment_year: req.body.assessment_year || null,
          taxable_income: req.body.taxable_income || 0,
          total_tax_amount: req.body.total_tax_amount || 0,
          cgst_amount: req.body.cgst_amount || 0,
          sgst_amount: req.body.sgst_amount || 0,
          igst_amount: req.body.igst_amount || 0,
          total_gst_amount: req.body.total_gst_amount || 0,
          eligible_itc: req.body.eligible_itc || 0,
          blocked_itc: req.body.blocked_itc || 0,
          claimed_itc: req.body.claimed_itc || 0,
          status: req.body.status || 'draft',
          return_type: req.body.return_type || null,
          notes: req.body.notes || null,
          filing_date: req.body.filing_date || null
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit(req.user.id, 'CREATE_TAX_RECORD', 'tax_record', record.id, 'success');

      res.status(201).json({ success: true, data: record, message: 'Tax record created successfully' });
    } catch (error) {
      console.error('Create tax record error:', error);
      res.status(500).json({ success: false, error: 'Failed to create tax record' });
    }
  })
);

/**
 * PUT /api/tax-records/:id
 */
app.put(
  '/api/tax-records/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: record, error } = await supabaseServer
        .from('tax_records')
        .update({
          financial_year: req.body.financial_year,
          assessment_year: req.body.assessment_year,
          taxable_income: req.body.taxable_income,
          total_tax_amount: req.body.total_tax_amount,
          cgst_amount: req.body.cgst_amount,
          sgst_amount: req.body.sgst_amount,
          igst_amount: req.body.igst_amount,
          total_gst_amount: req.body.total_gst_amount,
          eligible_itc: req.body.eligible_itc,
          blocked_itc: req.body.blocked_itc,
          claimed_itc: req.body.claimed_itc,
          status: req.body.status,
          return_type: req.body.return_type,
          notes: req.body.notes,
          filing_date: req.body.filing_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .eq('user_id', profileData.id)
        .select()
        .single();

      if (error) throw error;

      await logAudit(req.user.id, 'UPDATE_TAX_RECORD', 'tax_record', req.params.id, 'success');

      res.json({ success: true, data: record, message: 'Tax record updated successfully' });
    } catch (error) {
      console.error('Update tax record error:', error);
      res.status(500).json({ success: false, error: 'Failed to update tax record' });
    }
  })
);

/**
 * DELETE /api/tax-records/:id
 */
app.delete(
  '/api/tax-records/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { error } = await supabaseServer
        .from('tax_records')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', profileData.id);

      if (error) throw error;

      await logAudit(req.user.id, 'DELETE_TAX_RECORD', 'tax_record', req.params.id, 'success');

      res.json({ success: true, message: 'Tax record deleted successfully' });
    } catch (error) {
      console.error('Delete tax record error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete tax record' });
    }
  })
);

// ============================================================================
// ROUTES: TAX DOCUMENTS (CRUD & FILE STORAGE)
// ============================================================================

/**
 * GET /api/documents
 */
app.get(
  '/api/documents',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: docs, error } = await supabaseServer
        .from('tax_documents')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ success: true, data: docs || [], count: docs?.length || 0 });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
  })
);

/**
 * POST /api/documents
 */
app.post(
  '/api/documents',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { base64Data, filename, mimeType, documentType, financialYear, description, tags } = req.body;

    if (!base64Data || !filename || !mimeType || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing document payload (base64Data, filename, mimeType, and documentType are required)'
      });
    }

    if (!supabaseServer) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds the 10MB limit'
        });
      }

      const encrypted = encryptBuffer(buffer);
      const encryptedFilename = `${crypto.randomUUID()}-${filename}.enc`;
      const storagePath = `documents/${req.user.id}/${encryptedFilename}`;
      
      const { error: uploadError } = await supabaseServer.storage
        .from('tax-documents')
        .upload(storagePath, Buffer.from(encrypted.ciphertext, 'base64'), {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: doc, error: dbError } = await supabaseServer
        .from('tax_documents')
        .insert({
          user_id: profileData.id,
          document_type: documentType,
          document_name: filename.replace(/\.[^/.]+$/, ""),
          original_filename: filename,
          encrypted_file_path: storagePath,
          encrypted_file_iv: encrypted.iv,
          file_mime_type: mimeType,
          file_size_bytes: buffer.length,
          financial_year: financialYear || null,
          description: description || null,
          tags: tags || null
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await logAudit(req.user.id, 'UPLOAD_DOCUMENT', 'document', doc.id, 'success');

      res.status(201).json({
        success: true,
        data: doc,
        message: 'Document encrypted and uploaded successfully'
      });
    } catch (error: any) {
      console.error('Document upload error:', error);
      await logAudit(req.user?.id || null, 'UPLOAD_DOCUMENT', 'document', null, 'failure');
      res.status(500).json({ success: false, error: error.message || 'Failed to upload document' });
    }
  })
);

/**
 * GET /api/documents/download/:id
 */
app.get(
  '/api/documents/download/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: doc, error: dbError } = await supabaseServer
        .from('tax_documents')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', profileData.id)
        .single();

      if (dbError || !doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      const { data: fileData, error: storageError } = await supabaseServer.storage
        .from('tax-documents')
        .download(doc.encrypted_file_path);

      if (storageError || !fileData) {
        throw storageError || new Error('Could not download file from storage');
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const encryptedBuffer = Buffer.from(arrayBuffer);
      const decrypted = decryptBuffer(encryptedBuffer.toString('base64'), doc.encrypted_file_iv);

      await logAudit(req.user.id, 'DOWNLOAD_DOCUMENT', 'document', doc.id, 'success');

      res.setHeader('Content-Type', doc.file_mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(doc.original_filename)}"`
      );
      res.send(decrypted);
    } catch (error: any) {
      console.error('Document download error:', error);
      await logAudit(req.user?.id || null, 'DOWNLOAD_DOCUMENT', 'document', req.params.id, 'failure');
      res.status(500).json({ success: false, error: error.message || 'Failed to download document' });
    }
  })
);

/**
 * DELETE /api/documents/:id
 */
app.delete(
  '/api/documents/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id || !supabaseServer) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { data: profileData } = await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', req.user.id)
        .limit(1)
        .single();

      if (!profileData) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      const { data: doc, error: fetchError } = await supabaseServer
        .from('tax_documents')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', profileData.id)
        .single();

      if (fetchError || !doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      const { error: dbError } = await supabaseServer
        .from('tax_documents')
        .delete()
        .eq('id', req.params.id);

      if (dbError) throw dbError;

      await supabaseServer.storage
        .from('tax-documents')
        .remove([doc.encrypted_file_path]);

      await logAudit(req.user.id, 'DELETE_DOCUMENT', 'document', req.params.id, 'success');

      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Delete document error:', error);
      await logAudit(req.user?.id || null, 'DELETE_DOCUMENT', 'document', req.params.id, 'failure');
      res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
  })
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
};



// ============================================================================
// VITE & SERVER STARTUP
// ============================================================================

async function ensureBucketExists(bucketName: string) {
  if (!supabaseServer) return;
  try {
    const { data: buckets, error: listError } = await supabaseServer.storage.listBuckets();
    
    if (listError) {
      console.warn(`\n⚠️  STORAGE INITIALIZATION WARNING: Could not list buckets (${listError.message})`);
      console.warn(`👉 Check if SUPABASE_SERVICE_ROLE_KEY in your .env file is the secret "service_role" key, NOT the public "anon" key.\n`);
      return;
    }

    const exists = buckets?.some((b: any) => b.name === bucketName);
    if (!exists) {
      const { error } = await supabaseServer.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024
      });
      if (error) {
        console.warn(`⚠️  Could not create bucket ${bucketName}:`, error.message);
        if (error.message.includes('violates row-level security policy')) {
          console.warn(`👉 This confirms your SUPABASE_SERVICE_ROLE_KEY key does not bypass RLS. Please ensure you are using the actual service_role secret key.`);
        }
      } else {
        console.log(`✅ Storage bucket "${bucketName}" created successfully.`);
      }
    } else {
      console.log(`✅ Storage bucket "${bucketName}" verified.`);
    }
  } catch (err) {
    console.warn(`⚠️  Error ensuring bucket ${bucketName} exists:`, err);
  }
}

async function start() {
  // Ensure storage buckets exist
  await ensureBucketExists('invoice-files');
  await ensureBucketExists('tax-documents');

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    // Serve index.html for all non-API paths in development mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        console.error(e);
        res.status(500).end(e.message);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Register 404 and Error Handler at the very end of the pipeline
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`\n✅ GST Mitra AI Server ready on port ${PORT}`);
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🔐 Encryption: AES-256-GCM`);
    console.log(`🎫 Authentication: JWT`);
    console.log(`🗄️  Database: Supabase PostgreSQL + RLS\n`);
  });
}

start().catch(err => {
  console.error('Server startup failed:', err);
  process.exit(1);
});

export default app;
