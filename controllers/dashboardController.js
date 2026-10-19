const db = require('../config/db');

/**
 * Format food record
 */
const formatFood = (f) => ({
  id: f.id,
  title: f.title,
  category: f.category,
  quantity: f.quantity,
  location: f.location,
  availableUntil: f.available_until,
  available_until: f.available_until,
  status: f.status,
  description: f.description || null,
  pickupNotes: f.pickup_notes || null,
  pickup_notes: f.pickup_notes || null,
  image: f.image_url || null,
  imageUrl: f.image_url || null,
  createdAt: f.created_at,
  created_at: f.created_at
});

/**
 * Format request record
 */
const formatRequest = (r) => ({
  id: r.id,
  foodId: r.food_id,
  foodTitle: r.food_title,
  quantityRequested: r.quantity_requested,
  status: r.status,
  notes: r.notes || null,
  partnerName: r.partner_name,
  partnerOrganization: r.partner_organization || null,
  createdAt: r.created_at,
  created_at: r.created_at
});

/**
 * GET /api/donor/dashboard
 * Donor-only dashboard metrics and recent food listings calculated from MySQL:
 * - total food listings
 * - available listings
 * - reserved listings
 * - completed listings
 * - cancelled listings
 * - pending requests
 * - completed donations
 * - meals saved
 * - waste diverted (kg & tons)
 * - recent food listings
 * - recent requests
 */
const getDonorDashboard = async (req, res) => {
  try {
    const donorId = req.user.id;

    // 1. Food listing status counts
    const [foodCounts] = await db.execute(`
      SELECT 
        COUNT(*) AS total_listings,
        COUNT(CASE WHEN status = 'Available' THEN 1 END) AS available_listings,
        COUNT(CASE WHEN status = 'Reserved' THEN 1 END) AS reserved_listings,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_listings,
        COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) AS cancelled_listings
      FROM foods
      WHERE donor_id = ?
    `, [donorId]);

    // 2. Incoming requests for this donor's food
    const [requestCounts] = await db.execute(`
      SELECT 
        COUNT(*) AS total_requests,
        COUNT(CASE WHEN r.status = 'Pending' THEN 1 END) AS pending_requests,
        COUNT(CASE WHEN r.status = 'Accepted' THEN 1 END) AS accepted_requests,
        COUNT(CASE WHEN r.status = 'Completed' THEN 1 END) AS completed_requests
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      WHERE f.donor_id = ?
    `, [donorId]);

    // 3. Completed donations & impact from distribution_history
    const [impactCounts] = await db.execute(`
      SELECT 
        COUNT(*) AS total_completed_donations,
        COALESCE(SUM(meals_saved_count), 0) AS total_meals_saved,
        COALESCE(SUM(waste_kg_saved), 0.00) AS total_waste_kg,
        COALESCE(SUM(co2_kg_saved), 0.00) AS total_co2_kg
      FROM distribution_history
      WHERE donor_id = ?
    `, [donorId]);

    // 4. Donor's recent 6 food listings
    const [recentFoodsRows] = await db.execute(`
      SELECT * FROM foods
      WHERE donor_id = ?
      ORDER BY created_at DESC
      LIMIT 6
    `, [donorId]);

    // 5. Recent 5 incoming requests
    const [recentRequestsRows] = await db.execute(`
      SELECT 
        r.id, r.food_id, r.quantity_requested, r.status, r.notes, r.created_at,
        f.title AS food_title,
        u.full_name AS partner_name,
        u.organization_name AS partner_organization
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      JOIN users u ON r.seeker_id = u.id
      WHERE f.donor_id = ?
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [donorId]);

    const totalListings = parseInt(foodCounts[0].total_listings, 10) || 0;
    const availableListings = parseInt(foodCounts[0].available_listings, 10) || 0;
    const reservedListings = parseInt(foodCounts[0].reserved_listings, 10) || 0;
    const completedListings = parseInt(foodCounts[0].completed_listings, 10) || 0;
    const cancelledListings = parseInt(foodCounts[0].cancelled_listings, 10) || 0;

    const pendingRequests = parseInt(requestCounts[0].pending_requests, 10) || 0;
    const acceptedRequests = parseInt(requestCounts[0].accepted_requests, 10) || 0;
    const completedDonations = parseInt(impactCounts[0].total_completed_donations, 10) || 0;
    const mealsSaved = parseInt(impactCounts[0].total_meals_saved, 10) || 0;
    const wasteDivertedKg = parseFloat(impactCounts[0].total_waste_kg) || 0;
    const wasteDivertedTons = parseFloat((wasteDivertedKg / 1000).toFixed(2));
    const co2SavedKg = parseFloat(impactCounts[0].total_co2_kg) || 0;

    return res.status(200).json({
      success: true,
      metrics: {
        totalDonations: totalListings,
        totalFoodListings: totalListings,
        availableFood: availableListings,
        availableListings: availableListings,
        reservedListings: reservedListings,
        completedListings: completedListings,
        cancelledListings: cancelledListings,
        pendingRequests: pendingRequests,
        acceptedRequests: acceptedRequests,
        completedDonations: completedDonations,
        mealsSaved: mealsSaved,
        wasteDivertedKg: wasteDivertedKg,
        wasteDivertedTons: wasteDivertedTons,
        co2SavedKg: co2SavedKg
      },
      recentFoods: recentFoodsRows.map(formatFood),
      recentRequests: recentRequestsRows.map(formatRequest)
    });
  } catch (error) {
    console.error('Error fetching donor dashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving donor dashboard metrics.'
    });
  }
};

/**
 * GET /api/seeker/dashboard
 * Seeker-only dashboard metrics calculated from MySQL:
 * - available food count
 * - submitted requests
 * - pending requests
 * - accepted requests
 * - completed claims
 * - meals received / saved
 * - recent requests
 * - available foods preview
 */
const getSeekerDashboard = async (req, res) => {
  try {
    const seekerId = req.user.id;

    // 1. Available foods platform-wide
    const [availableFoodRows] = await db.execute(`
      SELECT COUNT(*) AS available_count FROM foods WHERE status = 'Available'
    `);
    const availableFoodCount = parseInt(availableFoodRows[0].available_count, 10) || 0;

    // 2. Seeker's request counts by status
    const [requestCounts] = await db.execute(`
      SELECT 
        COUNT(*) AS total_submitted,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status = 'Accepted' THEN 1 END) AS accepted_count,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) AS completed_count,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_count
      FROM food_requests
      WHERE seeker_id = ?
    `, [seekerId]);

    // 3. Impact / meals received from completed claims in distribution_history
    const [impactCounts] = await db.execute(`
      SELECT 
        COALESCE(SUM(meals_saved_count), 0) AS total_meals_received,
        COALESCE(SUM(waste_kg_saved), 0.00) AS total_waste_kg,
        COALESCE(SUM(co2_kg_saved), 0.00) AS total_co2_kg
      FROM distribution_history
      WHERE seeker_id = ?
    `, [seekerId]);

    // 4. Seeker's recent 5 submitted requests
    const [recentRequestsRows] = await db.execute(`
      SELECT 
        r.id, r.food_id, r.quantity_requested, r.status, r.notes, r.created_at,
        f.title AS food_title,
        u.full_name AS partner_name,
        u.organization_name AS partner_organization
      FROM food_requests r
      JOIN foods f ON r.food_id = f.id
      JOIN users u ON f.donor_id = u.id
      WHERE r.seeker_id = ?
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [seekerId]);

    // 5. Available foods preview (newest 6 available)
    const [availableFoodsPreview] = await db.execute(`
      SELECT 
        f.id, f.title, f.category, f.quantity, f.location, f.available_until,
        f.status, f.description, f.pickup_notes, f.image_url, f.created_at,
        u.full_name AS donor_name, u.organization_name
      FROM foods f
      JOIN users u ON f.donor_id = u.id
      WHERE f.status = 'Available'
      ORDER BY f.created_at DESC
      LIMIT 6
    `);

    const submittedRequests = parseInt(requestCounts[0].total_submitted, 10) || 0;
    const pendingRequests = parseInt(requestCounts[0].pending_count, 10) || 0;
    const acceptedRequests = parseInt(requestCounts[0].accepted_count, 10) || 0;
    const completedClaims = parseInt(requestCounts[0].completed_count, 10) || 0;
    const mealsReceived = parseInt(impactCounts[0].total_meals_received, 10) || 0;
    const wasteDivertedKg = parseFloat(impactCounts[0].total_waste_kg) || 0;
    const co2SavedKg = parseFloat(impactCounts[0].total_co2_kg) || 0;

    return res.status(200).json({
      success: true,
      metrics: {
        availableFood: availableFoodCount,
        availableFoodCount: availableFoodCount,
        submittedRequests: submittedRequests,
        totalRequests: submittedRequests,
        myRequests: submittedRequests,
        pendingRequests: pendingRequests,
        acceptedRequests: acceptedRequests,
        completedClaims: completedClaims,
        mealsReceived: mealsReceived,
        mealsSaved: mealsReceived,
        wasteDivertedKg: wasteDivertedKg,
        co2SavedKg: co2SavedKg
      },
      recentRequests: recentRequestsRows.map(formatRequest),
      availableFoods: availableFoodsPreview.map(f => ({
        ...formatFood(f),
        donorName: f.donor_name,
        donorOrganization: f.organization_name
      }))
    });
  } catch (error) {
    console.error('Error fetching seeker dashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving seeker dashboard metrics.'
    });
  }
};

module.exports = {
  getDonorDashboard,
  getSeekerDashboard
};
