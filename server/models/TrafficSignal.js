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

const TrafficSignal = mongoose.model('TrafficSignal', trafficSignalSchema);

export default TrafficSignal;
