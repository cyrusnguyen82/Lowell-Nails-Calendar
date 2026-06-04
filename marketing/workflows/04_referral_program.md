# Workflow: Referral Program

**Objective:** Turn satisfied clients into a steady source of new referrals. Referrals convert at 3-5x the rate of cold leads and have higher LTV.

**Inputs required:** Active client list from DB, referral tracking in `clients` table (notes or dedicated column), REFERRAL_REWARD and REFERRAL_CURRENCY in `.env`

**Outputs:** New clients attributed to referrals, rewards issued to referring clients

**Tool:** `tools/referral_tracker.py`

---

## Program Structure

### The Offer

**Referrer gets:** $10 credit toward their next visit (configurable via REFERRAL_REWARD in `.env`)

**New client gets:** 10% off their first visit

**Why two-sided works:** The new client has a lower barrier to try. The referrer has a reason to actually mention it. Single-sided programs (reward only the referrer) have lower share rates.

---

## How It Works

1. Referrer shares their unique referral link or code with a friend
2. New client books using that code (manually entered or via URL parameter)
3. New client completes their first appointment
4. `tools/referral_tracker.py` logs the referral and flags it for reward issuance
5. Referrer's credit is applied to their account at next booking (manual in POS, or automated if integrated)

---

## The Ask — When and How

### Best Moments to Ask

| Moment | Method | Conversion |
|---|---|---|
| Immediately after a great result | In-person, verbal | Highest |
| After 5-star review | Follow-up text/email | High |
| Monthly email to top clients | Email with referral link | Medium |
| Anniversary of first visit | Email with credit offer | Medium |

**Script (in-person):** *"Hey, I'm so glad you love it — if you know anyone who'd enjoy this, I'd love to meet them. If they mention your name when they book, I'll put $10 credit on your account."*

**The key:** Ask after the peak emotional high, not at the end of a routine visit.

---

## Referral Tracking Process

### Step 1: Assign Referral Codes

Every active client gets a referral code. Format: first 4 letters of last name + last 4 digits of phone.
Example: Sarah Johnson, (555) 867-5309 → `JOHN5309`

Alternatively, use a simple URL parameter on the booking widget: `?ref=JOHN5309`

Log codes in `clients` table — add a `referral_code` note or use the `notes` field with format: `[REF:JOHN5309]`.

### Step 2: Track Referrals

Run monthly: `python tools/referral_tracker.py --report`

Output: list of referrers, how many referrals each has sent, total credit owed, total new revenue from referrals.

### Step 3: Issue Rewards

**Manual process (current):**
1. Run the referral report
2. For each earned credit, add a note to the client's record: `[CREDIT:$10 referral reward - 2026-05]`
3. Apply credit at next POS transaction

**Future:** Integrate credit issuance directly into POS gift card / credit system.

---

## Monthly Referral Email Campaign

Send to: all clients with 2+ visits in the past 90 days (your most satisfied segment).
Frequency: Once per month, send-day varies to avoid predictability.

Use template: `templates/referral_outreach.md` → "Monthly Referral Email"

**List pull:** `python tools/export_clients_for_email.py --segment loyal`

---

## Gamification (Optional — Add Month 3+)

Create tiers to reward high-volume referrers:

| Tier | Referrals | Reward |
|---|---|---|
| Bronze | 1 referral | $10 credit |
| Silver | 3 referrals | $35 credit (bonus $5) |
| Gold | 5 referrals | $75 credit (bonus $25) + free add-on service |
| VIP Ambassador | 10+ referrals | Lifetime discount or complimentary monthly visit |

Announce tiers in monthly email and on social media. Public recognition ("Our top referrers this month") drives engagement.

---

## Edge Cases

- **Client asks about referral before program is set up:** Tell them verbally you'll track it. Log `[REF:pending - referred Jane Smith]` in client notes. Set up formal tracking within 48 hours.
- **New client forgets to mention referral:** Accept late attribution if reported within 30 days of first visit. Goodwill matters more than process purity.
- **Referral doesn't show:** Don't penalize the referrer. Only issue reward when the new client completes a visit.
- **Abuse (referring themselves via a second account):** Flag if two accounts share an address or device. Use judgment.

---

## Success Metrics

| Metric | Target |
|---|---|
| % of new clients from referrals | 20%+ |
| Referral conversion rate (link shared → booked) | >30% |
| Referral LTV vs. average LTV | 1.5x+ |
| Active referrers (sent at least 1 in last 90 days) | 10% of client base |
