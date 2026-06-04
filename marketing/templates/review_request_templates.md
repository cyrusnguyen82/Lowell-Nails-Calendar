# Review Request Templates

Variables: `{{first_name}}`, `{{business_name}}`, `{{staff_name}}`, `{{review_link}}`

Replace `{{review_link}}` with the value of `REVIEW_LINK` from your `.env` file.

---

## In-Person Ask Script

Use at checkout, immediately after the client expresses satisfaction:

> "Hey, I'm so glad you loved it — if you have 30 seconds, would you mind leaving us a quick Google review? It honestly makes such a difference for a small business like ours. Here — [show QR code / open link on your phone] — it takes less than a minute."

**Tips:**
- Only ask when the client is visibly happy — never after a neutral or negative experience
- Make it conversational, not transactional
- Show them how to do it on the spot — remove every friction point
- Have a printed QR code at checkout and one in the waiting area

---

## SMS Review Ask (Send Within 1 Hour of Appointment)

**Version A — Short:**
> Hey {{first_name}}, it's {{staff_name}} from {{business_name}}! So glad you came in today. If you have a quick second, a Google review would mean the world to us: {{review_link}} — Thank you! 🙏

**Version B — Slightly longer:**
> Hey {{first_name}}! Hope you're loving your results from today. If you'd be willing to share your experience on Google, it helps us so much — and takes less than a minute: {{review_link}}. Thanks for trusting us with your time! — {{staff_name}}

**Version C — Casual:**
> {{first_name}}! So great seeing you today. Quick ask — would you leave us a Google review? Here's the link: {{review_link}}. It seriously makes a huge difference. Thank you! ❤️

---

## Email Review Ask (Send Within 24 Hours)

**Subject A:** Would you do us a quick favor?

**Body:**
> Hey {{first_name}},
>
> It was great having you in today.
>
> If you enjoyed your experience, would you mind sharing it on Google? It genuinely helps people like you find us when they're searching, and it means a lot to our team.
>
> It takes less than a minute: **{{review_link}}**
>
> Thank you so much — we really appreciate it.
>
> — {{staff_name}} at {{business_name}}

---

**Subject B:** Your experience matters to us — and to others searching

**Body:**
> Hey {{first_name}},
>
> Thank you for visiting {{business_name}} today.
>
> We put a lot of care into every appointment, and honest client reviews are what help new clients decide whether to trust us. If you had a great experience, we'd be truly grateful if you'd share it on Google:
>
> → **{{review_link}}**
>
> And if anything wasn't quite right — just reply to this email. We'd rather hear it directly and make it right than have you leave unhappy.
>
> Either way, thank you for your time today.
>
> — {{staff_name}} & the {{business_name}} team

---

## Follow-Up (48-Hour, If No Review Left)

Send only once — do not continue following up after this.

**SMS:**
> Hey {{first_name}}, sorry to bug you one more time — just wanted to leave the link handy in case you haven't had a chance yet. No pressure at all: {{review_link}} — Thanks again for coming in! — {{staff_name}}

**Email Subject:** One last nudge (and then we'll leave you alone!)

**Email Body:**
> Hey {{first_name}},
>
> I just wanted to leave this here one more time in case life got busy: {{review_link}}
>
> After this I'll stop asking, I promise. But if you have 60 seconds and you'd be willing — it means a lot to us.
>
> Hope you're doing great.
>
> — {{staff_name}}

---

## Responding to Reviews

### 5-Star Response Template

> Thank you so much, [First Name]! It means everything to us to hear that — we put a lot of care into every appointment and it's incredibly rewarding to know it shows. We can't wait to see you next time! — {{business_name}} team

### 4-Star Response Template

> Thank you for taking the time to share your experience, [First Name]! We're so glad you enjoyed your visit. If there's anything we can do to make your next experience a full 5 stars, please don't hesitate to reach out — we're always looking to improve. See you soon!

### 3-Star Response Template

> Thank you for your honest feedback, [First Name]. We're sorry your experience wasn't everything it should have been. We'd love the chance to make it right — please reach out to us directly at [email/phone] so we can learn more about what happened. Your feedback helps us improve.

### 1-2 Star Response Template

> [First Name], thank you for bringing this to our attention — we're truly sorry to hear about your experience. This is not the standard we hold ourselves to, and we'd very much like to make it right. Please contact us directly at [email] or [phone] so we can address this personally. We take every review seriously.

**Never:** argue, make excuses, or be defensive in a public reply. Every response is read by potential clients — how you handle criticism reveals more about your business than the complaint itself.

---

## QR Code Instructions

1. Copy your `REVIEW_LINK` from `.env`
2. Go to qr-code-generator.com
3. Paste the link, generate QR code
4. Download as PNG
5. Print and laminate for:
   - Front desk / checkout counter
   - Waiting area
   - Stylist/tech station
   - Business cards
   - Thank-you cards
