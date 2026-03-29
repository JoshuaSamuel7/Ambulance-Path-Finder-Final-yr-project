import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['ambulance', 'police', 'hospital', 'admin'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ambulanceVehicleId: { type: String, trim: true },
    ambulanceModel: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    /** Chennai patrol post — used to match officers on emergency routes */
    patrolLatitude: { type: Number },
    patrolLongitude: { type: Number },
    badgeNumber: { type: String, trim: true },
    /** Chennai patrol post — GeoJSON Point format for geospatial queries */
    patrolCoordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false
      }
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
