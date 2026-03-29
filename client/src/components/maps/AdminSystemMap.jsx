import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ── Marker Icons ───────────────────────── */

const pickupIcon = L.divIcon({
  className: 'admin-div-icon',
  html: '<div class="admin-pin admin-pin-pickup" title="Pickup">P</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const hospitalIcon = L.divIcon({
  className: 'admin-div-icon',
  html: '<div class="admin-pin admin-pin-hospital" title="Hospital">H</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const policeIcon = L.divIcon({
  className: 'admin-div-icon',
  html: '<div class="admin-pin admin-pin-police" title="Police">◇</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function signalIcon(status) {
  const cls = status === 'busy' ? 'busy' : 'free';
  const symbol = status === 'busy' ? '✕' : '✓';
  return L.divIcon({
    className: 'admin-div-icon',
    html: `<div class="admin-pin admin-pin-signal ${cls}" title="Signal">${symbol}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function ambulanceIcon(severity) {
  const colorMap = {
    critical: '#e74c3c',
    high: '#e67e22',
    medium: '#f39c12',
    low: '#f1c40f',
  };
  const color = colorMap[severity] || '#3498db';
  return L.divIcon({
    className: 'admin-div-icon',
    html: `<div class="admin-pin admin-pin-ambulance" style="background-color: ${color};" title="Ambulance">🚑</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/* ── Map Utilities ───────────────────────── */

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize());
    const ro = new ResizeObserver(() => map.invalidateSize());
    const el = map.getContainer();
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    try {
      const b = L.latLngBounds(positions);
      if (b.isValid()) map.fitBounds(b, { padding: [48, 48], maxZoom: 13 });
    } catch {
      /* ignore */
    }
  }, [map, positions]);
  return null;
}

/**
 * Admin System Map - Shows all active requests, police, hospitals, and signals
 * @param {object} props
 * @param {object} props.data - { requests: [], policeOfficers: [], hospitals: [], signals: [] }
 */
export default function AdminSystemMap({ data }) {
  const { requests = [], policeOfficers = [], hospitals = [], signals = [] } = data || {};
  const [showLegend, setShowLegend] = useState(true);

  // Collect all positions for bounds
  const positions = [];

  requests.forEach((req) => {
    if (req.pickupCoordinates?.coordinates) {
      const [lng, lat] = req.pickupCoordinates.coordinates;
      positions.push([lat, lng]);
    }
  });

  hospitals.forEach((h) => {
    if (h.coordinates?.coordinates) {
      const [lng, lat] = h.coordinates.coordinates;
      positions.push([lat, lng]);
    }
  });

  policeOfficers.forEach((p) => {
    if (p.patrolCoordinates?.coordinates) {
      const [lng, lat] = p.patrolCoordinates.coordinates;
      positions.push([lat, lng]);
    }
  });

  signals.forEach((s) => {
    if (s.coordinates?.coordinates) {
      const [lng, lat] = s.coordinates.coordinates;
      positions.push([lat, lng]);
    }
  });

  const center = positions.length > 0 ? positions[0] : [13.0827, 80.2707]; // Default to Chennai

  // Count active requests
  const activeRequests = requests.filter((r) => ['pending', 'accepted', 'in-transit'].includes(r.status));
  const criticalCount = activeRequests.filter((r) => r.severity === 'critical').length;
  const highCount = activeRequests.filter((r) => r.severity === 'high').length;

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ flex: 1, borderRadius: '8px', overflow: 'hidden' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapResize />
        {positions.length > 1 && <FitBounds positions={positions} />}

        {/* Ambulance Requests */}
        {requests.map((req) => {
          if (!req.pickupCoordinates?.coordinates) return null;
          const [lng, lat] = req.pickupCoordinates.coordinates;
          const isActive = ['pending', 'accepted', 'in-transit'].includes(req.status);
          return (
            <Marker key={`pickup-${req._id}`} position={[lat, lng]} icon={pickupIcon}>
              <Popup>
                <div style={{ fontSize: '12px', maxWidth: '200px' }}>
                  <strong>{req.patientName}</strong>
                  <br />
                  <span style={{ color: '#888' }}>Pickup Location</span>
                  <br />
                  Condition: {req.medicalCondition}
                  <br />
                  Severity: <strong style={{ color: `var(--sev-${req.severity})` }}>{req.severity}</strong>
                  <br />
                  Status: {req.status}
                  {isActive && <br />}
                  {isActive && <>Driver: {req.ambulanceDriver?.name}</>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Hospitals */}
        {hospitals.map((h) => {
          if (!h.coordinates?.coordinates) return null;
          const [lng, lat] = h.coordinates.coordinates;
          return (
            <Marker key={`hospital-${h._id}`} position={[lat, lng]} icon={hospitalIcon}>
              <Popup>
                <div style={{ fontSize: '12px', maxWidth: '200px' }}>
                  <strong>{h.hospitalName}</strong>
                  <br />
                  Available Beds: <strong>{h.availableBeds}</strong>
                  <br />
                  Accepting: {h.acceptingPatients ? '✓ Yes' : '✗ No'}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Police Officers */}
        {policeOfficers.map((p, idx) => {
          if (!p.patrolCoordinates?.coordinates) return null;
          const [lng, lat] = p.patrolCoordinates.coordinates;
          return (
            <CircleMarker
              key={`police-${p._id}`}
              center={[lat, lng]}
              radius={6}
              fillColor="#3498db"
              color="#2980b9"
              weight={2}
              opacity={0.8}
              fillOpacity={0.4}
            >
              <Popup>
                <div style={{ fontSize: '12px', maxWidth: '150px' }}>
                  <strong>{p.name}</strong>
                  <br />
                  Officer on Patrol
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Traffic Signals */}
        {signals.map((s) => {
          if (!s.coordinates?.coordinates) return null;
          const [lng, lat] = s.coordinates.coordinates;
          return (
            <Marker key={`signal-${s._id}`} position={[lat, lng]} icon={signalIcon(s.status)}>
              <Popup>
                <div style={{ fontSize: '12px', maxWidth: '150px' }}>
                  <strong>{s.location}</strong>
                  <br />
                  Status: <span style={{ color: s.status === 'busy' ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>{s.status.toUpperCase()}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Sidebar Legend */}
      {showLegend && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            width: 280,
            backgroundColor: '#1a2332',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: '16px',
            zIndex: 500,
            maxHeight: '90vh',
            overflowY: 'auto',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', backgroundColor:'#1a2332' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>System Status</h3>
            <button
              onClick={() => setShowLegend(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
              Requests
            </h4>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#e74c3c', borderRadius: '2px', marginRight: '8px' }} />
                <span>Critical: {criticalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#e67e22', borderRadius: '2px', marginRight: '8px' }} />
                <span>High: {highCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#f39c12', borderRadius: '2px', marginRight: '8px' }} />
                <span>Active: {activeRequests.length}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
              Map Legend
            </h4>
            <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>P</strong> = Pickup Location
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>H</strong> = Hospital
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>◇</strong> = Police Officer
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>✓</strong> = Signal Free
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>✕</strong> = Signal Busy
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginTop: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
              Coverage
            </h4>
            <div style={{ fontSize: '12px', lineHeight: '1.8' }}>
              <div>🏥 Hospitals: {hospitals.length}</div>
              <div>👮 Officers: {policeOfficers.length}</div>
              <div>🚦 Signals: {signals.length}</div>
            </div>
          </div>
        </div>
      )}

      {!showLegend && (
        <button
          onClick={() => setShowLegend(true)}
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            zIndex: 500,
          }}
        >
          ⊕ Legend
        </button>
      )}
    </div>
  );
}
