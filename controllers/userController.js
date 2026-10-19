const db = require('../config/db');

/**
 * Format user profile object for client responses
 */
const formatUserProfile = (user) => ({
  id: user.id,
  name: user.full_name,
  fullName: user.full_name,
  full_name: user.full_name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  organization: user.organization_name || null,
  organization_name: user.organization_name || null,
  address: user.address || null,
  createdAt: user.created_at,
  created_at: user.created_at,
  updatedAt: user.updated_at,
  updated_at: user.updated_at
});

/**
 * GET /api/users/profile
 * Returns the currently authenticated user's profile details.
 * Never exposes password_hash.
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, role, organization_name, address, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found.'
      });
    }

    const formattedUser = formatUserProfile(rows[0]);

    // Return structured response with user object and top-level fields for frontend ease
    return res.status(200).json({
      success: true,
      user: formattedUser,
      ...formattedUser
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving user profile.'
    });
  }
};

/**
 * PUT /api/users/profile
 * Updates the current authenticated user's contact information.
 * - Allowed: name (full_name), organization (organization_name), phone, address
 * - Protected: id, email, role, password_hash cannot be changed
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      fullName,
      full_name,
      organization,
      organization_name,
      phone,
      address
    } = req.body;

    // 1. Fetch current record
    const [currentRows] = await db.execute(
      `SELECT id, full_name, email, phone, role, organization_name, address 
       FROM users 
       WHERE id = ? 
       LIMIT 1`,
      [userId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    const currentUser = currentRows[0];

    // 2. Validate updated values
    const newName = (name !== undefined ? name : (fullName !== undefined ? fullName : full_name));
    if (newName !== undefined) {
      if (!newName || !newName.trim() || newName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Full name must be at least 2 characters.'
        });
      }
    }

    if (phone !== undefined) {
      if (!phone || !phone.trim() || phone.trim().length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Phone number must be at least 8 digits.'
        });
      }
    }

    // 3. Map input fields to database columns
    const updatedFullName = newName !== undefined ? newName.trim() : currentUser.full_name;
    const updatedOrg = (organization !== undefined ? organization : organization_name);
    const updatedOrgName = updatedOrg !== undefined
      ? (updatedOrg ? updatedOrg.trim() : null)
      : currentUser.organization_name;
    const updatedPhone = phone !== undefined ? phone.trim() : currentUser.phone;
    const updatedAddress = address !== undefined
      ? (address ? address.trim() : null)
      : currentUser.address;

    // 4. Update in database (immutable: id, email, role, password_hash)
    await db.execute(
      `UPDATE users SET
         full_name = ?,
         organization_name = ?,
         phone = ?,
         address = ?
       WHERE id = ?`,
      [updatedFullName, updatedOrgName, updatedPhone, updatedAddress, userId]
    );

    // 5. Retrieve updated record
    const [updatedRows] = await db.execute(
      `SELECT id, full_name, email, phone, role, organization_name, address, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const formattedUser = formatUserProfile(updatedRows[0]);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: formattedUser,
      ...formattedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while updating user profile.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
