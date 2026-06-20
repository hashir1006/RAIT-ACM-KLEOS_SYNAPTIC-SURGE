/**
 * PHASE 13: FRONTEND MIGRATION - API INTEGRATION
 * 
 * Changes from localStorage to Supabase PostgreSQL:
 * 1. Remove all localStorage.getItem() and localStorage.setItem()
 * 2. Replace with API calls to backend
 * 3. Use JWT tokens for authentication
 * 4. Store JWT in sessionStorage (read-only, not persisted to DB)
 * 5. Keep UI state in React state only
 * 6. Fetch fresh data from API on component mount
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * API SERVICE UTILITIES
 * Handles all backend communication with JWT authentication
 */

interface APIOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL)
  || (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_API_URL)
  || 'http://localhost:3000/api';

/**
 * Get JWT token from sessionStorage
 */
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('auth_token');
  }
  return null;
}

/**
/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

/**
 * Generic API call helper
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: APIOptions = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Token expired or invalid for protected routes — clear it
      sessionStorage.removeItem('auth_token');
      throw new Error('Session expired. Please sign in again.');
    }
    // Safely parse error — server might return plain text (e.g. from middleware)
    let errorMessage = 'API call failed';
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      // Response was not JSON (e.g. rate limiter plain text)
      try {
        const text = await response.text();
        if (text && text.length < 200) errorMessage = text;
      } catch { /* ignore */ }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Authentication API Functions
 */

export async function registerUser(data: {
  email: string;
  password: string;
  businessName: string;
  ownerName: string;
  gstin: string;
  mobileNumber: string;
}) {
  const response = await apiCall('/auth/register', {
    method: 'POST',
    body: data
  });
  
  if (response.data?.token) {
    sessionStorage.setItem('auth_token', response.data.token);
  }
  
  return response.data;
}

export async function loginUser(email: string, password: string) {
  const response = await apiCall('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  
  if (response.data?.token) {
    sessionStorage.setItem('auth_token', response.data.token);
  }
  
  return response.data;
}

export async function getCurrentUser() {
  return apiCall('/auth/me');
}

export async function logoutUser() {
  sessionStorage.removeItem('auth_token');
  return apiCall('/auth/logout', { method: 'POST' });
}

/**
 * Invoice API Functions
 */

export async function getInvoices() {
  return apiCall('/invoices');
}

export async function createInvoice(data: any) {
  return apiCall('/invoices', {
    method: 'POST',
    body: data
  });
}

export async function updateInvoice(id: string, data: any) {
  return apiCall(`/invoices/${id}`, {
    method: 'PUT',
    body: data
  });
}

export async function deleteInvoice(id: string) {
  return apiCall(`/invoices/${id}`, {
    method: 'DELETE'
  });
}

export async function processOCR(base64Data: string, mimeType: string) {
  return apiCall('/ocr', {
    method: 'POST',
    body: { base64Data, mimeType }
  });
}

export async function sendChatMessage(message: string, history: any[], context: any) {
  return apiCall('/chat', {
    method: 'POST',
    body: { message, history, context }
  });
}

/**
 * CUSTOM HOOKS FOR API DATA MANAGEMENT
 */

/**
 * useAuth: Manage authentication state and JWT token
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current user if token exists
    const token = getAuthToken();
    if (token) {
      getCurrentUser()
        .then(response => {
          setUser(response.data);
          setError(null);
        })
        .catch(err => {
          setError(err.message);
          sessionStorage.removeItem('auth_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: any) => {
    try {
      setLoading(true);
      const userData = await registerUser(data);
      setUser(userData.user);
      return userData;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const userData = await loginUser(email, password);
      setUser(userData.user);
      return userData;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setUser(null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const isAuthenticated = !!getAuthToken() && !!user;

  return {
    user,
    isAuthenticated,
    loading,
    error,
    register,
    login,
    logout
  };
}

/**
 * useInvoices: Manage invoice data with API
 */
export function useInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getInvoices();
      setInvoices(response.data || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addInvoice = useCallback(async (invoiceData: any) => {
    try {
      setLoading(true);
      const response = await createInvoice(invoiceData);
      setInvoices(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInvoiceData = useCallback(async (id: string, data: any) => {
    try {
      setLoading(true);
      const response = await updateInvoice(id, data);
      setInvoices(prev =>
        prev.map(inv => (inv.id === id ? response.data : inv))
      );
      return response.data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteInvoiceData = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await deleteInvoice(id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch invoices on mount
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      fetchInvoices();
    }
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    addInvoice,
    updateInvoiceData,
    deleteInvoiceData
  };
}

/**
 * useTaxRecords: Manage tax records data with API
 */
export function useTaxRecords() {
  const [taxRecords, setTaxRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall('/tax-records');
      setTaxRecords(response.data || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTaxRecord = useCallback(async (recordData: any) => {
    try {
      setLoading(true);
      const response = await apiCall('/tax-records', {
        method: 'POST',
        body: recordData
      });
      setTaxRecords(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTaxRecordData = useCallback(async (id: string, data: any) => {
    try {
      setLoading(true);
      const response = await apiCall(`/tax-records/${id}`, {
        method: 'PUT',
        body: data
      });
      setTaxRecords(prev =>
        prev.map(rec => (rec.id === id ? response.data : rec))
      );
      return response.data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTaxRecordData = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await apiCall(`/tax-records/${id}`, {
        method: 'DELETE'
      });
      setTaxRecords(prev => prev.filter(rec => rec.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      fetchTaxRecords();
    }
  }, [fetchTaxRecords]);

  return {
    taxRecords,
    loading,
    error,
    fetchTaxRecords,
    addTaxRecord,
    updateTaxRecordData,
    deleteTaxRecordData
  };
}

/**
 * useDocuments: Manage tax documents data and secure file storage
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall('/documents');
      setDocuments(response.data || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDoc = useCallback(async (docData: {
    base64Data: string;
    filename: string;
    mimeType: string;
    documentType: string;
    financialYear?: string;
    description?: string;
    tags?: string;
  }) => {
    try {
      setLoading(true);
      const response = await apiCall('/documents', {
        method: 'POST',
        body: docData
      });
      setDocuments(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDoc = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await apiCall(`/documents/${id}`, {
        method: 'DELETE'
      });
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      fetchDocuments();
    }
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    uploadDoc,
    deleteDoc
  };
}

export default {
  apiCall,
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  processOCR,
  sendChatMessage,
  useAuth,
  useInvoices,
  useTaxRecords,
  useDocuments
};
