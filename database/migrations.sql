

USE cleantrack_uganda;

ALTER TABLE pickup_requests ADD COLUMN scheduled_for DATE NULL AFTER requested_at;

CREATE TABLE IF NOT EXISTS pickup_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  location_id INT NOT NULL,
  waste_category_id INT NOT NULL,
  frequency ENUM('weekly', 'monthly') NOT NULL,
  weekday TINYINT NULL,
  day_of_month TINYINT NULL,
  start_date DATE NOT NULL,
  next_run_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('active', 'paused', 'cancelled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_location FOREIGN KEY (location_id) REFERENCES customer_locations(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_category FOREIGN KEY (waste_category_id) REFERENCES waste_categories(id)
);

CREATE TABLE IF NOT EXISTS customer_points (
  customer_id INT PRIMARY KEY,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_points_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS points_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  pickup_request_id INT NOT NULL UNIQUE,
  points_awarded INT NOT NULL DEFAULT 10,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_points_tx_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_points_tx_pickup FOREIGN KEY (pickup_request_id) REFERENCES pickup_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pickup_reschedule_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pickup_request_id INT NOT NULL,
  customer_id INT NOT NULL,
  requested_date DATE NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reschedule_pickup FOREIGN KEY (pickup_request_id) REFERENCES pickup_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reschedule_status (status)
);

INSERT INTO pickup_requests
  (customer_id, location_id, waste_category_id, description, urgency,
   estimated_bin_level, status, requested_at, completed_at)
VALUES
 (4, 1, 6, 'Sample completed pickup for rewards demo - customer 4',
   'normal', 80, 'collected', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 4 DAY);
    (8, 1, 6, 'Sample completed pickup for rewards demo - customer 8',
   'normal', 75, 'collected', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 3 DAY);
SET @sample_pickup_customer8 = LAST_INSERT_ID();

INSERT INTO pickup_requests
  (customer_id, location_id, waste_category_id, description, urgency,
   estimated_bin_level, status, requested_at, completed_at)
VALUES
  (9, 3, 3, 'Sample completed pickup for rewards demo - customer 9',
   'normal', 60, 'collected', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 2 DAY);
SET @sample_pickup_customer9 = LAST_INSERT_ID();


INSERT INTO customer_points (customer_id, points)
VALUES
  (8,  10),
  (9,  10),
  (10, 20),
  (12,  0),
  (13, 10)
ON DUPLICATE KEY UPDATE points = VALUES(points);


INSERT INTO points_transactions
  (customer_id, pickup_request_id, points_awarded, reason)
VALUES
  (10, 4, 10, 'Reward for completed pickup'),
  (10, 9, 10, 'Reward for completed pickup'),
  (13, 12, 10, 'Reward for completed pickup'),
  (8, @sample_pickup_customer8, 10, 'Reward for sample completed pickup'),
  (9, @sample_pickup_customer9, 10, 'Reward for sample completed pickup');


INSERT INTO pickup_reschedule_requests
  (pickup_request_id, customer_id, requested_date, reason, status)
VALUES
  (1,  8,  '2026-10-16', 'I will be unavailable on the original collection date.', 'pending'),
  (2,  8,  '2026-10-19', 'Please collect the waste later in the week.', 'pending'),
  (6,  12, '2026-10-20', 'The clinic needs the collection after its appointment.', 'pending'),
  (8,  9,  '2026-10-21', 'The shop will be closed on the original date.', 'pending'),
  (10, 11, '2026-10-23', 'Please move the school pickup until after the event.', 'pending');


SELECT * FROM pickup_schedules ORDER BY id DESC LIMIT 5;
SELECT * FROM customer_points ORDER BY customer_id;
SELECT * FROM points_transactions ORDER BY id DESC LIMIT 5;
SELECT * FROM pickup_reschedule_requests ORDER BY id DESC LIMIT 5;
