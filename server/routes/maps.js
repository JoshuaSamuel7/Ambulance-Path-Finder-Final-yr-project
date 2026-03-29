import express from 'express';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import TrafficSignal from '../models/TrafficSignal.js';
import AmbulanceRoute from '../models/AmbulanceRoute.js';
import { verifyToken } from './auth.js';

const router = express.Router();

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
};

// Get all routes with map data
router.get('/routes-map', verifyToken, async (req, res) => {
  try {
    const routes = await AmbulanceRoute.find()
      .populate('ambulanceDriver', 'name email')
      .populate('signalsAffected', 'from to location status')
      .populate('hospitalsNotified', 'hospitalName location');

    const routesWithCoordinates = routes.map((route) => ({
      _id: route._id,
      driver: route.ambulanceDriver,
      from: route.from,
      to: route.to,
      patientNotes: route.patientNotes,
      status: route.status,
      signals: route.signalsAffected,
      hospitals: route.hospitalsNotified,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    }));

    res.json(routesWithCoordinates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get traffic signals with map data
router.get('/traffic-map', verifyToken, async (req, res) => {
  try {
    const signals = await TrafficSignal.find().select(
      'from to location status policeOfficerName createdAt updatedAt'
    );

    // Add traffic intelligence
    const signalsWithTraffic = signals.map((signal) => ({
      _id: signal._id,
      from: signal.from,
      to: signal.to,
      location: signal.location,
      status: signal.status,
      severity: signal.status === 'busy' ? 'high' : 'low',
      policeOfficerName: signal.policeOfficerName,
      createdAt: signal.createdAt,
      updatedAt: signal.updatedAt,
    }));

    res.json(signalsWithTraffic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hospitals with map data
router.get('/hospitals-map', verifyToken, async (req, res) => {
  try {
    const hospitals = await Hospital.find().select(
      'hospitalName location availableBeds acceptingPatients coordinatorName'
    );

    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get optimized route (intelligent routing)
router.post('/optimize-route', verifyToken, async (req, res) => {
  try {
    const { from, to, currentCoordinates } = req.body;

    if (!from || !to || !currentCoordinates) {
      return res
        .status(400)
        .json({ message: 'from, to, and currentCoordinates are required' });
    }

    // Get all signals on this route
    const signals = await TrafficSignal.find({ from, to });

    // Separate free and busy signals
    const freeSignals = signals.filter((s) => s.status === 'free');
    const busySignals = signals.filter((s) => s.status === 'busy');

    // Calculate alternative routes based on traffic
    const optimizedRoute = {
      primaryRoute: {
        from,
        to,
        totalSignals: signals.length,
        freeSignals: freeSignals.length,
        busySignals: busySignals.length,
        estimatedDelay: busySignals.length * 2, // 2 min per busy signal
        signals: signals.map((s) => ({
          location: s.location,
          status: s.status,
          severity: s.status === 'busy' ? 'high' : 'low',
        })),
      },
      recommendation: busySignals.length > 0 ? 'Consider alternative route' : 'Route is clear',
      alerts: busySignals.map((s) => ({
        location: s.location,
        type: 'BUSY_SIGNAL',
        severity: 'high',
      })),
    };

    res.json(optimizedRoute);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get nearby hospitals
router.post('/nearby-hospitals', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, radiusKm = 5 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'latitude and longitude required' });
    }

    // For demo, map hospital locations to coordinates
    const hospitalCoordinates = {
      'Downtown Medical Center': [12.9789, 77.5941],
      'Westside Healthcare Plaza': [13.0889, 80.2707],
      'Riverside Emergency District': [28.7231, 77.1025],
      'Central Business District': [19.076, 72.8777],
      'Lakeview Road Extension': [23.1815, 79.9864],
    };

    const hospitals = await Hospital.find({ acceptingPatients: true });

    const nearbyHospitals = hospitals
      .map((hospital) => {
        const coords = hospitalCoordinates[hospital.location] || [0, 0];
        const distance = calculateDistance(latitude, longitude, coords[0], coords[1]);
        return {
          _id: hospital._id,
          hospitalName: hospital.hospitalName,
          location: hospital.location,
          availableBeds: hospital.availableBeds,
          coordinates: coords,
          distance: parseFloat(distance),
        };
      })
      .filter((h) => h.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    res.json(nearbyHospitals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get route details with visualization data
router.get('/route-details/:routeId', verifyToken, async (req, res) => {
  try {
    const { routeId } = req.params;

    const route = await AmbulanceRoute.findById(routeId)
      .populate('ambulanceDriver', 'name email')
      .populate('signalsAffected')
      .populate('hospitalsNotified');

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Add map visualization data
    const routeVisualization = {
      _id: route._id,
      driver: route.ambulanceDriver,
      from: route.from,
      to: route.to,
      status: route.status,
      patientNotes: route.patientNotes,
      signals: route.signalsAffected.map((s) => ({
        _id: s._id,
        location: s.location,
        status: s.status,
        severity: s.status === 'busy' ? 'high' : 'low',
      })),
      hospital: route.hospitalsNotified[0]
        ? {
            _id: route.hospitalsNotified[0]._id,
            name: route.hospitalsNotified[0].hospitalName,
            location: route.hospitalsNotified[0].location,
            beds: route.hospitalsNotified[0].availableBeds,
          }
        : null,
      visualization: {
        routePath: {
          from: route.from,
          to: route.to,
          waypoints: route.signalsAffected.map((s) => s.location),
        },
        trafficOverlay: route.signalsAffected.map((s) => ({
          location: s.location,
          color: s.status === 'busy' ? '#ff0000' : '#00ff00',
          intensity: s.status === 'busy' ? 0.8 : 0.2,
        })),
        alerts: route.signalsAffected
          .filter((s) => s.status === 'busy')
          .map((s) => ({
            location: s.location,
            type: 'CONGESTION',
            severity: 'high',
          })),
      },
    };

    res.json(routeVisualization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get traffic heatmap data
router.get('/traffic-heatmap', verifyToken, async (req, res) => {
  try {
    const signals = await TrafficSignal.find();

    const heatmapData = signals.map((signal) => ({
      location: signal.location,
      intensity: signal.status === 'busy' ? 0.8 : 0.2,
      color: signal.status === 'busy' ? 'red' : 'green',
      severity: signal.status === 'busy' ? 'high' : 'low',
    }));

    res.json({
      timestamp: new Date(),
      data: heatmapData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get alternative routes
router.post('/alternative-routes', verifyToken, async (req, res) => {
  try {
    const { from, to } = req.body;

    // For demo, return multiple route options
    const allSignals = await TrafficSignal.find();

    const signalsForRoute = allSignals.filter((s) => s.from === from && s.to === to);

    // Route 1: Primary route
    // Route 2: Fastest route (avoiding busy signals)
    // Route 3: Safest route (main roads only)

    const alternatives = [
      {
        routeId: 1,
        name: 'Primary Route',
        from,
        to,
        distance: 1.2,
        estimatedTime: 15,
        signals: signalsForRoute.length,
        busySignals: signalsForRoute.filter((s) => s.status === 'busy').length,
        recommended: true,
      },
      {
        routeId: 2,
        name: 'Fastest Route',
        from,
        to,
        distance: 1.5,
        estimatedTime: 12,
        signals: signalsForRoute.length,
        busySignals: 0,
        recommended: signalsForRoute.filter((s) => s.status === 'busy').length > 0,
      },
      {
        routeId: 3,
        name: 'Safest Route',
        from,
        to,
        distance: 2.0,
        estimatedTime: 18,
        signals: signalsForRoute.length + 1,
        busySignals: 0,
        recommended: false,
      },
    ];

    res.json(alternatives);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** OSRM driving route — server-side proxy avoids browser CORS */
router.get('/driving-route', verifyToken, async (req, res) => {
  try {
    const fromLat = parseFloat(req.query.fromLat);
    const fromLng = parseFloat(req.query.fromLng);
    const toLat = parseFloat(req.query.toLat);
    const toLng = parseFloat(req.query.toLng);
    if ([fromLat, fromLng, toLat, toLng].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ message: 'Valid fromLat, fromLng, toLat, toLng required' });
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ message: 'Routing service unavailable' });
    }
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) {
      return res.status(404).json({ message: 'No route found' });
    }
    const coords = route.geometry?.coordinates || [];
    const leafletPath = coords.map(([lng, lat]) => [lat, lng]);
    res.json({
      leafletPath,
      distanceKm: Number(((route.distance || 0) / 1000).toFixed(2)),
      durationMin: Math.round((route.duration || 0) / 60),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
