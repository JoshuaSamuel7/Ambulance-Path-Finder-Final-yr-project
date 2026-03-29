import mongoose from 'mongoose';

const AmbulanceRequestSchema = new mongoose.Schema({
  // Driver information
  ambulanceDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Patient information
  patientName: {
    type: String,
    required: true
  },
  patientAge: {
    type: Number,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  bloodGroup: String,
  medicalCondition: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  allergies: String,
  currentMedications: String,

  // Location information
  pickupLocation: {
    type: String,
    required: true
  },
  pickupCoordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  // Hospital assignment
  destinationHospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },
  bedsRequired: {
    type: Number,
    default: 1
  },
  bedsAllocated: Number,

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-transit', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Notifications and responses
  policeOfficersNotified: [{
    officerId: mongoose.Schema.Types.ObjectId,
    acceptedAt: Date,
    signalsGreened: Boolean
  }],

  hospitalsNotified: [{
    hospitalId: mongoose.Schema.Types.ObjectId,
    preparedAt: Date,
    bedsAllocated: Number,
    notes: String
  }],

  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  arrivedAtPickup: Date,
  arrivedAtHospital: Date,
  completedAt: Date,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// GeoJSON index for location-based queries
AmbulanceRequestSchema.index({ pickupCoordinates: '2dsphere' });

const AmbulanceRequest = mongoose.model('AmbulanceRequest', AmbulanceRequestSchema);

export default AmbulanceRequest;
