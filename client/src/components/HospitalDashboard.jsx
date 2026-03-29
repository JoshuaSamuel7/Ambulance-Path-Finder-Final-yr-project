import { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import DashboardShell from './layout/DashboardShell';
import EmergencyRouteMap from './maps/EmergencyRouteMap';

export default function HospitalDashboard() {
  const [tab, setTab] = useState('incoming');
  const [hospital, setHospital] = useState(null);
  const [facilityLoaded, setFacilityLoaded] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [beds, setBeds] = useState(0);
  const [accepting, setAccepting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [road, setRoad] = useState(null);
  const [prepBeds, setPrepBeds] = useState(1);
  const [prepNotes, setPrepNotes] = useState('');

  const load = async () => {
    try {
      const { data } = await apiClient.get('/requests/hospital/incoming');
      setIncoming(data.requests || []);
      if (data.hospital) {
        setHospital(data.hospital);
        setBeds(data.hospital.availableBeds);
        setAccepting(data.hospital.acceptingPatients);
      } else {
        setHospital(null);
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setHospital(null);
      }
      console.error(e);
    } finally {
      setFacilityLoaded(true);
    }
  };

  useEffect(() => {
    load();
    const s = getSocket();
    const fn = () => load();
    s.on('emergency_request', fn);
    s.on('patient_incoming', fn);
    s.on('hospital_preparing', fn);
    return () => {
      s.off('emergency_request', fn);
      s.off('patient_incoming', fn);
      s.off('hospital_preparing', fn);
    };
  }, []);

  const openDetail = async (id) => {
    setLoading(true);
    setRoad(null);
    try {
      const { data } = await apiClient.get(`/requests/${id}`);
      setDetail(data);
      setPrepBeds(data.request?.bedsRequired || 1);
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
    } catch {
      alert('Could not load case');
    } finally {
      setLoading(false);
    }
  };

  const submitPrep = async () => {
    if (!detail?.request?._id) return;
    try {
      await apiClient.post(`/requests/${detail.request._id}/hospital-prepare`, {
        bedsToAllocate: prepBeds,
        preparationNotes: prepNotes,
      });
      setPrepNotes('');
      await load();
      await openDetail(detail.request._id);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    }
  };

  const r = detail?.request;
  const pickup = r
    ? (() => {
        const [lng, lat] = r.pickupCoordinates.coordinates;
        return [lat, lng];
      })()
    : null;
  const hospCoord =
    r?.destinationHospital?.coordinates?.coordinates
      ? (() => {
          const [lng, lat] = r.destinationHospital.coordinates.coordinates;
          return [lat, lng];
        })()
      : null;

  const polyline = useMemo(() => {
    if (road?.leafletPath?.length > 1) return road.leafletPath;
    if (detail?.routePolyline?.length) return detail.routePolyline.map(([a, b]) => [a, b]);
    if (pickup && hospCoord) return [pickup, hospCoord];
    return [];
  }, [road, detail, pickup, hospCoord]);

  const center = pickup && hospCoord ? [(pickup[0] + hospCoord[0]) / 2, (pickup[1] + hospCoord[1]) / 2] : [13.08, 80.27];

  if (!facilityLoaded) {
    return (
      <DashboardShell title="Hospital" subtitle="Loading facility profile…">
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      </DashboardShell>
    );
  }

  if (!hospital) {
    return (
      <DashboardShell title="Hospital" subtitle="Facility profile">
        <div className="card">
          <p className="lead">
            No hospital record is linked to this login. Use the seeded account <code>hospital@test.com</code> or run{' '}
            <code>npm run seed:new</code> in the server folder.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={hospital ? hospital.hospitalName : 'Hospital'}
      subtitle="Track incoming EMS cases, prepare beds and specialty resources, and review corridor signals before arrival."
    >
      <div className="tabs">
        <button type="button" className={tab === 'incoming' ? 'active' : ''} onClick={() => setTab('incoming')}>
          Incoming cases
        </button>
        <button type="button" className={tab === 'capacity' ? 'active' : ''} onClick={() => setTab('capacity')}>
          Capacity
        </button>
      </div>

      {tab === 'incoming' && (
        <div className="grid-2">
          <div className="card">
            <h2>Triage queue</h2>
            <p className="lead">Cases routed to your facility. Select one for clinical summary and route context.</p>
            {incoming.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No active cases.</p>}
            {incoming.map((req) => (
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
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: 6 }}>{req.medicalCondition}</div>
              </button>
            ))}
          </div>

          <div className="card">
            <h2>Preparation &amp; route</h2>
            {!detail && <p className="lead">Select a case from the queue.</p>}
            {loading && <p style={{ color: 'var(--color-muted)' }}>Loading…</p>}
            {detail && r && (
              <>
                <div className="stat-grid">
                  <div className="stat">
                    <div className="label">Patient</div>
                    <div style={{ fontWeight: 600 }}>{r.patientName}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Blood</div>
                    <div className="value">{r.bloodGroup || '—'}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Beds requested</div>
                    <div className="value">{r.bedsRequired}</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', marginTop: 12 }}>{r.medicalCondition}</p>
                <div className="form-row-2" style={{ marginTop: 12 }}>
                  <label>
                    Beds to allocate
                    <input type="number" min={1} value={prepBeds} onChange={(e) => setPrepBeds(+e.target.value || 1)} />
                  </label>
                </div>
                <label>
                  Handoff notes (ER / OT)
                  <textarea
                    rows={2}
                    value={prepNotes}
                    onChange={(e) => setPrepNotes(e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <button type="button" className="btn-primary" onClick={submitPrep}>
                  Confirm preparation
                </button>
                <div style={{ marginTop: 16 }}>
                  <EmergencyRouteMap
                    center={center}
                    zoom={12}
                    pickup={pickup}
                    hospital={hospCoord}
                    polyline={polyline}
                    signalsOnRoute={detail.signalsOnRoute || []}
                    officersOnRoute={detail.officersOnRoute || []}
                    signalStats={detail.signalStats}
                    roadLabel="Inbound route"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'capacity' && hospital && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2>Bed &amp; intake capacity</h2>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await apiClient.put('/hospital/update-beds', { availableBeds: beds });
                await load();
              } catch {
                alert('Failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            <label>
              Available beds
              <input type="number" min={0} value={beds} onChange={(e) => setBeds(parseInt(e.target.value, 10) || 0)} />
            </label>
            <button type="submit" className="btn-primary">
              Update beds
            </button>
          </form>
          <form
            className="form-stack"
            style={{ marginTop: 20 }}
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await apiClient.put('/hospital/update-status', { acceptingPatients: accepting });
                await load();
              } catch {
                alert('Failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            <label>
              Accepting new patients
              <select value={accepting ? 'true' : 'false'} onChange={(e) => setAccepting(e.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <button type="submit" className="btn-primary">
              Save intake policy
            </button>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
