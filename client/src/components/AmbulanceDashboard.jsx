import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import '../styles/Dashboard.css';

export default function AmbulanceDashboard() {
  const [routes, setRoutes] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [signals, setSignals] = useState([]);
  const [selectedFrom, setSelectedFrom] = useState('');
  const [selectedTo, setSelectedTo] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchRoutes();
    setupSocketListeners();
  }, []);

  useEffect(() => {
    if (selectedTo) {
      fetchHospitals(selectedTo);
    }
  }, [selectedTo]);

  useEffect(() => {
    if (selectedFrom && selectedTo) {
      fetchSignals(selectedFrom, selectedTo);
    }
  }, [selectedFrom, selectedTo]);

  const fetchRoutes = async () => {
    try {
      const response = await apiClient.get('/ambulance/routes');
      setRoutes(response.data.routes);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };

  const fetchHospitals = async (location) => {
    try {
      const response = await apiClient.get(`/ambulance/hospitals/${location}`);
      setHospitals(response.data.hospitals);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  const fetchSignals = async (from, to) => {
    try {
      const response = await apiClient.get(`/ambulance/signals/${from}/${to}`);
      setSignals(response.data.signals);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    socket.on('ambulance_alert', (data) => {
      setAlerts((prev) => [data, ...prev.slice(0, 4)]);
    });
  };

  const handleSubmitRoute = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post('/ambulance/submit-route', {
        from: selectedFrom,
        to: selectedTo,
        patientNotes,
      });

      setSubmitted(true);
      // Reset form
      setSelectedFrom('');
      setSelectedTo('');
      setPatientNotes('');

      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error('Error submitting route:', error);
      alert('Failed to submit route');
    } finally {
      setLoading(false);
    }
  };

  const uniqueFromLocations = [...new Set(routes.map((r) => r.from))];
  const toLocationsForFrom = routes
    .filter((r) => r.from === selectedFrom)
    .map((r) => r.to);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Ambulance Driver Dashboard</h1>
        <button
          onClick={() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }}
          className="logout-button"
        >
          Logout
        </button>
      </header>

      <div className="dashboard-container">
        <div className="form-section">
          <h2>Submit Emergency Route</h2>
          {submitted && (
            <div className="success-message">Route submitted! Alerts sent to police and hospitals.</div>
          )}

          <form onSubmit={handleSubmitRoute}>
            <div className="form-group">
              <label htmlFor="from">Starting Location</label>
              <select
                id="from"
                value={selectedFrom}
                onChange={(e) => setSelectedFrom(e.target.value)}
                required
              >
                <option value="">Select starting location</option>
                {uniqueFromLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="to">Destination</label>
              <select
                id="to"
                value={selectedTo}
                onChange={(e) => setSelectedTo(e.target.value)}
                disabled={!selectedFrom}
                required
              >
                <option value="">Select destination</option>
                {toLocationsForFrom.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Patient Notes (Optional)</label>
              <textarea
                id="notes"
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                placeholder="Enter patient condition details"
                rows="4"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Submitting...' : 'Submit Route & Alert'}
            </button>
          </form>
        </div>

        <div className="info-section">
          <div className="info-card">
            <h3>Hospitals at Destination</h3>
            {hospitals.length > 0 ? (
              <ul>
                {hospitals.map((h) => (
                  <li key={h._id}>
                    <strong>{h.hospitalName}</strong>
                    <br />
                    Accepting: {h.acceptingPatients ? 'Yes' : 'No'}
                    <br />
                    Available Beds: {h.availableBeds}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select a destination to view hospitals</p>
            )}
          </div>

          <div className="info-card">
            <h3>Traffic Signals on Route</h3>
            {signals.length > 0 ? (
              <ul>
                {signals.map((s) => (
                  <li key={s._id}>
                    <strong>{s.location}</strong>
                    <br />
                    Status: <span className={`status ${s.status}`}>{s.status}</span>
                    <br />
                    Officer: {s.policeOfficerName}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select a route to view signals</p>
            )}
          </div>

          <div className="info-card">
            <h3>Recent Alerts</h3>
            {alerts.length > 0 ? (
              <ul>
                {alerts.map((alert, idx) => (
                  <li key={idx}>
                    <p>{alert.message}</p>
                    <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No alerts yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
