-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';

-- Update existing users based on their current status
UPDATE users SET role = 'superadmin' WHERE status = 'admin' AND clerk_id IN (
  SELECT clerk_id FROM clerk_users WHERE role = 'superadmin'
);

UPDATE users SET role = 'admin' WHERE status = 'admin' AND clerk_id IN (
  SELECT clerk_id FROM clerk_users WHERE role = 'admin'
);

UPDATE users SET role = 'observer' WHERE status = 'admin' AND clerk_id IN (
  SELECT clerk_id FROM clerk_users WHERE role = 'observer'
);

UPDATE users SET role = 'user' WHERE status = 'user' OR role IS NULL;

-- Add index for role queries
CREATE INDEX idx_users_role ON users(role);