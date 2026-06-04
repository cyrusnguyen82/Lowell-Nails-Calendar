# ARR Marketing System

**Acquisition → Retention → Revenue**

A complete online marketing system built on top of the booking + POS infrastructure. Designed to run with minimal manual effort once configured.

---

## Structure

```
marketing/
├── workflows/          # SOPs — what to do and when
├── templates/          # Ready-to-send email/SMS copy
└── tools/              # Python scripts that pull from the DB
```

---

## The 5 Pillars

| Pillar | Workflow | Tool |
|---|---|---|
| Lead Generation | `workflows/01_lead_generation.md` | — |
| Email Nurture | `workflows/02_email_nurture.md` | `tools/export_clients_for_email.py` |
| Review Requests | `workflows/03_review_requests.md` | `tools/fetch_lapsed_clients.py` |
| Referral Program | `workflows/04_referral_program.md` | `tools/referral_tracker.py` |
| Reactivation | `workflows/05_reactivation_campaign.md` | `tools/fetch_lapsed_clients.py` |
| Metrics | `workflows/06_metrics_dashboard.md` | `tools/metrics_report.py` |

---

## Required .env Variables

Add these to your root `.env` file:

```env
# Email delivery (SendGrid recommended)
SENDGRID_API_KEY=your_key_here
MARKETING_FROM_EMAIL=hello@yourbusiness.com
MARKETING_FROM_NAME=Your Business Name

# SMS delivery (Twilio)
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

# Review link (Google Business or Yelp)
REVIEW_LINK=https://g.page/r/your-google-review-link

# Referral program
REFERRAL_REWARD=10
REFERRAL_CURRENCY=USD
```

---

## Quick Start (Month 1 Checklist)

- [ ] Add env variables above to `.env`
- [ ] Run `tools/metrics_report.py` to get a baseline on current client data
- [ ] Run `tools/fetch_lapsed_clients.py` to find clients you can reactivate now
- [ ] Pick an email platform (SendGrid free tier = 100 emails/day)
- [ ] Set up Google Business Profile if not already done
- [ ] Load `templates/review_request_templates.md` and start sending review asks manually
- [ ] Read `workflows/01_lead_generation.md` and launch one paid channel

---

## KPIs to Track Weekly

| Metric | Target | Where to Pull |
|---|---|---|
| New bookings | +10% MoM | DB: `appointments` |
| Returning client rate | >60% | `tools/metrics_report.py` |
| Avg transaction value | Baseline → grow | `tools/metrics_report.py` |
| Review count | +5/month | Google Business |
| Reactivated clients | >10/month | `tools/fetch_lapsed_clients.py` |

---

## Philosophy

Most businesses spend on acquisition while leaking retention. This system plugs the leak first.

A client who books twice is worth 3x one who books once. A client who refers someone is worth 10x. Every tool and workflow here is designed to move clients up that value ladder.
