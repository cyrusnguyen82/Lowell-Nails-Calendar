# Workflow: Client Reactivation Campaign

**Objective:** Win back clients who have gone inactive. These clients already trust you — reactivation cost is 5-10x lower than cold acquisition.

**Inputs required:** DATABASE_URL in `.env`, client appointment history in DB

**Outputs:** Reactivated clients returning to book, revenue recovered from lapsed base

**Tool:** `tools/fetch_lapsed_clients.py`

---

## Segmentation

Define lapse windows based on your average rebooking cycle. For most service businesses:

| Segment | Inactive Since | Label | Action |
|---|---|---|---|
| At-risk | 45-60 days | Slipping away | Gentle nudge |
| Lapsed | 61-90 days | Lost momentum | Offer incentive |
| Dormant | 91-180 days | Went elsewhere | Win-back offer |
| Cold | 180+ days | Likely churned | Hail mary / unsubscribe |

Run: `python tools/fetch_lapsed_clients.py` — outputs all four segments.

---

## Reactivation Sequence by Segment

### At-Risk (45-60 days)

Channel: Email or SMS
Tone: Casual, no urgency
Message: "We miss seeing you — here's what's new"
Offer: None needed yet. Curiosity and relationship are enough.

Template: `templates/reactivation_emails.md` → "At-Risk Nudge"

---

### Lapsed (61-90 days)

Channel: Email + SMS (both)
Tone: Warm, slight urgency
Message: "It's been a while — here's a reason to come back"
Offer: 15% off next visit, expires in 14 days

Template: `templates/reactivation_emails.md` → "Lapsed Offer"

---

### Dormant (91-180 days)

Channel: Email + SMS + personal outreach (if high-value client)
Tone: Direct, value-led
Message: "We'd love to earn your trust back"
Offer: 20% off or complimentary add-on service, expires in 7 days
Personal touch: If client spent $500+ lifetime, send a personalized text from the staff member they last worked with.

Template: `templates/reactivation_emails.md` → "Dormant Win-Back"

---

### Cold (180+ days)

Channel: Email only (don't SMS cold contacts)
Tone: Final, low pressure
Message: "Last check-in before we say goodbye"
Offer: Best offer you're willing to make (free add-on, significant discount)
If no response: Move to suppression list. Do not continue contacting.

Template: `templates/reactivation_emails.md` → "Cold Hail Mary"

---

## Execution Schedule

Run this workflow on the first Monday of every month:

1. `python tools/fetch_lapsed_clients.py` → review the four segment lists
2. Export each segment to CSV
3. Upload to email platform (SendGrid) into the correct list
4. Launch the matching email sequence for each segment
5. For dormant high-value clients: send personal SMS manually
6. After 30 days: run `tools/metrics_report.py` to measure reactivation rate

---

## What to Say to High-Value Lapsed Clients

Personal SMS script for clients with LTV >$300 who have been dormant 90-180 days:

> "Hey [Name], it's [Staff Name] from [Business]. It's been a while and I wanted to personally reach out — I'd love to have you back. I can offer you [20% off / complimentary add-on] on your next visit. Want me to grab you a spot? Just reply here."

This single message, sent personally from the staff member they worked with, is consistently the highest-converting touchpoint in reactivation.

---

## Post-Reactivation: Lock Them In

When a lapsed client returns, treat it like an acquisition. Run them through Sequence B (new client onboarding) from `workflows/02_email_nurture.md`. Their second return visit is the inflection point — if they come back twice after reactivation, they stay.

---

## Edge Cases

- **Client left due to bad experience:** Check notes before sending. Address the issue first or skip the campaign for this client.
- **Client moved away:** If their address is far outside your service area, suppress from campaigns.
- **Phone number changed:** SMS bounces will flag this. Update the record and switch to email-only.
- **Client unsubscribed:** Never contact via that channel again. Check other channels only if available and permitted.

---

## Success Metrics

| Metric | Target |
|---|---|
| Reactivation rate (at-risk) | >40% |
| Reactivation rate (lapsed) | >25% |
| Reactivation rate (dormant) | >15% |
| Reactivation rate (cold) | >5% |
| Revenue recovered per campaign | Track monthly |
