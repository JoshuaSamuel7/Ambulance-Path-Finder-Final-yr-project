import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import ambulanceRoutes from './routes/ambulance.js';
import policeRoutes from './routes/police.js';
import hospitalRoutes from './routes/hospital.js';
import adminRoutes from './routes/admin.js';
import mapRoutes from './routes/maps.js';
import requestsRoutes from './routes/requests.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Store io instance in app for routes to access
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulance-alert');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/police', policeRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/requests', requestsRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room based on user type and identifier
  socket.on('join_room', (data) => {
    const { userRole, userIdentifier } = data;
    const room = `${userRole}_${userIdentifier}`;
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  // Handle real-time updates
  socket.on('signal_status_update', (data) => {
    io.emit('signal_updated', data);
  });

  socket.on('hospital_update', (data) => {
    io.emit('hospital_updated', data);
  });

  socket.on('ambulance_alert', (data) => {
    io.emit('alert_sent', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export getIO function for routes to access socket.io
export const getIO = () => io;

export default app;