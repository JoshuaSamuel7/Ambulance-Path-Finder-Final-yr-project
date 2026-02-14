import React from 'react';
import MapComponent from './MapComponent';
import '../styles/MapPage.css';

const AmbulanceMapPage = () => {
  return (
    <div className="map-page-container">
      <div className="map-page-header">
        <h1>🚑 Ambulance Route Management</h1>
        <p>Real-time route optimization with traffic awareness</p>
      </div>
      <MapComponent type="ambulance" />
    </div>
  );
};

export default AmbulanceMapPage;
