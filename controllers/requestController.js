const db = require('../config/db');

// Valid request statuses
const VALID_REQUEST_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Completed'];

/**
 * Helper to calculate impact metrics on completion
 * Follows the FoodCare impact algorithm:
 * - Cooked Food   : 1 Portion = 1 Meal, 0.45 kg waste, 1.12 kg CO2
 * - Bakery        : 1 Loaf    = 4 Meals, 0.50 kg waste, 0.90 kg CO2
 * - Fresh Produce : 1 kg      = 2 Meals, 1.00 kg waste, 1.90 kg CO2
 * - Dairy         : 1 Liter   = 3 Meals, 1.00 kg waste, 2.40 kg CO2
 * - Packaged Food : 1 Pack    = 2 Meals, 0.50 kg waste, 1.20 kg CO2
 */
const calculateImpact = (category, quantityStr) => {
  const match = (quantityStr || '').match(/\d+(\.\d+)?/);
  const units = match ? parseFloat(match[0]) : 1;

  let meals = 0;
  let wasteKg = 0;
  let co2Kg = 0;

  switch (category) {
    case 'Cooked Food':
      meals = Math.round(units * 1);
      wasteKg = parseFloat((units * 0.45).toFixed(2));
      co2Kg = parseFloat((units * 1.12).toFixed(2));
      break;
    case 'Bakery':
      meals = Math.round(units * 4);
      wasteKg = parseFloat((units * 0.50).toFixed(2));
      co2Kg = parseFloat((units * 0.90).toFixed(2));
      break;
    case 'Fresh Produce':
      meals = Math.round(units * 2);
      wasteKg = parseFloat((units * 1.00).toFixed(2));
      co2Kg = parseFloat((units * 1.90).toFixed(2));
      break;
    case 'Dairy':
      meals = Math.round(units * 3);
      wasteKg = parseFloat((units * 1.00).toFixed(2));
      co2Kg = parseFloat((units * 2.40).toFixed(2));
      break;
    case 'Packaged Food':
    default:
      // LIMITATION NOTE:
      // The FoodCare plan explicitly standardizes conversion factors for 'Cooked Food', 'Bakery',
      // 'Fresh Produce', and 'Dairy'. 'Packaged Food' encompasses varied containers (cans, pouches, boxes)
      // without a single volumetric or weight standard. We handle it safely with a conservative 1:1 estimate
      // (1 unit = 1 Meal, 0.35 kg waste prevented, 0.75 kg CO2 saved) to prevent zero-division or errors.
      meals = Math.round(units * 1);
      wasteKg = parseFloat((units * 0.35).toFixed(2));
      co2Kg = parseFloat((units * 0.75).toFixed(2));
      break;
  }

  return { meals, wasteKg, co2Kg };
};

/**
 * Format request record to support both frontend UI camelCase and snake_case API standards
 */
const formatRequestItem = (row) => ({
  id: row.id,
  foodId: row.food_id,
  food_id: row.food_id,
  seekerId: row.seeker_id,
  seeker_id: row.seeker_id,
  quantityRequested: row.quantity_requested,
  quantity_requested: row.quantity_requested,
  notes: row.notes || null,
  status: row.status,
  requestDate: new Date(row.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }),
  createdAt: row.created_at,
  created_at: row.created_at,
  updatedAt: row.updated_at,
  updated_at: row.updated_at,
  foodTitle: row.food_title,
  food_title: row.food_title,
  foodCategory: row.food_category,
  food_category: row.food_category,
  foodLocation: row.food_location,
  food_location: row.food_location,
  availableUntil: row.food_available_until,
  available_until: row.food_available_until,
  foodStatus: row.food_status,
  food_status: row.food_status,
  foodImageUrl: row.food_image_url || null,
  food_image_url: row.food_image_url || null,
  donorId: row.donor_id,
  donor_id: row.donor_id,
  donorName: row.donor_name,
  donor_name: row.donor_name,
  donorPhone: row.donor_phone,
  donor_phone: row.donor_phone,
  donorEmail: row.donor_email,
  donor_email: row.donor_email,
  donorOrganization: row.donor_organization || null,
  donor_organization: row.donor_organization || null,
  seekerName: row.seeker_name,
  seeker_name: row.seeker_name,
  seekerPhone: row.seeker_phone,
  seeker_phone: row.seeker_phone,
  seekerEmail: row.seeker_email,
  seeker_email: row.seeker_email,
  seekerOrganization: row.seeker_organization || null,
  seeker_organization: row.seeker_organization || null,
  seekerContact: `${row.seeker_phone} • ${row.seeker_organization || row.seeker_email}`
});

/**
 * GET /api/requests
 * Authenticated endpoint:
 * - Donors receive requests submitted for their food listings.
 * - Seekers receive requests they personally submitted.
 * - Supports status filter: Pending, Accepted, Completed, Rejected, all.
 */
const getAllRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const { status } = req.query;

    let query = `
      SELECT 
        r.id,
        r.food_id,
        r.seeker_id,
        r.quantity_requested,
        r.notes,
        r.status,
        r.created_at,
        r.updated_at,
        f.donor_id,
        f.title AS food_title,
        f.category AS food_category,
        f.quantity AS food_total_quantity,
        f.location AS food_location,
        f.available_until AS food_available_until,
        f.status AS food_status,
        f.image_url AS food_image_url,
        donor.full_name AS donor_name,
        donor.phone AS donor_phone,
        donor.email AS donor_email,
        donor.organization_name AS donor_organization,
        seeker.full_name AS seeker_name,
        seeker.phone AS seeker_phone,
        seeker.email AS seeker_email,
        seeker.organization_name AS seeker_organization
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      JOIN users donor ON f.donor_id = donor.id
      JOIN users seeker ON r.seeker_id = seeker.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by user role: Donors see claims on their food; Seekers see their own claims
    if (userRole === 'donor') {
      query += ' AND f.donor_id = ?';
      params.push(userId);
    } else {
      query += ' AND r.seeker_id = ?';
      params.push(userId);
    }

    // Filter by status if provided (and not 'all')
    if (status && status.toLowerCase() !== 'all') {
      const matchedStatus = VALID_REQUEST_STATUSES.find(
        s => s.toLowerCase() === status.trim().toLowerCase()
      );
      if (matchedStatus) {
        query += ' AND r.status = ?';
        params.push(matchedStatus);
      } else {
        query += ' AND r.status = ?';
        params.push(status.trim());
      }
    }

    query += ' ORDER BY r.created_at DESC';

    const [rows] = await db.execute(query, params);
    const requests = rows.map(formatRequestItem);

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving food requests.'
    });
  }
};

/**
 * POST /api/requests
 * Seeker-only endpoint to claim available surplus food.
 * Request body: { foodId, quantityRequested, notes }
 * Enforces:
 * - Food exists and status is 'Available'
 * - seeker_id from req.user.id
 * - Prevents duplicate active claims for the same food
 * - Status defaults to 'Pending'
 */
const createRequest = async (req, res) => {
  try {
    const { foodId, food_id, quantityRequested, quantity_requested, notes } = req.body;
    const targetFoodId = parseInt(foodId || food_id, 10);
    const quantity = (quantityRequested || quantity_requested || '').trim();
    const requestNotes = (notes || '').trim() || null;
    const seekerId = req.user.id;

    // 1. Validate required fields
    if (isNaN(targetFoodId)) {
      return res.status(400).json({
        success: false,
        error: 'A valid foodId is required.'
      });
    }

    if (!quantity) {
      return res.status(400).json({
        success: false,
        error: 'Quantity requested is required.'
      });
    }

    // 2. Verify food exists and is Available
    const [foods] = await db.execute(
      'SELECT id, donor_id, title, status FROM foods WHERE id = ? LIMIT 1',
      [targetFoodId]
    );

    if (foods.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Food listing not found.'
      });
    }

    const food = foods[0];

    // Prevent donor from requesting their own food
    if (food.donor_id === seekerId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot request or claim your own surplus food listing.'
      });
    }

    if (food.status !== 'Available') {
      return res.status(400).json({
        success: false,
        error: `Cannot request food that is not Available (current status: ${food.status}).`
      });
    }

    // 3. Prevent duplicate active requests by the same seeker for the same food
    const [existingClaims] = await db.execute(
      `SELECT id, status FROM food_requests 
       WHERE food_id = ? AND seeker_id = ? AND status IN ('Pending', 'Accepted') 
       LIMIT 1`,
      [targetFoodId, seekerId]
    );

    if (existingClaims.length > 0) {
      return res.status(409).json({
        success: false,
        error: `You already have an active request (${existingClaims[0].status}) for this food listing.`
      });
    }

    // 4. Create request with 'Pending' status
    const [insertResult] = await db.execute(
      `INSERT INTO food_requests (food_id, seeker_id, quantity_requested, notes, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [targetFoodId, seekerId, quantity, requestNotes]
    );

    const newRequestId = insertResult.insertId;

    // 5. Fetch full request record with details
    const [rows] = await db.execute(
      `SELECT 
        r.id,
        r.food_id,
        r.seeker_id,
        r.quantity_requested,
        r.notes,
        r.status,
        r.created_at,
        r.updated_at,
        f.donor_id,
        f.title AS food_title,
        f.category AS food_category,
        f.location AS food_location,
        f.available_until AS food_available_until,
        f.status AS food_status,
        f.image_url AS food_image_url,
        donor.full_name AS donor_name,
        donor.phone AS donor_phone,
        donor.email AS donor_email,
        donor.organization_name AS donor_organization,
        seeker.full_name AS seeker_name,
        seeker.phone AS seeker_phone,
        seeker.email AS seeker_email,
        seeker.organization_name AS seeker_organization
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      JOIN users donor ON f.donor_id = donor.id
      JOIN users seeker ON r.seeker_id = seeker.id
      WHERE r.id = ?`,
      [newRequestId]
    );

    const createdRequest = formatRequestItem(rows[0]);

    return res.status(201).json({
      success: true,
      message: 'Food claim request submitted successfully.',
      request: createdRequest
    });
  } catch (error) {
    console.error('Error creating food request:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating the food request.'
    });
  }
};

/**
 * PUT /api/requests/:id/status
 * Updates request status ('Accepted', 'Rejected', 'Completed')
 * Enforces MySQL transactions, row locking, and lifecycle consistency:
 * - 'Accepted': Locks food row. Updates request to 'Accepted', food to 'Reserved'.
 * - 'Rejected': Updates request to 'Rejected'. If no other accepted claim exists, food reverts to 'Available'.
 * - 'Completed': Updates request and food to 'Completed'. Records distribution_history with impact metrics.
 */
const updateRequestStatus = async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ success: false, error: 'Invalid request ID provided.' });
  }

  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, error: 'Target status is required.' });
  }

  const normalizedStatus = VALID_REQUEST_STATUSES.find(
    s => s.toLowerCase() === status.trim().toLowerCase()
  );

  if (!normalizedStatus || normalizedStatus === 'Pending') {
    return res.status(400).json({
      success: false,
      error: "Status must be 'Accepted', 'Rejected', or 'Completed'."
    });
  }

  const connection = await db.getConnection();

  try {
    // Begin atomic MySQL transaction
    await connection.beginTransaction();

    // 1. Fetch request details with lock
    const [requests] = await connection.execute(
      `SELECT 
        r.id,
        r.food_id,
        r.seeker_id,
        r.quantity_requested,
        r.notes,
        r.status AS request_status,
        f.donor_id,
        f.title AS food_title,
        f.category AS food_category,
        f.status AS food_status,
        f.quantity AS food_quantity
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      WHERE r.id = ? 
      FOR UPDATE`,
      [requestId]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Food request not found.' });
    }

    const request = requests[0];
    const userId = req.user.id;
    const isDonor = userId === request.donor_id;
    const isSeeker = userId === request.seeker_id;

    // 2. Authorization validation: Only participants can interact; Accept & Reject require the donor
    if (!isDonor && !isSeeker) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to update this request.'
      });
    }

    if ((normalizedStatus === 'Accepted' || normalizedStatus === 'Rejected') && !isDonor) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the food donor can accept or reject requests.'
      });
    }

    // 3. Prevent duplicate completions
    if (request.request_status === 'Completed') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'This request has already been Completed and cannot be modified.'
      });
    }

    // 4. Handle State Transitions
    if (normalizedStatus === 'Accepted') {
      // Must be currently Pending
      if (request.request_status !== 'Pending') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `Cannot accept a request with status '${request.request_status}'.`
        });
      }

      // Check food availability
      if (request.food_status !== 'Available') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `Cannot accept request. The food listing is currently '${request.food_status}'.`
        });
      }

      // Check if any other request is already Accepted for this food
      const [otherAccepted] = await connection.execute(
        `SELECT id FROM food_requests 
         WHERE food_id = ? AND status = 'Accepted' AND id != ? 
         FOR UPDATE`,
        [request.food_id, requestId]
      );

      if (otherAccepted.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Another request has already been accepted for this food listing.'
        });
      }

      // Update request to 'Accepted'
      await connection.execute(
        "UPDATE food_requests SET status = 'Accepted' WHERE id = ?",
        [requestId]
      );

      // Lock food listing to 'Reserved'
      await connection.execute(
        "UPDATE foods SET status = 'Reserved' WHERE id = ?",
        [request.food_id]
      );

    } else if (normalizedStatus === 'Rejected') {
      // Update request to 'Rejected'
      await connection.execute(
        "UPDATE food_requests SET status = 'Rejected' WHERE id = ?",
        [requestId]
      );

      // If this request was Accepted (or food was Reserved), check if any other accepted request exists
      const [remainingAccepted] = await connection.execute(
        `SELECT id FROM food_requests 
         WHERE food_id = ? AND status = 'Accepted' AND id != ? 
         LIMIT 1`,
        [request.food_id, requestId]
      );

      // If no other accepted claim exists, revert food back to 'Available'
      if (remainingAccepted.length === 0 && request.food_status === 'Reserved') {
        await connection.execute(
          "UPDATE foods SET status = 'Available' WHERE id = ?",
          [request.food_id]
        );
      }

    } else if (normalizedStatus === 'Completed') {
      // Must be currently 'Accepted' before completion
      if (request.request_status !== 'Accepted') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `Cannot complete a request that is currently '${request.request_status}'. It must be Accepted first.`
        });
      }

      // Check if a distribution history record already exists for this request
      const [existingHistory] = await connection.execute(
        'SELECT id FROM distribution_history WHERE request_id = ? LIMIT 1',
        [requestId]
      );

      if (existingHistory.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Distribution history record already exists for this request.'
        });
      }

      // Update request and food to 'Completed'
      await connection.execute(
        "UPDATE food_requests SET status = 'Completed' WHERE id = ?",
        [requestId]
      );

      await connection.execute(
        "UPDATE foods SET status = 'Completed' WHERE id = ?",
        [request.food_id]
      );

      // Calculate environmental and social impact metrics
      const { meals, wasteKg, co2Kg } = calculateImpact(
        request.food_category,
        request.quantity_requested
      );

      // Insert audited record into distribution_history
      await connection.execute(
        `INSERT INTO distribution_history (
          request_id,
          food_id,
          donor_id,
          seeker_id,
          quantity_completed,
          meals_saved_count,
          waste_kg_saved,
          co2_kg_saved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          request.food_id,
          request.donor_id,
          request.seeker_id,
          request.quantity_requested,
          meals,
          wasteKg,
          co2Kg
        ]
      );
    }

    // Commit all changes atomically
    await connection.commit();

    // 5. Fetch updated request representation
    const [updatedRows] = await db.execute(
      `SELECT 
        r.id,
        r.food_id,
        r.seeker_id,
        r.quantity_requested,
        r.notes,
        r.status,
        r.created_at,
        r.updated_at,
        f.donor_id,
        f.title AS food_title,
        f.category AS food_category,
        f.location AS food_location,
        f.available_until AS food_available_until,
        f.status AS food_status,
        f.image_url AS food_image_url,
        donor.full_name AS donor_name,
        donor.phone AS donor_phone,
        donor.email AS donor_email,
        donor.organization_name AS donor_organization,
        seeker.full_name AS seeker_name,
        seeker.phone AS seeker_phone,
        seeker.email AS seeker_email,
        seeker.organization_name AS seeker_organization
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      JOIN users donor ON f.donor_id = donor.id
      JOIN users seeker ON r.seeker_id = seeker.id
      WHERE r.id = ?`,
      [requestId]
    );

    const updatedRequest = formatRequestItem(updatedRows[0]);

    return res.status(200).json({
      success: true,
      message: `Request status successfully updated to '${normalizedStatus}'.`,
      request: updatedRequest
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating request status:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while updating the request status.'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllRequests,
  createRequest,
  updateRequestStatus
};
