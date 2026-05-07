import dayjs from 'dayjs'

export const defaultCompanyInfo = {
  name:    'Lowell Nails and Spa, LLC',
  address: '505 W. Main St. Suite B',
  city:    'Lowell, MI 49331',
  phone:   '(616) 319-7924',
  email:   '',
  website: '',
  logoUrl: '/logo.png',   // place your logo at frontend/public/logo.png
}

export const mockUsers = [
  { id: 1, name: 'Admin User',  username: 'admin', password: 'admin123', role: 'admin',        initials: 'AU' },
  { id: 2, name: 'Jane Smith',  username: 'jane',  password: 'staff123', role: 'receptionist', initials: 'JS' },
  { id: 3, name: 'Sarah K.',    username: 'sarah', password: 'tech123',  role: 'technician',   initials: 'SK', technicianId: 1 },
  { id: 4, name: 'Mike T.',     username: 'mike',  password: 'tech123',  role: 'technician',   initials: 'MT', technicianId: 2 },
  { id: 5, name: 'Jessica L.',  username: 'jess',  password: 'tech123',  role: 'technician',   initials: 'JL', technicianId: 3 },
]

export const mockClients = [
  { id: 1,  name: 'Alice Johnson',  phone: '555-0101', email: 'alice.j@email.com',   lastVisit: '2026-05-05', totalVisits: 8,  notes: 'Prefers short square shape, sensitive skin',
    serviceHistory: [
      { id: 101, date: '2026-05-05', service: 'Full Set Acrylic', technicianId: 1, amount: 65.00 },
      { id: 102, date: '2026-04-14', service: 'Fill-In',          technicianId: 1, amount: 35.00 },
      { id: 103, date: '2026-03-24', service: 'Gel Manicure',     technicianId: 1, amount: 45.00 },
    ]},
  { id: 2,  name: 'Beth Williams',  phone: '555-0102', email: 'beth.w@email.com',    lastVisit: '2026-05-05', totalVisits: 12, notes: '',
    serviceHistory: [
      { id: 201, date: '2026-05-05', service: 'Pedicure',         technicianId: 1, amount: 50.00 },
      { id: 202, date: '2026-04-07', service: 'Classic Manicure', technicianId: 3, amount: 30.00 },
    ]},
  { id: 3,  name: 'Carol Martinez', phone: '555-0103', email: 'carol.m@email.com',   lastVisit: '2026-05-05', totalVisits: 5,  notes: 'Gel top coat always',
    serviceHistory: [
      { id: 301, date: '2026-05-05', service: 'Gel Manicure',     technicianId: 2, amount: 45.00 },
      { id: 302, date: '2026-04-14', service: 'Fill-In',          technicianId: 2, amount: 35.00 },
    ]},
  { id: 4,  name: 'Diana Lee',      phone: '555-0104', email: 'diana.lee@email.com', lastVisit: '2026-04-28', totalVisits: 20, notes: 'VIP — always books 2 weeks ahead',
    serviceHistory: [
      { id: 401, date: '2026-04-28', service: 'Full Set Acrylic', technicianId: 2, amount: 65.00 },
      { id: 402, date: '2026-04-07', service: 'Fill-In',          technicianId: 2, amount: 35.00 },
      { id: 403, date: '2026-03-17', service: 'Gel Manicure',     technicianId: 2, amount: 45.00 },
      { id: 404, date: '2026-02-24', service: 'Nail Art',         technicianId: 2, amount: 80.00 },
    ]},
  { id: 5,  name: 'Eva Chen',       phone: '555-0105', email: 'eva.chen@email.com',  lastVisit: '2026-05-05', totalVisits: 3,  notes: 'Nail art specialist required',
    serviceHistory: [
      { id: 501, date: '2026-05-05', service: 'Nail Art',         technicianId: 2, amount: 80.00 },
    ]},
  { id: 6,  name: 'Fiona Brown',    phone: '555-0106', email: 'fiona.b@email.com',   lastVisit: '2026-05-05', totalVisits: 7,  notes: '',
    serviceHistory: [
      { id: 601, date: '2026-05-05', service: 'Dip Powder',       technicianId: 3, amount: 55.00 },
      { id: 602, date: '2026-04-14', service: 'Fill-In',          technicianId: 3, amount: 35.00 },
    ]},
  { id: 7,  name: 'Grace Wilson',   phone: '555-0107', email: 'grace.w@email.com',   lastVisit: '2026-05-05', totalVisits: 15, notes: 'Loyal customer since 2024',
    serviceHistory: [
      { id: 701, date: '2026-05-05', service: 'Classic Manicure', technicianId: 3, amount: 30.00 },
      { id: 702, date: '2026-04-21', service: 'Pedicure',         technicianId: 3, amount: 50.00 },
    ]},
  { id: 8,  name: 'Hannah Davis',   phone: '555-0108', email: 'hannah.d@email.com',  lastVisit: '2026-05-05', totalVisits: 4,  notes: 'Callus treatment every visit',
    serviceHistory: [
      { id: 801, date: '2026-05-05', service: 'Pedicure',         technicianId: 3, amount: 60.00 },
    ]},
  { id: 9,  name: 'Iris Taylor',    phone: '555-0109', email: 'iris.t@email.com',    lastVisit: '2026-04-15', totalVisits: 9,  notes: '',
    serviceHistory: [
      { id: 901, date: '2026-04-15', service: 'Waxing',           technicianId: 4, amount: 40.00 },
      { id: 902, date: '2026-03-18', service: 'Eyebrow Shaping',  technicianId: 4, amount: 25.00 },
    ]},
  { id: 10, name: 'Julia Moore',    phone: '555-0110', email: 'julia.m@email.com',   lastVisit: '2026-05-05', totalVisits: 22, notes: 'Prefers morning slots',
    serviceHistory: [
      { id: 1001, date: '2026-05-05', service: 'Eyebrow Shaping', technicianId: 4, amount: 25.00 },
      { id: 1002, date: '2026-04-14', service: 'Waxing',          technicianId: 4, amount: 40.00 },
      { id: 1003, date: '2026-03-24', service: 'Eyebrow Shaping', technicianId: 4, amount: 25.00 },
    ]},
  { id: 11, name: 'Karen Anderson', phone: '555-0111', email: 'karen.a@email.com',   lastVisit: '2026-05-05', totalVisits: 6,  notes: 'Ombre specialist required',
    serviceHistory: [
      { id: 1101, date: '2026-05-05', service: 'Full Set Acrylic', technicianId: 4, amount: 75.00 },
      { id: 1102, date: '2026-04-07', service: 'Fill-In',          technicianId: 4, amount: 35.00 },
    ]},
  { id: 12, name: 'Laura Thomas',   phone: '555-0112', email: 'laura.t@email.com',   lastVisit: '2026-04-20', totalVisits: 11, notes: '',
    serviceHistory: [
      { id: 1201, date: '2026-05-05', service: 'Gel Manicure',    technicianId: 5, amount: 45.00 },
      { id: 1202, date: '2026-04-14', service: 'Pedicure',        technicianId: 5, amount: 50.00 },
    ]},
  { id: 13, name: 'Mia Jackson',    phone: '555-0113', email: 'mia.j@email.com',     lastVisit: '2026-05-05', totalVisits: 2,  notes: 'New client',
    serviceHistory: [
      { id: 1301, date: '2026-05-05', service: 'Fill-In',         technicianId: 5, amount: 35.00 },
    ]},
  { id: 14, name: 'Nina White',     phone: '555-0114', email: 'nina.w@email.com',    lastVisit: '2026-03-30', totalVisits: 18, notes: '',
    serviceHistory: [
      { id: 1401, date: '2026-03-30', service: 'Classic Manicure', technicianId: 1, amount: 30.00 },
    ]},
  { id: 15, name: 'Olivia Harris',  phone: '555-0115', email: 'olivia.h@email.com',  lastVisit: '2026-04-06', totalVisits: 30, notes: 'Long-term VIP',
    serviceHistory: [
      { id: 1501, date: '2026-04-06', service: 'Full Set Acrylic', technicianId: 3, amount: 65.00 },
      { id: 1502, date: '2026-03-16', service: 'Fill-In',          technicianId: 3, amount: 35.00 },
      { id: 1503, date: '2026-02-24', service: 'Nail Art',         technicianId: 3, amount: 80.00 },
    ]},
]

export const mockGiftCards = [
  { id: 1, cardNumber: 'GC-2026-001', purchaseDate: '2026-01-15', purchasedBy: 'Diana Lee',     recipientName: 'Karen Anderson', expiryDate: '2027-01-15', amount: 100.00, balance: 65.00,  notes: 'Birthday gift' },
  { id: 2, cardNumber: 'GC-2026-002', purchaseDate: '2026-02-10', purchasedBy: 'Grace Wilson',  recipientName: 'Grace Wilson',   expiryDate: '2027-02-10', amount: 50.00,  balance: 50.00,  notes: '' },
  { id: 3, cardNumber: 'GC-2026-003', purchaseDate: '2026-03-01', purchasedBy: 'Alice Johnson', recipientName: 'Beth Williams',  expiryDate: '2027-03-01', amount: 75.00,  balance: 0.00,   notes: 'Fully redeemed' },
  { id: 4, cardNumber: 'GC-2025-088', purchaseDate: '2025-04-20', purchasedBy: 'Olivia Harris', recipientName: 'Olivia Harris',  expiryDate: '2026-04-20', amount: 100.00, balance: 30.00,  notes: 'Expired — balance forfeited' },
  { id: 5, cardNumber: 'GC-2026-004', purchaseDate: '2026-04-30', purchasedBy: 'Julia Moore',   recipientName: 'Mia Jackson',    expiryDate: '2027-04-30', amount: 150.00, balance: 150.00, notes: 'Welcome package' },
]

export const technicians = [
  { id: 1, name: 'Sarah K.',   color: '#7C3AED', initials: 'SK', email: 'sarah.k@bookcal.com',   phone: '555-1001', address: '123 Oak St, Austin TX 78701',    dateHired: '2023-03-15' },
  { id: 2, name: 'Mike T.',    color: '#0EA5E9', initials: 'MT', email: 'mike.t@bookcal.com',    phone: '555-1002', address: '456 Pine Ave, Austin TX 78702',   dateHired: '2023-06-01' },
  { id: 3, name: 'Jessica L.', color: '#10B981', initials: 'JL', email: 'jessica.l@bookcal.com', phone: '555-1003', address: '789 Maple Dr, Austin TX 78703',   dateHired: '2022-11-20' },
  { id: 4, name: 'David M.',   color: '#F59E0B', initials: 'DM', email: 'david.m@bookcal.com',   phone: '555-1004', address: '321 Elm Blvd, Austin TX 78704',   dateHired: '2024-01-08' },
  { id: 5, name: 'Emma R.',    color: '#EF4444', initials: 'ER', email: 'emma.r@bookcal.com',    phone: '555-1005', address: '654 Cedar Ln, Austin TX 78705',   dateHired: '2024-04-22' },
]

const today = dayjs().format('YYYY-MM-DD')
const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')

export const SERVICES = [
  'Full Set Acrylic',
  'Fill-In',
  'Gel Manicure',
  'Classic Manicure',
  'Pedicure',
  'Dip Powder',
  'Nail Art',
  'Waxing',
  'Eyebrow Shaping',
  'Consultation',
]

export const initialAppointments = [
  { id: 1,  technicianId: 1, clientName: 'Alice Johnson',   service: 'Full Set Acrylic', date: today,     startTime: '09:00', duration: 90,  notes: 'Prefers short, square shape' },
  { id: 2,  technicianId: 1, clientName: 'Beth Williams',   service: 'Pedicure',         date: today,     startTime: '11:00', duration: 60,  notes: '' },
  { id: 3,  technicianId: 2, clientName: 'Carol Martinez',  service: 'Gel Manicure',     date: today,     startTime: '08:30', duration: 60,  notes: 'Gel top coat' },
  { id: 4,  technicianId: 2, clientName: 'Diana Lee',       service: 'Fill-In',          date: today,     startTime: '10:00', duration: 60,  notes: '' },
  { id: 5,  technicianId: 2, clientName: 'Eva Chen',        service: 'Nail Art',         date: today,     startTime: '13:00', duration: 90,  notes: 'Floral design' },
  { id: 6,  technicianId: 3, clientName: 'Fiona Brown',     service: 'Dip Powder',       date: today,     startTime: '09:30', duration: 75,  notes: '' },
  { id: 7,  technicianId: 3, clientName: 'Grace Wilson',    service: 'Classic Manicure', date: today,     startTime: '11:30', duration: 45,  notes: '' },
  { id: 8,  technicianId: 3, clientName: 'Hannah Davis',    service: 'Pedicure',         date: today,     startTime: '14:00', duration: 60,  notes: 'Callus treatment' },
  { id: 9,  technicianId: 4, clientName: 'Iris Taylor',     service: 'Waxing',           date: today,     startTime: '10:00', duration: 30,  notes: '' },
  { id: 10, technicianId: 4, clientName: 'Julia Moore',     service: 'Eyebrow Shaping',  date: today,     startTime: '11:00', duration: 30,  notes: '' },
  { id: 11, technicianId: 4, clientName: 'Karen Anderson',  service: 'Full Set Acrylic', date: today,     startTime: '13:30', duration: 90,  notes: 'Ombre style' },
  { id: 12, technicianId: 5, clientName: 'Laura Thomas',    service: 'Gel Manicure',     date: today,     startTime: '09:00', duration: 60,  notes: '' },
  { id: 13, technicianId: 5, clientName: 'Mia Jackson',     service: 'Fill-In',          date: today,     startTime: '12:00', duration: 60,  notes: '' },
  { id: 14, technicianId: 1, clientName: 'Nina White',      service: 'Consultation',     date: tomorrow,  startTime: '10:00', duration: 30,  notes: '' },
  { id: 15, technicianId: 3, clientName: 'Olivia Harris',   service: 'Full Set Acrylic', date: yesterday, startTime: '14:00', duration: 90,  notes: '' },
]
