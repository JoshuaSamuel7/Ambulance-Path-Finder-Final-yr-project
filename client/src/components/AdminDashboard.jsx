import { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import '../styles/Dashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [signals, setSignals] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);

  // Form states
  const [policeForm, setPoliceForm] = useState({
    name: '',
    email: '',
    password: '',
    location: '',
    discordUsername: '',
    from1: '',
    to1: '',
    from2: '',
    to2: '',
  });

  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    email: '',
    password: '',
    hospitalName: '',
    location: '',
    discordUsername: '',
    coordinatorName: '',
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, usersRes, signalsRes, hospitalsRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/traffic-signals'),
        apiClient.get('/admin/hospitals'),
      ]);

      setStats(statsRes.data.stats);
      setUsers(usersRes.data.users);
      setSignals(signalsRes.data.signals);
      setHospitals(hospitalsRes.data.hospitals);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleRegisterPolice = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Register user
      const registerRes = await apiClient.post('/auth/register', {
        name: policeForm.name,
        email: policeForm.email,
        password: policeForm.password,
        role: 'police',
      });

      // Setup traffic signals
      await apiClient.post('/admin/setup-traffic-signal', {
        userId: registerRes.data.user.id,
        policeOfficerName: policeForm.name,
        location: policeForm.location,
        from1: policeForm.from1,
        to1: policeForm.to1,
        from2: policeForm.from2,
        to2: policeForm.to2,
        discordUsername: policeForm.discordUsername,
      });

      alert('Police officer registered successfully');
      setPoliceForm({
        name: '',
        email: '',
        password: '',
        location: '',
        discordUsername: '',
        from1: '',
        to1: '',
        from2: '',
        to2: '',
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error registering police:', error);
      alert(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterHospital = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Register user
      const registerRes = await apiClient.post('/auth/register', {
        name: hospitalForm.name,
        email: hospitalForm.email,
        password: hospitalForm.password,
        role: 'hospital',
      });

      // Setup hospital
      await apiClient.post('/admin/setup-hospital', {
        userId: registerRes.data.user.id,
        hospitalName: hospitalForm.hospitalName,
        location: hospitalForm.location,
        discordUsername: hospitalForm.discordUsername,
        coordinatorName: hospitalForm.coordinatorName,
      });

      alert('Hospital registered successfully');
      setHospitalForm({
        name: '',
        email: '',
        password: '',
        hospitalName: '',
        location: '',
        discordUsername: '',
        coordinatorName: '',
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error registering hospital:', error);
      alert(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
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

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Dashboard Stats
        </button>
        <button
          className={`tab-button ${activeTab === 'police' ? 'active' : ''}`}
          onClick={() => setActiveTab('police')}
        >
          Register Police
        </button>
        <button
          className={`tab-button ${activeTab === 'hospital' ? 'active' : ''}`}
          onClick={() => setActiveTab('hospital')}
        >
          Register Hospital
        </button>
        <button
          className={`tab-button ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          Traffic Signals
        </button>
        <button
          className={`tab-button ${activeTab === 'hospitals' ? 'active' : ''}`}
          onClick={() => setActiveTab('hospitals')}
        >
          Hospitals
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'stats' && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <p className="stat-number">{stats.totalUsers}</p>
            </div>
            <div className="stat-card">
              <h3>Ambulance Drivers</h3>
              <p className="stat-number">{stats.ambulanceDrivers}</p>
            </div>
            <div className="stat-card">
              <h3>Police Officers</h3>
              <p className="stat-number">{stats.policeOfficers}</p>
            </div>
            <div className="stat-card">
              <h3>Hospital Staff</h3>
              <p className="stat-number">{stats.hospitals}</p>
            </div>
            <div className="stat-card">
              <h3>Traffic Signals</h3>
              <p className="stat-number">{stats.trafficSignals}</p>
            </div>
            <div className="stat-card">
              <h3>Total Hospitals</h3>
              <p className="stat-number">{stats.totalHospitals}</p>
            </div>
          </div>
        )}

        {activeTab === 'police' && (
          <div className="form-section">
            <h2>Register Police Officer</h2>
            <form onSubmit={handleRegisterPolice}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={policeForm.name}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={policeForm.email}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, email: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={policeForm.password}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Discord Username</label>
                  <input
                    type="text"
                    value={policeForm.discordUsername}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, discordUsername: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={policeForm.location}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, location: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <h3>Traffic Signal 1</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="text"
                    value={policeForm.from1}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, from1: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>To</label>
                  <input
                    type="text"
                    value={policeForm.to1}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, to1: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <h3>Traffic Signal 2 (Optional)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="text"
                    value={policeForm.from2}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, from2: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>To</label>
                  <input
                    type="text"
                    value={policeForm.to2}
                    onChange={(e) =>
                      setPoliceForm({ ...policeForm, to2: e.target.value })
                    }
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                {loading ? 'Registering...' : 'Register Police'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'hospital' && (
          <div className="form-section">
            <h2>Register Hospital</h2>
            <form onSubmit={handleRegisterHospital}>
              <div className="form-row">
                <div className="form-group">
                  <label>Coordinator Name</label>
                  <input
                    type="text"
                    value={hospitalForm.name}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={hospitalForm.email}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, email: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={hospitalForm.password}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hospital Name</label>
                  <input
                    type="text"
                    value={hospitalForm.hospitalName}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, hospitalName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={hospitalForm.location}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, location: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Discord Username</label>
                  <input
                    type="text"
                    value={hospitalForm.discordUsername}
                    onChange={(e) =>
                      setHospitalForm({ ...hospitalForm, discordUsername: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                {loading ? 'Registering...' : 'Register Hospital'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="info-section">
            <h2>Traffic Signals</h2>
            {signals.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>Location</th>
                      <th>Officer</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal) => (
                      <tr key={signal._id}>
                        <td>{signal.from}</td>
                        <td>{signal.to}</td>
                        <td>{signal.location}</td>
                        <td>{signal.policeOfficerName}</td>
                        <td>
                          <span className={`status ${signal.status}`}>
                            {signal.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No traffic signals registered</p>
            )}
          </div>
        )}

        {activeTab === 'hospitals' && (
          <div className="info-section">
            <h2>Registered Hospitals</h2>
            {hospitals.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Hospital Name</th>
                      <th>Location</th>
                      <th>Accepting</th>
                      <th>Available Beds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.map((hospital) => (
                      <tr key={hospital._id}>
                        <td>{hospital.hospitalName}</td>
                        <td>{hospital.location}</td>
                        <td>
                          <span className={hospital.acceptingPatients ? 'status free' : 'status busy'}>
                            {hospital.acceptingPatients ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>{hospital.availableBeds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hospitals registered</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
