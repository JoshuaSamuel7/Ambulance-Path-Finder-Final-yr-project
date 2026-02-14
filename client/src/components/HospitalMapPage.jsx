import React from 'react';
import MapComponent from './MapComponent';
import '../styles/MapPage.css';

const HospitalMapPage = () => {
  return (
    <div className="map-page-container">
      <div className="map-page-header">
        <h1>🏥 Hospital Response Center</h1>
        <p>Track incoming ambulances and manage patient flow</p>
      </div>
      <MapComponent type="hospital" />
    </div>
  );
};

export default HospitalMapPage;
