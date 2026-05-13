import './Booking.css'

export default function PrivacyPage() {
  return (
    <div className="booking-root">
      <div className="booking-header">
        <div className="booking-brand">Lowell Nails &amp; Spa</div>
        <div className="booking-title">Privacy Policy</div>
      </div>

      <div className="booking-card" style={{ padding: '24px', maxHeight: 'none' }}>
        <div style={{ fontSize: 12, color: '#7a9ab8', marginBottom: 20 }}>
          Last updated: May 13, 2026
        </div>

        {[
          {
            heading: 'Information We Collect',
            body: 'When you book an appointment through our online booking system, we collect your name and phone number. This information is used solely to confirm and manage your appointment.',
          },
          {
            heading: 'How We Use Your Information',
            body: 'We use your phone number to send SMS appointment confirmations and reminders. We do not sell, share, or distribute your personal information to third parties for marketing purposes.',
          },
          {
            heading: 'SMS Messaging',
            body: 'By providing your phone number during booking, you consent to receive SMS messages from Lowell Nails & Spa regarding your appointment. Message frequency varies — typically one confirmation per booking. Message and data rates may apply.',
          },
          {
            heading: 'Opt-Out',
            body: 'You may opt out of SMS messages at any time by replying STOP to any message. After opting out, you will receive one final confirmation that you have been unsubscribed. For help, reply HELP.',
          },
          {
            heading: 'Data Retention',
            body: 'Appointment records including your name and phone number are retained for business record-keeping purposes. You may contact us to request deletion of your information.',
          },
          {
            heading: 'Contact Us',
            body: 'If you have questions about this privacy policy, contact us at Lowell Nails & Spa, Lowell, Michigan, or call (616) 897-9090.',
          },
        ].map(({ heading, body }) => (
          <div key={heading} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0c1a2e', marginBottom: 6 }}>
              {heading}
            </div>
            <div style={{ fontSize: 13.5, color: '#5a7a9b', lineHeight: 1.75 }}>
              {body}
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px solid rgba(12,26,46,0.07)', paddingTop: 16, marginTop: 4 }}>
          <a href="/book" style={{ fontSize: 13, color: '#0ea5e9', textDecoration: 'none' }}>
            ← Back to booking
          </a>
        </div>
      </div>

      <div className="booking-footer" style={{ marginTop: 20 }}>
        © 2026 Lowell Nails &amp; Spa · Lowell, Michigan
      </div>
    </div>
  )
}
