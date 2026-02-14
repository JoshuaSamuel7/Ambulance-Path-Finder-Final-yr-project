import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import '../styles/MapComponent.css';

const MapComponent = ({ routeId = null, type = 'full' }) => {
  const [mapData, setMapData] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [hospitalData, setHospitalData] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState([]);

  // Fetch routes data
  const fetchRoutesMap = async () => {
    try {
      const response = await apiClient.get('/api/maps/routes-map');
      setMapData(response.data);
      if (routeId) {
        const route = response.data.find((r) => r._id === routeId);
        setSelectedRoute(route);
      } else if (response.data.length > 0) {
        setSelectedRoute(response.data[0]);
      }
    } catch (err) {
      setError('Failed to fetch routes');
      console.error(err);
    }
  };

  // Fetch traffic data
  const fetchTrafficMap = async () => {
    try {
      const response = await apiClient.get('/api/maps/traffic-map');
      setTrafficData(response.data);
    } catch (err) {
      console.error('Failed to fetch traffic data', err);
    }
  };

  // Fetch hospitals data
  const fetchHospitalsMap = async () => {
    try {
      const response = await apiClient.get('/api/maps/hospitals-map');
      setHospitalData(response.data);
    } catch (err) {
      console.error('Failed to fetch hospitals data', err);
    }
  };

  // Fetch alternative routes
  const fetchAlternativeRoutes = async () => {
    if (!selectedRoute) return;
    try {
      const response = await apiClient.post('/api/maps/alternative-routes', {
        from: selectedRoute.from,
        to: selectedRoute.to,
      });
      setAlternatives(response.data);
    } catch (err) {
      console.error('Failed to fetch alternative routes', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRoutesMap(), fetchTrafficMap(), fetchHospitalsMap()]);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (showAlternatives && selectedRoute) {
      fetchAlternativeRoutes();
    }
  }, [showAlternatives, selectedRoute]);

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    setShowAlternatives(false);
  };

  if (loading) {
    return <div className="map-container loading">Loading map data...</div>;
  }

  if (error) {
    return <div className="map-container error">{error}</div>;
  }

  return (
    <div className="map-container">
      <div className="map-header">
        <h2>🗺️ Ambulance Route Map & Traffic Visualization</h2>
        <div className="map-controls">
          <button
            className={`control-btn ${showTraffic ? 'active' : ''}`}
            onClick={() => setShowTraffic(!showTraffic)}
          >
            {showTraffic ? '🚨 Traffic ON' : '🚨 Traffic OFF'}
          </button>
          <button
            className={`control-btn ${showHospitals ? 'active' : ''}`}
            onClick={() => setShowHospitals(!showHospitals)}
          >
            {showHospitals ? '🏥 Hospitals ON' : '🏥 Hospitals OFF'}
          </button>
          <button
            className={`control-btn ${showAlternatives ? 'active' : ''}`}
            onClick={() => setShowAlternatives(!showAlternatives)}
          >
            {showAlternatives ? '🛣️ Alt Routes ON' : '🛣️ Alt Routes OFF'}
          </button>
        </div>
      </div>

      <div className="map-content">
        {/* Left Panel - Route List */}
        <div className="map-sidebar">
          <h3>Active Routes</h3>
          <div className="routes-list">
            {mapData && mapData.length > 0 ? (
              mapData.map((route) => (
                <div
                  key={route._id}
                  className={`route-item ${selectedRoute?._id === route._id ? 'selected' : ''}`}
                  onClick={() => handleRouteSelect(route)}
                >
                  <div className="route-info">
                    <p className="route-from">📍 From: {route.from}</p>
                    <p className="route-to">📍 To: {route.to}</p>
                    <p className="route-driver">👨‍⚕️ {route.driver?.name}</p>
                    <span className={`status-badge status-${route.status}`}>
                      {route.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="route-meta">
                    <span className="signal-count">🚨 {route.signals?.length || 0}</span>
                    <span className="hospital-count">🏥 {route.hospitals?.length || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">No routes available</p>
            )}
          </div>
        </div>

        {/* Main Map Area */}
        <div className="map-main">
          {selectedRoute ? (
            <div className="route-visualization">
              <div className="route-header">
                <h3>Route Details: {selectedRoute.from} → {selectedRoute.to}</h3>
                <span className={`status-badge status-${selectedRoute.status}`}>
                  {selectedRoute.status.toUpperCase()}
                </span>
              </div>

              {/* ASCII Map Visualization */}
              <div className="map-ascii">
                <div className="route-path">
                  <div className="location-marker start">
                    <span>📍</span>
                    <p>{selectedRoute.from}</p>
                  </div>

                  {/* Traffic Overlay */}
                  {showTraffic && selectedRoute.signals && selectedRoute.signals.length > 0 && (
                    <div className="traffic-section">
                      <h4>🚨 Traffic Signals</h4>
                      <div className="signals-list">
                        {selectedRoute.signals.map((signal, idx) => (
                          <div
                            key={idx}
                            className={`signal-item signal-${signal.status}`}
                          >
                            <div className="signal-dot" style={{
                              backgroundColor: signal.status === 'busy' ? '#ff0000' : '#00cc00',
                            }}></div>
                            <span className="signal-location">{signal.location}</span>
                            <span className={`signal-status status-${signal.status}`}>
                              {signal.status === 'busy' ? '🔴 CONGESTION' : '🟢 CLEAR'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="location-marker end">
                    <span>🏥</span>
                    <p>{selectedRoute.to}</p>
                  </div>
                </div>
              </div>

              {/* Route Statistics */}
              <div className="route-stats">
                <div className="stat-item">
                  <label>Total Signals</label>
                  <span>{selectedRoute.signals?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <label>Hospitals Notified</label>
                  <span>{selectedRoute.hospitals?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <label>Route Status</label>
                  <span className={`status-badge status-${selectedRoute.status}`}>
                    {selectedRoute.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Patient Notes */}
              {selectedRoute.patientNotes && (
                <div className="patient-notes">
                  <h4>Patient Notes</h4>
                  <p>{selectedRoute.patientNotes}</p>
                </div>
              )}

              {/* Hospitals in Route */}
              {showHospitals && selectedRoute.hospitals && selectedRoute.hospitals.length > 0 && (
                <div className="hospitals-section">
                  <h4>🏥 Hospitals</h4>
                  <div className="hospitals-list">
                    {selectedRoute.hospitals.map((hospital) => (
                      <div key={hospital._id} className="hospital-item">
                        <p className="hospital-name">{hospital.hospitalName}</p>
                        <p className="hospital-location">📍 {hospital.location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Routes */}
              {showAlternatives && alternatives.length > 0 && (
                <div className="alternatives-section">
                  <h4>🛣️ Alternative Routes</h4>
                  <div className="alternatives-list">
                    {alternatives.map((alt) => (
                      <div key={alt.routeId} className={`alt-route ${alt.recommended ? 'recommended' : ''}`}>
                        <h5>{alt.name} {alt.recommended && '⭐'}</h5>
                        <p>Distance: {alt.distance} km | Time: {alt.estimatedTime} min</p>
                        <p>Signals: {alt.signals} | Busy: {alt.busySignals}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-route-selected">Select a route to view details</div>
          )}
        </div>

        {/* Right Panel - Traffic Overview */}
        {showTraffic && (
          <div className="map-traffic-panel">
            <h3>🚨 Traffic Overview</h3>
            <div className="traffic-summary">
              <div className="traffic-stat">
                <span className="traffic-indicator clear">●</span>
                <span>Clear: {trafficData.filter((t) => t.status === 'free').length}</span>
              </div>
              <div className="traffic-stat">
                <span className="traffic-indicator congested">●</span>
                <span>Congested: {trafficData.filter((t) => t.status === 'busy').length}</span>
              </div>
            </div>

            <h4>Signal Status</h4>
            <div className="traffic-list">
              {trafficData.map((signal) => (
                <div key={signal._id} className={`traffic-item status-${signal.status}`}>
                  <div className="traffic-dot" style={{
                    backgroundColor: signal.status === 'busy' ? '#ff0000' : '#00cc00',
                  }}></div>
                  <div className="traffic-info">
                    <p className="traffic-route">{signal.from} → {signal.to}</p>
                    <span className={`traffic-badge status-${signal.status}`}>
                      {signal.status === 'busy' ? '🔴 BUSY' : '🟢 FREE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;
