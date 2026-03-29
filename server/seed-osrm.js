import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import User from './models/User.js';
import Hospital from './models/Hospital.js';
import TrafficSignal from './models/TrafficSignal.js';
import AmbulanceRoute from './models/AmbulanceRoute.js';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to hash passwords
async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return await bcryptjs.hash(password, salt);
}

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

// Realistic Chennai locations with accurate coordinates
const HOSPITAL_LOCATIONS = [
  {
    name: 'Apollo Hospitals',
    address: 'Greams Road, Chennai',
    coordinates: [13.0025, 80.2394],
    city: 'Chennai',
    beds: 150,
  },
  {
    name: 'Fortis Malar Hospital',
    address: 'Landmark Avenue, Luz, Chennai',
    coordinates: [13.0029, 80.2531],
    city: 'Chennai',
    beds: 120,
  },
  {
    name: 'Dr. Mehta\'s Hospitals',
    address: 'Mylapore, Chennai',
    coordinates: [13.0344, 80.2667],
    city: 'Chennai',
    beds: 100,
  },
  {
    name: 'MIOT International',
    address: 'Mahabalipuram Road, Chennai',
    coordinates: [12.8929, 80.2154],
    city: 'Chennai',
    beds: 180,
  },
  {
    name: 'Billroth Hospitals',
    address: 'Alwarpet, Chennai',
    coordinates: [13.0155, 80.2525],
    city: 'Chennai',
    beds: 90,
  },
];

// Realistic Chennai pickup locations with accurate coordinates
const PICKUP_LOCATIONS = [
  { label: 'Central Railway Station', coords: [13.0832, 80.2704] },
  { label: 'Anna Salai, Teynampet', coords: [13.0389, 80.2431] },
  { label: 'Nungambakkam', coords: [13.0441, 80.2341] },
  { label: 'Mylapore Temple Area', coords: [13.0351, 80.2708] },
  { label: 'Besant Nagar Beach', coords: [12.9898, 80.2649] },
  { label: 'Adyar Bridge', coords: [13.0034, 80.2722] },
  { label: 'ECR, Mahabalipuram Road', coords: [12.8900, 80.2050] },
  { label: 'T. Nagar Market', coords: [13.0496, 80.2355] },
  { label: 'Velachery', coords: [12.9689, 80.2270] },
  { label: 'Anna Nagar', coords: [13.1683, 80.2212] },
];

// Function to generate waypoints between two coordinates
function generateWaypointsBetween(from, to, numPoints = 3) {
  const waypoints = [];
  for (let i = 1; i <= numPoints; i++) {
    const t = i / (numPoints + 1);
    const lat = from[0] + (to[0] - from[0]) * t;
    const lng = from[1] + (to[1] - from[1]) * t;
    waypoints.push([lat, lng]);
  }
  return waypoints;
}

// Traffic signal mapping with coordinates - Chennai routes with accurate locations
const SIGNAL_ROUTES = [
  {
    from: 'Central Railway Station',
    to: 'Apollo Hospitals',
    fromCoords: [13.0832, 80.2704],
    toCoords: [13.0025, 80.2394],
    location: 'Central Railway Station to Greams Road',
    distance: '2.1 km',
    signals: [
      { location: 'Central Railway Station Exit', coords: [13.0832, 80.2704], status: 'free' },
      { location: 'Park Station Junction', coords: [13.0776, 80.2589], status: 'busy' },
      { location: 'Cathedral Road Intersection', coords: [13.0545, 80.2526], status: 'free' },
      { location: 'Greams Road Signal', coords: [13.0200, 80.2412], status: 'busy' },
      { location: 'Apollo Hospital Approach', coords: [13.0025, 80.2394], status: 'free' },
    ],
  },
  {
    from: 'Anna Salai, Teynampet',
    to: 'Fortis Malar Hospital',
    fromCoords: [13.0389, 80.2431],
    toCoords: [13.0029, 80.2531],
    location: 'Anna Salai to Luz Church',
    distance: '1.2 km',
    signals: [
      { location: 'Teynampet Signal', coords: [13.0389, 80.2431], status: 'free' },
      { location: 'Raja Annamalai Puram Junction', coords: [13.0308, 80.2520], status: 'busy' },
      { location: 'Luz Church Road', coords: [13.0100, 80.2531], status: 'free' },
      { location: 'Fortis Hospital Gate', coords: [13.0029, 80.2531], status: 'free' },
    ],
  },
  {
    from: 'Nungambakkam',
    to: 'Dr. Mehta\'s Hospitals',
    fromCoords: [13.0441, 80.2341],
    toCoords: [13.0344, 80.2667],
    location: 'Nungambakkam to Mylapore',
    distance: '2.8 km',
    signals: [
      { location: 'Nungambakkam High Road', coords: [13.0441, 80.2341], status: 'busy' },
      { location: 'Cathedral Road Junction', coords: [13.0345, 80.2440], status: 'free' },
      { location: 'Mylapore Road Signal', coords: [13.0344, 80.2550], status: 'busy' },
      { location: 'Srinivasa Perumal Temple Signal', coords: [13.0344, 80.2620], status: 'free' },
      { location: 'Hospital Entrance', coords: [13.0344, 80.2667], status: 'free' },
    ],
  },
  {
    from: 'Besant Nagar Beach',
    to: 'MIOT International',
    fromCoords: [12.9898, 80.2649],
    toCoords: [12.8929, 80.2154],
    location: 'Besant Nagar to Mahabalipuram Road',
    distance: '5.5 km',
    signals: [
      { location: 'Besant Nagar Beach Road', coords: [12.9898, 80.2649], status: 'free' },
      { location: 'Adyar Bridge', coords: [13.0034, 80.2722], status: 'busy' },
      { location: 'ECR Highway South', coords: [12.9500, 80.2500], status: 'free' },
      { location: 'Mahabalipuram Road Junction', coords: [12.8929, 80.2154], status: 'busy' },
      { location: 'MIOT Hospital Gate', coords: [12.8929, 80.2154], status: 'free' },
    ],
  },
  {
    from: 'T. Nagar Market',
    to: 'Billroth Hospitals',
    fromCoords: [13.0496, 80.2355],
    toCoords: [13.0155, 80.2525],
    location: 'T. Nagar to Alwarpet',
    distance: '1.8 km',
    signals: [
      { location: 'T. Nagar Main Street', coords: [13.0496, 80.2355], status: 'free' },
      { location: 'Usman Road Signal', coords: [13.0400, 80.2420], status: 'busy' },
      { location: 'Alwarpet Junction', coords: [13.0275, 80.2500], status: 'free' },
      { location: 'Billroth Hospital Signal', coords: [13.0155, 80.2525], status: 'free' },
    ],
  },
  {
    from: 'Velachery',
    to: 'Apollo Hospitals',
    fromCoords: [12.9689, 80.2270],
    toCoords: [13.0025, 80.2394],
    location: 'Velachery to Greams Road',
    distance: '4.2 km',
    signals: [
      { location: 'Velachery Main Road', coords: [12.9689, 80.2270], status: 'busy' },
      { location: 'Taramani Signal', coords: [12.9800, 80.2331], status: 'free' },
      { location: 'Kotturpuram Junction', coords: [12.9950, 80.2362], status: 'busy' },
      { location: 'Greams Road Entry', coords: [13.0025, 80.2394], status: 'free' },
    ],
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

    // Create test users — 2 ambulance + 18 police (3 per route) + 5 hospital + 1 admin
    const OFFICER_NAMES = [
      // Route 1: Central Railway Station → Apollo
      { name: 'Officer Priya Kumar', badge: 'CHN-101', email: 'officer1@test.com' },
      { name: 'Officer Ravi Shankar', badge: 'CHN-102', email: 'officer2@test.com' },
      { name: 'Officer Deepa Nair', badge: 'CHN-103', email: 'officer3@test.com' },
      // Route 2: Anna Salai → Fortis
      { name: 'Officer Arun Prasad', badge: 'CHN-201', email: 'officer4@test.com' },
      { name: 'Officer Kavitha Raj', badge: 'CHN-202', email: 'officer5@test.com' },
      { name: 'Officer Suresh Babu', badge: 'CHN-203', email: 'officer6@test.com' },
      // Route 3: Nungambakkam → Dr. Mehta's
      { name: 'Officer Meena Lakshmi', badge: 'CHN-301', email: 'officer7@test.com' },
      { name: 'Officer Vijay Kumar', badge: 'CHN-302', email: 'officer8@test.com' },
      { name: 'Officer Anitha Devi', badge: 'CHN-303', email: 'officer9@test.com' },
      // Route 4: Besant Nagar → MIOT
      { name: 'Officer Karthik Raman', badge: 'CHN-401', email: 'officer10@test.com' },
      { name: 'Officer Shalini Iyer', badge: 'CHN-402', email: 'officer11@test.com' },
      { name: 'Officer Mohan Das', badge: 'CHN-403', email: 'officer12@test.com' },
      // Route 5: T. Nagar → Billroth
      { name: 'Officer Lalitha Sundaram', badge: 'CHN-501', email: 'officer13@test.com' },
      { name: 'Officer Ganesh Murthy', badge: 'CHN-502', email: 'officer14@test.com' },
      { name: 'Officer Revathi Krishnan', badge: 'CHN-503', email: 'officer15@test.com' },
      // Route 6: Velachery → Apollo
      { name: 'Officer Senthil Nathan', badge: 'CHN-601', email: 'officer16@test.com' },
      { name: 'Officer Divya Ramesh', badge: 'CHN-602', email: 'officer17@test.com' },
      { name: 'Officer Prakash Jeyaraman', badge: 'CHN-603', email: 'officer18@test.com' },
    ];

    const allUsersData = [
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
      // 18 Police officers — coords will be set per-route after OSRM fetch
      ...OFFICER_NAMES.map(o => ({
        name: o.name,
        email: o.email,
        password: 'TestPass123',
        role: 'police',
        badgeNumber: o.badge,
        patrolLatitude: null,
        patrolLongitude: null,
      })),
      // Hospital staff — indices 20..24
      {
        name: 'Dr. Sarah Johnson - City Hospital',
        email: 'hospital-bangalore@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'Dr. Michael Chen - St. Mary Medical Center',
        email: 'hospital-chennai@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'Dr. Jennifer Brown - Emergency Care Hospital',
        email: 'hospital-delhi@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'Dr. Robert Williams - Metropolitan General Hospital',
        email: 'hospital-mumbai@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'Dr. Lisa Anderson - Lakeside Trauma Center',
        email: 'hospital-indore@test.com',
        password: 'TestPass123',
        role: 'hospital',
      },
      {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'TestPass123',
        role: 'admin',
      },
    ];

    // Hash all passwords before insertion
    for (let i = 0; i < allUsersData.length; i++) {
      allUsersData[i].password = await hashPassword(allUsersData[i].password);
    }

    const users = await User.insertMany(allUsersData);
    console.log(`✅ Created ${users.length} test users (ambulance + police + hospital + admin)`);

    // Create hospitals with efficient mapping using map()
    const hospitals = await Hospital.insertMany(
      HOSPITAL_LOCATIONS.map((hosp, index) => ({
        hospitalName: hosp.name,
        location: hosp.address,
        coordinates: {
          type: 'Point',
          coordinates: [hosp.coordinates[1], hosp.coordinates[0]], // GeoJSON order: [lng, lat]
        },
        availableBeds: [45, 62, 28, 78, 15][index], // Varying bed availability
        discordUsername: hosp.name.toLowerCase().replace(/\s+/g, '-'),
        coordinatorName: [
          'Dr. Sarah Johnson',
          'Dr. Michael Chen',
          'Dr. Jennifer Brown',
          'Dr. Robert Williams',
          'Dr. Lisa Anderson',
        ][index],
        createdBy: users[20 + index]._id, // Hospital staff users are at indices 20-24
        acceptingPatients: index !== 3, // MetroGeneral not accepting
      }))
    );
    console.log('✅ Created 5 hospitals mapped to dedicated hospital staff accounts');

    // Create traffic signals using precise OSRM mapping
    const allSignalsData = [];
    
    for (let routeIdx = 0; routeIdx < SIGNAL_ROUTES.length; routeIdx++) {
      const route = SIGNAL_ROUTES[routeIdx];
      
      // Fetch exact OSRM path
      const url = `https://router.project-osrm.org/route/v1/driving/${route.fromCoords[1]},${route.fromCoords[0]};${route.toCoords[1]},${route.toCoords[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      
      let coords = data?.routes?.[0]?.geometry?.coordinates || []; // [[lng, lat]]
      
      if (coords.length > 0) {
        // Pick ~7 points along the exact route polyline
        const step = Math.max(1, Math.floor(coords.length / 7));
        const generatedSignals = [];
        
        for (let i = 0; i < coords.length; i += step) {
          if (generatedSignals.length >= 7) break;
          const [lng, lat] = coords[i];
          generatedSignals.push({
            location: `${route.from} Junction ${generatedSignals.length + 1}`,
            coords: [lat, lng],
            status: Math.random() > 0.5 ? 'busy' : 'free'
          });
        }
        
        generatedSignals.forEach((signal, sigIdx) => {
          // Each route has 3 dedicated officers at indices: routeIdx*3+2 .. routeIdx*3+4
          const officerBase = 2 + (routeIdx * 3); // users[2..19] are police
          const policeUserIdx = officerBase + (sigIdx % 3);
          allSignalsData.push({
            from: route.from,
            to: route.to,
            location: signal.location,
            status: signal.status,
            coordinates: {
              type: 'Point',
              coordinates: [signal.coords[1], signal.coords[0]], // GeoJSON order: [lng, lat]
            },
            policeOfficerName: users[policeUserIdx].name,
            discordUsername: `signal-${allSignalsData.length + 1}`,
            createdBy: users[policeUserIdx]._id,
            policeUserIdx,
            routeIdx,
          });
        });
      }
    }
    
    // Set each officer's patrol coords to the first signal assigned to them on their route
    const assignedOfficers = new Set();
    for (const sig of allSignalsData) {
        if (sig.policeUserIdx !== undefined) {
           if (!assignedOfficers.has(sig.policeUserIdx)) {
              assignedOfficers.add(sig.policeUserIdx);
              await User.findByIdAndUpdate(users[sig.policeUserIdx]._id, {
                  patrolLatitude: sig.coordinates.coordinates[1],
                  patrolLongitude: sig.coordinates.coordinates[0],
              });
           }
           delete sig.policeUserIdx;
           delete sig.routeIdx;
        }
    }

    const signals = await TrafficSignal.insertMany(allSignalsData);
    console.log(`✅ Fetched OSRM and created ${signals.length} highly accurate traffic signals perfectly aligning with driving routes`);

    // Create ambulance routes with patient cases and efficient location mapping using map()
    const routes = await AmbulanceRoute.insertMany(
      PATIENT_CASES.map((patient, index) => {
        const routeInfo = SIGNAL_ROUTES[index];
        // Get all signals for this route
        const routeSignals = signals.filter((s) => s.from === routeInfo.from && s.to === routeInfo.to);
        return {
          ambulanceDriver: index % 2 === 0 ? users[0]._id : users[1]._id,
          from: routeInfo.from,
          to: routeInfo.to,
          patientNotes: `${patient.name}, Age ${patient.age}\nCondition: ${patient.condition}\nSeverity: ${patient.severity}\nETA: ${patient.eta > 0 ? patient.eta + ' min' : 'ARRIVED'}`,
          status: patient.eta < 0 ? 'completed' : 'in-transit',
          alertsSent: true,
          signalsAffected: routeSignals.map((s) => s._id),
          hospitalsNotified: [hospitals[index]._id],
        };
      })
    );
    console.log('✅ Created 5 ambulance routes with patient cases');

    console.log('\n✅✅✅ Database seeding completed successfully! ✅✅✅\n');
    console.log('Test Accounts Created:');
    console.log('─────────────────────────────────────────');
    console.log('Ambulance Drivers:');
    console.log('• ambulance1@test.com / TestPass123');
    console.log('• ambulance2@test.com / TestPass123');
    console.log('─────────────────────────────────────────');
    console.log('Police Officers (with patrol coordinates):');
    console.log('• Officer Arjun Singh (BNG-001): officer1@test.com / TestPass123');
    console.log('• Officer Priya Kumar (CHN-001): officer2@test.com / TestPass123');
    console.log('• Officer Rajesh Verma (DEL-001): officer3@test.com / TestPass123');
    console.log('• Officer Vikram Patel (MUM-001): officer4@test.com / TestPass123');
    console.log('• Officer Neha Singh (IND-001): officer5@test.com / TestPass123');
    console.log('• Officer Amit Sharma (BNG-002): officer6@test.com / TestPass123');
    console.log('─────────────────────────────────────────');
    console.log('Hospital Staff (Each hospital has dedicated login):');
    console.log('• City Hospital - Dr. Sarah Johnson: hospital-bangalore@test.com / TestPass123');
    console.log('• St. Mary Medical Center - Dr. Michael Chen: hospital-chennai@test.com / TestPass123');
    console.log('• Emergency Care Hospital - Dr. Jennifer Brown: hospital-delhi@test.com / TestPass123');
    console.log('• Metropolitan General Hospital - Dr. Robert Williams: hospital-mumbai@test.com / TestPass123');
    console.log('• Lakeside Trauma Center - Dr. Lisa Anderson: hospital-indore@test.com / TestPass123');
    console.log('─────────────────────────────────────────');
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
    console.log('• 15 Test Users (2 ambulance + 6 police + 5 hospital staff + 1 admin + 1 extra)');
    console.log('• 5 Hospitals (each with dedicated hospital staff login to manage data)');
    console.log(`• ${signals.length} Traffic Signals (${signals.length / 6} per route, positioned along corridors with assigned officers)`);
    console.log('• 5 Active Ambulance Routes (with patient cases & signal assignments)');
    console.log('─────────────────────────────────────────');
    console.log('\nHospital Data Management:');
    console.log('• Each hospital staff can login and update:');
    console.log('  - Available beds count');
    console.log('  - Patient acceptance status');
    console.log('  - Hospital information via /hospital/my-hospital endpoint');
    console.log('─────────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
