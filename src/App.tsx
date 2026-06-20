import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, User, Phone, CheckCircle2, AlertTriangle, AlertCircle, 
  HelpCircle, Sparkles, BookOpen, BarChart3, FileSpreadsheet, 
  MessageSquare, RefreshCw, Smartphone, Mail, Copy, Check, 
  ArrowRight, Download, Laptop, Sun, Moon, Bell, Menu, X, Play,
  Lock, LogIn, UserPlus, LogOut, ShieldCheck
} from 'lucide-react';

import { Language, UserProfile, Invoice, GSTR2BRecord, ReconResult } from './types';
import { translations } from './utils/translations';
import { initialInvoices, initialGSTR2B, initialSupplierRisk, initialNotifications } from './data/mockData';
import AnalyticsCharts from './components/AnalyticsCharts';
import GstAssistant from './components/GstAssistant';
import UploadEngine from './components/UploadEngine';
import {
  loginUser, registerUser, logoutUser, getCurrentUser,
  getInvoices, createInvoice, deleteInvoice, apiCall
} from './api/client';

export default function App() {
  // ============================================================
  // AUTH STATE
  // ============================================================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    email: '', password: '', businessName: '',
    ownerName: '', gstin: '', mobileNumber: ''
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ============================================================
  // APP STATE — no localStorage, defaults to mock data
  // ============================================================
  const [lang, setLang] = useState<Language>('en');
  const [darkTheme, setDarkTheme] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile>({
    businessName: "Gupta Wholesalers & Distributors LLC",
    ownerName: "Shirish Gupta",
    gstin: "27BBBBB2222B2Z2",
    mobileNumber: "9876543210",
    preferredLanguage: "en"
  });

  // Seed with demo mock data — replaced with real data after login
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [gstr2b, setGstr2b] = useState<GSTR2BRecord[]>(initialGSTR2B);
  const [supplierRiskList, setSupplierRiskList] = useState(initialSupplierRisk);
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'recon' | 'suppliers' | 'chat' | 'learning' | 'profile'>('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileToast, setProfileToast] = useState(false);
  const [copiedText, setCopiedText] = useState<{ id: string; type: string } | null>(null);
  const [selectedReconItem, setSelectedReconItem] = useState<ReconResult | null>(null);

  // ============================================================
  // SYNC LANGUAGE WITH PROFILE PREFERENCE
  // ============================================================
  useEffect(() => {
    setLang(profile.preferredLanguage as Language);
  }, [profile.preferredLanguage]);

  // ============================================================
  // AUTH BOOTSTRAP — check JWT token on mount, load real data
  // ============================================================
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    // Validate token and load user profile + real data
    getCurrentUser()
      .then((res: any) => {
        if (res?.data) {
          setIsAuthenticated(true);
          setProfile(prev => ({
            ...prev,
            businessName: res.data.businessName || prev.businessName,
            ownerName: res.data.ownerName || prev.ownerName,
            gstin: res.data.gstin || prev.gstin,
            preferredLanguage: res.data.preferredLanguage || prev.preferredLanguage,
          }));
        }
        // Load real invoices from Supabase
        return getInvoices();
      })
      .then((res: any) => {
        if (res?.data && res.data.length > 0) {
          setInvoices(res.data);
        }
        // Load real GSTR-2B from Supabase
        return apiCall('/gstr2b');
      })
      .then((res: any) => {
        if (res?.data && res.data.length > 0) {
          setGstr2b(res.data);
        }
        // Load real notifications from Supabase
        return apiCall('/notifications');
      })
      .then((res: any) => {
        if (res?.data && res.data.length > 0) {
          setNotifications(res.data);
        }
      })
      .catch(() => {
        // Token invalid/expired — clear it
        sessionStorage.removeItem('auth_token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // ============================================================
  // AUTH HANDLERS
  // ============================================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        const res = await loginUser(authForm.email, authForm.password) as any;
        if (res) {
          setIsAuthenticated(true);
          if (res.user) {
            setProfile(prev => ({
              ...prev,
              businessName: res.user.businessName || prev.businessName,
              ownerName: res.user.ownerName || prev.ownerName,
              gstin: res.user.gstin || prev.gstin,
            }));
          }
          setShowAuthModal(false);
          // Load real data from Supabase after login
          const invRes = await getInvoices() as any;
          if (invRes?.data?.length > 0) setInvoices(invRes.data);
          const gstrRes = await apiCall('/gstr2b') as any;
          if (gstrRes?.data?.length > 0) setGstr2b(gstrRes.data);
          const notifRes = await apiCall('/notifications') as any;
          if (notifRes?.data?.length > 0) setNotifications(notifRes.data);
        }
      } else {
        const res = await registerUser(authForm) as any;
        if (res) {
          setIsAuthenticated(true);
          setShowAuthModal(false);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Check your credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try { await logoutUser(); } catch {}
    sessionStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    // Reset to mock data on logout
    setInvoices(initialInvoices);
    setGstr2b(initialGSTR2B);
    setNotifications(initialNotifications);
    setSupplierRiskList(initialSupplierRisk);
    setProfile({
      businessName: "Gupta Wholesalers & Distributors LLC",
      ownerName: "Shirish Gupta",
      gstin: "27BBBBB2222B2Z2",
      mobileNumber: "9876543210",
      preferredLanguage: "en"
    });
  };

  // --- RECONCILIATION ENGINE ALGORITHM ---
  const [reconciliation, setReconciliation] = useState<ReconResult[]>([]);
  const [reconciling, setReconciling] = useState(false);

  const performReconciliation = () => {
    setReconciling(true);
    setTimeout(() => {
      const reconResults: ReconResult[] = [];
      const invoiceNumbersProcessed = new Set<string>();

      invoices.forEach(inv => {
        // Double-check duplicates
        const isDuplicate = invoices.filter(i => i.invoice_number === inv.invoice_number).length > 1;
        if (isDuplicate && inv.validation_status === 'critical') {
          reconResults.push({
            invoice_number: inv.invoice_number,
            status: 'duplicate_invoice',
            invoiceDetails: inv,
            potentialLoss: inv.total_gst,
            risk: 'high'
          });
          invoiceNumbersProcessed.add(inv.invoice_number);
          return;
        }

        // Match with GSTR-2B
        const matchingGstr = gstr2b.find(g => g.invoice_number === inv.invoice_number);

        if (!matchingGstr) {
          reconResults.push({
            invoice_number: inv.invoice_number,
            status: 'missing_in_gstr2b',
            invoiceDetails: inv,
            potentialLoss: inv.total_gst,
            risk: 'high'
          });
        } else {
          // Compare elements
          if (matchingGstr.supplier_gstin !== inv.supplier_gstin) {
            reconResults.push({
              invoice_number: inv.invoice_number,
              status: 'gstin_mismatch',
              invoiceDetails: inv,
              gstr2bDetails: matchingGstr,
              potentialLoss: inv.total_gst,
              risk: 'high'
            });
          } else if (matchingGstr.hsn_code !== inv.hsn_code) {
            reconResults.push({
              invoice_number: inv.invoice_number,
              status: 'hsn_mismatch',
              invoiceDetails: inv,
              gstr2bDetails: matchingGstr,
              potentialLoss: 2400, // Fixed risk weight or calculation variance
              risk: 'medium'
            });
          } else if (Math.abs(matchingGstr.total_gst - inv.total_gst) > 10) {
            reconResults.push({
              invoice_number: inv.invoice_number,
              status: 'tax_mismatch',
              invoiceDetails: inv,
              gstr2bDetails: matchingGstr,
              potentialLoss: Math.abs(matchingGstr.total_gst - inv.total_gst),
              risk: 'medium'
            });
          } else {
            reconResults.push({
              invoice_number: inv.invoice_number,
              status: 'matched',
              invoiceDetails: inv,
              gstr2bDetails: matchingGstr,
              potentialLoss: 0,
              risk: 'low'
            });
          }
        }
        invoiceNumbersProcessed.add(inv.invoice_number);
      });

      // Find GSTR-2B records that the buyer did NOT upload
      gstr2b.forEach(g => {
        if (!invoiceNumbersProcessed.has(g.invoice_number)) {
          reconResults.push({
            invoice_number: g.invoice_number,
            status: 'supplier_error',
            gstr2bDetails: g,
            potentialLoss: g.total_gst,
            risk: 'medium'
          });
        }
      });

      setReconciliation(reconResults);
      setReconciling(false);
    }, 1000);
  };

  useEffect(() => {
    performReconciliation();
  }, [invoices, gstr2b]);

  const t = translations[lang];

  // --- DYNAMIC CARD VALUES ---
  const totalInvoicesCount = invoices.length;
  const validInvoicesCount = invoices.filter(inv => inv.validation_status === 'valid').length;
  const warningInvoicesCount = invoices.filter(inv => inv.validation_status === 'warning').length;
  const criticalInvoicesCount = invoices.filter(inv => inv.validation_status === 'critical').length;
  const issuesFound = warningInvoicesCount + criticalInvoicesCount;

  const eligibleItc = reconciliation
    .filter(r => r.status === 'matched')
    .reduce((sum, r) => sum + (r.invoiceDetails?.total_gst || 0), 0);

  const blockedItc = reconciliation
    .filter(r => r.status !== 'matched' && r.status !== 'supplier_error')
    .reduce((sum, r) => sum + r.potentialLoss, 0);

  const recoverableItc = reconciliation
    .filter(r => r.status === 'missing_in_gstr2b' || r.status === 'gstin_mismatch')
    .reduce((sum, r) => sum + r.potentialLoss, 0);

  // Compliance scorecard generator
  // Starts with 100, drops points for critical issues, missing matching filings, etc.
  let complianceScore = 100;
  if (totalInvoicesCount > 0) {
    const mismatchCount = reconciliation.filter(r => r.status !== 'matched').length;
    complianceScore = Math.max(24, Math.round(100 - (mismatchCount * 12) - (criticalInvoicesCount * 8)));
  }

  const getHealthCategory = (score: number) => {
    if (score >= 90) return { label: t.excellent, color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    if (score >= 70) return { label: t.good, color: "text-blue-600 bg-blue-50 border-blue-200" };
    if (score >= 50) return { label: t.moderateRisk, color: "text-amber-600 bg-amber-50 border-amber-200" };
    return { label: t.highRisk, color: "text-red-600 bg-red-50 border-red-200" };
  };

  const scoreData = getHealthCategory(complianceScore);

  // --- HELPERS ---
  const handleAddNewInvoice = async (inv: Invoice) => {
    setInvoices(prev => [inv, ...prev]);

    // Persist to Supabase when authenticated
    if (isAuthenticated) {
      try {
        await createInvoice(inv);
      } catch (err) {
        console.warn('⚠️ Failed to persist invoice to Supabase:', err);
      }
    }

    const newNotif = {
      id: "notif-gen-" + Date.now(),
      title: "Invoice Extracted Successfully",
      message: `${inv.supplier_name} invoice details identified. Tax amount is ₹${inv.total_gst.toLocaleString()}.`,
      type: "success" as const,
      date: "Just Now",
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Persist notification to Supabase when authenticated
    if (isAuthenticated) {
      try {
        await apiCall('/notifications', { method: 'POST', body: {
          title: newNotif.title,
          message: newNotif.message,
          type: 'success'
        }});
      } catch {}
    }
  };

  const handleGstr2bSimulationUpload = async (recordsList: any[]) => {
    setGstr2b(prev => [...recordsList, ...prev]);

    // Persist to Supabase when authenticated
    if (isAuthenticated) {
      try {
        await apiCall('/gstr2b', { method: 'POST', body: recordsList });
      } catch (err) {
        console.warn('⚠️ Failed to persist GSTR2B records to Supabase:', err);
      }
    }

    const newNotif = {
      id: "notif-gstr-" + Date.now(),
      title: "GSTR-2B Synced (Portal update)",
      message: "1 new supplier registered. Mismatch resolved automatically, Claimable ITC recovered!",
      type: "success" as const,
      date: "Just Now",
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingProfile(false);

    // Persist to Supabase when authenticated
    if (isAuthenticated) {
      try {
        await apiCall('/profile', {
          method: 'PUT',
          body: {
            businessName: profile.businessName,
            ownerName: profile.ownerName,
            preferredLanguage: profile.preferredLanguage,
            mobileNumber: profile.mobileNumber
          }
        });
      } catch (err) {
        console.warn('⚠️ Failed to update profile on Supabase:', err);
      }
    }

    setProfileToast(true);
    setTimeout(() => setProfileToast(false), 3000);
  };

  const handleRemoveInvoice = async (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));

    // Delete from Supabase when authenticated
    if (isAuthenticated) {
      try {
        await deleteInvoice(id);
      } catch (err) {
        console.warn('⚠️ Failed to delete invoice from Supabase:', err);
      }
    }
  };

  const handleDownloadInvoiceFile = async (id: string, originalFilename: string) => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(`/api/download/invoice/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalFilename || 'invoice');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download invoice file:', err);
      alert('Failed to download invoice file. Please try again.');
    }
  };

  const downloadCsv = (dataList: any[], filename: string) => {
    if (!dataList || dataList.length === 0) return;
    const headers = Object.keys(dataList[0]).join(",");
    const rows = dataList.map(item => 
      Object.values(item).map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, id: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText({ id, type });
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Show full-page loading spinner during auth bootstrap
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20 mx-auto mb-4">
            M
          </div>
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">Loading GST Mitra AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${darkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 1. TOP MARGIN UTILITY HEADERS / STATUS INDICATORS RESTRICTIONS CHECK: No margin logs, Online indicators, or universal credit phrases! Kept strictly elegant. */}
      
      {/* BRAND NAVIGATION HEADER */}
      <nav id="nav-header" className={`sticky top-0 z-40 transition-colors duration-200 border-b border-slate-100 dark:border-slate-800 ${darkTheme ? 'bg-slate-900/90' : 'bg-white/95'} backdrop-blur-md px-6 py-4.5`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
              M
            </div>
            <div>
              <h1 className="text-lg font-black font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-900 to-sky-600 dark:from-white dark:to-sky-400">
                {t.appName}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">{t.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Language Selection switch */}
            <div className="relative inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button 
                onClick={() => setProfile(prev => ({ ...prev, preferredLanguage: 'en' }))}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${lang === 'en' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setProfile(prev => ({ ...prev, preferredLanguage: 'hi' }))}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${lang === 'hi' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                हिं
              </button>
              <button 
                onClick={() => setProfile(prev => ({ ...prev, preferredLanguage: 'mr' }))}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${lang === 'mr' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                मरा
              </button>
              <button 
                onClick={() => setProfile(prev => ({ ...prev, preferredLanguage: 'bn' }))}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${lang === 'bn' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                বাং
              </button>
            </div>

            {/* Dark mode switcher toggle */}
            <button
              onClick={() => setDarkTheme(!darkTheme)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            >
              {darkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Bell Alerts */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 relative transition cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-45 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-855 dark:text-white uppercase tracking-wider">{t.notifications}</h4>
                    <button 
                      onClick={() => {
                        setNotifications(prev => prev.map(n => ({...n, read: true})));
                        setNotifOpen(false);
                        if (isAuthenticated) apiCall('/notifications/read-all', { method: 'PUT' }).catch(() => {});
                      }}
                      className="text-[10px] text-blue-655 font-bold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-3.5 max-h-60 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="text-xs">
                        <div className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            n.type === 'danger' ? 'bg-red-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                          <div>
                            <h5 className="font-bold text-slate-800 dark:text-slate-300">{n.title}</h5>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                            <span className="text-[9px] text-slate-400 font-mono mt-1 block">{n.date}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auth Status: Login button OR user avatar + logout */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <div 
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-150 dark:border-slate-700 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {profile.ownerName.charAt(0)}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-bold text-slate-755 dark:text-slate-200 leading-tight">{profile.ownerName}</p>
                    <p className="text-[10px] text-emerald-500 font-mono tracking-tight font-bold mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" /> Secured
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-500 text-slate-500 dark:text-slate-400 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <div 
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-150 dark:border-slate-700 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {profile.ownerName.charAt(0)}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-bold text-slate-755 dark:text-slate-200 leading-tight">{profile.ownerName}</p>
                    <p className="text-[10px] text-amber-500 font-mono tracking-tight font-bold mt-0.5">Demo Mode</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Sign In
                </button>
              </div>
            )}

          </div>
        </div>
      </nav>

      {/* BODY WRAPPER */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* GUIDED WORKFLOW PROGRESS TRACKER HEADER */}
        <section id="workflow-panel" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-6 rounded-3xl mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold font-display text-slate-800 dark:text-white uppercase tracking-wider">{t.guidedWorkflow}</h2>
              <p className="text-xs text-slate-400">Step-by-step MSME tax recovery milestones</p>
            </div>
            
            <div className="flex items-center gap-2 bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/30">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
              <p className="text-xs text-sky-800 dark:text-sky-300 font-semibold font-mono uppercase tracking-wider">
                {t.nextStepLabel}: <span className="font-black text-blue-900 dark:text-sky-200">
                  {invoices.length < 7 ? t.step1 : gstr2b.length === 0 ? t.step3 : t.step4}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { num: 1, label: t.step1, done: invoices.length > 5 },
              { num: 2, label: t.step2, done: invoices.length > 0 },
              { num: 3, label: t.step3, done: gstr2b.length > 3 },
              { num: 4, label: t.step4, done: reconciliation.length > 0 },
              { num: 5, label: t.step5, done: reconciliation.filter(r => r.status === 'matched').length > 0 },
            ].map((step, idx) => (
              <div 
                key={step.num}
                className={`p-3 rounded-2xl border transition text-center ${
                  step.done 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {step.num}
                  </span>
                  <span className="text-xs font-bold truncate">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* METRICS CORE DASHBOARD */}
        <section id="metrics-panel" className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
          
          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">{t.totalInvoices}</span>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalInvoicesCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-500 uppercase block tracking-wider">{t.validInvoices}</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{validInvoicesCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs">
            <span className="text-[10px] font-bold text-rose-500 uppercase block tracking-wider">{t.issuesFound}</span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{issuesFound}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs">
            <span className="text-[10px] font-bold text-blue-500 uppercase block tracking-wider">{t.eligibleItc}</span>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">₹{eligibleItc.toLocaleString()}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs">
            <span className="text-[10px] font-bold text-red-500 uppercase block tracking-wider">{t.blockedItc}</span>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">₹{blockedItc.toLocaleString()}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs">
            <span className="text-[10px] font-bold text-amber-500 uppercase block tracking-wider">{t.recoverableItc}</span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">₹{recoverableItc.toLocaleString()}</p>
          </div>

          {/* COMPLIANCE HEALTH SCORE VISUAL INDICATOR SPEEDOMETER */}
          <div className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs text-center flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">{t.complianceScore}</span>
            <div className="my-2.5 relative inline-block">
              {/* Circular gauge mock */}
              <div className="w-16 h-16 rounded-full border-4 border-slate-100 dark:border-slate-800 mx-auto flex items-center justify-center relative">
                <span className="text-base font-black text-slate-800 dark:text-white">{complianceScore}</span>
                <span className="text-[10px] text-slate-400 absolute bottom-1 font-bold">/100</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-sm border ${scoreData.color}`}>
              {scoreData.label}
            </span>
          </div>

        </section>

        {/* TOP INTERACTIVE TAB BAR CONTROLLER */}
        <section id="tabs-navigation" className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-4 mb-8">
          {[
            { id: 'dashboard', label: 'Overview Dashboard', icon: BarChart3 },
            { id: 'ledger', label: 'Monthly Ledgers', icon: FileSpreadsheet },
            { id: 'recon', label: 'AI Reconciliation Desk', icon: Sparkles },
            { id: 'suppliers', label: 'Premium Supplier Risks', icon: Building2 },
            { id: 'chat', label: 'CA Chatbot Counsel', icon: MessageSquare },
            { id: 'learning', label: 'GST Learning Center', icon: BookOpen },
            { id: 'profile', label: 'Manage Profile', icon: User },
          ].map(tab => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-850'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </section>

        {/* COMPONENT BODY ROUTINGS */}
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* Upload Invoice Suite integrated natively inside Overview Tab so owners can click instantly! */}
              <UploadEngine 
                lang={lang} 
                onInvoiceAdded={handleAddNewInvoice} 
                onGSTR2BAffected={handleGstr2bSimulationUpload}
                isAuthenticated={isAuthenticated}
              />
              
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-850">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-800 dark:text-white">Compliance Metrics & Analytical Trends</h3>
                    <p className="text-xs text-slate-400">Financial statistics for audits and Input Tax Credit evaluations</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-xs text-slate-500 font-medium">Auto-generated in real-time</span>
                  </div>
                </div>
                
                <AnalyticsCharts 
                  invoices={invoices} 
                  gstr2b={gstr2b} 
                  supplierRiskList={supplierRiskList} 
                />
              </div>

            </div>
          )}

          {/* TAB 2: MONTHLY LEDGERS */}
          {activeTab === 'ledger' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold font-display text-slate-855 dark:text-white">{t.invoiceLedger}</h3>
                  <p className="text-xs text-slate-400">Chronological list of all OCR processed invoice receipts</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => downloadCsv(invoices, "Monthly_Ledger.csv")}
                    className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.downloadExcel}
                  </button>
                  <button
                    onClick={() => downloadCsv(gstr2b, "GSTR2B_Portal_Report.csv")}
                    className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download GSTR2B.csv
                  </button>
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-30 text-sky-500" />
                  <p className="text-xs">{t.noInvoicesYet}</p>
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 uppercase text-[10px] font-bold font-mono tracking-wider">
                        <th className="py-4 px-6">Bill No</th>
                        <th className="py-4 px-6">Date</th>
                        <th className="py-4 px-6">Supplier Entity</th>
                        <th className="py-4 px-6">Supplier GSTIN</th>
                        <th className="py-4 px-6">HSN</th>
                        <th className="py-4 px-6 text-right">Taxable Subtotal</th>
                        <th className="py-4 px-6 text-right">GST Amount</th>
                        <th className="py-4 px-6 text-right">Grand Total</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-slate-700 dark:text-slate-300">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                          <td className="py-4 px-6 font-mono font-bold text-slate-800 dark:text-white truncate max-w-[120px]">{inv.invoice_number}</td>
                          <td className="py-4 px-6 whitespace-nowrap">{inv.invoice_date}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">{inv.supplier_name}</td>
                          <td className="py-4 px-6 font-mono font-medium text-slate-500">{inv.supplier_gstin}</td>
                          <td className="py-4 px-6 font-mono">{inv.hsn_code}</td>
                          <td className="py-4 px-6 text-right font-mono">₹{inv.taxable_amount.toLocaleString()}</td>
                          <td className="py-4 px-6 text-right font-mono text-blue-600 dark:text-sky-400 font-semibold">₹{inv.total_gst.toLocaleString()}</td>
                          <td className="py-4 px-6 text-right font-mono font-black text-slate-800 dark:text-white">₹{inv.grand_total.toLocaleString()}</td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold ${
                              inv.validation_status === 'valid' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' 
                                : inv.validation_status === 'warning'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                            }`}>
                              {inv.validation_status === 'valid' ? (
                                <><CheckCircle2 className="w-2.5 h-2.5" /> Valid</>
                              ) : inv.validation_status === 'warning' ? (
                                <><AlertTriangle className="w-2.5 h-2.5" /> Warn</>
                              ) : (
                                <><AlertCircle className="w-2.5 h-2.5" /> Critical</>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {inv.encrypted_file_path && (
                                <button
                                  onClick={() => handleDownloadInvoiceFile(inv.id, inv.original_filename || 'invoice')}
                                  className="text-slate-400 hover:text-blue-500 p-1.5 rounded transition cursor-pointer"
                                  title="Download Decrypted Invoice File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveInvoice(inv.id)}
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded transition cursor-pointer"
                                title="Delete Record"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI RECONCILIATION DESK */}
          {activeTab === 'recon' && (
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-850">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-855 dark:text-white">{t.reconciliationEngine}</h3>
                    <p className="text-xs text-slate-400">Comparing local invoice files against live Government auto-draft GSTR-2B</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={performReconciliation}
                      disabled={reconciling}
                      className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
                      {t.runRecon}
                    </button>
                    <button
                      onClick={() => downloadCsv(reconciliation, "Mismatches_Audit_Log.csv")}
                      className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Mismatches_Report.csv
                    </button>
                  </div>
                </div>

                {reconciling ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Comparing system databases with portal records...</p>
                  </div>
                ) : reconciliation.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs">{t.allSettled}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Anomaly list */}
                    <div className="lg:col-span-2 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {reconciliation.map((item, idx) => {
                        const styleConfig = item.status === 'matched' 
                          ? { border: 'border-emerald-100 dark:border-emerald-950/20', bg: 'bg-emerald-50/20 dark:bg-emerald-950/5', color: 'text-emerald-800' }
                          : item.status === 'missing_in_gstr2b' || item.status === 'duplicate_invoice'
                          ? { border: 'border-red-150 dark:border-red-950/30', bg: 'bg-red-50/25 dark:bg-red-950/10', color: 'text-red-800' }
                          : { border: 'border-amber-150 dark:border-amber-950/30', bg: 'bg-amber-50/25 dark:bg-amber-950/10', color: 'text-amber-800' };

                        const labelText = t[item.status] || item.status;

                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedReconItem(item)}
                            className={`cursor-pointer p-4 rounded-2xl border transition-all ${styleConfig.bg} ${styleConfig.border} ${
                              selectedReconItem?.invoice_number === item.invoice_number ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                    item.status === 'matched' 
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                      : item.status === 'missing_in_gstr2b'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  }`}>
                                    {labelText}
                                  </span>
                                  <span className="font-mono font-black text-slate-800 dark:text-white">Bill No: {item.invoice_number}</span>
                                </div>
                                <h4 className="font-bold text-slate-700 dark:text-slate-350 mt-1.5">
                                  {item.invoiceDetails?.supplier_name || item.gstr2bDetails?.supplier_name || "Unknown Business Corporate"}
                                </h4>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">{t.potentialLoss}</span>
                                <span className={`font-mono font-black text-sm block ${item.potentialLoss > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  ₹{item.potentialLoss.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Brief explanation under list item */}
                            <p className="text-[11px] text-slate-500 mt-2 line-clamp-1 leading-normal italic">
                              {t[`${item.status}_explanation`] || "Perfect record synchronizations confirmed."}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* CA Explanation & Supplier Communication Generator Panel */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-5 border border-slate-150 dark:border-slate-800 flex flex-col justify-between text-xs">
                      {selectedReconItem ? (
                        <div className="space-y-4">
                          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">CA Diagnostics for Invoice</span>
                            <h4 className="text-sm font-black font-display text-slate-855 dark:text-white mt-1">
                              {selectedReconItem.invoice_number}
                            </h4>
                            <p className="font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                              {selectedReconItem.invoiceDetails?.supplier_name || selectedReconItem.gstr2bDetails?.supplier_name}
                            </p>
                          </div>

                          {/* Loss status */}
                          <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                            <span className="text-[10px] text-rose-500 uppercase tracking-wider font-bold block">{t.potentialLoss}</span>
                            <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                              ₹{selectedReconItem.potentialLoss.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {t.riskLevel}: <strong className="font-bold text-slate-700 dark:text-slate-300 capitalize">{selectedReconItem.risk}</strong>
                            </span>
                          </div>

                          {/* Explained like a CA in custom simple terms */}
                          <div className="space-y-1.5">
                            <h5 className="font-bold text-slate-800 dark:text-slate-200">Explain Like a CA:</h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                              {t[`${selectedReconItem.status}_explanation`] || "Verified matched ledger document."}
                            </p>
                          </div>

                          {/* Recommended Actions */}
                          <div className="space-y-1.5">
                            <h5 className="font-bold text-slate-855 dark:text-slate-200">{t.suggestedAction}:</h5>
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-normal text-slate-655 dark:text-slate-400 text-[11px]">
                              {t[`${selectedReconItem.status}_action`] || "No further step required."}
                              {selectedReconItem.status === 'missing_in_gstr2b' && ` This prevents you from claiming ₹${selectedReconItem.potentialLoss.toLocaleString()} in tax savings.`}
                            </div>
                          </div>

                          {/* AI Supplier Communications Generator */}
                          {selectedReconItem.status !== 'matched' && (
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-4">
                              <h5 className="font-bold text-slate-855 dark:text-white uppercase tracking-wider text-[10px] mb-2">{t.commGen}</h5>
                              
                              <div className="grid grid-cols-2 gap-2">
                                {/* WhatsApp Reminder generator */}
                                <button
                                  onClick={() => {
                                    const text = `Dear ${selectedReconItem.invoiceDetails?.supplier_name || 'Partner'}, this is Shirish Gupta from ${profile.businessName}. We noticed Invoice ${selectedReconItem.invoice_number} for ₹${selectedReconItem.potentialLoss.toLocaleString()} is missing in GSTR-2B. Please file GSTR-1 so we can claim Input Tax Credit (ITC). Thank you.`;
                                    copyToClipboard(text, selectedReconItem.invoice_number, 'wa');
                                  }}
                                  className="cursor-pointer py-2 px-3 bg-slate-900 border border-slate-800 dark:bg-slate-950 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] transition flex items-center justify-center gap-1.5"
                                >
                                  {copiedText?.id === selectedReconItem.invoice_number && copiedText?.type === 'wa' ? (
                                    <><Check className="w-3 h-3 text-emerald-400" /> {t.copied}</>
                                  ) : (
                                    <><Smartphone className="w-3.5 h-3.5 text-emerald-400" /> {t.genWhatsApp}</>
                                  )}
                                </button>

                                {/* Email Draft generator */}
                                <button
                                  onClick={() => {
                                    const text = `Subject: ACTION REQUIRED: GSTR-1 Filing Discrepancy for Invoice ${selectedReconItem.invoice_number}\n\nDear Accounts Team,\n\nOur periodic audit of purchase registers against GSTR-2B via GST Mitra AI has flagged a reconciliation discrepancy regarding Invoice No. ${selectedReconItem.invoice_number}.\n\nThis invoice has not been uploaded/disclosed correctly under our GSTIN (${profile.gstin}), resulting in an immediate Input Tax Credit (ITC) blockage of ₹${selectedReconItem.potentialLoss.toLocaleString()}.\n\nPlease check this immediately and file the correction.\n\nWarm regards,\n${profile.ownerName}\n${profile.businessName}`;
                                    copyToClipboard(text, selectedReconItem.invoice_number, 'email');
                                  }}
                                  className="cursor-pointer py-2 px-3 bg-slate-900 border border-slate-800 dark:bg-slate-950 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] transition flex items-center justify-center gap-1.5"
                                >
                                  {copiedText?.id === selectedReconItem.invoice_number && copiedText?.type === 'email' ? (
                                    <><Check className="w-3 h-3 text-sky-400" /> {t.copied}</>
                                  ) : (
                                    <><Mail className="w-3.5 h-3.5 text-sky-450" /> {t.genEmail}</>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-400 self-center">
                          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-500 animate-pulse" />
                          <p className="text-[11px]">Select any mismatch on the left desk to review granular Chartered Accountant diagnostics</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: PREMIUM SUPPLIER RISKS */}
          {activeTab === 'suppliers' && (
            <div id="supplier-desk" className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-850">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold font-display text-slate-800 dark:text-white">{t.supplierRiskTitle}</h3>
                  <p className="text-xs text-slate-400">Scorecard of corporate vendors based on filing timeline compliance issues</p>
                </div>
                <button
                  onClick={() => downloadCsv(supplierRiskList, "Supplier_Risk_Log.csv")}
                  className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Risk_Report.csv
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {supplierRiskList.map((sup, idx) => {
                  const percentColor = sup.riskScore > 70 
                    ? "text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20" 
                    : sup.riskScore > 30 
                    ? "text-amber-500 bg-amber-50 border-amber-100 dark:bg-amber-950/20" 
                    : "text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20";
                  
                  return (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-44 hover:shadow-xs transition">
                      <div>
                        <div className="flex justify-between items-start gap-2.5">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{sup.name}</h4>
                          <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold border uppercase tracking-wider ${percentColor}`}>
                            {sup.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-1">GSTIN: {sup.gstin}</span>
                      </div>

                      <div className="my-3 flex items-end justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">{t.riskScore}</span>
                          <span className="text-2xl font-black text-slate-855 dark:text-white">{sup.riskScore}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase">Anomalies</span>
                          <span className="font-bold text-slate-700 dark:text-slate-350">{sup.errorCount} / {sup.totalInvoices} bills</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-[10px] leading-relaxed text-slate-500 dark:text-slate-450">
                        {sup.riskScore > 70 
                          ? "Audit Flag: Avoid large advance payments until GSTR-1 files align."
                          : sup.riskScore > 30
                          ? "Moderate Risk: Periodic warnings recommended prior to returns cut-off."
                          : "Preferred Vendor: Spotless electronic filings record verified."}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CA CHATBOT CONSOLE */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto">
              <GstAssistant 
                lang={lang} 
                profile={profile} 
                invoices={invoices} 
                gstr2b={gstr2b} 
                reconciliation={reconciliation} 
              />
            </div>
          )}

          {/* TAB 6: GST LEARNING CENTER & VIDEO TUTORIALS */}
          {activeTab === 'learning' && (
            <div className="space-y-6">
              
              {/* Learning Base Cards header */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-850">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-800 dark:text-white">{t.learningTitle}</h3>
                    <p className="text-xs text-slate-400">Simple breakdowns of micro-compliance for retail store owners</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* FAQs Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white border-l-3 border-blue-600 pl-2.5">GST Core Concepts Simplified</h4>
                    
                    <div className="space-y-3.5 text-xs max-h-[500px] overflow-y-auto pr-1">
                      {[
                        { q: t.tutorial1, a: "To digitize physical receipts, tap the 'Upload Invoices' card on Dashboard, select photos or PDFs from your local mobile photo-library. The engine triggers our server-side secure Gemini 3.5 AI algorithm to perform instant zero-shot structured text readings of HSN codes, dates, billing subtotals, and CGST/SGST parameters." },
                        { q: t.tutorial2, a: "1. Head to official India GST Portal (gst.gov.in).\n2. Login, navigate to Services > Returns > Return Dashboard.\n3. Choose Financial Year and Filing Period.\n4. Click Auto-drafted ITC Statement GSTR-2B > Download as JSON/Excel.\n5. Import that file directly inside GST Mitra AI." },
                        { q: t.tutorial3, a: "When Deccan Cement or other sellers forget to file GSTR-1, the automatic comparison highlights critical loss of ₹89,600. Tapping 'Generate WhatsApp Alert' spits out pre-translated reminders to copy and text to supplier instantly to push correction." },
                        { q: "What is GSTR-1 vs GSTR-3B?", a: "GSTR-1 is your monthly statement of outward supply details (sales bills and tax liability figures). GSTR-3B is your monthly consolidated return summarizing sales, detailing final eligible Input Tax Credit claim sums, and paying the remaining taxes due." }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <h5 className="font-bold text-slate-800 dark:text-slate-250 mb-2 font-display">{item.q}</h5>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{item.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GST Tutorial Video */}
                  <div className="flex flex-col h-full">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white border-l-3 border-sky-500 pl-2.5 mb-4">
                      GST Mitra AI — Tutorial Video
                    </h4>
                    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-black" style={{ paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        src="https://drive.google.com/file/d/1uZFVPMx4tsmbdOM3GZBgCp5FaBfHZ0Yy/preview"
                        className="absolute top-0 left-0 w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        title="GST Mitra AI Tutorial"
                        style={{ border: 'none' }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                      Watch the full tutorial to learn how to use GST Mitra AI effectively
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 7: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-850">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                <div>
                  <h3 className="text-base font-bold font-display text-slate-855 dark:text-white">Business Settings & Audit Profiling</h3>
                  <p className="text-xs text-slate-400">Configure corporate identity for report generations & communications templates</p>
                </div>
                {!isEditingProfile && (
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="cursor-pointer py-1.5 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-305 transition text-xs font-bold rounded-xl"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {profileToast && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs text-center rounded-xl font-bold mb-4 animate-in fade-in slide-in-from-top-1">
                  ✓ Profile Details updated and locked successfully! Downloadable reports now reflect correct entity credentials.
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide block mb-1.5">{t.businessName}</label>
                  <input
                    type="text"
                    disabled={!isEditingProfile}
                    value={profile.businessName}
                    onChange={(e) => setProfile(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-75 focus:border-blue-500 rounded-xl py-2.5 px-3.5 focus:outline-none transition text-slate-800 dark:text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide block mb-1.5">{t.ownerName}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profile.ownerName}
                      onChange={(e) => setProfile(prev => ({ ...prev, ownerName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-75 focus:border-blue-500 rounded-xl py-2.5 px-3.5 focus:outline-none transition text-slate-800 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide block mb-1.5">{t.gstin}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profile.gstin}
                      onChange={(e) => setProfile(prev => ({ ...prev, gstin: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-75 focus:border-blue-500 rounded-xl py-2.5 px-3.5 focus:outline-none transition text-slate-800 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide block mb-1.5">{t.mobileNumber}</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profile.mobileNumber}
                      onChange={(e) => setProfile(prev => ({ ...prev, mobileNumber: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-75 focus:border-blue-500 rounded-xl py-2.5 px-3.5 focus:outline-none transition text-slate-800 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide block mb-1.5">{t.preferredLanguage}</label>
                    <select
                      disabled={!isEditingProfile}
                      value={profile.preferredLanguage}
                      onChange={(e) => setProfile(prev => ({ ...prev, preferredLanguage: e.target.value as Language }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-75 focus:border-blue-500 rounded-xl py-2.5 px-3.5 focus:outline-none transition text-slate-855 dark:text-white font-bold"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="mr">Marathi (मराठी)</option>
                      <option value="bn">Bengali (বাংলা)</option>
                    </select>
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="pt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl transition text-slate-500 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition font-bold"
                    >
                      {t.saveProfile}
                    </button>
                  </div>
                )}

              </form>
            </div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 dark:border-slate-900 mt-16 py-8 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
          <p>© 2026 {t.appName}. Empowering Indian MSMEs to reclaim Input Tax Savings seamlessly.</p>
          <div className="flex items-center gap-4">
            {!isAuthenticated && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-400 font-bold transition"
              >
                <Lock className="w-3 h-3" /> Sign In to Save Data Securely
              </button>
            )}
            <a href="#workflow-panel" className="hover:text-blue-500 transition">Workflows</a>
            <a href="#nav-header" className="hover:text-blue-500 transition">Up</a>
          </div>
        </div>
      </footer>

      {/* ================================================================ */}
      {/* AUTH MODAL — Login / Register                                     */}
      {/* ================================================================ */}
      {showAuthModal && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-sky-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Secure Access</h3>
                    <p className="text-sky-200 text-xs">AES-256-GCM encrypted · JWT authenticated</p>
                  </div>
                </div>
                <button onClick={() => setShowAuthModal(false)} className="text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Login / Register Tab Toggle */}
              <div className="flex mt-5 bg-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    authMode === 'login' ? 'bg-white text-blue-700 shadow' : 'text-white/80 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 inline mr-1.5" />Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    authMode === 'register' ? 'bg-white text-blue-700 shadow' : 'text-white/80 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 inline mr-1.5" />Register
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {authError}
                </div>
              )}

              {authMode === 'register' && (
                <>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Business Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Gupta Wholesalers & Distributors"
                      value={authForm.businessName}
                      onChange={e => setAuthForm(p => ({ ...p, businessName: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Owner Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Shirish Gupta"
                        value={authForm.ownerName}
                        onChange={e => setAuthForm(p => ({ ...p, ownerName: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Mobile</label>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={authForm.mobileNumber}
                        onChange={e => setAuthForm(p => ({ ...p, mobileNumber: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">GSTIN (15 characters)</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      placeholder="27BBBBB2222B2Z2"
                      value={authForm.gstin}
                      onChange={e => setAuthForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="owner@yourbusiness.com"
                  value={authForm.email}
                  onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Password {authMode === 'register' && <span className="text-slate-400">(min. 8 chars, uppercase, number, special)</span>}</label>
                <input
                  type="password"
                  required
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={authMode === 'login' ? '••••••••' : 'Create strong password'}
                  value={authForm.password}
                  onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {authSubmitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                ) : authMode === 'login' ? (
                  <><LogIn className="w-4 h-4" /> Sign In Securely</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create Account</>
                )}
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                <Lock className="w-3 h-3 inline mr-1 text-emerald-500" />
                Your financial data is encrypted with AES-256-GCM and stored in Supabase PostgreSQL with Row Level Security.
              </p>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
