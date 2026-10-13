import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({ title, eyebrow, children, onClose, wide = false }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Avatar({ name, size = 'normal' }: { name?: string; size?: 'normal' | 'small' }) {
  const initials = (name || '?').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const tone = (name || 'a').charCodeAt(0) % 5;
  return <span className={`avatar avatar-${size} avatar-tone-${tone}`} title={name}>{initials}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading-block"><span className="spinner" />{label}</div>;
}

export function formatDate(date?: string) {
  if (!date) return 'No due date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
}

export function titleCase(value: string) {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
