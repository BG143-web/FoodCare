-- ============================================================================
-- FoodCare - Database Reset Script
-- Clears all transactional and user data while preserving schema definitions,
-- foreign key relationships, constraints, and indexes.
-- Resets AUTO_INCREMENT primary keys back to 1.
-- ============================================================================

USE foodcare_db;

-- Temporarily disable foreign key constraints for clean truncation
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE distribution_history;
TRUNCATE TABLE food_requests;
TRUNCATE TABLE foods;
TRUNCATE TABLE users;

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;

-- Verification query (all counts should be 0)
SELECT 
  (SELECT COUNT(*) FROM users) AS users_count,
  (SELECT COUNT(*) FROM foods) AS foods_count,
  (SELECT COUNT(*) FROM food_requests) AS requests_count,
  (SELECT COUNT(*) FROM distribution_history) AS history_count;
