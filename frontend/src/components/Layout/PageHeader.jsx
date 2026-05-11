import { useApp } from '../../context/AppContext'
import './Layout.css'

export default function PageHeader({ onNavigate }) {
  const { companyInfo } = useApp()
  const name    = companyInfo.name    || 'Lowell Nails & Spa, LLC'
  const address = companyInfo.address || '505 W. Main St. Ste B'
  const city    = companyInfo.city    || 'Lowell, MI 49331'
  const logo    = companyInfo.logoUrl || '/logo.png'

  return (
    <div className="page-header">
      <button className="page-header-back" onClick={() => onNavigate('pos')}>
        ← Back to POS
      </button>

      <div className="page-header-center" onClick={() => onNavigate('pos')} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onNavigate('pos')}>
        <img src={logo} alt={name} className="page-header-logo" onError={e => { e.target.src = '/logo.png' }} />
        <div className="page-header-text">
          <div className="page-header-name">{name}</div>
          <div className="page-header-address">{address}</div>
          <div className="page-header-address">{city}</div>
        </div>
      </div>

      {/* spacer to keep center truly centered */}
      <div style={{ width: 120, flexShrink: 0 }} />
    </div>
  )
}
