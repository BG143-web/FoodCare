-- ================================================================================
-- FoodCare Database Schema
-- MySQL 8.0+ / InnoDB Engine
-- ================================================================================

-- Create Database if it does not already exist
CREATE DATABASE IF NOT EXISTS foodcare_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE foodcare_db;

-- --------------------------------------------------------------------------------
-- 1. users Table (Stores Donors and Food Seekers)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role ENUM('donor', 'seeker') NOT NULL,
  organization_name VARCHAR(180) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 2. foods Table (Surplus Food Listings)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  category ENUM('Cooked Food', 'Bakery', 'Fresh Produce', 'Dairy', 'Packaged Food') NOT NULL,
  quantity VARCHAR(80) NOT NULL,
  location VARCHAR(200) NOT NULL,
  available_until VARCHAR(100) NOT NULL,
  status ENUM('Available', 'Reserved', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Available',
  description TEXT NULL,
  pickup_notes TEXT NULL,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_foods_status (status),
  INDEX idx_foods_category (category),
  INDEX idx_foods_donor (donor_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 3. food_requests Table (Claims by Seekers / NGOs)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  food_id INT NOT NULL,
  seeker_id INT NOT NULL,
  quantity_requested VARCHAR(80) NOT NULL,
  notes TEXT NULL,
  status ENUM('Pending', 'Accepted', 'Rejected', 'Completed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_requests_status (status),
  INDEX idx_requests_food (food_id),
  INDEX idx_requests_seeker (seeker_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 4. distribution_history Table (Audited Completed Handovers)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribution_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  food_id INT NOT NULL,
  donor_id INT NOT NULL,
  seeker_id INT NOT NULL,
  quantity_completed VARCHAR(80) NOT NULL,
  meals_saved_count INT DEFAULT 0,
  waste_kg_saved DECIMAL(8, 2) DEFAULT 0.00,
  co2_kg_saved DECIMAL(8, 2) DEFAULT 0.00,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_history_donor (donor_id),
  INDEX idx_history_seeker (seeker_id)
) ENGINE=InnoDB;
