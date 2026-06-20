import { Invoice, GSTR2BRecord, SupplierRisk, SmartNotification } from '../types';

export const initialInvoices: Invoice[] = [
  {
    id: "inv-001",
    invoice_number: "INV-2026-001",
    invoice_date: "2026-06-03",
    supplier_name: "Aman Electronics & Wholesalers",
    supplier_gstin: "27AAAAA1111A1Z1",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "8517", // Mobile devices & phones
    taxable_amount: 120000,
    cgst: 10800,
    sgst: 10800,
    igst: 0,
    total_gst: 21600,
    grand_total: 141600,
    validation_status: "valid",
    validation_errors: []
  },
  {
    id: "inv-002",
    invoice_number: "INV-2026-002",
    invoice_date: "2026-06-05",
    supplier_name: "Apex Trading Corporation",
    supplier_gstin: "07VVVVV3333V3Z3",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "8471", // Computers / processors
    taxable_amount: 85000,
    cgst: 0,
    sgst: 0,
    igst: 15300,
    total_gst: 15300,
    grand_total: 100300,
    validation_status: "valid",
    validation_errors: []
  },
  {
    id: "inv-003",
    invoice_number: "INV-2026-003",
    invoice_date: "2026-06-08",
    supplier_name: "Balaji Steel Industry",
    supplier_gstin: "27CCCCC4444C4Z4",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "7208", // Flat-rolled iron or steel
    taxable_amount: 250000,
    cgst: 22500,
    sgst: 22500,
    igst: 0,
    total_gst: 45000,
    grand_total: 295000,
    validation_status: "warning",
    validation_errors: [
      "HSN Code in GSTR-2B represents 7210. Invoice has 7208"
    ]
  },
  {
    id: "inv-004",
    invoice_number: "INV-2026-004",
    invoice_date: "2026-06-11",
    supplier_name: "Chopra Logistics Pvt Ltd",
    supplier_gstin: "27DDDDD5555D5Z5",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "9965", // Goods transport services
    taxable_amount: 42000,
    cgst: 3780,
    sgst: 3780,
    igst: 0,
    total_gst: 7560,
    grand_total: 49560,
    validation_status: "critical",
    validation_errors: [
      "GSTIN format on invoice is invalid or missing state-code digits",
      "Calculated GST (CGST/SGST 9%) should be ₹7,560, but invoice totals are incorrect"
    ]
  },
  {
    id: "inv-005",
    invoice_number: "INV-2026-005",
    invoice_date: "2026-06-12",
    supplier_name: "Deccan Cement Distributors",
    supplier_gstin: "36EEEEE6666E6Z6",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "2523", // Portland Cement
    taxable_amount: 320000,
    cgst: 0,
    sgst: 0,
    igst: 89600, // 28% GST rate category for cement!
    total_gst: 89600,
    grand_total: 409600,
    validation_status: "valid",
    validation_errors: []
  },
  {
    id: "inv-006",
    invoice_number: "INV-2026-005", // Duplicate invoice
    invoice_date: "2026-06-12",
    supplier_name: "Deccan Cement Distributors",
    supplier_gstin: "36EEEEE6666E6Z6",
    buyer_gstin: "27BBBBB2222B2Z2",
    hsn_code: "2523",
    taxable_amount: 320000,
    cgst: 0,
    sgst: 0,
    igst: 89600,
    total_gst: 89600,
    grand_total: 409600,
    validation_status: "critical",
    validation_errors: [
      "Duplicate Invoice detected: INV-2026-005 has been uploaded multiple times"
    ]
  }
];

export const initialGSTR2B: GSTR2BRecord[] = [
  {
    id: "gstr-001",
    invoice_number: "INV-2026-001",
    supplier_name: "Aman Electronics & Wholesalers",
    supplier_gstin: "27AAAAA1111A1Z1",
    hsn_code: "8517",
    taxable_amount: 120000,
    cgst: 10800,
    sgst: 10800,
    igst: 0,
    total_gst: 21600,
    grand_total: 141600
  },
  {
    id: "gstr-002",
    invoice_number: "INV-2026-002",
    supplier_name: "Apex Trading Corporation",
    supplier_gstin: "07VVVVV3333V3Z3",
    hsn_code: "8471",
    taxable_amount: 85000,
    cgst: 0,
    sgst: 0,
    igst: 15300,
    total_gst: 15300,
    grand_total: 100300
  },
  {
    id: "gstr-003",
    invoice_number: "INV-2026-003",
    supplier_name: "Balaji Steel Industry",
    supplier_gstin: "27CCCCC4444C4Z4",
    hsn_code: "7210", // Mismatch in HSN! GSTR-2B has 7210, invoice has 7208
    taxable_amount: 250000,
    cgst: 22500,
    sgst: 22500,
    igst: 0,
    total_gst: 45000,
    grand_total: 295000
  },
  {
    id: "gstr-004",
    invoice_number: "INV-2026-008", // Supplier filed invoice, but the buyer does NOT have invoice in their folder!
    supplier_name: "Elite Glass Furnishings",
    supplier_gstin: "27YYYYY7777Y7Y7",
    hsn_code: "7007",
    taxable_amount: 60000,
    cgst: 5400,
    sgst: 5400,
    igst: 0,
    total_gst: 10800,
    grand_total: 70800
  }
  // INV-2026-005 (Deccan Cement) is MISSING in GSTR2B (supplier filing error / has not filed)!
  // INV-2026-004 (Chopra Logistics) has severe calculation & GSTIN discrepancies.
];

export const initialSupplierRisk: SupplierRisk[] = [
  {
    name: "Deccan Cement Distributors",
    gstin: "36EEEEE6666E6Z6",
    riskScore: 82,
    status: "high",
    errorCount: 3,
    totalInvoices: 4
  },
  {
    name: "Chopra Logistics Pvt Ltd",
    gstin: "27DDDDD5555D5Z5",
    riskScore: 65,
    status: "medium",
    errorCount: 2,
    totalInvoices: 2
  },
  {
    name: "Balaji Steel Industry",
    gstin: "27CCCCC4444C4Z4",
    riskScore: 40,
    status: "low",
    errorCount: 1,
    totalInvoices: 5
  },
  {
    name: "Aman Electronics & Wholesalers",
    gstin: "27AAAAA1111A1Z1",
    riskScore: 5,
    status: "low",
    errorCount: 0,
    totalInvoices: 10
  }
];

export const initialNotifications: SmartNotification[] = [
  {
    id: "notif-1",
    title: "GST Reconciliation Pending!",
    message: "You uploaded 2 new invoices. Run Reconciliation Check to identify dynamic tax recoveries.",
    type: "warning",
    date: "Just Now",
    read: false
  },
  {
    id: "notif-2",
    title: "High Risk Supplier Spotted",
    message: "Deccan Cement Distributors has not filed GSTR-1, blocking eligibility for ₹89,600 in ITC credit.",
    type: "danger",
    date: "1 hour ago",
    read: false
  },
  {
    id: "notif-3",
    title: "Compliance Score Updated",
    message: "Your Monthly Compliance Score calculation improved to 76/100 points after correction of INV-001.",
    type: "success",
    date: "1 day ago",
    read: true
  }
];

export const faqList = [
  {
    id: "faq-1",
    question: "What is Input Tax Credit (ITC) under GST?",
    answer: "Input Tax Credit (ITC) is the tax that a business pays on its purchase of goods and/or services, which can be deducted from its tax liability when selling goods/services. This ensures that double taxation is avoided throughout the supply chains."
  },
  {
    id: "faq-2",
    question: "Why should MSMEs periodically reconcile GSTR-2B?",
    answer: "GSTR-2B is an auto-populated, static document generated by the portal reflecting purchase invoices uploaded by suppliers. Doing monthly or weekly reconciliation helps identify suppliers who haven't filed their returns, allowing you to follow up and prevent permanent ITC losses."
  },
  {
    id: "faq-3",
    question: "What is Blocked ITC?",
    answer: "Blocked ITC refers to Input Tax Credit that is not allowable under Section 17(5) of the CGST Act. This includes goods/services purchased for personal use, motor vehicles, employee food & beverages, or standard civil constructions, even if used for business."
  },
  {
    id: "faq-4",
    question: "What are the rules regarding invalid or incorrect GSTINs?",
    answer: "If an invoice contains an incorrect GSTIN, the tax is credited to a different account, making it impossible for you to claim credit. It requires immediate GSTR-1 amendments or debit note issuances from your suppliers."
  },
  {
    id: "faq-5",
    question: "What is the HSN Code and why is it important?",
    answer: "HSN (Harmonized System of Nomenclature) is a globally accepted classification system for goods. Entering the wrong HSN in invoice filings attracts penalties and can trigger automated GST compliance audits due to mismatched tax rates."
  }
];
