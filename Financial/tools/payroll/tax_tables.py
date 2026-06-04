"""
tax_tables.py — Payroll tax tables and calculators

PRIMARY STATE: Michigan (MI) — fully configured with city taxes
OTHER STATES:  Will be added as the product expands

TAX YEAR: 2026
LAST UPDATED: 2026-01-01

UPDATE PROCESS (every January):
  Federal:  IRS Publication 15-T — new withholding tables
            SSA announcement — new Social Security wage base
  Michigan: Michigan Income Tax Withholding Guide (Form 446)
            Michigan personal exemption amount (adjusts with CPI)
  Cities:   Verify each city's rate hasn't changed (rare but possible)
  SUTA:     Your rate notice from UIA — set per-employee if different from default
"""

from __future__ import annotations

# ── Tax year metadata ─────────────────────────────────────────────────────────
TAX_YEAR        = 2026
LAST_UPDATED    = "2026-01-01"   # update this each January after verifying tables
PRIMARY_STATE   = "MI"           # Michigan — fully supported with city taxes


# ── Federal constants (2026 — verify against IRS Pub 15-T each January) ──────

STANDARD_DEDUCTION: dict[str, float] = {
    "single":            14600.0,
    "married":           29200.0,
    "head_of_household": 21900.0,
}

# (bracket_low, bracket_high, marginal_rate, cumulative_tax_at_low)
FEDERAL_BRACKETS: dict[str, list] = {
    "single": [
        (0,        11600,    0.10,  0.00),
        (11600,    47150,    0.12,  1160.00),
        (47150,    100525,   0.22,  5426.00),
        (100525,   191950,   0.24,  17168.50),
        (191950,   243725,   0.32,  39110.50),
        (243725,   609350,   0.35,  55678.50),
        (609350,   float("inf"), 0.37, 183647.25),
    ],
    "married": [
        (0,        23200,    0.10,  0.00),
        (23200,    94300,    0.12,  2320.00),
        (94300,    201050,   0.22,  10852.00),
        (201050,   383900,   0.24,  34337.00),
        (383900,   487450,   0.32,  78221.00),
        (487450,   731200,   0.35,  111357.00),
        (731200,   float("inf"), 0.37, 196669.50),
    ],
    "head_of_household": [
        (0,        16550,    0.10,  0.00),
        (16550,    63100,    0.12,  1655.00),
        (63100,    100500,   0.22,  7241.00),
        (100500,   191950,   0.24,  15469.00),
        (191950,   243700,   0.32,  37417.00),
        (243700,   609350,   0.35,  53977.00),
        (609350,   float("inf"), 0.37, 181954.50),
    ],
}

# Pre-2020 W-4 allowance value (still used for employees who haven't updated)
ALLOWANCE_VALUE_ANNUAL = 4300.0

FICA = {
    "ss_employee_rate":  0.062,
    "ss_employer_rate":  0.062,
    "ss_wage_base":      176100.0,   # 2026 — verify with SSA each January
    "med_employee_rate": 0.0145,
    "med_employer_rate": 0.0145,
    "add_med_rate":      0.009,      # employee only, on wages > $200K YTD
    "add_med_threshold": 200000.0,
}

FUTA = {
    "rate":      0.060,
    "wage_base": 7000.0,
    "credit":    0.054,   # full SUTA credit when paid on time → net 0.6%
}


# ── Michigan State Income Tax ─────────────────────────────────────────────────
# Source: Michigan Income Tax Withholding Guide (Form 446)
# Rate: 4.25% flat (2026)
# Personal exemption: $5,600 per exemption claimed on MI W-4
#   — This amount adjusts annually with the Consumer Price Index
#   — Verify each January at: michigan.gov/taxes → Withholding Tax
#
# Formula:
#   Annual taxable = Annual gross - (exemptions × $5,600)
#   Annual MI tax  = max(taxable, 0) × 4.25%
#   Per period     = Annual MI tax / pay periods

MI_EXEMPTION_AMOUNT = 5600.0   # per exemption, per year — verify each January


# ── Michigan City Income Taxes ────────────────────────────────────────────────
# Source: Michigan Public Act 284 of 1964 (City Income Tax Act)
# Each city sets its own rate (capped by state law).
# Resident rate applies if the employee lives in the city.
# Non-resident rate applies if they work in the city but live elsewhere.
#
# Verify rates annually — changes are uncommon but do happen.
# Source: each city's income tax ordinance or treasury department.

MI_CITIES: dict[str, dict] = {
    "detroit":          {"label": "Detroit",          "resident": 0.024,  "nonresident": 0.012},
    "grand_rapids":     {"label": "Grand Rapids",     "resident": 0.015,  "nonresident": 0.0075},
    "highland_park":    {"label": "Highland Park",    "resident": 0.020,  "nonresident": 0.010},
    "saginaw":          {"label": "Saginaw",          "resident": 0.015,  "nonresident": 0.0075},
    "hamtramck":        {"label": "Hamtramck",        "resident": 0.010,  "nonresident": 0.005},
    "lansing":          {"label": "Lansing",          "resident": 0.010,  "nonresident": 0.005},
    "flint":            {"label": "Flint",            "resident": 0.010,  "nonresident": 0.005},
    "pontiac":          {"label": "Pontiac",          "resident": 0.010,  "nonresident": 0.005},
    "battle_creek":     {"label": "Battle Creek",     "resident": 0.010,  "nonresident": 0.005},
    "muskegon":         {"label": "Muskegon",         "resident": 0.010,  "nonresident": 0.005},
    "muskegon_heights": {"label": "Muskegon Heights", "resident": 0.010,  "nonresident": 0.005},
    "port_huron":       {"label": "Port Huron",       "resident": 0.010,  "nonresident": 0.005},
    "albion":           {"label": "Albion",           "resident": 0.010,  "nonresident": 0.005},
    "big_rapids":       {"label": "Big Rapids",       "resident": 0.010,  "nonresident": 0.005},
    "walker":           {"label": "Walker",           "resident": 0.010,  "nonresident": 0.005},
    "ionia":            {"label": "Ionia",            "resident": 0.010,  "nonresident": 0.005},
    "springfield":      {"label": "Springfield",      "resident": 0.010,  "nonresident": 0.005},
}


# ── State income tax configuration ───────────────────────────────────────────
# type: "none" | "flat" | "bracketed"
# flat states with exemption_per_allowance: deduct (exemptions × amount) before applying rate
# Verify state rates each January against each state's withholding publication.
#
# NOTE: Only Michigan is fully validated and tested for production use.
# All other states are included for reference — verify before using in production.

STATE_TAX: dict[str, dict] = {

    # ── No state income tax ───────────────────────────────────────────────────
    "AK": {"type": "none"},
    "FL": {"type": "none"},
    "NV": {"type": "none"},
    "NH": {"type": "none"},
    "SD": {"type": "none"},
    "TN": {"type": "none"},
    "TX": {"type": "none"},
    "WA": {"type": "none"},
    "WY": {"type": "none"},

    # ── Flat-rate states ──────────────────────────────────────────────────────
    # Michigan — FULLY VALIDATED, production-ready
    "MI": {
        "type": "flat",
        "rate": 0.0425,
        "exemption_per_allowance": MI_EXEMPTION_AMOUNT,   # per MI W-4 exemption
        "has_city_tax": True,
    },

    # Other flat states — reference only, verify before expanding to these states
    "AZ": {"type": "flat", "rate": 0.025},
    "CO": {"type": "flat", "rate": 0.044},
    "IL": {"type": "flat", "rate": 0.0495},
    "IN": {"type": "flat", "rate": 0.0305,  "exemption_per_allowance": 1000.0},
    "KY": {"type": "flat", "rate": 0.040},
    "MA": {"type": "flat", "rate": 0.050},
    "NC": {"type": "flat", "rate": 0.0499},
    "PA": {"type": "flat", "rate": 0.0307},
    "UT": {"type": "flat", "rate": 0.0465},

    # ── Bracketed states — reference only ────────────────────────────────────
    "CA": {
        "type": "bracketed",
        "std_single":  5202.0,
        "std_married": 10404.0,
        "std_hoh":     10604.0,
        "exemption_single":   144.0,
        "exemption_married":  288.0,
        "brackets_single": [
            (0,       10099,   0.01,  0.00),
            (10099,   23942,   0.02,  100.99),
            (23942,   37788,   0.04,  377.85),
            (37788,   52455,   0.06,  931.69),
            (52455,   66295,   0.08,  1811.71),
            (66295,   338639,  0.093, 2918.91),
            (338639,  406364,  0.103, 28253.59),
            (406364,  677275,  0.113, 35236.60),
            (677275,  1000000, 0.123, 65843.15),
            (1000000, float("inf"), 0.133, 105551.60),
        ],
        "brackets_married": [
            (0,       20198,   0.01,  0.00),
            (20198,   47884,   0.02,  201.98),
            (47884,   75576,   0.04,  755.70),
            (75576,   104910,  0.06,  1863.38),
            (104910,  132590,  0.08,  3623.42),
            (132590,  677278,  0.093, 5837.82),
            (677278,  812728,  0.103, 56507.18),
            (812728,  1000000, 0.113, 70453.20),
            (1000000, float("inf"), 0.123, 91605.66),
        ],
        "sdi_rate":      0.009,
        "sdi_wage_base": float("inf"),
    },
    "NY": {
        "type": "bracketed",
        "std_single":  8000.0,
        "std_married": 16050.0,
        "std_hoh":     11200.0,
        "brackets_single": [
            (0,        17150,   0.04,   0.00),
            (17150,    23600,   0.045,  686.00),
            (23600,    27900,   0.0525, 976.25),
            (27900,    161550,  0.0585, 1202.00),
            (161550,   323200,  0.0625, 9014.08),
            (323200,   2155350, 0.0685, 19124.88),
            (2155350,  5000000, 0.0965, 144442.48),
            (5000000,  25000000, 0.103, 418861.48),
            (25000000, float("inf"), 0.109, 2478861.48),
        ],
        "brackets_married": [
            (0,        27900,   0.04,  0.00),
            (27900,    43000,   0.045, 1116.00),
            (43000,    161550,  0.0525, 1795.50),
            (161550,   323200,  0.0585, 8022.38),
            (323200,   2155350, 0.0625, 17464.68),
            (2155350,  5000000, 0.0685, 131978.73),
            (5000000,  25000000, 0.103, 313588.48),
            (25000000, float("inf"), 0.109, 2373588.48),
        ],
        "sdi_rate":      0.005,
        "sdi_wage_base": 89343.0,
    },
    "NJ": {
        "type": "bracketed",
        "std_single":  1000.0,
        "std_married": 2000.0,
        "brackets_single": [
            (0,      20000,  0.014,  0.00),
            (20000,  35000,  0.0175, 280.00),
            (35000,  40000,  0.035,  542.50),
            (40000,  75000,  0.05525, 717.50),
            (75000,  500000, 0.0637, 2651.25),
            (500000, 1000000, 0.0897, 29724.25),
            (1000000, float("inf"), 0.1075, 74574.25),
        ],
        "brackets_married": [
            (0,      20000,  0.014,  0.00),
            (20000,  50000,  0.0175, 280.00),
            (50000,  70000,  0.0245, 805.00),
            (70000,  80000,  0.035,  1295.00),
            (80000,  150000, 0.05525, 1645.00),
            (150000, 500000, 0.0637, 5512.50),
            (500000, 1000000, 0.0897, 27802.50),
            (1000000, float("inf"), 0.1075, 72652.50),
        ],
        "sdi_rate":      0.0026,
        "sdi_wage_base": 161400.0,
    },
    "GA": {
        "type": "bracketed",
        "std_single":  5400.0,
        "std_married": 7100.0,
        "brackets_single": [
            (0,    750,   0.01,  0.00),
            (750,  2250,  0.02,  7.50),
            (2250, 3750,  0.03,  37.50),
            (3750, 5250,  0.04,  82.50),
            (5250, 7000,  0.05,  142.50),
            (7000, float("inf"), 0.055, 230.00),
        ],
        "brackets_married": [
            (0,     1000,  0.01,  0.00),
            (1000,  3000,  0.02,  10.00),
            (3000,  5000,  0.03,  50.00),
            (5000,  7000,  0.04,  110.00),
            (7000,  10000, 0.05,  190.00),
            (10000, float("inf"), 0.055, 340.00),
        ],
    },
    "OH": {
        "type": "bracketed",
        "std_single":  0.0,
        "std_married": 0.0,
        "brackets_single": [
            (0,      26050, 0.000,   0.00),
            (26050,  46100, 0.02765, 0.00),
            (46100,  92150, 0.03226, 554.38),
            (92150,  115300, 0.03688, 2040.39),
            (115300, float("inf"), 0.03990, 2895.37),
        ],
        "brackets_married": [
            (0,      26050, 0.000,   0.00),
            (26050,  46100, 0.02765, 0.00),
            (46100,  92150, 0.03226, 554.38),
            (92150,  115300, 0.03688, 2040.39),
            (115300, float("inf"), 0.03990, 2895.37),
        ],
    },
    "VA": {
        "type": "bracketed",
        "std_single":  8000.0,
        "std_married": 16000.0,
        "brackets_single": [
            (0,     3000,  0.02,   0.00),
            (3000,  5000,  0.03,   60.00),
            (5000,  17000, 0.05,   120.00),
            (17000, float("inf"), 0.0575, 720.00),
        ],
        "brackets_married": [
            (0,     3000,  0.02,   0.00),
            (3000,  5000,  0.03,   60.00),
            (5000,  17000, 0.05,   120.00),
            (17000, float("inf"), 0.0575, 720.00),
        ],
    },
    "MO": {
        "type": "bracketed",
        "std_single":  14600.0,
        "std_married": 29200.0,
        "brackets_single": [
            (0,    111,   0.015, 0.00),
            (111,  1121,  0.020, 1.67),
            (1121, 2242,  0.025, 21.87),
            (2242, 3353,  0.030, 49.89),
            (3353, 4463,  0.035, 83.22),
            (4463, 5574,  0.040, 122.07),
            (5574, 6695,  0.045, 166.51),
            (6695, 7805,  0.050, 217.06),
            (7805, float("inf"), 0.054, 272.56),
        ],
        "brackets_married": [
            (0,    111,   0.015, 0.00),
            (111,  1121,  0.020, 1.67),
            (1121, 2242,  0.025, 21.87),
            (2242, 3353,  0.030, 49.89),
            (3353, 4463,  0.035, 83.22),
            (4463, 5574,  0.040, 122.07),
            (5574, 6695,  0.045, 166.51),
            (6695, 7805,  0.050, 217.06),
            (7805, float("inf"), 0.054, 272.56),
        ],
    },
}


# ── SUTA defaults (new employer rate, wage base) ──────────────────────────────
# Your actual assigned rate comes from your state UIA/SWA rate notice.
# Set a per-employee override in the employees table when you receive your rate.
# Michigan default: 2.7% on first $9,500 (verify with Michigan UIA each year)

SUTA_DEFAULTS: dict[str, tuple[float, float]] = {
    "AK": (0.010, 43600), "AL": (0.027,  8000), "AR": (0.032, 10000),
    "AZ": (0.020,  8000), "CA": (0.034,  7000), "CO": (0.017, 20400),
    "CT": (0.027, 25000), "DC": (0.027,  9000), "DE": (0.018, 10500),
    "FL": (0.027,  7000), "GA": (0.027,  9500), "HI": (0.040, 56700),
    "IA": (0.010, 38200), "ID": (0.010, 49900), "IL": (0.039, 13590),
    "IN": (0.025,  9500), "KS": (0.027, 14000), "KY": (0.027, 11400),
    "LA": (0.019,  7700), "MA": (0.024, 15000), "MD": (0.027,  8500),
    "ME": (0.027, 12000), "MI": (0.027,  9500), "MN": (0.010, 42000),
    "MO": (0.025, 10500), "MS": (0.010, 14000), "MT": (0.010, 43000),
    "NC": (0.010, 31400), "ND": (0.010, 43800), "NE": (0.012,  9000),
    "NH": (0.027, 14000), "NJ": (0.028, 42300), "NM": (0.020, 31700),
    "NV": (0.030, 40600), "NY": (0.031, 12500), "OH": (0.027,  9000),
    "OK": (0.027, 25700), "OR": (0.026, 52700), "PA": (0.036, 10000),
    "RI": (0.012, 29200), "SC": (0.027, 14000), "SD": (0.012, 15000),
    "TN": (0.027,  7000), "TX": (0.027,  9000), "UT": (0.010, 45300),
    "VA": (0.025,  8000), "VT": (0.010, 14100), "WA": (0.010, 68500),
    "WI": (0.038, 14000), "WV": (0.027, 12000), "WY": (0.027, 29100),
}


# ── Calculation functions ─────────────────────────────────────────────────────

def _apply_brackets(taxable: float, brackets: list) -> float:
    """Apply a progressive tax bracket table to a taxable amount."""
    if taxable <= 0:
        return 0.0
    tax = 0.0
    for low, high, rate, flat in brackets:
        if taxable <= low:
            break
        if taxable < high:
            tax = flat + (taxable - low) * rate
            break
    else:
        last = brackets[-1]
        if taxable >= last[0]:
            tax = last[3] + (taxable - last[0]) * last[2]
    return max(tax, 0.0)


def _normalize_status(status: str) -> str:
    s = (status or "single").lower().replace("-", "_").replace(" ", "_")
    if s in ("married_filing_jointly", "mfj"):
        return "married"
    if s in ("head_of_household", "hoh"):
        return "head_of_household"
    return "single" if s not in ("married", "head_of_household") else s


def calc_federal_withholding(gross_pay: float, filing_status: str,
                              allowances: int = 0, extra_withholding: float = 0,
                              pay_periods: int = 52) -> float:
    """
    Federal income tax withholding for one pay period.
    Uses IRS annualized income method (Publication 15-T).
    """
    status     = _normalize_status(filing_status)
    std_ded    = STANDARD_DEDUCTION.get(status, STANDARD_DEDUCTION["single"])
    annual     = gross_pay * pay_periods
    allowance_ded = ALLOWANCE_VALUE_ANNUAL * allowances
    taxable    = max(annual - std_ded - allowance_ded, 0.0)
    annual_tax = _apply_brackets(taxable, FEDERAL_BRACKETS[status])
    per_period = annual_tax / pay_periods
    return round(max(per_period + extra_withholding, 0.0), 2)


def calc_state_withholding(gross_pay: float, state: str, filing_status: str,
                            allowances: int = 0, extra_withholding: float = 0,
                            pay_periods: int = 52) -> float:
    """
    State income tax withholding for one pay period.

    Michigan: uses MI W-4 exemptions (each worth $5,600/year).
              Formula: (Annual gross - exemptions × $5,600) × 4.25% ÷ pay periods
    Other states: annualized method using each state's brackets or flat rate.
    """
    if not state:
        return 0.0
    state = state.upper()
    cfg   = STATE_TAX.get(state)
    if not cfg or cfg["type"] == "none":
        return 0.0

    annual = gross_pay * pay_periods
    status = _normalize_status(filing_status)

    if cfg["type"] == "flat":
        # Apply per-exemption deduction if the state uses one (e.g. Michigan)
        exemption_ded = cfg.get("exemption_per_allowance", 0.0) * allowances
        taxable       = max(annual - exemption_ded, 0.0)
        per_period    = taxable * cfg["rate"] / pay_periods
        return round(max(per_period + extra_withholding, 0.0), 2)

    # Bracketed
    mkey     = "married" if status == "married" else "single"
    brackets = cfg.get(f"brackets_{mkey}", cfg.get("brackets_single", []))
    std_key  = "std_married" if mkey == "married" else "std_single"
    std_ded  = cfg.get(std_key, cfg.get("std_single", 0.0))
    exemption = cfg.get(f"exemption_{mkey}", cfg.get("exemption_single", 0.0))
    allow_ded = allowances * ALLOWANCE_VALUE_ANNUAL
    taxable   = max(annual - std_ded - exemption - allow_ded, 0.0)
    annual_tax = _apply_brackets(taxable, brackets)
    per_period = annual_tax / pay_periods
    return round(max(per_period + extra_withholding, 0.0), 2)


def calc_michigan_withholding(gross_pay: float, exemptions: int = 0,
                               extra_withholding: float = 0,
                               pay_periods: int = 52) -> float:
    """
    Michigan state income tax withholding — direct calculation.
    Use this for Michigan-specific payroll to avoid any ambiguity.

    Source: Michigan Form 446, Income Tax Withholding Guide.
    Rate: 4.25%  Exemption: $5,600/year per exemption on MI W-4.
    """
    annual        = gross_pay * pay_periods
    exemption_ded = MI_EXEMPTION_AMOUNT * exemptions
    taxable       = max(annual - exemption_ded, 0.0)
    annual_tax    = taxable * 0.0425
    per_period    = annual_tax / pay_periods
    return round(max(per_period + extra_withholding, 0.0), 2)


def calc_city_withholding(gross_pay: float, state: str,
                           city_code: str | None,
                           resident: bool = True) -> float:
    """
    Michigan city income tax withholding for one pay period.

    Michigan cities tax both residents and non-residents who work in the city.
    Resident rate is always higher than non-resident rate.

    Returns 0 for non-Michigan states or cities without a local tax.
    """
    if not city_code or (state or "").upper() != "MI":
        return 0.0
    city = MI_CITIES.get(city_code.lower().replace(" ", "_"))
    if not city:
        return 0.0
    rate = city["resident"] if resident else city["nonresident"]
    return round(gross_pay * rate, 2)


def calc_state_sdi(gross_pay: float, state: str, ytd_sdi_wages: float = 0.0) -> float:
    """Employee-side state disability insurance (CA SDI, NY PFL, NJ TDI, etc.)"""
    if not state:
        return 0.0
    cfg  = STATE_TAX.get(state.upper(), {})
    rate = cfg.get("sdi_rate", 0.0)
    if not rate:
        return 0.0
    wage_base = cfg.get("sdi_wage_base", float("inf"))
    taxable   = max(min(gross_pay, wage_base - ytd_sdi_wages), 0.0)
    return round(taxable * rate, 2)


def calc_fica(gross_pay: float, ytd_gross: float) -> dict:
    """Employee and employer FICA taxes for one pay period."""
    ss_base    = FICA["ss_wage_base"]
    ss_taxable = max(min(gross_pay, ss_base - ytd_gross), 0.0)

    emp_ss  = round(ss_taxable * FICA["ss_employee_rate"], 2)
    emp_med = round(gross_pay  * FICA["med_employee_rate"], 2)
    er_ss   = round(ss_taxable * FICA["ss_employer_rate"], 2)
    er_med  = round(gross_pay  * FICA["med_employer_rate"], 2)

    add_med  = 0.0
    ytd_after = ytd_gross + gross_pay
    if ytd_after > FICA["add_med_threshold"]:
        add_med_wages = min(gross_pay, ytd_after - FICA["add_med_threshold"])
        add_med = round(max(add_med_wages, 0.0) * FICA["add_med_rate"], 2)

    return {
        "employee_ss":        emp_ss,
        "employee_medicare":  emp_med,
        "additional_medicare": add_med,
        "employer_ss":        er_ss,
        "employer_medicare":  er_med,
    }


def calc_futa(gross_pay: float, ytd_gross: float,
              suta_paid_timely: bool = True) -> float:
    """Employer FUTA liability for one pay period."""
    wage_base = FUTA["wage_base"]
    taxable   = max(min(gross_pay, wage_base - ytd_gross), 0.0)
    net_rate  = FUTA["rate"] - (FUTA["credit"] if suta_paid_timely else 0.0)
    return round(taxable * net_rate, 2)


def calc_suta(gross_pay: float, ytd_gross: float, state: str,
              rate: float | None = None) -> float:
    """Employer SUTA (state unemployment) liability for one pay period."""
    if not state:
        return 0.0
    default_rate, wage_base = SUTA_DEFAULTS.get(state.upper(), (0.027, 7000.0))
    r       = rate if rate is not None else default_rate
    taxable = max(min(gross_pay, wage_base - ytd_gross), 0.0)
    return round(taxable * r, 2)


def effective_state(employee_state: str | None, employer_state: str | None) -> str:
    """Employee's state code takes precedence over employer's state."""
    return (employee_state or employer_state or "").upper()


def is_no_income_tax_state(state: str) -> bool:
    return STATE_TAX.get((state or "").upper(), {}).get("type") == "none"


def get_michigan_city_choices() -> list[tuple[str, str]]:
    """Returns (code, label) pairs for Michigan city dropdown."""
    return [("", "None — no city tax")] + [
        (code, info["label"]) for code, info in sorted(MI_CITIES.items(), key=lambda x: x[1]["label"])
    ]


def tax_table_age_warning() -> str | None:
    """Returns a warning string if tax tables are more than 13 months old."""
    import datetime
    updated = datetime.date.fromisoformat(LAST_UPDATED)
    age_days = (datetime.date.today() - updated).days
    if age_days > 395:
        return (f"Tax tables were last updated {LAST_UPDATED}. "
                f"Verify rates against IRS Pub 15-T and Michigan Form 446 for {datetime.date.today().year}.")
    return None
