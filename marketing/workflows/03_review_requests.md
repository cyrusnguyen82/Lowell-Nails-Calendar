# Workflow: Review Requests

**Objective:** Build a consistent pipeline of 5-star reviews on Google (and secondarily Yelp/Facebook) to drive organic discovery and convert skeptical prospects.

**Inputs required:** Completed appointments in DB, REVIEW_LINK in `.env`, Twilio credentials (for SMS) or SendGrid (for email)

**Outputs:** Net new Google reviews, improved local search ranking, increased conversion rate on website

**Tool:** `tools/fetch_lapsed_clients.py --days 1` — pulls clients who completed an appointment yesterday

---

## The Review Request Timing Rule

**Ask at the peak of satisfaction, not at the end of a transaction.**

The peak of satisfaction for most service businesses is immediately after the service is complete — while the client is still in the chair, looking in the mirror, or walking out the door. That is when to ask.

| Timing | Method | Conversion Rate |
|---|---|---|
| In-person ask at checkout | Verbal + show them your phone | 40-60% |
| SMS within 1 hour of appointment | Text message | 20-30% |
| Email within 24 hours | Email with direct link | 10-15% |
| Email after 48+ hours | Too late — drops dramatically | <5% |

**Rule:** Always do the in-person ask first. The SMS/email is a follow-up for clients who didn't leave a review at checkout.

---

## Step-by-Step Process

### Step 1: In-Person Ask (At Checkout)

Script: *"If you loved your experience today, would you mind leaving us a Google review? It helps us so much. Here — [show QR code or phone with link open] — it literally takes 30 seconds."*

Have a QR code printed at checkout counter linking directly to your Google review form.

Generate QR code at: qr-code-generator.com or qrcode.kaywa.com (use your REVIEW_LINK value from `.env`)

---

### Step 2: SMS Follow-Up (Within 1 Hour)

Run daily: `python tools/fetch_lapsed_clients.py --days 1`

This outputs a list of clients who had appointments yesterday. For those who haven't left a review:

Send SMS using template from `templates/review_request_templates.md` → "SMS Review Ask"

**Important:** Only send to clients who have phone numbers and have not already received a review request in the last 90 days.

---

### Step 3: Email Follow-Up (24 Hours Later)

If SMS was not delivered or client has no phone number, send the email version.
Use template from `templates/review_request_templates.md` → "Email Review Ask"

---

### Step 4: Respond to Every Review

**5-star reviews:**
- Thank them by first name
- Reference something specific from their visit if possible
- Invite them back

**3-4 star reviews:**
- Thank them, acknowledge what could have been better
- Offer to make it right (email or call)
- Never get defensive

**1-2 star reviews:**
- Respond within 2 hours
- Apologize for the experience, take accountability
- Offer a resolution offline: "Please call us at [number] or email [email]"
- Never argue or explain publicly
- A handled 1-star often reads better than a ignored 5-star to prospects

---

## Review Platforms Priority

| Platform | Priority | Why |
|---|---|---|
| Google | #1 | Drives local SEO and GBP ranking |
| Yelp | #2 | High-intent service searchers |
| Facebook | #3 | Social proof for paid ads |

Focus 80% of effort on Google until you have 50+ reviews there.

---

## Velocity Target

| Reviews | Effect |
|---|---|
| 0-10 | Invisible in local search |
| 10-25 | Appearing, not yet trusted |
| 25-50 | Strong local presence |
| 50-100 | Top-tier trust, competes with established businesses |
| 100+ | Dominates local search, runs on its own momentum |

**Target:** +5 new Google reviews per month minimum.

---

## Edge Cases

- **Client had a bad experience:** Do not ask for a review. Flag in DB notes. Address the issue.
- **Client already left a review:** Check before sending — avoid asking twice. Track in `clients` table `notes` field or a separate `reviews_requested` log.
- **Twilio not configured:** Fallback to email-only workflow.
- **Review removed by Google:** This happens with IP-flagged reviews (client left review on your wifi). Ask client to review from their home network.

---

## Success Metrics

| Metric | Target |
|---|---|
| Review request send rate | 100% of completed appointments |
| Review conversion rate | >25% of requests |
| New Google reviews per month | 5+ |
| Average rating | 4.7+ |
| Response time to new reviews | <24 hours |
