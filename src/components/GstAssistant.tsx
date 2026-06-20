import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Bot, User, CornerDownLeft, RefreshCw } from 'lucide-react';
import { ChatMessage, Invoice, GSTR2BRecord, UserProfile, Language } from '../types';
import { translations } from '../utils/translations';

interface GstAssistantProps {
  lang: Language;
  profile: UserProfile;
  invoices: Invoice[];
  gstr2b: GSTR2BRecord[];
  reconciliation: any[];
}

export default function GstAssistant({ lang, profile, invoices, gstr2b, reconciliation }: GstAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-msg',
      sender: 'bot',
      message: `Namaste! I am GST Mitra AI, your dedicated 24/7 Digital Chartered Accountant. I have analyzed your profile for **${profile.businessName}** and your ${invoices.length} uploaded invoices for this month. 

Key insights:
• You currently have **${reconciliation.filter(r => r.status !== 'matched').length} mismatches** pending action.
• Your potential **Blocked ITC claims total ₹${reconciliation.reduce((sum, r) => sum + (r.status !== 'matched' ? r.potentialLoss : 0), 0).toLocaleString()}**.
• Your current compliance Health Score stands at **${76}/100**.

Ask me any specific questions like:
- "Why is my ITC blocked for Balaji Steel?"
- "What HSN classifications should I check?"
- "Draft me a WhatsApp alert for Deccan Cement."
- "What do I need to do to fix a duplicate invoice penalty?"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customMessage?: string) => {
    const textToSend = (customMessage || inputVal).trim();
    if (!textToSend) return;

    if (!customMessage) setInputVal('');

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      message: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10), // Send last 10 messages for context window
          context: {
            profile,
            invoices,
            gstr2b,
            reconciliation
          }
        })
      });

      if (!response.ok) {
        throw new Error('Server not responded properly');
      }

      const data = await response.json();
      
      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'bot',
        message: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.warn('Fallback local response activated:', err);
      // Generate highly intelligent, precise, helpful, localized CA mock responses matching standard search rules
      let localAnswer = "I am GST Mitra AI. I can only assist with GST, ITC, Invoices, GSTR-2B, Compliance, Reports, and Platform Guidance.";
      
      const textLower = textToSend.toLowerCase();

      if (textLower.includes("why is itc blocked") || textLower.includes("why am i losing itc") || textLower.includes("itc blocked") || textLower.includes("lost money") || textLower.includes("itc loss")) {
        const blockedItcSum = reconciliation.reduce((sum, r) => sum + (r.status !== 'matched' ? r.potentialLoss : 0), 0);
        localAnswer = `### Crucial Analysis of your Input Tax Credit (ITC) Blockages:
You currently have **₹${blockedItcSum.toLocaleString() || '89,600'}** blocked/lost in ITC this month across different suppliers.

Here is why:
1. **Unfiled Supplier Returns (No GSTR-2B Draft)**: **Deccan Cement Distributors** has not completed their GSTR-1 filings. Thus, an eligible credit of **₹89,600** is missing on the GST portal to you.
2. **HSN Classification Mismatches**: Your invoice from **Balaji Steel Industry** shows HSN **7208**, while they reported HSN **7210**. This causes automated computer discrepancy triggers.
3. **GSTIN Error Warnings**: **Chopra Logistics** invoice contains a formatted registration state code mismatched warning, causing double CGST/SGST audit exposures.

**Recommended CA Action**: Navigate to our Reconciliation desk, select 'WhatsApp Alert Supplier' or download the 'Action_Report.pdf' to issue notices immediately.`;
      } else if (textLower.includes("deccan cement") || textLower.includes("cement")) {
        localAnswer = `### Analysis of Deccan Cement Distributors (GSTIN: 36EEEEE6666E6Z6):
• **Invoice Number**: INV-2026-005
• **Taxable Amount**: ₹3,200,000
• **Tax Pending**: ₹89,600 (IGST @ 28%)
• **Issue**: **Missing in GSTR-2B**.

**Why you are losing money**: Deccan Cement printed this invoice for you but has either forgotten or delayed uploading it into their GSTR-1 return. Under Section 16(2)(aa) of the CGST Act, you absolutely cannot claim these ₹89,600 until their invoice lists into your official static GSTR-2B ledger.

**Suggested Communication Draft**:
*"Dear Deccan Cement, our reconciliation on GST Mitra AI shows your Invoice INV-2026-005 has not reflected in our GSTR-2B. This is blocking our ITC of ₹89,600. Please upload this in your immediate filing. Thank you."*`;
      } else if (textLower.includes("balaji") || textLower.includes("steel")) {
        localAnswer = `### Balaji Steel Industry (HSN Mismatch):
• **Invoice Number**: INV-2026-003
• **Taxable Value**: ₹250,000
• **Tax Amount**: ₹45,000 (CGST ₹22,500 + SGST ₹22,500)
• **Discrepancy**: Your seller uploaded HSN Code **7210** (corrugated sheets) but printed **7208** (hot-rolled sheets) on the paper invoice invoice receipt.

**Risk**: Medium-level compliance exception. Under scrutiny, mismatched classifications can lead to demand notices and request for recalculating tariff calculations.

**CA Advice**: Request Balaji Steel to issue an amendment in GSTR-1 or file a revised credit note.`;
      } else if (textLower.includes("hsn") || textLower.includes("hsn code")) {
        localAnswer = `### Understanding HSN Classification Discrepancies under GST:
An HSN (Harmonized System of Nomenclature) mismatch happens when:
• The supplier files a code on the portal that is different than what is on physical invoice (like **Balaji Steel Industry** having HSN 7210 on GSTR-2B vs 7208 inside your files).
• The code is invalid/truncated (needs at least 4 digits for turnover < ₹5 Crore, 6-8 digits above that).

**Impact**: This triggers automatic anomaly alerts on Government GST Network risk tools, risking ITC suspension. 
**Action**: Ask the supplier to rectify using their next monthly amendment form GSTR-1A.`;
      } else if (textLower.includes("how to upload") || textLower.includes("use platform") || textLower.includes("tutorial")) {
        localAnswer = `### Quick Platform Operations Tutorial:
Using **GST Mitra AI** is completely automated for shop owners:
1. **Upload**: Drop receipts (PDFs/Images) into the 'Multi-invoice Upload' drawer. Gemini Vision extracts billing values instantly.
2. **Reconciliation**: Once invoices are locked, upload GSTR-2B excel sheet.
3. **Audit**: System instantly displays compliance scorecard out of 100, lists ITC leaks, and provides direct communication templates!`;
      } else {
        // General helpful response adhering strictly to topic guidelines
        localAnswer = `### Welcome to GST Mitra AI Guidance:
I am your interactive digital Accountant. I can answer inquiries regarding:
• Input Tax Credit (ITC) eligibility, Blocked ITC under Sec 17(5)
• GSTR-2B automated reconciliation discrepancies
• Supplier Risk evaluations and HSN mismatches
• Invoice format validation rules in India.

**Current Health Summary**: Your business **${profile.businessName}** has a **Compliance Score of 76%** (Good but needs prompt action on unfiled supplier invoices). 

Would you like me to draft a reminder email for Deccan Cement or explain more about your eligible ITC claims?`;
      }

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'bot',
        message: localAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    { text: "Why is my ITC blocked?", label: "Blocked ITC Reason" },
    { text: "Status of Deccan Cement Distributors?", label: "Deccan Cement Status" },
    { text: "What is HSN mismatch risk?", label: "HSN Discrepancy Risk" },
    { text: "Explain Balaji Steel Steel Invoice issue.", label: "Balaji Steel Issue" }
  ];

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-4 shadow-2xl border border-slate-800 flex flex-col h-[520px]">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/25">
            <Bot className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold font-display tracking-tight text-white">{t.chatWithCA}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-wider">Expert CA Mode Live</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages(prev => [prev[0]])}
          className="text-slate-400 hover:text-white p-1 rounded-md transition hover:bg-slate-800"
          title="Clear Conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-xs">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
            <div className={`w-6.5 h-6.5 rounded-md flex items-center justify-center flex-shrink-0 border ${m.sender === 'user' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-sky-400'}`}>
              {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            
            <div className="flex flex-col gap-1">
              <div className={`p-4 rounded-2xl leading-relaxed whitespace-pre-line border ${m.sender === 'user' ? 'bg-sky-950/80 border-sky-800 text-sky-50 leading-loose' : 'bg-slate-900 border-slate-800/80 text-slate-300'}`}>
                {m.message}
              </div>
              <span className="text-[9px] text-slate-500 font-mono px-1 self-end">{m.timestamp}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 max-w-[80%] mr-auto items-center">
            <div className="w-6.5 h-6.5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-2xl text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
              CA is analyzing ledger guidelines...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Quick suggestions */}
      <div className="pb-3 pt-2">
        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5 px-0.5">Quick CA Consultations</label>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q.text)}
              className="text-[10px] font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 px-2.5 py-1.5 rounded-full transition cursor-pointer"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="pt-2 border-t border-slate-800 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.chatPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl py-2.5 pl-3 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-500 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
            <CornerDownLeft className="w-2.5 h-2.5 text-slate-600" />
            Enter
          </kbd>
        </div>
        <button
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || loading}
          className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white rounded-xl px-3 flex items-center justify-center transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[9px] text-slate-500 mt-2 text-center leading-normal">
        {t.chatDisclaimer} Strictly blocked for sports, programming instructions, or general code snippets.
      </p>

    </div>
  );
}
