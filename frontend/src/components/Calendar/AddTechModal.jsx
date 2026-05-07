import { useState } from 'react'

const COLORS = [
  '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1',
]

export default function AddTechModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  function getInitials(n) {
    return n.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function handleAdd() {
    if (!name.trim()) return
    onAdd({
      id: Date.now(),
      name: name.trim(),
      color,
      initials: getInitials(name),
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
        <div className="modal-header">
          <div className="modal-title">Add Technician</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Sophie B."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-swatches">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="tech-avatar" style={{ background: color }}>
                {getInitials(name)}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{name.trim()}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Add Technician</button>
        </div>
      </div>
    </div>
  )
}
