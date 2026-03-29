import { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import DashboardShell from './layout/DashboardShell';
import EmergencyRouteMap from './maps/EmergencyRouteMap';

export default function PoliceDashboard() {
  const [tab, setTab] = useState('dispatches');
  const [requests, setRequests] = useState([]);
  const [signals, setSignals] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState('');
  const [sigStatus, setSigStatus] = useState('free');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [road, setRoad] = useState(null);

  const load = async () => {
    try {
      const { data } = await apiClient.get('/requests/all/pending');
      setRequests(data.requests || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSignals = async () => {
    try {
      const { data } = await apiClient.get('/police/locations');
      setSignals(data.locations || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    loadSignals();
    const s = getSocket();
    const onUp = () => {
      load();
      loadSignals();
    };
    s.on('emergency_request', onUp);
    s.on('signal_updated', loadSignals);
    s.on('police_accepted', load);
    return () => {
      s.off('emergency_request', onUp);
      s.off('signal_updated', loadSignals);
      s.off('police_accepted', load);
    };
  }, []);

  const openDetail = async (id) => {
    setLoading(true);
    setRoad(null);
    try {
      const { data } = await apiClient.get(`/requests/${id}`);
      setDetail(data);
      const r = data.request;
      const [plng, plat] = r.pickupCoordinates?.coordinates || [80.27, 13.0];
      let hlng = 80.25;
      let hlat = 13.06;
      if (r.destinationHospital?.coordinates?.coordinates) {
        [hlng, hlat] = r.destinationHospital.coordinates.coordinates;
      }
      try {
        const { data: osrm } = await apiClient.get('/maps/driving-route', {
          params: { fromLat: plat, fromLng: plng, toLat: hlat, toLng: hlng },
        });
        setRoad(osrm);
      } catch {
        setRoad(null);
      }
    } catch (e) {
      alert('Could not load request');
    } finally {
      setLoading(false);
    }
  };

  const accept = async (id) => {
    try {
      await apiClient.post(`/requests/${id}/police-accept`);
      await load();
      if (detail?.request?._id === id) openDetail(id);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    }
  };

  const updateSignal = async (e) => {
    e.preventDefault();
    if (!selectedLoc) return;
    setLoading(true);
    try {
      await apiClient.put('/police/update-signal', { location: selectedLoc, status: sigStatus });
      await loadSignals();
      setSelectedLoc('');
    } catch {
      alert('Update failed');
    } finally {
      setLoading(false);
    }
  };

  const r = detail?.request;
  const pickup = r
    ? (() => {
        const [lng, lat] = r.pickupCoordinates.coordinates;
        return [lat, lng];
      })()
    : null;
  const hospital =
    r?.destinationHospital?.coordinates?.coordinates
      ? (() => {
          const [lng, lat] = r.destinationHospital.coordinates.coordinates;
          return [lat, lng];
        })()
      : null;

  const polyline = useMemo(() => {
    if (road?.leafletPath?.length > 1) return road.leafletPath;
    if (detail?.routePolyline?.length) return detail.routePolyline.map(([a, b]) => [a, b]);
    if (pickup && hospital) return [pickup, hospital];
    return [];
  }, [road, detail, pickup, hospital]);

  const center = pickup && hospital ? [(pickup[0] + hospital[0]) / 2, (pickup[1] + hospital[1]) / 2] : [13.08, 80.27];

  return (
    <DashboardShell
      title="Traffic operations"
      subtitle="Monitor active ambulance dispatches, clear corridor signals, and open a case for route context and officer posts."
    >
      <div className="tabs">
        <button type="button" className={tab === 'dispatches' ? 'active' : ''} onClick={() => setTab('dispatches')}>
          Active dispatches
        </button>
        <button type="button" className={tab === 'junctions' ? 'active' : ''} onClick={() => setTab('junctions')}>
          Junction status
        </button>
      </div>

      {tab === 'dispatches' && (
        <div className="grid-2">
          <div className="card">
            <h2>Queue</h2>
            <p className="lead">Open a row to load corridor map, signal counts, and officers assigned to junctions on that route.</p>
            {requests.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No active dispatches.</p>}
            {requests.map((req) => (
              <button
                key={req._id}
                type="button"
                onClick={() => openDetail(req._id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: detail?.request?._id === req._id ? 'var(--color-accent-dim)' : 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                <strong>{req.patientName}</strong>
                <span className={`sev sev-${req.severity}`} style={{ marginLeft: 8 }}>
                  {req.severity}
                </span>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: 6 }}>
                  {req.pickupLocation} → {req.destinationHospital?.hospitalName}
                </div>
                {req.signalStats && (
                  <div style={{ fontSize: '0.75rem', marginTop: 6, color: '#94a3b8' }}>
                    Signals on route: {req.signalStats.total} ({req.signalStats.free} clear, {req.signalStats.busy} busy) · Officers:{' '}
                    {req.officersOnRoute?.length ?? 0}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="card">
            <h2>Route detail</h2>
            {!detail && <p className="lead">Select a dispatch to preview the map and actions.</p>}
            {loading && <p style={{ color: 'var(--color-muted)' }}>Loading…</p>}
            {detail && r && (
              <>
                <p className="lead">
                  <strong>{r.patientName}</strong> · {r.medicalCondition} · {r.pickupLocation}
                </p>
                <button type="button" className="btn-primary" style={{ maxWidth: 280 }} onClick={() => accept(r._id)}>
                  Acknowledge corridor
                </button>
                <div style={{ marginTop: 16 }}>
                  <EmergencyRouteMap
                    center={center}
                    zoom={12}
                    pickup={pickup}
                    hospital={hospital}
                    polyline={polyline}
                    signalsOnRoute={detail.signalsOnRoute || []}
                    officersOnRoute={detail.officersOnRoute || []}
                    signalStats={detail.signalStats}
                    roadLabel="Clearance route"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'junctions' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2>Update junction</h2>
          <p className="lead">Applies to all signals registered at the selected junction name.</p>
          <form className="form-stack" onSubmit={updateSignal}>
            <label>
              Junction
              <select value={selectedLoc} onChange={(e) => setSelectedLoc(e.target.value)} required>
                <option value="">Select</option>
                {signals.map((sig) => (
                  <option key={sig._id} value={sig.location}>
                    {sig.location} ({sig.status})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={sigStatus} onChange={(e) => setSigStatus(e.target.value)}>
                <option value="free">Clear / free</option>
                <option value="busy">Busy / congested</option>
              </select>
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Apply status'}
            </button>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
