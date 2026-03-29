import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSocket } from '../../api/socket';

const ROLE_LABELS = {
  ambulance: 'Ambulance EMS',
  police: 'Traffic police',
  hospital: 'Hospital coordination',
  admin: 'System administration',
};

export default function DashboardShell({ title, subtitle, children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const s = getSocket();
    
    const handleNewEvent = (data, titleContext) => {
      const newNotif = {
        id: Date.now() + Math.random(),
        title: titleContext,
        message: data.message || 'System update received',
        time: new Date().toLocaleTimeString(),
        read: false
      };
      setNotifications(prev => [newNotif, ...prev].slice(0, 20)); // Keep last 20
      toast.success(`${titleContext}: ${newNotif.message}`, { duration: 5000 });
    };

    const onEmergency = (data) => handleNewEvent(data, '🚨 New Dispatch');
    const onPolice = (data) => handleNewEvent(data, '🚓 Corridor Cleared');
    const onHospital = (data) => handleNewEvent(data, '🏥 Hospital Prepared');
    const onSignal = (data) => {
        // Only toast if it's relevant to avoiding noise
        if (user.role === 'ambulance' || user.role === 'police') {
           handleNewEvent({message: `${data.location} is now ${data.status}`}, '🚦 Signal Update');
        }
    };
    const onRouteComplete = (data) => handleNewEvent(data, '✅ Dispatch Completed');

    s.on('emergency_request', onEmergency);
    s.on('police_accepted', onPolice);
    s.on('hospital_preparing', onHospital);
    s.on('signal_updated', onSignal);
    s.on('route_completed', onRouteComplete);

    return () => {
      s.off('emergency_request', onEmergency);
      s.off('police_accepted', onPolice);
      s.off('hospital_preparing', onHospital);
      s.off('signal_updated', onSignal);
      s.off('route_completed', onRouteComplete);
    };
  }, [user.role]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({...n, read: true})));
    setShowDropdown(false);
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="shell-meta" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              className="btn-ghost" 
              style={{ padding: '8px', position: 'relative' }}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0, 
                  background: '#ef4444', color: 'white', 
                  fontSize: '0.65rem', padding: '2px 6px', 
                  borderRadius: '10px', fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, 
                width: '320px', background: 'var(--color-surface-elevated)', 
                border: '1px solid var(--color-border)', borderRadius: '8px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000,
                marginTop: '8px', overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                      No recent notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{ 
                        padding: '12px 16px', 
                        borderBottom: '1px solid var(--color-border)',
                        background: n.read ? 'transparent' : 'rgba(56, 189, 248, 0.05)'
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{n.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px' }}>{n.time}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="badge-role">{ROLE_LABELS[user.role] || user.role}</span>
          <span className="badge-role" style={{ opacity: 0.85 }}>
            {user.name || user.email}
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              localStorage.removeItem('authToken');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
