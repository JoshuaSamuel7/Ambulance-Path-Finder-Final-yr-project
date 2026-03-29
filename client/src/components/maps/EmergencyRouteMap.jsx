import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './EmergencyRouteMap.css';
import { ChevronDown, ChevronUp } from 'lucide-react';

/* ── Distinct Marker Icons ───────────────── */

const pickupIcon = L.divIcon({
  className: 'em-div-icon',
  html: '<div class="em-pin em-pin-pickup" title="Pickup">A</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const hospitalIcon = L.divIcon({
  className: 'em-div-icon',
  html: '<div class="em-pin em-pin-hosp" title="Hospital">H</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function policeIcon(index) {
  return L.divIcon({
    className: 'em-div-icon',
    html: `<div class="em-pin em-pin-police" title="Officer">${index + 1}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function signalIcon(status) {
  const cls = status === 'busy' ? 'busy' : 'free';
  const symbol = status === 'busy' ? '✕' : '✓';
  return L.divIcon({
    className: 'em-div-icon',
    html: `<div class="em-pin em-pin-signal ${cls}" title="Signal">${symbol}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
      if (b.isValid()) map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
    } catch {
      /* ignore */
    }
  }, [map, positions]);
  return null;
}

/**
 * @param {object} props
 * @param {[number,number]} props.pickup [lat,lng]
 * @param {[number,number]} props.hospital [lat,lng]
 * @param {Array<[number,number]>} props.polyline
 * @param {Array} props.signalsOnRoute — { coordinates: [lat,lng], status, location, policeOfficerName }
 * @param {Array} props.officersOnRoute — { patrolCoordinates: [lat,lng], name, badgeNumber }
 * @param {{ total: number, free: number, busy: number }} props.signalStats
 */
export default function EmergencyRouteMap({
  center,
  zoom = 12,
  pickup,
  hospital,
  polyline = [],
  signalsOnRoute = [],
  officersOnRoute = [],
  signalStats,
  fitBounds = true,
  roadLabel = 'Driving route',
  style,
}) {
  const [showSignals, setShowSignals] = useState(true);
  const [showPolice, setShowPolice] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

  const linePositions = useMemo(() => {
    if (polyline?.length > 1) return polyline;
    if (pickup && hospital) return [pickup, hospital];
    return [];
  }, [polyline, pickup, hospital]);

  const boundsPositions = useMemo(() => {
    if (linePositions.length > 1) return linePositions;
    if (pickup && hospital) return [pickup, hospital];
    return [];
  }, [linePositions, pickup, hospital]);

  const safeCenter = center || pickup || [13.0827, 80.2707];

  const stats = signalStats || {
    total: signalsOnRoute.length,
    free: signalsOnRoute.filter((s) => s.status === 'free').length,
    busy: signalsOnRoute.filter((s) => s.status === 'busy').length,
  };

  return (
    <div className="em-map-wrap" style={style}>
      <div className={`em-map-legend ${legendOpen ? 'open' : 'closed'}`} aria-label="Map legend">
        <div className="em-legend-header" onClick={() => setLegendOpen(!legendOpen)}>
          <h4>Map Legend</h4>
          {legendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
        
        {legendOpen && (
          <div className="em-legend-content">
            {/* Endpoints */}
            <div className="em-legend-section-title">Endpoints</div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-pickup">A</span>
              <span className="em-legend-label">Ambulance Pickup</span>
            </div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-hospital">H</span>
              <span className="em-legend-label">Destination Hospital</span>
            </div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-route" />
              <span className="em-legend-label">{roadLabel} (OSRM)</span>
            </div>

            {/* Signals */}
            <div className="em-legend-section-title">Traffic Signals</div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-signal-green">✓</span>
              <span className="em-legend-label">Signal — Clear</span>
            </div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-signal-red">✕</span>
              <span className="em-legend-label">Signal — Congested</span>
            </div>

            {/* Officers */}
            <div className="em-legend-section-title">Personnel</div>
            <div className="em-legend-row">
              <span className="em-legend-marker marker-police">P</span>
              <span className="em-legend-label">Police Officer on Route</span>
            </div>

            {/* Stats */}
            <div className="em-legend-stats">
              <div className="em-stat-pill">
                <strong>{stats.total}</strong>
                <span>Signals</span>
              </div>
              <div className="em-stat-pill">
                <strong style={{ color: '#4ade80' }}>{stats.free}</strong>
                <span>Clear</span>
              </div>
              <div className="em-stat-pill">
                <strong style={{ color: '#f87171' }}>{stats.busy}</strong>
                <span>Busy</span>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="em-legend-toggles">
              <label className="em-toggle-label">
                <span className="em-toggle-switch">
                  <input type="checkbox" checked={showSignals} onChange={(e) => setShowSignals(e.target.checked)} />
                  <span className="em-toggle-track" />
                </span>
                <span className="em-toggle-text">Show Signals</span>
                <span className="em-toggle-count">{signalsOnRoute.length}</span>
              </label>
              <label className="em-toggle-label">
                <span className="em-toggle-switch">
                  <input type="checkbox" checked={showPolice} onChange={(e) => setShowPolice(e.target.checked)} />
                  <span className="em-toggle-track" />
                </span>
                <span className="em-toggle-text">Show Officers</span>
                <span className="em-toggle-count">{officersOnRoute.length}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      <MapContainer center={safeCenter} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <MapResize />
        {fitBounds && boundsPositions.length > 0 && <FitBounds positions={boundsPositions} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup && (
          <Marker position={pickup} icon={pickupIcon}>
            <Popup>
              <strong>🚑 Ambulance Pickup</strong><br />
              Start point for this corridor
            </Popup>
          </Marker>
        )}
        {hospital && (
          <Marker position={hospital} icon={hospitalIcon}>
            <Popup>
              <strong>🏥 Destination Hospital</strong><br />
              Emergency receiving facility
            </Popup>
          </Marker>
        )}
        {linePositions.length > 1 && (
          <Polyline
            positions={linePositions}
            pathOptions={{
              color: '#3b82f6',
              weight: 5,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: null,
            }}
          />
        )}
        {showSignals &&
          signalsOnRoute.map((s, i) => {
            const [lat, lng] = s.coordinates || [];
            if (lat == null || lng == null) return null;
            return (
              <Marker key={s._id || i} position={[lat, lng]} icon={signalIcon(s.status)}>
                <Popup>
                  <strong>🚦 {s.location}</strong><br />
                  Status: <span style={{ color: s.status === 'free' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                    {s.status === 'free' ? 'Clear' : 'Congested'}
                  </span><br />
                  {s.policeOfficerName && <>Assigned: {s.policeOfficerName}</>}
                </Popup>
              </Marker>
            );
          })}
        {showPolice &&
          officersOnRoute.map((o, i) => {
            const [lat, lng] = o.patrolCoordinates || [];
            if (lat == null || lng == null) return null;
            return (
              <Marker key={o._id || i} position={[lat, lng]} icon={policeIcon(i)}>
                <Popup>
                  <strong>👮 {o.name}</strong><br />
                  {o.badgeNumber && <>Badge: {o.badgeNumber}<br /></>}
                  On-route corridor patrol
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
