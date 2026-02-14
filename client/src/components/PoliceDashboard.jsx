import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import '../styles/Dashboard.css';

export default function PoliceDashboard() {
  const [signals, setSignals] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('free');
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchSignals();
    setupSocketListeners();
  }, []);

  const fetchSignals = async () => {
    try {
      const response = await apiClient.get('/police/locations');
      setSignals(response.data.locations);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    socket.on('ambulance_alert', (data) => {
      setAlerts((prev) => [data, ...prev.slice(0, 9)]);
    });
    socket.on('signal_updated', (data) => {
      fetchSignals();
    });
  };

  const handleUpdateSignal = async (e) => {
    e.preventDefault();
    if (!selectedLocation) {
      alert('Please select a location');
      return;
    }

    setLoading(true);
    try {
      await apiClient.put('/police/update-signal', {
        location: selectedLocation,
        status: selectedStatus,
      });
      fetchSignals();
      setSelectedLocation('');
      setSelectedStatus('free');
    } catch (error) {
      console.error('Error updating signal:', error);
      alert('Failed to update signal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Traffic Police Dashboard</h1>
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
          <h2>Update Signal Status</h2>

          <form onSubmit={handleUpdateSignal}>
            <div className="form-group">
              <label htmlFor="location">Select Location</label>
              <select
                id="location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                required
              >
                <option value="">Choose a location</option>
                {signals.map((signal) => (
                  <option key={signal._id} value={signal._id}>
                    {signal.location} (Currently: {signal.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Set Status</label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="free">Free</option>
                <option value="busy">Busy</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Signal'}
            </button>
          </form>
        </div>

        <div className="info-section">
          <div className="info-card">
            <h3>Managed Locations</h3>
            {signals.length > 0 ? (
              <ul>
                {signals.map((signal) => (
                  <li key={signal._id}>
                    <strong>{signal.location}</strong>
                    <br />
                    Current Status: <span className={`status ${signal.status}`}>{signal.status}</span>
                    <br />
                    <small>
                      Routes:
                      {signal.signalIds?.length > 0
                        ? signal.signalIds.join(', ')
                        : 'Multiple routes'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No signals assigned</p>
            )}
          </div>

          <div className="info-card">
            <h3>Ambulance Alerts</h3>
            {alerts.length > 0 ? (
              <ul className="alerts-list">
                {alerts.map((alert, idx) => (
                  <li key={idx} className="alert-item">
                    <strong>🚑 Alert</strong>
                    <p>{alert.message}</p>
                    <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No active alerts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
