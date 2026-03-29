import express from 'express';
import { verifyToken, checkRole } from './auth.js';
import User from '../models/User.js';
import TrafficSignal from '../models/TrafficSignal.js';
import Hospital from '../models/Hospital.js';
import AmbulanceRequest from '../models/AmbulanceRequest.js';

const router = express.Router();

// Get all users
router.get('/users', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('name email role isActive createdAt');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get users by role
router.get('/users/:role', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { role } = req.params;

    if (!['ambulance', 'police', 'hospital', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const users = await User.find({ role }).select('name email role isActive createdAt');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Toggle user active status
router.put('/users/:userId/toggle-active', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Setup traffic signal (called after police registration)
router.post('/setup-traffic-signal', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      userId,
      policeOfficerName,
      location,
      from1,
      to1,
      from2,
      to2,
      discordUsername,
    } = req.body;

    if (!userId || !policeOfficerName || !location || !from1 || !to1 || !discordUsername) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const signals = [];

    // Create first signal
    const signal1 = new TrafficSignal({
      from: from1,
      to: to1,
      location,
      policeOfficerName,
      discordUsername,
      createdBy: userId,
    });
    signals.push(await signal1.save());

    // Create second signal if provided
    if (from2 && to2) {
      const signal2 = new TrafficSignal({
        from: from2,
        to: to2,
        location,
        policeOfficerName,
        discordUsername,
        createdBy: userId,
      });
      signals.push(await signal2.save());
    }

    res.status(201).json({
      message: 'Traffic signals created successfully',
      signals,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Setup hospital
router.post('/setup-hospital', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { userId, hospitalName, location, discordUsername, coordinatorName } = req.body;

    if (!userId || !hospitalName || !location || !discordUsername || !coordinatorName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const hospital = new Hospital({
      hospitalName,
      location,
      discordUsername,
      coordinatorName,
      createdBy: userId,
      acceptingPatients: true,
      availableBeds: 0,
    });

    await hospital.save();

    res.status(201).json({
      message: 'Hospital created successfully',
      hospital,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all traffic signals
router.get('/traffic-signals', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const signals = await TrafficSignal.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ signals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all hospitals
router.get('/hospitals', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard stats
router.get('/stats', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const ambulanceDrivers = await User.countDocuments({ role: 'ambulance' });
    const policeOfficers = await User.countDocuments({ role: 'police' });
    const hospitals = await User.countDocuments({ role: 'hospital' });
    const trafficSignals = await TrafficSignal.countDocuments();
    const totalHospitals = await Hospital.countDocuments();

    res.json({
      stats: {
        totalUsers,
        ambulanceDrivers,
        policeOfficers,
        hospitals,
        trafficSignals,
        totalHospitals,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all ambulance requests with details for system map
router.get('/requests/all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const requests = await AmbulanceRequest.find()
      .populate('ambulanceDriver', 'name email')
      .populate('destinationHospital', 'hospitalName coordinates')
      .sort({ requestedAt: -1 });

    // Get all police officers with their signals
    const policeOfficers = await User.find({ role: 'police' })
      .select('name email patrolCoordinates');

    // Get all hospitals
    const hospitalsData = await Hospital.find()
      .select('hospitalName coordinates availableBeds acceptingPatients');

    // Get all traffic signals
    const signals = await TrafficSignal.find()
      .select('location coordinates status');

    res.json({
      requests,
      policeOfficers,
      hospitals: hospitalsData,
      signals,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
