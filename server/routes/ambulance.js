import express from 'express';
import { verifyToken, checkRole } from './auth.js';
import AmbulanceRoute from '../models/AmbulanceRoute.js';
import TrafficSignal from '../models/TrafficSignal.js';
import Hospital from '../models/Hospital.js';

const router = express.Router();

// Get all available traffic routes
router.get('/routes', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const routes = await TrafficSignal.find({}, 'from to location');
    const uniqueRoutes = [];
    const routeSet = new Set();

    routes.forEach((route) => {
      const key = `${route.from}-${route.to}`;
      if (!routeSet.has(key)) {
        routeSet.add(key);
        uniqueRoutes.push({
          from: route.from,
          to: route.to,
        });
      }
    });

    res.json({ routes: uniqueRoutes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hospitals near destination
router.get('/hospitals/:location', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const { location } = req.params;
    const hospitals = await Hospital.find({ location }).select(
      'hospitalName location acceptingPatients availableBeds'
    );
    res.json({ hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get traffic signals for a route
router.get('/signals/:from/:to', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const { from, to } = req.params;
    const signals = await TrafficSignal.find({ from, to }).select(
      'location status policeOfficerName'
    );
    res.json({ signals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit route and trigger alerts
router.post('/submit-route', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const { from, to, patientNotes } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'From and To locations are required' });
    }

    // Create ambulance route
    const ambulanceRoute = new AmbulanceRoute({
      ambulanceDriver: req.user.userId,
      from,
      to,
      patientNotes,
      status: 'in-transit',
      alertsSent: true,
    });

    // Find affected traffic signals
    const signals = await TrafficSignal.find({ from, to });
    ambulanceRoute.signalsAffected = signals.map((s) => s._id);

    // Find hospitals at destination
    const hospitals = await Hospital.find({ location: to });
    ambulanceRoute.hospitalsNotified = hospitals.map((h) => h._id);

    await ambulanceRoute.save();

    // Emit socket events for real-time notifications
    if (req.app.get('io')) {
      const io = req.app.get('io');

      // Alert police
      signals.forEach((signal) => {
        io.to(`police_${signal.discordUsername}`).emit('ambulance_alert', {
          location: signal.location,
          from,
          to,
          message: `Ambulance incoming from ${from} to ${to}. Clear the road!`,
          timestamp: new Date(),
        });
      });

      // Alert hospitals
      hospitals.forEach((hospital) => {
        io.to(`hospital_${hospital.discordUsername}`).emit('patient_incoming', {
          hospitalName: hospital.hospitalName,
          from,
          message: `Patient incoming to ${to}. Prepare beds and first aid.`,
          timestamp: new Date(),
        });
      });
    }

    res.status(201).json({
      message: 'Route submitted and alerts sent',
      ambulanceRoute,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my routes
router.get('/my-routes', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const routes = await AmbulanceRoute.find({ ambulanceDriver: req.user.userId })
      .populate('signalsAffected')
      .populate('hospitalsNotified')
      .sort({ createdAt: -1 });

    res.json({ routes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update route status
router.put('/route/:routeId/status', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const { routeId } = req.params;
    const { status } = req.body;

    if (!['pending', 'in-transit', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const route = await AmbulanceRoute.findById(routeId);
    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    if (route.ambulanceDriver.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    route.status = status;
    await route.save();

    res.json({ message: 'Route status updated', route });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
