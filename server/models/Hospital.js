import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema(
  {
    hospitalName: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    discordUsername: {
      type: String,
      required: true,
      trim: true,
    },
    acceptingPatients: {
      type: Boolean,
      default: true,
    },
    availableBeds: {
      type: Number,
      default: 0,
      min: 0,
    },
    coordinatorName: {
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

const Hospital = mongoose.model('Hospital', hospitalSchema);

export default Hospital;
