import express from 'express';
import { verifyToken, checkRole } from './auth.js';
import Hospital from '../models/Hospital.js';

const router = express.Router();

// Get all hospitals
router.get('/', verifyToken, async (req, res) => {
  try {
    const hospitals = await Hospital.find().select(
      'hospitalName location acceptingPatients availableBeds'
    );
    res.json({ hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get my hospital (for hospital staff)
router.get('/my-hospital', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.json({ hospital });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hospitals by location
router.get('/location/:location', verifyToken, async (req, res) => {
  try {
    const { location } = req.params;
    const hospitals = await Hospital.find({ location }).select(
      'hospitalName acceptingPatients availableBeds'
    );
    res.json({ hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update hospital bed availability
router.put('/update-beds', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const { availableBeds } = req.body;

    if (typeof availableBeds !== 'number' || availableBeds < 0) {
      return res.status(400).json({ message: 'Valid available beds count is required' });
    }

    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    hospital.availableBeds = availableBeds;
    await hospital.save();

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('hospital_beds_updated', {
        hospitalId: hospital._id,
        hospitalName: hospital.hospitalName,
        availableBeds,
        timestamp: new Date(),
      });
    }

    res.json({
      message: 'Beds updated successfully',
      hospital,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update patient acceptance status
router.put('/update-status', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const { acceptingPatients } = req.body;

    if (typeof acceptingPatients !== 'boolean') {
      return res.status(400).json({ message: 'Accepting patients must be true or false' });
    }

    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    hospital.acceptingPatients = acceptingPatients;
    await hospital.save();

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('hospital_status_updated', {
        hospitalId: hospital._id,
        hospitalName: hospital.hospitalName,
        acceptingPatients,
        timestamp: new Date(),
      });
    }

    res.json({
      message: 'Hospital status updated successfully',
      hospital,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hospital stats
router.get('/stats', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.json({
      hospitalName: hospital.hospitalName,
      location: hospital.location,
      acceptingPatients: hospital.acceptingPatients,
      availableBeds: hospital.availableBeds,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
