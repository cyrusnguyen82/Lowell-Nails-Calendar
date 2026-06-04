"""
briefing.py

Generates and emails a daily morning briefing to the business owner.
Combines revenue, marketing actions needed, cash alerts, and system status
into one email delivered at 8am.

Usage:
    python Orchestration/tools/briefing.py              # generate and send
    python Orchestration/tools/briefing.py --preview    # print to terminal only
"""

import os
import csv
import argparse
import logging
from datetime import date, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("briefing")

SYMBOL = "$"
REFERRAL_LOG = ".tmp/referral_log.csv"
EVENT_LOG = ".tmp/event_log.csv"
ORCH_LOG = ".tmp/orchestration_log.csv"


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return psycopg2.connect(db_url)


def fmt(n):
    return f"{SYMBOL}{float(n):,.2f}"


# ─── Data Pulls ───────────────────────────────────────────────────────────────

def pull_revenue(cur, target: date) -> dict:
    yesterday = target - timedelta(days=1)
    prior_week_day = yesterday - timedelta(days=7)

    def day_rev(d):
        cur.execute("""
            SELECT COALESCE(SUM(total), 0), COUNT(*)
            FROM transactions
            WHERE created_at::date = %s
              AND status IN ('completed', 'paid', 'done')
              AND total > 0
        """, (d,))
        row = cur.fetchone()
        return float(row[0]), int(row[1])

    yesterday_rev, yesterday_tx = day_rev(yesterday)
    prior_rev, _ = day_rev(prior_week_day)

    cur.execute("""
        SELECT COALESCE(SUM(total), 0)
        FROM transactions
        WHERE created_at::date BETWEEN %s AND %s
          AND status IN ('completed', 'paid', 'done')
          AND total > 0
    """, (target.replace(day=1), yesterday))
    mtd = float(cur.fetchone()[0])

    change_pct = ((yesterday_rev - prior_rev) / prior_rev * 100) if prior_rev > 0 else 0
    return {
        "yesterday": yesterday_rev,
        "yesterday_tx": yesterday_tx,
        "prior_week_same_day": prior_rev,
        "change_pct": change_pct,
        "mtd": mtd,
    }


def pull_lapsed_counts(cur) -> dict:
    today = date.today()
    counts = {}
    for label, (min_d, max_d) in [("at_risk", (45, 60)), ("lapsed", (61, 90)), ("dormant", (91, 180))]:
        from_date = today - timedelta(days=max_d)
        to_date = today - timedelta(days=min_d)
        cur.execute("""
            SELECT COUNT(DISTINCT c.id)
            FROM clients c
            JOIN appointments a ON a.client_id = c.id
            WHERE a.status IN ('completed', 'done', 'confirmed')
            GROUP BY c.id
            HAVING MAX(a.start_time)::date BETWEEN %s AND %s
        """, (from_date, to_date))
        rows = cur.fetchall()
        counts[label] = len(rows)
    return counts


def pull_pending_reviews(cur) -> int:
    yesterday = date.today() - timedelta(days=1)
    cur.execute("""
        SELECT COUNT(DISTINCT a.client_id)
        FROM appointments a
        WHERE a.status IN ('completed', 'done')
          AND a.updated_at::date = %s
    """, (yesterday,))
    return cur.fetchone()[0] or 0


def pull_pending_rewards() -> int:
    if not os.path.exists(REFERRAL_LOG):
        return 0
    count = 0
    reward = int(os.getenv("REFERRAL_REWARD", 10))
    with open(REFERRAL_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("visit_completed") == "yes" and row.get("reward_issued") == "no":
                count += 1
    return count


def pull_cash_alert() -> dict:
    """Quick cash position check — returns alert if projected balance drops low."""
    threshold = float(os.getenv("CASH_ALERT_THRESHOLD", 0))
    if threshold == 0:
        return {"alert": False}

    rent = float(os.getenv("RENT_MONTHLY", 0))
    other = float(os.getenv("OTHER_FIXED_COSTS", 0))
    weekly_fixed = (rent + other) / 4.33

    if weekly_fixed * 4 > threshold:
        return {
            "alert": True,
            "message": f"Fixed costs ({fmt(weekly_fixed)}/wk) may exceed alert threshold ({fmt(threshold)}) within 4 weeks."
        }
    return {"alert": False}


def pull_failed_jobs() -> list:
    if not os.path.exists(ORCH_LOG):
        return []
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    failed = []
    with open(ORCH_LOG, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") == "failed" and row.get("timestamp", "")[:10] >= yesterday:
                failed.append(row.get("job_name", "unknown"))
    return failed


# ─── Report Assembly ──────────────────────────────────────────────────────────

def build_briefing(preview: bool = False) -> str:
    today = date.today()
    business = os.getenv("BUSINESS_NAME", "Your Business")
    owner = os.getenv("BUSINESS_OWNER", "")

    lines = []
    lines.append(f"MORNING BRIEFING — {today.strftime('%A, %B %d, %Y')}")
    lines.append(f"{business}")
    lines.append("=" * 52)

    try:
        conn = get_connection()
        cur = conn.cursor()
    except Exception as e:
        lines.append(f"\n⚠ Could not connect to database: {e}")
        return "\n".join(lines)

    try:
        # Revenue
        rev = pull_revenue(cur, today)
        arrow = "▲" if rev["change_pct"] >= 0 else "▼"
        lines.append(f"\n💰 REVENUE")
        lines.append(f"   Yesterday:     {fmt(rev['yesterday'])}  ({rev['yesterday_tx']} transactions)")
        if rev["prior_week_same_day"] > 0:
            lines.append(f"   vs. Last Week: {fmt(rev['prior_week_same_day'])}  {arrow} {abs(rev['change_pct']):.1f}%")
        lines.append(f"   Month to Date: {fmt(rev['mtd'])}")

        # Alert on revenue drop
        if rev["change_pct"] < -float(os.getenv("LOW_REVENUE_ALERT_PCT", 20)):
            lines.append(f"   ⚠ Revenue down {abs(rev['change_pct']):.0f}% vs same day last week")

        # Marketing actions
        lapsed = pull_lapsed_counts(cur)
        pending_reviews = pull_pending_reviews(cur)
        total_lapsed = sum(lapsed.values())

        lines.append(f"\n📣 MARKETING ACTIONS")
        if pending_reviews > 0:
            lines.append(f"   Review requests queued: {pending_reviews} (firing automatically)")
        if lapsed["at_risk"] > 0:
            lines.append(f"   At-risk clients (45-60 days): {lapsed['at_risk']} — nurture emails active")
        if lapsed["lapsed"] > 0:
            lines.append(f"   Lapsed clients (61-90 days): {lapsed['lapsed']} — win-back emails active")
        if lapsed["dormant"] > 0:
            lines.append(f"   Dormant clients (91-180 days): {lapsed['dormant']} — consider personal outreach")
        if total_lapsed == 0 and pending_reviews == 0:
            lines.append(f"   ✅ No immediate marketing actions needed")

        # Referral rewards
        pending_rewards = pull_pending_rewards()
        if pending_rewards > 0:
            reward = os.getenv("REFERRAL_REWARD", "10")
            lines.append(f"\n🎁 REFERRAL REWARDS")
            lines.append(f"   {pending_rewards} reward(s) pending — ${reward} each")
            lines.append(f"   Apply at next client POS transaction")
            lines.append(f"   Then mark reward_issued=yes in .tmp/referral_log.csv")

        # Cash alert
        cash = pull_cash_alert()
        if cash["alert"]:
            lines.append(f"\n⚠ CASH FLOW ALERT")
            lines.append(f"   {cash['message']}")
            lines.append(f"   Run: python Financial/tools/cash_flow_forecast.py --cash-on-hand XXXX")

        # Failed jobs
        failed = pull_failed_jobs()
        if failed:
            lines.append(f"\n❌ FAILED JOBS (last 24 hrs)")
            for j in failed:
                lines.append(f"   - {j}")
            lines.append(f"   Check: .tmp/orchestration_log.csv")

        # Footer
        lines.append(f"\n{'─'*52}")
        lines.append(f"Automated by your Business Orchestration System")
        lines.append(f"Full reports: python Financial/tools/pl_report.py --monthly")

    except Exception as e:
        lines.append(f"\n⚠ Error generating briefing: {e}")
    finally:
        cur.close()
        conn.close()

    return "\n".join(lines)


def send_briefing(dry_run: bool = False):
    from Orchestration.tools.integrations.sendgrid_client import send_owner_email

    content = build_briefing()
    today = date.today()
    subject = f"Morning Briefing — {today.strftime('%a %b %d')}"

    if dry_run:
        print(content)
        return

    result = send_owner_email(subject, content)
    if result["success"]:
        log.info(f"[briefing] Sent to {os.getenv('OWNER_EMAIL')} ✅")
    else:
        log.error(f"[briefing] Failed: {result['error']}")


def main():
    parser = argparse.ArgumentParser(description="Daily morning briefing generator.")
    parser.add_argument("--preview", action="store_true", help="Print to terminal instead of sending.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    if args.preview:
        print(build_briefing(preview=True))
    else:
        send_briefing()


if __name__ == "__main__":
    main()
