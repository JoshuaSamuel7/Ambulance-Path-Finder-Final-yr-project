import React from 'react';
import MapComponent from './MapComponent';
import '../styles/MapPage.css';

const TrafficMapPage = () => {
  return (
    <div className="map-page-container">
      <div className="map-page-header">
        <h1>🚦 Traffic Signal Management</h1>
        <p>Monitor and optimize traffic signals for emergency vehicle passage</p>
      </div>
      <MapComponent type="traffic" />
    </div>
  );
};

export default TrafficMapPage;
