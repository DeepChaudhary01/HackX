-- ParkSphere Seed Data — Parking Lots across Gujarat + Delhi NCR

INSERT INTO parking_lots (name, address, latitude, longitude, total_slots, available_slots, price_per_hour) VALUES
  -- AHMEDABAD
  ('Sabarmati Riverfront Parking', 'Sabarmati Riverfront, Ashram Road, Ahmedabad 380009', 23.0350, 72.5800, 200, 78, 30.00),
  ('CG Road Smart Parking', 'CG Road, Near Municipal Market, Navrangpura, Ahmedabad 380009', 23.0330, 72.5610, 120, 45, 40.00),
  ('Manek Chowk Parking', 'Manek Chowk, Old City, Ahmedabad 380001', 23.0258, 72.5873, 80, 0, 20.00),
  ('SG Highway Parking Hub', 'SG Highway, Near Iscon Mega Mall, Ahmedabad 380054', 23.0300, 72.5070, 300, 187, 50.00),
  ('Alpha One Mall Parking', 'Alpha One Mall, Vastrapur, Ahmedabad 380015', 23.0370, 72.5290, 250, 92, 60.00),
  ('Kankaria Lake Parking', 'Kankaria Circle, Maninagar, Ahmedabad 380002', 23.0069, 72.5997, 150, 23, 25.00),
  ('Ahmedabad Airport Parking', 'SVP International Airport, Hansol, Ahmedabad 380003', 23.0772, 72.6347, 400, 245, 80.00),
  ('Law Garden Parking Zone', 'Law Garden, Ellisbridge, Ahmedabad 380006', 23.0289, 72.5609, 60, 34, 30.00),

  -- SURAT
  ('VR Surat Mall Parking', 'Dumas Road, Surat 395007', 21.1590, 72.7900, 350, 198, 45.00),
  ('Surat Railway Station Parking', 'Near Surat Railway Station, Ring Road, Surat 395003', 21.2060, 72.8410, 180, 12, 20.00),

  -- VADODARA
  ('Sayaji Baug Parking', 'Sayaji Baug, Vadodara 390018', 22.3100, 73.1900, 100, 67, 25.00),
  ('Inox Multiplex Parking', 'Race Course Circle, Vadodara 390007', 22.3130, 73.1800, 120, 55, 35.00),

  -- RAJKOT
  ('Race Course Ring Road Parking', 'Race Course Ring Road, Rajkot 360001', 22.2920, 70.7930, 80, 41, 20.00),

  -- GANDHINAGAR
  ('Gandhinagar GIFT City Parking', 'GIFT City SEZ, Gandhinagar 382355', 23.1127, 72.6838, 500, 312, 60.00),
  ('Infocity Parking', 'Infocity, Gandhinagar 382007', 23.1920, 72.6280, 200, 134, 35.00),

  -- DELHI NCR
  ('CP Central Parking', 'Block A, Connaught Place, New Delhi 110001', 28.6315, 77.2167, 120, 45, 70.00),
  ('Select Citywalk Parking', 'A-3 District Centre, Saket, New Delhi 110017', 28.5285, 77.2190, 500, 234, 60.00),
  ('Cyber Hub Parking', 'DLF Cyber City, Gurgaon 122002', 28.4945, 77.0889, 350, 128, 50.00);
