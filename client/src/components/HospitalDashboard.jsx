import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { getSocket } from '../api/socket';
import '../styles/Dashboard.css';

export default function HospitalDashboard() {
  const [hospital, setHospital] = useState(null);
  const [beds, setBeds] = useState(0);
  const [accepting, setAccepting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchHospitalData();
    setupSocketListeners();
  }, []);

  const fetchHospitalData = async () => {
    try {
      const response = await apiClient.get('/hospital/my-hospital');
      const hospitalData = response.data.hospital;
      setHospital(hospitalData);
      setBeds(hospitalData.availableBeds);
      setAccepting(hospitalData.acceptingPatients);
    } catch (error) {
      console.error('Error fetching hospital data:', error);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    socket.on('patient_incoming', (data) => {
      setAlerts((prev) => [data, ...prev.slice(0, 9)]);
    });
    socket.on('hospital_updated', (data) => {
      fetchHospitalData();
    });
  };

  const handleUpdateBeds = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.put('/hospital/update-beds', { availableBeds: beds });
      fetchHospitalData();
      alert('Beds updated successfully');
    } catch (error) {
      console.error('Error updating beds:', error);
      alert('Failed to update beds');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.put('/hospital/update-status', { acceptingPatients: accepting });
      fetchHospitalData();
      alert('Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  if (!hospital) {
    return (
      <div className="dashboard">
        <div className="loading">Loading hospital data...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Hospital Dashboard - {hospital.hospitalName}</h1>
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
          <h2>Update Hospital Status</h2>

          <form onSubmit={handleUpdateBeds}>
            <div className="form-group">
              <label htmlFor="beds">Available Beds</label>
              <input
                id="beds"
                type="number"
                min="0"
                value={beds}
                onChange={(e) => setBeds(parseInt(e.target.value))}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Beds'}
            </button>
          </form>

          <form onSubmit={handleUpdateStatus} style={{ marginTop: '20px' }}>
            <div className="form-group">
              <label htmlFor="accepting">Accepting Patients</label>
              <select
                id="accepting"
                value={accepting}
                onChange={(e) => setAccepting(e.target.value === 'true')}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </form>
        </div>

        <div className="info-section">
          <div className="info-card">
            <h3>Hospital Information</h3>
            <ul>
              <li>
                <strong>Name:</strong> {hospital.hospitalName}
              </li>
              <li>
                <strong>Location:</strong> {hospital.location}
              </li>
              <li>
                <strong>Current Beds:</strong>{' '}
                <span className={hospital.availableBeds > 0 ? 'status free' : 'status busy'}>
                  {hospital.availableBeds}
                </span>
              </li>
              <li>
                <strong>Accepting:</strong>{' '}
                <span className={hospital.acceptingPatients ? 'status free' : 'status busy'}>
                  {hospital.acceptingPatients ? 'Yes' : 'No'}
                </span>
              </li>
            </ul>
          </div>

          <div className="info-card">
            <h3>Patient Alerts</h3>
            {alerts.length > 0 ? (
              <ul className="alerts-list">
                {alerts.map((alert, idx) => (
                  <li key={idx} className="alert-item">
                    <strong>⚠️ Patient Incoming</strong>
                    <p>{alert.message}</p>
                    <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No incoming patients</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
