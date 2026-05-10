import os
from fpdf import FPDF

def generate_pdf_plan():
    pdf = FPDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("helvetica", 'B', 18)
    pdf.cell(0, 10, "POS System Integration Plan", ln=True, align='C')
    pdf.set_font("helvetica", 'I', 12)
    pdf.cell(0, 10, "Lowell Nails & Spa", ln=True, align='C')
    pdf.ln(10)

    # Section 1: Vision
    pdf.set_font("helvetica", 'B', 14)
    pdf.cell(0, 10, "1. Vision & Core Objectives", ln=True)
    pdf.set_font("helvetica", '', 11)
    pdf.multi_cell(0, 7, (
        "Transform the existing scheduling/CRM system into a high-performance Point of Sale (POS) ecosystem. "
        "This bridges the gap between 'Scheduled Intent' and 'Financial Completion'."
    ))
    pdf.ln(5)

    # Section 2: Architecture
    pdf.set_font("helvetica", 'B', 14)
    pdf.cell(0, 10, "2. Technical Architecture (Postgres Expansion)", ln=True)
    pdf.set_font("helvetica", '', 11)
    pdf.multi_cell(0, 7, "To support currency flow, we need to implement a deterministic ledger via new database tables:")
    pdf.ln(2)
    
    tables = [
        ("transactions", "Records the 'Who, When, and How Much' of every sale."),
        ("line_items", "Breaks down exactly what was sold (Service vs. Retail)."),
        ("products", "Inventory management for retail items (polish, oils)."),
        ("gift_cards", "Stored value management and balance tracking.")
    ]
    for table, purpose in tables:
        pdf.set_font("helvetica", 'B', 11)
        pdf.cell(10)
        pdf.cell(30, 7, f"{table}:", ln=False)
        pdf.set_font("helvetica", '', 11)
        pdf.multi_cell(0, 7, purpose)
    pdf.ln(5)

    # Section 3: Roadmap
    pdf.set_font("helvetica", 'B', 14)
    pdf.cell(0, 10, "3. Implementation Roadmap", ln=True)
    
    roadmap = [
        ("Phase 1: The Payment Engine (Core)", [
            "Stripe Terminal Integration: Physical card readers at the front desk.",
            "Checkout UI: React modal triggered when appointments are marked 'Done'.",
            "Automated Tax/Tip: Michigan 6% tax calculation and smart tip suggestions."
        ]),
        ("Phase 2: Operations & Payroll", [
            "Commission Logic: Auto-calculate splits defined in business.config.js.",
            "SMS Receipts: Twilio integration for digital delivery.",
            "Inventory Alerts: Michael sends an SMS when retail stock is low."
        ]),
        ("Phase 3: Michael (AI) Intelligence", [
            "Gift Card Balance Tool: Michael can answer 'How much is left on my card?'",
            "Pricing Queries: Michael references the structured price list for quotes.",
            "Daily Close-Out: Michael summarizes day's revenue for the owner at 7:00 PM."
        ])
    ]

    for phase, items in roadmap:
        pdf.set_font("helvetica", 'B', 12)
        pdf.cell(0, 10, phase, ln=True)
        pdf.set_font("helvetica", '', 11)
        for item in items:
            pdf.cell(10)
            pdf.multi_cell(0, 7, f"- {item}")
    pdf.ln(5)

    # Section 4: Success Metrics
    pdf.set_font("helvetica", 'B', 14)
    pdf.cell(0, 10, "4. Success Metrics", ln=True)
    pdf.set_font("helvetica", '', 11)
    metrics = [
        "1. Zero Data Leakage: Every dollar in the drawer matches a line item in Postgres.",
        "2. Michael Autonomy: AI handles 100% of gift card and pricing inquiries.",
        "3. Frictionless Checkout: Transaction completion in under 3 clicks on the iPad."
    ]
    for m in metrics:
        pdf.cell(5)
        pdf.multi_cell(0, 7, m)

    output_path = os.path.join(os.getcwd(), "POS_INTEGRATION_SPEC.pdf")
    pdf.output(output_path)
    print(f"✅ Success: PDF Spec generated at {output_path}")

if __name__ == "__main__":
    try:
        generate_pdf_plan()
    except ImportError:
        print("❌ Error: fpdf2 not found. Run 'pip install fpdf2'")