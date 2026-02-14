import mongoose from 'mongoose';
import User from './models/User.js';
import Hospital from './models/Hospital.js';
import TrafficSignal from './models/TrafficSignal.js';
import AmbulanceRoute from './models/AmbulanceRoute.js';
import dotenv from 'dotenv';

dotenv.config();

// Geographic coordinate mapping for Indian cities (similar to original MapMyIndia implementation)
const LOCATION_MAP = {
  // Starting Points
  'Main Street Station': { lat: 12.9716, lng: 77.5946, city: 'Bangalore' },
  'Central Station': { lat: 13.0827, lng: 80.2707, city: 'Chennai' },
  'North Plaza': { lat: 28.7041, lng: 77.1025, city: 'Delhi' },
  'Airport Junction': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
  'Business District': { lat: 23.1815, lng: 79.9864, city: 'Indore' },
  'Residential Area': { lat: 12.9716, lng: 77.5946, city: 'Bangalore' },

  // Destination - Hospitals
  'Downtown Medical Center': { lat: 12.9789, lng: 77.5941, city: 'Bangalore' },
  'Westside Healthcare Plaza': { lat: 13.0889, lng: 80.2707, city: 'Chennai' },
  'Riverside Emergency District': { lat: 28.7231, lng: 77.1025, city: 'Delhi' },
  'Central Business District': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
  'Lakeview Road Extension': { lat: 23.1815, lng: 79.9864, city: 'Indore' },
};

// Hospital mapping with coordinates for nearby search
const HOSPITAL_LOCATIONS = [
  {
    name: 'City Hospital',
    address: 'Downtown Medical Center',
    coordinates: [12.9789, 77.5941],
    city: 'Bangalore',
    beds: 150,
  },
  {
    name: 'St. Mary Medical Center',
    address: 'Westside Healthcare Plaza',
    coordinates: [13.0889, 80.2707],
    city: 'Chennai',
    beds: 200,
  },
  {
    name: 'Emergency Care Hospital',
    address: 'Riverside Emergency District',
    coordinates: [28.7231, 77.1025],
    city: 'Delhi',
    beds: 100,
  },
  {
    name: 'Metropolitan General Hospital',
    address: 'Central Business District',
    coordinates: [19.0760, 72.8777],
    city: 'Mumbai',
    beds: 250,
  },
  {
    name: 'Lakeside Trauma Center',
    address: 'Lakeview Road Extension',
    coordinates: [23.1815, 79.9864],
    city: 'Indore',
    beds: 80,
  },
];

// Traffic signal mapping with coordinates
const SIGNAL_ROUTES = [
  {
    from: 'Main Street Station',
    to: 'Downtown Medical Center',
    fromCoords: [12.9716, 77.5946],
    toCoords: [12.9789, 77.5941],
    location: 'Main & 1st Avenue (Bangalore)',
    distance: '1.2 km',
  },
  {
    from: 'Central Station',
    to: 'Westside Healthcare Plaza',
    fromCoords: [13.0827, 80.2707],
    toCoords: [13.0889, 80.2707],
    location: 'Central & Park Road (Chennai)',
    distance: '0.8 km',
  },
  {
    from: 'North Plaza',
    to: 'Riverside Emergency District',
    fromCoords: [28.7041, 77.1025],
    toCoords: [28.7231, 77.1025],
    location: 'North & River Boulevard (Delhi)',
    distance: '2.1 km',
  },
  {
    from: 'Airport Junction',
    to: 'Central Business District',
    fromCoords: [19.0760, 72.8777],
    toCoords: [19.0760, 72.8777],
    location: 'Airport Road & Highway 5 (Mumbai)',
    distance: '3.5 km',
  },
  {
    from: 'Business District',
    to: 'Lakeview Road Extension',
    fromCoords: [23.1815, 79.9864],
    toCoords: [23.1815, 79.9864],
    location: 'Business Ave & Lake Drive (Indore)',
    distance: '1.9 km',
  },
  {
    from: 'Residential Area',
    to: 'Downtown Medical Center',
    fromCoords: [12.9650, 77.5800],
    toCoords: [12.9789, 77.5941],
    location: 'Residential & Main Street (Bangalore)',
    distance: '1.5 km',
  },
];

// Patient cases with realistic conditions
const PATIENT_CASES = [
  {
    name: 'John Doe',
    age: 42,
    condition: 'Chest Pain - Suspected Cardiac',
    severity: 'HIGH',
    eta: 15,
  },
  {
    name: 'Jane Smith',
    age: 28,
    condition: 'Severe Allergic Reaction - Anaphylaxis',
    severity: 'CRITICAL',
    eta: 22,
  },
  {
    name: 'Michael Johnson',
    age: 65,
    condition: 'Acute Stroke - Time Critical',
    severity: 'CRITICAL',
    eta: -5, // Already arrived
  },
  {
    name: 'Emma Davis',
    age: 34,
    condition: 'Multiple Fractures - RTA',
    severity: 'HIGH',
    eta: 18,
  },
  {
    name: 'Robert Wilson',
    age: 71,
    condition: 'STEMI - Acute MI',
    severity: 'CRITICAL',
    eta: 12,
  },
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulance-alert');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Hospital.deleteMany({});
    await TrafficSignal.deleteMany({});
    await AmbulanceRoute.deleteMany({});
    console.log('Cleared existing data');

    // Create test users
    const users = await User.insertMany([
      {
        name: 'Ambulance Driver 1',
        email: 'ambulance1@test.com',
        password: 'TestPass123',
        role: 'ambulance',
      },
      {
        name: 'Ambulance Driver 2',
        email: 'ambulance2@test.com',
        password: 'TestPass123',
        role: 'ambulance',
      },
      {
        name: 'Traffic Police Officer',
        email: 'police@test.com',
        password: 'TestPass123',
        role: 'police',
      },
      {
        name: 'Hospital Staff',
        email: 'hospital@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'TestPass123',
        role: 'admin',
      },
    ]);
    console.log('✅ Created 5 test users');

    // Create hospitals with efficient mapping using map()
    const hospitals = await Hospital.insertMany(
      HOSPITAL_LOCATIONS.map((hosp, index) => ({
        hospitalName: hosp.name,
        location: hosp.address,
        availableBeds: [45, 62, 28, 78, 15][index], // Varying bed availability
        discordUsername: hosp.name.toLowerCase().replace(/\s+/g, '-'),
        coordinatorName: [
          'Dr. Sarah Johnson',
          'Dr. Michael Chen',
          'Dr. Jennifer Brown',
          'Dr. Robert Williams',
          'Dr. Lisa Anderson',
        ][index],
        createdBy: users[4]._id,
        acceptingPatients: index !== 3, // MetroGeneral not accepting
      }))
    );
    console.log('✅ Created 5 hospitals with location mapping');

    // Create traffic signals using efficient route mapping with map()
    const signals = await TrafficSignal.insertMany(
      SIGNAL_ROUTES.map((route, index) => ({
        from: route.from,
        to: route.to,
        location: route.location,
        status: index % 2 === 0 ? 'free' : 'busy',
        policeOfficerName: users[2].name,
        discordUsername: `signal-${index + 1}`,
        createdBy: users[2]._id,
      }))
    );
    console.log('✅ Created 6 traffic signals with route mapping');

    // Create ambulance routes with patient cases and efficient location mapping using map()
    const routes = await AmbulanceRoute.insertMany(
      PATIENT_CASES.map((patient, index) => {
        const routeInfo = SIGNAL_ROUTES[index];
        return {
          ambulanceDriver: index % 2 === 0 ? users[0]._id : users[1]._id,
          from: routeInfo.from,
          to: routeInfo.to,
          patientNotes: `${patient.name}, Age ${patient.age}\nCondition: ${patient.condition}\nSeverity: ${patient.severity}\nETA: ${patient.eta > 0 ? patient.eta + ' min' : 'ARRIVED'}`,
          status: patient.eta < 0 ? 'completed' : 'in-transit',
          alertsSent: true,
          signalsAffected: [signals[index]._id],
          hospitalsNotified: [hospitals[index]._id],
        };
      })
    );
    console.log('✅ Created 5 ambulance routes with patient cases');

    console.log('\n✅✅✅ Database seeding completed successfully! ✅✅✅\n');
    console.log('Test Accounts Created:');
    console.log('─────────────────────────────────────────');
    console.log('Ambulance Driver 1: ambulance1@test.com / TestPass123');
    console.log('Ambulance Driver 2: ambulance2@test.com / TestPass123');
    console.log('Traffic Police:     police@test.com / TestPass123');
    console.log('Hospital Staff:     hospital@test.com / TestPass123');
    console.log('Admin:              admin@test.com / TestPass123');
    console.log('─────────────────────────────────────────');

    console.log('\nLocation Mapping (MapMyIndia Style):');
    console.log('─────────────────────────────────────────');
    console.log('Hospitals with Coordinates:');
    HOSPITAL_LOCATIONS.forEach((h) => {
      console.log(
        `  • ${h.name}: [${h.coordinates[0]}, ${h.coordinates[1]}] - ${h.city}`
      );
    });

    console.log('\nTraffic Signal Routes with Distance:');
    SIGNAL_ROUTES.forEach((r, i) => {
      console.log(`  • Route ${i + 1}: ${r.from} → ${r.to} (${r.distance})`);
    });

    console.log('\nPatient Cases:');
    PATIENT_CASES.forEach((p, i) => {
      console.log(
        `  • Patient ${i + 1}: ${p.name}, Age ${p.age} - ${p.condition} [${p.severity}]`
      );
    });

    console.log('\nSample Data Populated:');
    console.log('• 5 Test Users');
    console.log('• 5 Hospitals (with location coordinates & efficient mapping)');
    console.log('• 6 Traffic Signals (with route mapping & distances)');
    console.log('• 5 Active Ambulance Routes (with patient cases & coordinates)');
    console.log('─────────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
