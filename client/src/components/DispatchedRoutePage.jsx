import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EmergencyRouteMap from './maps/EmergencyRouteMap';
import DashboardShell from './layout/DashboardShell';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

export default function DispatchedRoutePage() {
  const [tab, setTab] = useState('overview');
  const [dispatchStatus, setDispatchStatus] = useState('in-transit');
  const [statusLoading, setStatusLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { run, road } = location.state || {};

  if (!run) {
    return (
      <DashboardShell title="Dispatched Route" subtitle="Route preview">
        <div className="card">
          <p>No dispatch data available. Please submit a new request.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard/ambulance')}>
            Back to Dashboard
          </button>
        </div>
      </DashboardShell>
    );
  }

  const polyline = road?.leafletPath?.length > 1 
    ? road.leafletPath 
    : run?.fallbackPoly?.length > 1 
      ? run.fallbackPoly 
      : run?.pickup && run?.hospital 
        ? [run.pickup, run.hospital] 
        : [];

  const mapCenter = run 
    ? [(run.pickup[0] + run.hospital[0]) / 2, (run.pickup[1] + run.hospital[1]) / 2]
    : [13.0827, 80.2707];

  const handleStatusUpdate = async (newStatus) => {
    if (!run.requestId) {
      toast.error('No request ID available. Cannot update status.');
      return;
    }
    setStatusLoading(true);
    try {
      await apiClient.put(`/requests/${run.requestId}/status`, { status: newStatus });
      setDispatchStatus(newStatus);
      toast.success(
        newStatus === 'arrived' 
          ? '🏥 Marked as Arrived — Hospital has been notified!' 
          : '✅ Case completed successfully!'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const statusLabel = {
    'in-transit': 'IN TRANSIT',
    'arrived': 'ARRIVED',
    'completed': 'COMPLETED',
  };

  const statusColor = {
    'in-transit': '#f59e0b',
    'arrived': '#22c55e',
    'completed': '#6366f1',
  };

  return (
    <DashboardShell 
      title="Dispatched Route" 
      subtitle={`Route to ${run.hospitalName} for ${run.patientName}`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '34px', alignItems: 'start' }}>
        <div className="card" style={{ height: 'calc(100vh - 160px)', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <EmergencyRouteMap
            center={mapCenter}
            zoom={12}
            pickup={run.pickup}
            hospital={run.hospital}
            polyline={polyline}
            signalsOnRoute={run.signalsOnRoute}
            officersOnRoute={run.officersOnRoute}
            signalStats={run.signalStats}
            roadLabel="Ambulance corridor"
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          {/* Status Banner */}
          <div style={{ 
            background: statusColor[dispatchStatus] || '#f59e0b',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            boxShadow: `0 4px 12px ${statusColor[dispatchStatus]}40`
          }}>
            {statusLabel[dispatchStatus] || dispatchStatus.toUpperCase()}
          </div>

          <div className="tabs" style={{ marginBottom: 0, justifyContent: 'flex-start' }}>
            <button 
              type="button" 
              className={tab === 'overview' ? 'active' : ''} 
              onClick={() => setTab('overview')}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              Overview
            </button>
            <button 
              type="button" 
              className={tab === 'statistics' ? 'active' : ''} 
              onClick={() => setTab('statistics')}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              Statistics
            </button>
            <button 
              type="button" 
              className={tab === 'details' ? 'active' : ''} 
              onClick={() => setTab('details')}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              Details
            </button>
          </div>

          <div className="card" style={{ flex: 1 }}>
            {tab === 'overview' && (
              <>
                <h3 style={{ marginTop: 0 }}>Patient Details</h3>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '20px' }}>
                  <p><strong>Name:</strong> {run.patientName}</p>
                  <p><strong>Age:</strong> {run.patientAge}</p>
                  <p><strong>Condition:</strong> {run.medicalCondition}</p>
                  <p><strong>Severity:</strong> <span className={`sev sev-${run.severity}`}>{run.severity}</span></p>
                </div>

                <h3 style={{ marginTop: 0 }}>Hospital Assignment</h3>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <p><strong>Hospital:</strong> {run.hospitalName}</p>
                  <p><strong>Available Beds:</strong> {run.hospitalBeds}</p>
                  <p><strong>Pickup Zone:</strong> {run.pickupLabel}</p>
                </div>
              </>
            )}

            {tab === 'statistics' && (
              <>
                <h3 style={{ marginTop: 0 }}>Route Statistics</h3>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Straight-line:</span>
                    <strong>{run.haversineKm} km</strong>
                  </div>
                  {road && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Road distance:</span>
                        <strong>{road.distanceKm} km</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Estimated time:</span>
                        <strong>{road.durationMin}m</strong>
                      </div>
                    </>
                  )}
                  {run.signalStats && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Green signals:</span>
                        <strong>{run.signalStats.green || run.signalStats.free || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Red signals:</span>
                        <strong>{run.signalStats.red || run.signalStats.busy || 0}</strong>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {tab === 'details' && (
              <>
                <h3 style={{ marginTop: 0 }}>Additional Metadata</h3>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '20px' }}>
                  <p><strong>Blood Group:</strong> {run.bloodGroup}</p>
                  <p>
                    <strong>Dispatch Status:</strong>{' '}
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '4px',
                      background: statusColor[dispatchStatus] || '#f59e0b',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {statusLabel[dispatchStatus] || dispatchStatus}
                    </span>
                  </p>
                </div>

                <h3 style={{ marginTop: 0 }}>Alerted Police Officers</h3>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {run.officersOnRoute?.length > 0 ? (
                    <ul style={{ paddingLeft: '20px', margin: 0 }}>
                      {run.officersOnRoute.map((officer, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>
                          <strong>{officer.name}</strong>
                          {officer.badgeNumber && <div><small style={{ color: 'var(--color-muted)' }}>Badge: {officer.badgeNumber}</small></div>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--color-muted)', margin: 0 }}>No officers matched on this specific corridor.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dispatchStatus === 'in-transit' && (
              <button 
                className="btn-primary" 
                style={{ width: '100%', background: '#22c55e', borderColor: '#22c55e' }}
                onClick={() => handleStatusUpdate('arrived')}
                disabled={statusLoading}
              >
                {statusLoading ? 'Updating...' : '🏥 Mark as Arrived'}
              </button>
            )}
            {dispatchStatus === 'arrived' && (
              <button 
                className="btn-primary" 
                style={{ width: '100%', background: '#6366f1', borderColor: '#6366f1' }}
                onClick={() => handleStatusUpdate('completed')}
                disabled={statusLoading}
              >
                {statusLoading ? 'Updating...' : '✅ Mark as Completed'}
              </button>
            )}
            <button 
              className="btn-primary" 
              style={{ width: '100%', opacity: dispatchStatus === 'completed' ? 1 : 0.7 }}
              onClick={() => navigate('/dashboard/ambulance')}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
