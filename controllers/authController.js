const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Cookie configuration constant
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

/**
 * Validate email format helper
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate JWT token helper
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined.');
  }
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

/**
 * Register a new user (donor or seeker)
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password, role, organization, address } = req.body;

    // 1. Validate required fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }
    if (!role) {
      return res.status(400).json({ success: false, error: 'Role is required.' });
    }

    // 2. Validate role value (only 'donor' or 'seeker' allowed)
    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole !== 'donor' && normalizedRole !== 'seeker') {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Role must be either 'donor' or 'seeker'."
      });
    }

    // 3. Validate email format
    const normalizedEmail = email.toLowerCase().trim();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    // 4. Check whether email already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // 5. Hash password using bcryptjs with 10 salt rounds
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Insert new user using prepared statement
    const organizationName = organization ? organization.trim() : null;
    const userAddress = address ? address.trim() : null;
    const userPhone = phone.trim();
    const userFullName = fullName.trim();

    const [insertResult] = await db.execute(
      `INSERT INTO users (full_name, email, password_hash, phone, role, organization_name, address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userFullName, normalizedEmail, passwordHash, userPhone, normalizedRole, organizationName, userAddress]
    );

    const newUserId = insertResult.insertId;

    // 7. Generate JWT token and set HTTP-only cookie
    const token = generateToken({ id: newUserId, email: normalizedEmail, role: normalizedRole });
    res.cookie('token', token, COOKIE_OPTIONS);

    // 8. Return response without password_hash
    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        id: newUserId,
        name: userFullName,
        fullName: userFullName,
        email: normalizedEmail,
        phone: userPhone,
        role: normalizedRole,
        organization: organizationName,
        organization_name: organizationName,
        address: userAddress
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during registration.'
    });
  }
};

/**
 * User login
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 1. Validate required fields
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Find user by email using prepared statement
    const [users] = await db.execute(
      'SELECT id, full_name, email, password_hash, phone, role, organization_name, address FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // 3. Verify password using bcrypt.compare
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 4. Verify the selected role (if role is provided in request)
    if (role) {
      const normalizedRole = role.toLowerCase().trim();
      if (user.role !== normalizedRole) {
        return res.status(403).json({
          success: false,
          error: `Role mismatch. This account is registered as a '${user.role}', but you selected '${normalizedRole}'.`
        });
      }
    }

    // 5. Generate JWT token with { id, email, role } payload and 7-day expiration
    const token = generateToken(user);

    // 6. Store JWT in HTTP-only cookie with SameSite=Lax
    res.cookie('token', token, COOKIE_OPTIONS);

    // 7. Return user metadata without password_hash
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organization: user.organization_name,
        organization_name: user.organization_name,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login.'
    });
  }
};

/**
 * User logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Clear the HTTP-only cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during logout.'
    });
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // req.user is populated by authenticateToken middleware: { id, email, role }
    const [users] = await db.execute(
      `SELECT id, full_name, email, phone, role, organization_name, address, created_at, updated_at 
       FROM users 
       WHERE id = ? 
       LIMIT 1`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    const user = users[0];

    // Return user profile without password_hash
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organization: user.organization_name,
        organization_name: user.organization_name,
        address: user.address,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving user details.'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
