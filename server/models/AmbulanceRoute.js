import mongoose from 'mongoose';

const ambulanceRouteSchema = new mongoose.Schema(
  {
    ambulanceDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in-transit', 'completed', 'cancelled'],
      default: 'pending',
    },
    patientNotes: {
      type: String,
      trim: true,
    },
    alertsSent: {
      type: Boolean,
      default: false,
    },
    signalsAffected: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrafficSignal',
      },
    ],
    hospitalsNotified: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
      },
    ],
  },
  { timestamps: true }
);

const AmbulanceRoute = mongoose.model('AmbulanceRoute', ambulanceRouteSchema);

export default AmbulanceRoute;
