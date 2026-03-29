import mongoose from 'mongoose';

const trafficSignalSchema = new mongoose.Schema(
  {
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
    location: {
      type: String,
      required: true,
      trim: true,
    },
    coordinates: {
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
    policeOfficerName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['free', 'busy'],
      default: 'free',
    },
    discordUsername: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// GeoJSON index
trafficSignalSchema.index({ coordinates: '2dsphere' });

const TrafficSignal = mongoose.model('TrafficSignal', trafficSignalSchema);

export default TrafficSignal;
