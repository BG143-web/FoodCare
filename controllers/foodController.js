const db = require('../config/db');

// Valid food categories defined in MySQL schema
const VALID_CATEGORIES = [
  'Cooked Food',
  'Bakery',
  'Fresh Produce',
  'Dairy',
  'Packaged Food'
];

// Valid food statuses defined in MySQL schema
const VALID_STATUSES = [
  'Available',
  'Reserved',
  'Completed',
  'Cancelled'
];

/**
 * Format food record to support both camelCase and snake_case properties
 */
const formatFoodItem = (row) => ({
  id: row.id,
  donorId: row.donor_id,
  donor_id: row.donor_id,
  title: row.title,
  category: row.category,
  quantity: row.quantity,
  location: row.location,
  availableUntil: row.available_until,
  available_until: row.available_until,
  status: row.status,
  description: row.description || null,
  pickupNotes: row.pickup_notes || null,
  pickup_notes: row.pickup_notes || null,
  image: row.image_url || null,
  imageUrl: row.image_url || null,
  image_url: row.image_url || null,
  donorName: row.donor_name,
  donor_name: row.donor_name,
  donorPhone: row.donor_phone,
  donor_phone: row.donor_phone,
  donorEmail: row.donor_email,
  donor_email: row.donor_email,
  organization: row.organization_name || null,
  organization_name: row.organization_name || null,
  donorAddress: row.donor_address || null,
  donor_address: row.donor_address || null,
  createdAt: row.created_at,
  created_at: row.created_at,
  updatedAt: row.updated_at,
  updated_at: row.updated_at
});

/**
 * GET /api/foods
 * Public listing of foods with category, search and status filters.
 * Default status is 'Available'.
 */
const getAllFoods = async (req, res) => {
  try {
    const { category, search, status } = req.query;

    let query = `
      SELECT 
        f.id,
        f.donor_id,
        f.title,
        f.category,
        f.quantity,
        f.location,
        f.available_until,
        f.status,
        f.description,
        f.pickup_notes,
        f.image_url,
        f.created_at,
        f.updated_at,
        u.full_name AS donor_name,
        u.phone AS donor_phone,
        u.email AS donor_email,
        u.organization_name
      FROM foods f
      JOIN users u ON f.donor_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // 1. Status Filter: Defaults to 'Available' unless specified or set to 'all'
    if (status) {
      if (status.toLowerCase() !== 'all') {
        const matchedStatus = VALID_STATUSES.find(
          s => s.toLowerCase() === status.toLowerCase()
        );
        if (matchedStatus) {
          query += ' AND f.status = ?';
          params.push(matchedStatus);
        } else {
          query += ' AND f.status = ?';
          params.push(status);
        }
      }
    } else {
      query += ' AND f.status = ?';
      params.push('Available');
    }

    // 2. Category Filter
    if (category && category.trim()) {
      const matchedCategory = VALID_CATEGORIES.find(
        c => c.toLowerCase() === category.trim().toLowerCase()
      );
      if (matchedCategory) {
        query += ' AND f.category = ?';
        params.push(matchedCategory);
      } else {
        query += ' AND f.category = ?';
        params.push(category.trim());
      }
    }

    // 3. Search Filter: Matches food title, location, donor name, or organization name
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (
        f.title LIKE ? OR 
        f.location LIKE ? OR 
        u.full_name LIKE ? OR 
        u.organization_name LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Order by newest listings first
    query += ' ORDER BY f.created_at DESC';

    const [rows] = await db.execute(query, params);
    const foods = rows.map(formatFoodItem);

    return res.status(200).json({
      success: true,
      count: foods.length,
      foods
    });
  } catch (error) {
    console.error('Error fetching food listings:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving food listings.'
    });
  }
};

/**
 * GET /api/foods/:id
 * Public endpoint to fetch details of a single food item with donor contact info.
 */
const getFoodById = async (req, res) => {
  try {
    const foodId = parseInt(req.params.id, 10);
    if (isNaN(foodId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid food ID provided.'
      });
    }

    const query = `
      SELECT 
        f.id,
        f.donor_id,
        f.title,
        f.category,
        f.quantity,
        f.location,
        f.available_until,
        f.status,
        f.description,
        f.pickup_notes,
        f.image_url,
        f.created_at,
        f.updated_at,
        u.full_name AS donor_name,
        u.phone AS donor_phone,
        u.email AS donor_email,
        u.organization_name,
        u.address AS donor_address
      FROM foods f
      JOIN users u ON f.donor_id = u.id
      WHERE f.id = ?
      LIMIT 1
    `;

    const [rows] = await db.execute(query, [foodId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Food listing not found.'
      });
    }

    const food = formatFoodItem(rows[0]);

    return res.status(200).json({
      success: true,
      food
    });
  } catch (error) {
    console.error('Error fetching food by ID:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving food details.'
    });
  }
};

/**
 * POST /api/foods
 * Donor-only endpoint to post surplus food.
 * Sets donor_id from req.user.id and initial status to 'Available'.
 */
const createFood = async (req, res) => {
  try {
    const {
      title,
      category,
      quantity,
      location,
      availableUntil,
      available_until,
      description,
      pickupNotes,
      pickup_notes,
      image,
      imageUrl,
      image_url
    } = req.body;

    // 1. Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Food title is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, error: 'Category is required.' });
    }
    if (!quantity || !quantity.trim()) {
      return res.status(400).json({ success: false, error: 'Quantity is required.' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ success: false, error: 'Pickup location is required.' });
    }

    const expiryTime = (availableUntil || available_until || '').trim();
    if (!expiryTime) {
      return res.status(400).json({ success: false, error: 'Available until time is required.' });
    }

    // 2. Validate category matches allowed ENUM
    const normalizedCategory = VALID_CATEGORIES.find(
      c => c.toLowerCase() === category.trim().toLowerCase()
    );
    if (!normalizedCategory) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`
      });
    }

    // 3. donor_id comes strictly from req.user.id (never trust client)
    const donorId = req.user.id;
    const foodTitle = title.trim();
    const foodQuantity = quantity.trim();
    const foodLocation = location.trim();
    const foodDescription = (description || '').trim() || null;
    const foodPickupNotes = (pickupNotes || pickup_notes || '').trim() || null;
    const foodImageUrl = (imageUrl || image_url || image || '').trim() || null;

    // 4. Insert with status 'Available'
    const insertQuery = `
      INSERT INTO foods (
        donor_id,
        title,
        category,
        quantity,
        location,
        available_until,
        status,
        description,
        pickup_notes,
        image_url
      ) VALUES (?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      donorId,
      foodTitle,
      normalizedCategory,
      foodQuantity,
      foodLocation,
      expiryTime,
      foodDescription,
      foodPickupNotes,
      foodImageUrl
    ]);

    const newFoodId = result.insertId;

    // 5. Fetch newly created record with donor details
    const [rows] = await db.execute(
      `SELECT 
        f.id,
        f.donor_id,
        f.title,
        f.category,
        f.quantity,
        f.location,
        f.available_until,
        f.status,
        f.description,
        f.pickup_notes,
        f.image_url,
        f.created_at,
        f.updated_at,
        u.full_name AS donor_name,
        u.phone AS donor_phone,
        u.email AS donor_email,
        u.organization_name
      FROM foods f
      JOIN users u ON f.donor_id = u.id
      WHERE f.id = ?`,
      [newFoodId]
    );

    const createdFood = formatFoodItem(rows[0]);

    return res.status(201).json({
      success: true,
      message: 'Surplus food listing created successfully.',
      food: createdFood
    });
  } catch (error) {
    console.error('Error creating food listing:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating the food listing.'
    });
  }
};

/**
 * PUT /api/foods/:id
 * Donor-only endpoint to update an existing food listing.
 * Strict ownership check and state-machine validation:
 * - Only the owner can update.
 * - Reserved, Completed, or Cancelled food cannot be updated.
 * - Arbitrary status manipulation is rejected.
 */
const updateFood = async (req, res) => {
  try {
    const foodId = parseInt(req.params.id, 10);
    if (isNaN(foodId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid food ID provided.'
      });
    }

    // 1. Check if food exists
    const [existingRows] = await db.execute(
      'SELECT * FROM foods WHERE id = ? LIMIT 1',
      [foodId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Food listing not found.'
      });
    }

    const currentFood = existingRows[0];

    // 2. Ownership check: Only the owner can modify
    if (currentFood.donor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only update food listings you created.'
      });
    }

    // 3. Business rule checks on current state
    if (currentFood.status === 'Reserved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a food listing that is currently Reserved by a seeker.'
      });
    }

    if (currentFood.status === 'Completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a food listing that has already been Completed.'
      });
    }

    if (currentFood.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a food listing that has been Cancelled.'
      });
    }

    const {
      title,
      category,
      quantity,
      location,
      availableUntil,
      available_until,
      description,
      pickupNotes,
      pickup_notes,
      image,
      imageUrl,
      image_url,
      status
    } = req.body;

    // 4. Prevent unauthorized status manipulation
    if (status && status !== currentFood.status) {
      return res.status(400).json({
        success: false,
        error: "Status cannot be modified via update endpoint. Status changes occur through claim and handover workflows or deletion."
      });
    }

    // 5. Validate category if provided
    let normalizedCategory = currentFood.category;
    if (category) {
      const match = VALID_CATEGORIES.find(
        c => c.toLowerCase() === category.trim().toLowerCase()
      );
      if (!match) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`
        });
      }
      normalizedCategory = match;
    }

    // 6. Build updated fields
    const updatedTitle = title !== undefined ? title.trim() : currentFood.title;
    const updatedQuantity = quantity !== undefined ? quantity.trim() : currentFood.quantity;
    const updatedLocation = location !== undefined ? location.trim() : currentFood.location;
    const updatedAvailableUntil = (availableUntil || available_until) !== undefined
      ? (availableUntil || available_until).trim()
      : currentFood.available_until;
    const updatedDescription = description !== undefined
      ? (description ? description.trim() : null)
      : currentFood.description;
    const updatedPickupNotes = (pickupNotes !== undefined || pickup_notes !== undefined)
      ? ((pickupNotes || pickup_notes) ? (pickupNotes || pickup_notes).trim() : null)
      : currentFood.pickup_notes;
    const updatedImageUrl = (imageUrl !== undefined || image_url !== undefined || image !== undefined)
      ? ((imageUrl || image_url || image) ? (imageUrl || image_url || image).trim() : null)
      : currentFood.image_url;

    if (!updatedTitle) {
      return res.status(400).json({ success: false, error: 'Food title cannot be empty.' });
    }
    if (!updatedQuantity) {
      return res.status(400).json({ success: false, error: 'Quantity cannot be empty.' });
    }
    if (!updatedLocation) {
      return res.status(400).json({ success: false, error: 'Location cannot be empty.' });
    }

    // 7. Execute update
    const updateQuery = `
      UPDATE foods SET
        title = ?,
        category = ?,
        quantity = ?,
        location = ?,
        available_until = ?,
        description = ?,
        pickup_notes = ?,
        image_url = ?
      WHERE id = ?
    `;

    await db.execute(updateQuery, [
      updatedTitle,
      normalizedCategory,
      updatedQuantity,
      updatedLocation,
      updatedAvailableUntil,
      updatedDescription,
      updatedPickupNotes,
      updatedImageUrl,
      foodId
    ]);

    // 8. Retrieve updated food listing
    const [rows] = await db.execute(
      `SELECT 
        f.id,
        f.donor_id,
        f.title,
        f.category,
        f.quantity,
        f.location,
        f.available_until,
        f.status,
        f.description,
        f.pickup_notes,
        f.image_url,
        f.created_at,
        f.updated_at,
        u.full_name AS donor_name,
        u.phone AS donor_phone,
        u.email AS donor_email,
        u.organization_name
      FROM foods f
      JOIN users u ON f.donor_id = u.id
      WHERE f.id = ?`,
      [foodId]
    );

    const updatedFood = formatFoodItem(rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Food listing updated successfully.',
      food: updatedFood
    });
  } catch (error) {
    console.error('Error updating food listing:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while updating the food listing.'
    });
  }
};

/**
 * DELETE /api/foods/:id
 * Donor-only endpoint to soft-delete / cancel a food listing.
 * Ownership and business rule validations:
 * - Only the owner can cancel.
 * - Reserved or Completed listings cannot be cancelled.
 * - Changes status to 'Cancelled' to preserve historical records.
 */
const deleteFood = async (req, res) => {
  try {
    const foodId = parseInt(req.params.id, 10);
    if (isNaN(foodId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid food ID provided.'
      });
    }

    // 1. Check if food exists
    const [rows] = await db.execute(
      'SELECT id, donor_id, title, status FROM foods WHERE id = ? LIMIT 1',
      [foodId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Food listing not found.'
      });
    }

    const food = rows[0];

    // 2. Ownership check
    if (food.donor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only cancel or delete your own food listings.'
      });
    }

    // 3. Business rule checks
    if (food.status === 'Reserved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a food listing that is currently Reserved by a seeker.'
      });
    }

    if (food.status === 'Completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete or cancel a food listing that has already been Completed.'
      });
    }

    if (food.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'This food listing is already Cancelled.'
      });
    }

    // 4. Soft-delete by setting status to 'Cancelled' (preserving historical records)
    await db.execute(
      "UPDATE foods SET status = 'Cancelled' WHERE id = ?",
      [foodId]
    );

    return res.status(200).json({
      success: true,
      message: 'Food listing has been cancelled successfully.',
      foodId,
      status: 'Cancelled'
    });
  } catch (error) {
    console.error('Error deleting food listing:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while deleting the food listing.'
    });
  }
};

module.exports = {
  getAllFoods,
  getFoodById,
  createFood,
  updateFood,
  deleteFood
};
