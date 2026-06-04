# Workflow: Email Nurture

**Objective:** Automatically guide new leads and clients through a sequence that builds trust, delivers value, and converts them into repeat bookings.

**Inputs required:** Email list (from booking widget or manual collection), email platform (SendGrid recommended), SENDGRID_API_KEY in `.env`

**Outputs:** Higher booking conversion rate, more repeat visits, stronger brand affinity

**Tool:** `tools/export_clients_for_email.py` — exports segmented client lists for upload to email platform

---

## Sequence Overview

### Sequence A: New Lead (Never Booked)

Triggered when: someone provides an email but has not completed a booking.

| Email | Timing | Goal | Template |
|---|---|---|---|
| 1. Welcome | Immediately | Set expectations, deliver value | `templates/email_nurture_sequence.md` → Welcome |
| 2. Social proof | Day 1 | Build trust | → Social Proof |
| 3. Value / education | Day 3 | Position as expert | → Value Drop |
| 4. Soft offer | Day 5 | First booking incentive | → First Visit Offer |
| 5. Direct ask | Day 7 | Convert to booking | → Direct Ask |
| 6. Last chance | Day 10 | Urgency close | → Last Chance |

---

### Sequence B: New Client (Just Booked for First Time)

Triggered when: client completes first appointment.

| Email | Timing | Goal | Template |
|---|---|---|---|
| 1. Onboarding | Same day | Validate their decision | → Post-Visit Welcome |
| 2. Results check-in | Day 3 | Reinforce satisfaction | → Check-In |
| 3. Care tips | Day 7 | Deliver value, stay top of mind | → Pro Tips |
| 4. Rebook prompt | Day 14 | Drive second visit | → Rebook |
| 5. Review request | Day 21 | Build social proof | → Review Ask |

See `workflows/03_review_requests.md` for full review workflow.

---

### Sequence C: Monthly Broadcast (All Active Clients)

Sent to: all clients who have booked at least once in the past 6 months.
Cadence: First Tuesday of every month.

| Month Type | Content |
|---|---|
| Slow month | Promotion or limited availability offer |
| New service | Announcement + early access offer for existing clients |
| Seasonal | Seasonal tie-in content + booking push |
| Standard | Value content (tip, education, behind-scenes) + soft CTA |

---

## Platform Setup (SendGrid)

1. Create free account at sendgrid.com (100 emails/day free)
2. Verify domain (or sender email) — required for deliverability
3. Add `SENDGRID_API_KEY` to `.env`
4. Create lists: "New Leads", "Active Clients", "Lapsed Clients"
5. Build automations using the sequences above
6. Upload contacts using `tools/export_clients_for_email.py`

---

## Deliverability Rules

- **Never buy email lists.** Only contact people who opted in.
- **Use a real from-name and reply-to.** "Michael from [Business]" outperforms "[Business] Team".
- **Send from a custom domain.** Gmail/Yahoo from-addresses get flagged as spam.
- **Subject line A/B test** every broadcast: send 20% to variant A, 20% to B, winner to the remaining 60%.
- **Unsubscribe link** must be in every email — legally required and good practice.
- **Aim for <0.5% unsubscribe rate** per send. If you exceed that, the content or frequency is off.

---

## Subject Line Formulas That Work

| Formula | Example |
|---|---|
| Question | "Still thinking about it?" |
| Number | "3 reasons clients rebook every 4 weeks" |
| Direct | "Your appointment slot is waiting" |
| Curiosity gap | "The thing most people don't know before their first visit" |
| Personalization | "[First name], we saved you a spot" |

---

## Edge Cases

- **Low open rate (<20%):** Subject lines are the problem. Test new formulas.
- **High open, low click rate:** CTA is unclear or there's too much text. Simplify to one action.
- **High unsubscribes:** Sending too frequently or content isn't relevant. Segment more tightly.
- **Bounces >2%:** List hygiene issue. Run `tools/export_clients_for_email.py --validate` to flag bad emails.

---

## Success Metrics

| Metric | Target |
|---|---|
| Open rate | >30% |
| Click-through rate | >3% |
| Booking conversion from email | >5% |
| Unsubscribe rate per send | <0.5% |
