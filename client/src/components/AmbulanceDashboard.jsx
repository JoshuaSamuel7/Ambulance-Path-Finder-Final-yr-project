import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import DashboardShell from './layout/DashboardShell';

/** Chennai — realistic pickup locations with accurate coordinates [lng, lat] GeoJSON format */
const CHENNAI_PICKUPS = {
  'Central Railway Station': [80.2704, 13.0832],
  'Anna Salai, Teynampet': [80.2431, 13.0389],
  'Nungambakkam': [80.2341, 13.0441],
  'Mylapore Temple Area': [80.2708, 13.0351],
  'Besant Nagar Beach': [80.2649, 12.9898],
  'Adyar Bridge': [80.2722, 13.0034],
  'ECR, Mahabalipuram Road': [80.2050, 12.8900],
  'T. Nagar Market': [80.2355, 13.0496],
  'Velachery': [80.2270, 12.9689],
  'Anna Nagar': [80.2212, 13.1683],
};

export default function AmbulanceDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('dispatch');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [medicalCondition, setMedicalCondition] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [severity, setSeverity] = useState('high');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [pickupLabel, setPickupLabel] = useState('');
  const [bedsRequired, setBedsRequired] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/auth/me');
        if (data.user) setProfile(data.user);
      } catch {
        setProfile(JSON.parse(localStorage.getItem('user') || '{}'));
      }
    })();
    loadHistory();
    const s = getSocket();
    const fn = () => loadHistory();
    s.on('hospital_preparing', fn);
    s.on('police_accepted', fn);
    return () => {
      s.off('hospital_preparing', fn);
      s.off('police_accepted', fn);
    };
  }, []);

  const loadHistory = async () => {
    try {
      const { data } = await apiClient.get('/requests/my-requests');
      setHistory(data.requests || []);
    } catch (e) {
      console.error(e);
    }
  };

  const pickupCoords = useMemo(() => {
    if (!pickupLabel || !CHENNAI_PICKUPS[pickupLabel]) return [80.2707, 13.0827];
    return CHENNAI_PICKUPS[pickupLabel];
  }, [pickupLabel]);

  // Calculate distance between two points (in km using Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find nearest pickup location to user's current position
  const findNearestPickup = (userLat, userLng) => {
    let nearest = null;
    let minDistance = Infinity;

    Object.entries(CHENNAI_PICKUPS).forEach(([label, [lng, lat]]) => {
      const dist = calculateDistance(userLat, userLng, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = label;
      }
    });

    return nearest;
  };

  // Get current location using Geolocation API
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please select a pickup zone manually.');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearest = findNearestPickup(latitude, longitude);
        if (nearest) {
          setPickupLabel(nearest);
        }
        setGeoLoading(false);
      },
      (error) => {
        let message = 'Unable to get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message += 'Please enable location permissions in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message += 'The request to get user location timed out.';
            break;
          default:
            message += 'An error occurred.';
        }
        alert(message);
        setGeoLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientName || !patientAge || !patientPhone || !medicalCondition || !pickupLabel) {
      alert('Complete patient details and pickup area.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post('/requests/create', {
        patientName,
        patientAge: parseInt(patientAge, 10),
        patientPhone,
        medicalCondition,
        severity,
        allergies: allergies || 'None',
        currentMedications: medications || 'None',
        bloodGroup,
        pickupLocation: pickupLabel,
        pickupCoordinates: pickupCoords,
        bedsRequired,
      });

      const nh = data.nearestHospital;
      const [pickupLat, pickupLng] = data.pickupCoordinates;
      const [hospLat, hospLng] = data.hospitalCoordinates;

      const runData = {
        requestId: data.request?._id,
        patientName,
        patientAge,
        medicalCondition,
        severity,
        bloodGroup,
        pickupLabel,
        hospitalName: nh.name,
        hospitalBeds: nh.beds,
        haversineKm: data.haversineDistanceKm,
        pickup: [pickupLat, pickupLng],
        hospital: [hospLat, hospLng],
        signalsOnRoute: data.signalsOnRoute || [],
        officersOnRoute: data.officersOnRoute || [],
        signalStats: data.signalStats,
        fallbackPoly: (data.routePolyline || []).map(([a, b]) => [a, b]),
      };

      let roadData = null;
      try {
        const { data: osrm } = await apiClient.get('/maps/driving-route', {
          params: { fromLat: pickupLat, fromLng: pickupLng, toLat: hospLat, toLng: hospLng },
        });
        roadData = osrm;
      } catch {
        roadData = null;
      }

      await loadHistory();

      // Navigate to dispatched route page with data
      navigate('/dispatch/route', { 
        state: { 
          run: runData, 
          road: roadData 
        } 
      });

      // Reset form
      setPatientName('');
      setPatientAge('');
      setPatientPhone('');
      setMedicalCondition('');
      setAllergies('');
      setMedications('');
      setPickupLabel('');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      title="Emergency dispatch"
      subtitle="Submit a case to assign the nearest Chennai hospital, alert corridor officers, and preview signals on your route."
    >
      <div className="tabs">
        <button type="button" className={tab === 'dispatch' ? 'active' : ''} onClick={() => setTab('dispatch')}>
          New request
        </button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Request log
        </button>
        <button type="button" className={tab === 'unit' ? 'active' : ''} onClick={() => setTab('unit')}>
          Unit &amp; driver
        </button>
      </div>

      {tab === 'dispatch' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="card">
            <h2>Patient &amp; Start Location</h2>
            <p className="lead">
              Clinical and contact details are shared with the receiving hospital for triage. Start Location uses live junction data
              for Chennai.
            </p>
            <form className="form-stack" onSubmit={handleSubmit}>
              <div className="form-row-2">
                <label>
                  Patient name *
                  <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
                </label>
                <label>
                  Age *
                  <input type="number" min={0} value={patientAge} onChange={(e) => setPatientAge(e.target.value)} required />
                </label>
              </div>
              <div className="form-row-2">
                <label>
                  Phone *
                  <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} required />
                </label>
                <label>
                  Blood group
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Medical condition *
                <select value={medicalCondition} onChange={(e) => setMedicalCondition(e.target.value)} required>
                  <option value="">Select</option>
                  <option>Chest Pain</option>
                  <option>Road Accident</option>
                  <option>Heart Attack</option>
                  <option>Stroke</option>
                  <option>Severe Headache</option>
                  <option>Asthma Attack</option>
                  <option>Fracture</option>
                  <option>Burns</option>
                  <option>Poisoning</option>
                  <option>Other Emergency</option>
                </select>
              </label>
              <div className="form-row-2">
                <label>
                  Severity
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label>
                  Start Location *
                  <select 
                    value={pickupLabel} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'current_location' || val === 'nearby_location') {
                        handleUseCurrentLocation();
                      } else {
                        setPickupLabel(val);
                      }
                    }} 
                    required
                  >
                    <option value="">Select</option>
                    <option value="current_location">📍 Current Location</option>
                    <option value="nearby_location">📍 Nearby Location</option>
                    <optgroup label="Saved Locations">
                      {Object.keys(CHENNAI_PICKUPS).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              </div>
              <label>
                Beds required
                <input
                  type="number"
                  min={1}
                  value={bedsRequired}
                  onChange={(e) => setBedsRequired(parseInt(e.target.value, 10) || 1)}
                />
              </label>
              <label>
                Allergies
                <input value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              </label>
              <label>
                Current medications
                <input value={medications} onChange={(e) => setMedications(e.target.value)} />
              </label>
              <button type="submit" className="btn-primary" disabled={loading || geoLoading}>
                {loading || geoLoading ? (geoLoading ? '🔍 Locating...' : 'Dispatching…') : 'Dispatch & show route'}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <h2>Request log</h2>
          <p className="lead">Recent dispatches from this unit (newest first).</p>
          {history.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No requests yet.</p>}
          {history.map((r) => (
            <div key={r._id} className="history-item">
              <strong>{r.patientName}</strong>
              <span className={`sev sev-${r.severity}`}>{r.severity}</span>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: 6 }}>
                {r.medicalCondition} · {r.pickupLocation} → {r.destinationHospital?.hospitalName}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Status: {r.status}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'unit' && (
        <div className="card">
          <h2>Unit &amp; driver</h2>
          <p className="lead">Credentials and vehicle identifiers registered for this account.</p>
          <p>
            <strong>Name:</strong> {profile?.name || '—'}
          </p>
          <p>
            <strong>Email:</strong> {profile?.email || '—'}
          </p>
          {profile?.driverPhone && (
            <p>
              <strong>Phone:</strong> {profile.driverPhone}
            </p>
          )}
          {profile?.ambulanceVehicleId && (
            <p>
              <strong>Vehicle:</strong> {profile.ambulanceVehicleId} {profile.ambulanceModel && `· ${profile.ambulanceModel}`}
            </p>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
