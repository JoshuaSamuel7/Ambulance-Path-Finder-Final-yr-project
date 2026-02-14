import express from 'express';
import { verifyToken, checkRole } from './auth.js';
import TrafficSignal from '../models/TrafficSignal.js';

const router = express.Router();

// Get all traffic signals for a police officer
router.get('/my-signals', verifyToken, checkRole(['police']), async (req, res) => {
  try {
    const signals = await TrafficSignal.find({ discordUsername: req.user.email }).select(
      'from to location status policeOfficerName'
    );

    // Get unique locations with their status
    const uniqueLocations = [];
    const locationSet = new Set();

    signals.forEach((signal) => {
      if (!locationSet.has(signal.location)) {
        locationSet.add(signal.location);
        uniqueLocations.push({
          id: signal._id,
          location: signal.location,
          status: signal.status,
          routes: signals
            .filter((s) => s.location === signal.location)
            .map((s) => ({ from: s.from, to: s.to })),
        });
      }
    });

    res.json({ signals: uniqueLocations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all traffic signals with distinct locations
router.get('/locations', verifyToken, checkRole(['police']), async (req, res) => {
  try {
    const signals = await TrafficSignal.aggregate([
      {
        $group: {
          _id: '$location',
          status: { $first: '$status' },
          signalIds: { $push: '$_id' },
        },
      },
    ]);

    res.json({ locations: signals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update signal status for a location
router.put('/update-signal', verifyToken, checkRole(['police']), async (req, res) => {
  try {
    const { location, status } = req.body;

    if (!location || !['free', 'busy'].includes(status)) {
      return res.status(400).json({ message: 'Location and valid status are required' });
    }

    // Update all signals at this location
    const result = await TrafficSignal.updateMany(
      { location },
      { status },
      { new: true }
    );

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('signal_updated', {
        location,
        status,
        updatedBy: req.user.email,
        timestamp: new Date(),
      });
    }

    res.json({
      message: `Signal status updated to ${status}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get signal details
router.get('/signal/:signalId', verifyToken, checkRole(['police']), async (req, res) => {
  try {
    const signal = await TrafficSignal.findById(req.params.signalId);
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }

    res.json({ signal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
