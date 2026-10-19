/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Enforces role authorization (e.g. requireRole('donor') or requireRole('seeker')).
 * Returns 401 if req.user is missing.
 * Returns 403 if authenticated user does not match the required role.
 */
const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: ${roles.join(', ')}.`
      });
    }

    next();
  };
};

requireRole.requireRole = requireRole;
module.exports = requireRole;
