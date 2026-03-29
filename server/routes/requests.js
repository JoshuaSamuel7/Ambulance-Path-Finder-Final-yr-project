import express from 'express';
import { verifyToken, checkRole } from './auth.js';
import AmbulanceRequest from '../models/AmbulanceRequest.js';
import Hospital from '../models/Hospital.js';
import TrafficSignal from '../models/TrafficSignal.js';
import User from '../models/User.js';

const router = express.Router();

const getIo = (req) => req.app.get('io');

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const distanceToSegmentKm = (lat, lon, pLat, pLon, hLat, hLon) => {
  const dPH = getDistanceKm(pLat, pLon, hLat, hLon);
  if (dPH < 0.001) return getDistanceKm(lat, lon, pLat, pLon);
  const dP = getDistanceKm(pLat, pLon, lat, lon);
  const dH = getDistanceKm(hLat, hLon, lat, lon);
  const maxSide = Math.max(dP, dH, dPH);
  const minSide = Math.min(dP, dH, dPH);
  if (maxSide * maxSide >= dP * dP + dH * dH) {
    const s = (dP + dH + dPH) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - dP) * (s - dH) * (s - dPH)));
    return (2 * area) / dPH;
  }
  return Math.min(dP, dH);
};

const buildPolyline = (pickupLat, pickupLng, hospLat, hospLng, steps = 32) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([pickupLat + (hospLat - pickupLat) * t, pickupLng + (hospLng - pickupLng) * t]);
  }
  return pts;
};

const getSignalsAlongRoute = async (pickupLat, pickupLng, hospLat, hospLng) => {
  const signals = await TrafficSignal.find({});
  return signals
    .map((s) => {
      const [slng, slat] = s.coordinates.coordinates;
      const distPickup = getDistanceKm(pickupLat, pickupLng, slat, slng);
      const distToLine = distanceToSegmentKm(slat, slng, pickupLat, pickupLng, hospLat, hospLng);
      return {
        _id: s._id,
        location: s.location,
        from: s.from,
        to: s.to,
        status: s.status,
        policeOfficerName: s.policeOfficerName,
        coordinates: [slat, slng],
        distanceFromPickupKm: Number(distPickup.toFixed(2)),
        distanceToRouteKm: Number(distToLine.toFixed(2)),
      };
    })
    .filter((x) => x.distanceToRouteKm < 0.8 && x.distanceFromPickupKm < 25)
    .sort((a, b) => a.distanceFromPickupKm - b.distanceFromPickupKm)
    .slice(0, 15);
};

/** Officers whose patrol post is within ~500m of a signal on this route */
const getOfficersOnRoute = async (signalsOnRoute) => {
  const officers = await User.find({ role: 'police' }).select(
    'name email badgeNumber patrolLatitude patrolLongitude'
  );
  const onRoute = [];
  for (const o of officers) {
    if (o.patrolLatitude == null || o.patrolLongitude == null) continue;
    const nearSignal = signalsOnRoute.some((s) => {
      const [slat, slng] = s.coordinates;
      const d = getDistanceKm(o.patrolLatitude, o.patrolLongitude, slat, slng);
      return d < 0.5;
    });
    if (nearSignal) {
      onRoute.push({
        _id: o._id,
        name: o.name,
        email: o.email,
        badgeNumber: o.badgeNumber,
        patrolCoordinates: [o.patrolLatitude, o.patrolLongitude],
      });
    }
  }
  return onRoute;
};

const emitEmergency = (io, payload) => {
  if (!io) return;
  io.emit('emergency_request', payload);
  io.emit('ambulance_alert', {
    ...payload,
    message: `Emergency: ${payload.patientName} — ${payload.pickupLocation}`,
  });
  io.emit('patient_incoming', {
    ...payload,
    message: `Incoming: ${payload.patientName} (${payload.severity})`,
    timestamp: new Date().toISOString(),
  });
};

router.post('/create', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const {
      patientName,
      patientAge,
      patientPhone,
      medicalCondition,
      severity,
      allergies,
      currentMedications,
      bloodGroup,
      pickupLocation,
      pickupCoordinates,
      bedsRequired,
    } = req.body;

    if (!patientName || !patientAge || !patientPhone || !medicalCondition || !severity) {
      return res.status(400).json({ message: 'Missing required patient information' });
    }

    const hospitals = await Hospital.find({ acceptingPatients: true });
    if (hospitals.length === 0) {
      return res.status(400).json({ message: 'No hospitals available' });
    }

    const [pickupLng, pickupLat] = pickupCoordinates || [80.2707, 13.0827];

    let nearestHospital = null;
    let minDistance = Infinity;
    hospitals.forEach((hospital) => {
      if (hospital.coordinates?.coordinates) {
        const [hospLng, hospLat] = hospital.coordinates.coordinates;
        const distance = getDistanceKm(pickupLat, pickupLng, hospLat, hospLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestHospital = {
            _id: hospital._id,
            name: hospital.hospitalName,
            location: hospital.location,
            coordinates: hospital.coordinates.coordinates,
            beds: hospital.availableBeds,
            distance: distance.toFixed(2),
          };
        }
      }
    });

    if (!nearestHospital) {
      return res.status(400).json({ message: 'Could not find nearest hospital' });
    }

    const [hospLng, hospLat] = nearestHospital.coordinates;

    const nearbyHospitals = hospitals
      .map((h) => {
        const [hlng, hlat] = h.coordinates.coordinates;
        return {
          _id: h._id,
          name: h.hospitalName,
          location: h.location,
          availableBeds: h.availableBeds,
          distanceKm: Number(getDistanceKm(pickupLat, pickupLng, hlat, hlng).toFixed(2)),
          coordinates: [hlat, hlng],
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);

    const signalsOnRoute = await getSignalsAlongRoute(pickupLat, pickupLng, hospLat, hospLng);
    const officersOnRoute = await getOfficersOnRoute(signalsOnRoute);

    const signalStats = {
      total: signalsOnRoute.length,
      free: signalsOnRoute.filter((s) => s.status === 'free').length,
      busy: signalsOnRoute.filter((s) => s.status === 'busy').length,
    };

    const routePolyline = buildPolyline(pickupLat, pickupLng, hospLat, hospLng);

    const newRequest = new AmbulanceRequest({
      ambulanceDriver: req.user.userId,
      patientName,
      patientAge,
      patientPhone,
      medicalCondition,
      severity,
      allergies,
      currentMedications,
      bloodGroup,
      pickupLocation,
      pickupCoordinates: {
        type: 'Point',
        coordinates: [pickupLng, pickupLat],
      },
      destinationHospital: nearestHospital._id,
      bedsRequired: bedsRequired || 1,
      status: 'pending',
      requestedAt: new Date(),
    });

    await newRequest.save();
    await newRequest.populate('destinationHospital');

    const socketPayload = {
      requestId: newRequest._id.toString(),
      patientName,
      severity,
      medicalCondition,
      pickupLocation,
      hospitalName: nearestHospital.name,
      hospitalId: nearestHospital._id.toString(),
      pickupCoordinates: [pickupLat, pickupLng],
      hospitalCoordinates: [hospLat, hospLng],
      signalCount: signalStats.total,
      officerCount: officersOnRoute.length,
    };

    emitEmergency(getIo(req), socketPayload);

    res.status(201).json({
      success: true,
      message: 'Emergency request created successfully',
      request: newRequest,
      nearestHospital,
      nearbyHospitals,
      pickupCoordinates: [pickupLat, pickupLng],
      hospitalCoordinates: [hospLat, hospLng],
      routePolyline,
      haversineDistanceKm: nearestHospital.distance,
      signalsOnRoute,
      signalStats,
      officersOnRoute,
      officersOnRouteCount: officersOnRoute.length,
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/my-requests', verifyToken, checkRole(['ambulance']), async (req, res) => {
  try {
    const requests = await AmbulanceRequest.find({ ambulanceDriver: req.user.userId })
      .populate('destinationHospital', 'hospitalName location availableBeds')
      .sort({ requestedAt: -1 });
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/all/pending', verifyToken, checkRole(['police', 'hospital']), async (req, res) => {
  try {
    const requests = await AmbulanceRequest.find({
      status: { $in: ['pending', 'accepted', 'in-transit'] },
    })
      .populate('ambulanceDriver', 'email name')
      .populate('destinationHospital', 'hospitalName location availableBeds coordinates')
      .sort({ requestedAt: -1 });

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const doc = r.toObject();
        const [plng, plat] = r.pickupCoordinates?.coordinates || [80.27, 13.0];
        let hospLat = 13.06;
        let hospLng = 80.25;
        if (r.destinationHospital?.coordinates?.coordinates) {
          [hospLng, hospLat] = r.destinationHospital.coordinates.coordinates;
        }
        const signalsOnRoute = await getSignalsAlongRoute(plat, plng, hospLat, hospLng);
        const officersOnRoute = await getOfficersOnRoute(signalsOnRoute);
        const signalStats = {
          total: signalsOnRoute.length,
          free: signalsOnRoute.filter((s) => s.status === 'free').length,
          busy: signalsOnRoute.filter((s) => s.status === 'busy').length,
        };
        return { ...doc, signalsOnRoute, officersOnRoute, signalStats };
      })
    );

    res.json({ requests: enriched });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/hospital/incoming', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found for this account' });
    }
    const requests = await AmbulanceRequest.find({
      destinationHospital: hospital._id,
      status: { $in: ['pending', 'accepted', 'in-transit', 'arrived'] },
    })
      .populate('ambulanceDriver', 'email name driverPhone ambulanceVehicleId')
      .sort({ requestedAt: -1 });

    res.json({ requests, hospital });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:requestId', verifyToken, async (req, res) => {
  try {
    const request = await AmbulanceRequest.findById(req.params.requestId)
      .populate('ambulanceDriver', 'email name driverPhone ambulanceVehicleId ambulanceModel')
      .populate('destinationHospital');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const [plng, plat] = request.pickupCoordinates?.coordinates || [80.27, 13.0];
    let hospLat = 13.06;
    let hospLng = 80.25;
    if (request.destinationHospital?.coordinates?.coordinates) {
      [hospLng, hospLat] = request.destinationHospital.coordinates.coordinates;
    }
    const signalsOnRoute = await getSignalsAlongRoute(plat, plng, hospLat, hospLng);
    const officersOnRoute = await getOfficersOnRoute(signalsOnRoute);
    const routePolyline = buildPolyline(plat, plng, hospLat, hospLng);
    const signalStats = {
      total: signalsOnRoute.length,
      free: signalsOnRoute.filter((s) => s.status === 'free').length,
      busy: signalsOnRoute.filter((s) => s.status === 'busy').length,
    };

    res.json({ request, signalsOnRoute, officersOnRoute, routePolyline, signalStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/police-accept', verifyToken, checkRole(['police']), async (req, res) => {
  try {
    const request = await AmbulanceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    request.status = 'accepted';
    request.policeOfficersNotified = request.policeOfficersNotified || [];
    request.policeOfficersNotified.push({
      officerId: req.user.userId,
      acceptedAt: new Date(),
      signalsGreened: true,
    });
    await request.save();

    const io = getIo(req);
    io?.emit('police_accepted', {
      requestId: request._id,
      patientName: request.patientName,
      message: `Route cleared for ${request.patientName}`,
      time: new Date().toLocaleTimeString(),
    });

    res.json({ success: true, message: 'Request acknowledged', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/hospital-prepare', verifyToken, checkRole(['hospital']), async (req, res) => {
  try {
    const { bedsToAllocate, preparationNotes } = req.body;
    const hospital = await Hospital.findOne({ createdBy: req.user.userId });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    const request = await AmbulanceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.destinationHospital.toString() !== hospital._id.toString()) {
      return res.status(403).json({ message: 'Not your hospital assignment' });
    }

    request.status = 'in-transit';
    request.bedsAllocated = bedsToAllocate;
    request.hospitalsNotified = request.hospitalsNotified || [];
    request.hospitalsNotified.push({
      hospitalId: hospital._id,
      preparedAt: new Date(),
      bedsAllocated: bedsToAllocate,
      notes: preparationNotes,
    });
    await request.save();

    const io = getIo(req);
    io?.emit('hospital_preparing', {
      requestId: request._id,
      patientName: request.patientName,
      bedsAllocated: bedsToAllocate,
      message: `${hospital.hospitalName} prepared ${bedsToAllocate} bed(s)`,
      time: new Date().toLocaleTimeString(),
    });

    res.json({ success: true, message: 'Preparation recorded', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'in-transit', 'arrived', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const request = await AmbulanceRequest.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    ).populate('destinationHospital', 'hospitalName');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Emit completion event so all dashboards are notified
    if (status === 'arrived' || status === 'completed') {
      const io = getIo(req);
      io?.emit('route_completed', {
        requestId: request._id,
        patientName: request.patientName,
        status,
        hospitalName: request.destinationHospital?.hospitalName || 'Hospital',
        message: `${request.patientName} has ${status === 'arrived' ? 'arrived at' : 'been discharged from'} ${request.destinationHospital?.hospitalName || 'hospital'}`,
        time: new Date().toLocaleTimeString(),
      });
    }

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
