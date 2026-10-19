const db = require('../config/db');

/**
 * Format history record for API response and frontend compatibility
 */
const formatHistoryItem = (row) => ({
  id: row.id,
  requestId: row.request_id,
  request_id: row.request_id,
  foodId: row.food_id,
  food_id: row.food_id,
  donorId: row.donor_id,
  donor_id: row.donor_id,
  seekerId: row.seeker_id,
  seeker_id: row.seeker_id,
  quantityCompleted: row.quantity_completed,
  quantity_completed: row.quantity_completed,
  quantity: row.quantity_completed,
  mealsSaved: row.meals_saved_count,
  meals_saved: row.meals_saved_count,
  meals_saved_count: row.meals_saved_count,
  wasteKgSaved: parseFloat(row.waste_kg_saved),
  waste_kg_saved: parseFloat(row.waste_kg_saved),
  co2KgSaved: parseFloat(row.co2_kg_saved),
  co2_kg_saved: parseFloat(row.co2_kg_saved),
  completedAt: row.completed_at,
  completed_at: row.completed_at,
  handoverDate: new Date(row.completed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }),
  status: 'Completed',
  // Food Metadata
  foodTitle: row.food_title,
  food_title: row.food_title,
  foodCategory: row.food_category,
  food_category: row.food_category,
  foodLocation: row.food_location,
  food_location: row.food_location,
  foodImage: row.food_image_url || null,
  food_image_url: row.food_image_url || null,
  // Partner Information
  donorName: row.donor_name,
  donor_name: row.donor_name,
  donorPhone: row.donor_phone,
  donor_phone: row.donor_phone,
  donorEmail: row.donor_email,
  donor_email: row.donor_email,
  donorOrganization: row.donor_organization || null,
  donor_organization: row.donor_organization || null,
  donorAddress: row.donor_address || null,
  donor_address: row.donor_address || null,
  donorPartner: row.donor_organization || row.donor_name,
  seekerName: row.seeker_name,
  seeker_name: row.seeker_name,
  seekerPhone: row.seeker_phone,
  seeker_phone: row.seeker_phone,
  seekerEmail: row.seeker_email,
  seeker_email: row.seeker_email,
  seekerOrganization: row.seeker_organization || null,
  seeker_organization: row.seeker_organization || null,
  seekerAddress: row.seeker_address || null,
  seeker_address: row.seeker_address || null,
  recipientOrganization: row.seeker_organization || row.seeker_name,
  distributionTarget: row.seeker_organization || row.seeker_name,
  notes: row.request_notes || null
});

/**
 * GET /api/stats/summary
 * Public endpoint returning aggregate platform impact metrics calculated live from MySQL:
 * - mealsSaved: Total meals saved from completed distribution_history records
 * - foodDonors: Total count of users registered as donors
 * - foodSeekers: Total count of users registered as seekers
 * - wasteDivertedTons: Total waste saved in kilograms converted to metric tons (kg / 1000)
 */
const getStatsSummary = async (req, res) => {
  try {
    // 1. Count donors
    const [donorRows] = await db.execute(
      "SELECT COUNT(*) AS donor_count FROM users WHERE role = 'donor'"
    );
    const foodDonors = donorRows[0].donor_count || 0;

    // 2. Count seekers
    const [seekerRows] = await db.execute(
      "SELECT COUNT(*) AS seeker_count FROM users WHERE role = 'seeker'"
    );
    const foodSeekers = seekerRows[0].seeker_count || 0;

    // 3. Aggregate completed impact from distribution_history
    const [impactRows] = await db.execute(`
      SELECT 
        COALESCE(SUM(meals_saved_count), 0) AS total_meals,
        COALESCE(SUM(waste_kg_saved), 0.00) AS total_waste_kg,
        COALESCE(SUM(co2_kg_saved), 0.00) AS total_co2_kg,
        COUNT(*) AS total_distributions
      FROM distribution_history
    `);

    const totalMeals = parseInt(impactRows[0].total_meals, 10) || 0;
    const totalWasteKg = parseFloat(impactRows[0].total_waste_kg) || 0;
    const totalCo2Kg = parseFloat(impactRows[0].total_co2_kg) || 0;
    const totalDistributions = parseInt(impactRows[0].total_distributions, 10) || 0;

    // Convert kg of diverted food waste to metric tons
    const wasteDivertedTons = parseFloat((totalWasteKg / 1000).toFixed(2));

    return res.status(200).json({
      mealsSaved: totalMeals,
      foodDonors,
      foodSeekers,
      wasteDivertedTons,
      wasteDivertedKg: totalWasteKg,
      co2SavedKg: totalCo2Kg,
      totalDistributions
    });
  } catch (error) {
    console.error('Error calculating impact summary stats:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while calculating platform impact statistics.'
    });
  }
};

/**
 * GET /api/history
 * Authenticated endpoint returning completed donations (for donors) or completed claims (for seekers).
 * Sorted by newest completed distributions first.
 */
const getHistory = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT 
        h.id,
        h.request_id,
        h.food_id,
        h.donor_id,
        h.seeker_id,
        h.quantity_completed,
        h.meals_saved_count,
        h.waste_kg_saved,
        h.co2_kg_saved,
        h.completed_at,
        f.title AS food_title,
        f.category AS food_category,
        f.location AS food_location,
        f.image_url AS food_image_url,
        donor.full_name AS donor_name,
        donor.phone AS donor_phone,
        donor.email AS donor_email,
        donor.organization_name AS donor_organization,
        donor.address AS donor_address,
        seeker.full_name AS seeker_name,
        seeker.phone AS seeker_phone,
        seeker.email AS seeker_email,
        seeker.organization_name AS seeker_organization,
        seeker.address AS seeker_address,
        r.notes AS request_notes
      FROM distribution_history h
      JOIN foods f ON h.food_id = f.id
      JOIN food_requests r ON h.request_id = r.id
      JOIN users donor ON h.donor_id = donor.id
      JOIN users seeker ON h.seeker_id = seeker.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by role: donors see completed donations; seekers see completed claims
    if (userRole === 'donor') {
      query += ' AND h.donor_id = ?';
      params.push(userId);
    } else {
      query += ' AND h.seeker_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY h.completed_at DESC';

    const [rows] = await db.execute(query, params);
    const history = rows.map(formatHistoryItem);

    // Compute cumulative summary for current user
    const userSummary = {
      totalHandovers: history.length,
      totalMealsSaved: history.reduce((acc, item) => acc + item.mealsSaved, 0),
      totalWasteKgSaved: parseFloat(
        history.reduce((acc, item) => acc + item.wasteKgSaved, 0).toFixed(2)
      ),
      totalCo2KgSaved: parseFloat(
        history.reduce((acc, item) => acc + item.co2KgSaved, 0).toFixed(2)
      )
    };

    return res.status(200).json({
      success: true,
      count: history.length,
      userSummary,
      history
    });
  } catch (error) {
    console.error('Error fetching distribution history:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving distribution history.'
    });
  }
};

module.exports = {
  getStatsSummary,
  getHistory
};
