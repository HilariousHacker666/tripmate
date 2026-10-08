const { validationResult, body, param } = require('express-validator');

// Middleware to evaluate validation results and return clean, generic error details
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
}

// Password policy: min 10 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character
const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{10,}$/;

const userRegistrationValidation = [
  body('email')
    .isEmail().withMessage('Valid email address is required')
    .normalizeEmail()
    .trim(),
  body('password')
    .matches(passwordComplexityRegex)
    .withMessage('Password must be at least 10 characters and include uppercase, lowercase, digit, and special character'),
  body('name')
    .isString().withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .escape(),
  validateRequest
];

const userLoginValidation = [
  body('email')
    .isEmail().withMessage('Valid email address is required')
    .normalizeEmail()
    .trim(),
  body('password')
    .isString().withMessage('Password must be provided')
    .isLength({ min: 1, max: 128 }),
  validateRequest
];

const tripCreateValidation = [
  body('title')
    .isString().trim()
    .isLength({ min: 1, max: 150 }).withMessage('Trip title must be 1-150 characters')
    .escape(),
  body('description')
    .optional({ checkFalsy: true })
    .isString().trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
    .escape(),
  body('startDate')
    .isISO8601().withMessage('Start date must be a valid ISO 8601 date (YYYY-MM-DD)'),
  body('endDate')
    .isISO8601().withMessage('End date must be a valid ISO 8601 date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) < new Date(req.body.startDate)) {
        throw new Error('End date cannot precede start date');
      }
      return true;
    }),
  body('budget')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a non-negative number'),
  validateRequest
];

const tripUpdateValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  body('title')
    .optional()
    .isString().trim()
    .isLength({ min: 1, max: 150 }).withMessage('Trip title must be 1-150 characters')
    .escape(),
  body('description')
    .optional()
    .isString().trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
    .escape(),
  body('startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  body('budget')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a non-negative number'),
  validateRequest
];

const destinationValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  body('name')
    .isString().trim()
    .isLength({ min: 1, max: 150 }).withMessage('Destination name must be 1-150 characters')
    .escape(),
  body('country')
    .isString().trim()
    .isLength({ min: 1, max: 100 }).withMessage('Country must be 1-100 characters')
    .escape(),
  body('arrivalDate')
    .isISO8601().withMessage('Arrival date must be valid ISO 8601 date'),
  body('departureDate')
    .isISO8601().withMessage('Departure date must be valid ISO 8601 date')
    .custom((departureDate, { req }) => {
      if (new Date(departureDate) < new Date(req.body.arrivalDate)) {
        throw new Error('Departure date cannot precede arrival date');
      }
      return true;
    }),
  body('notes')
    .optional()
    .isString().trim()
    .isLength({ max: 1000 })
    .escape(),
  validateRequest
];

const itineraryValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  body('destinationId')
    .isUUID().withMessage('Valid UUID destination ID required'),
  body('day')
    .isISO8601().withMessage('Day must be a valid ISO 8601 date (YYYY-MM-DD)'),
  body('time')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be in HH:MM format (24-hour)'),
  body('title')
    .isString().trim()
    .isLength({ min: 1, max: 150 }).withMessage('Title must be 1-150 characters')
    .escape(),
  body('location')
    .optional()
    .isString().trim()
    .isLength({ max: 200 })
    .escape(),
  body('notes')
    .optional()
    .isString().trim()
    .isLength({ max: 1000 })
    .escape(),
  validateRequest
];

const expenseValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  body('amount')
    .isFloat({ gt: 0 }).withMessage('Expense amount must be a positive number greater than 0'),
  body('currency')
    .optional()
    .isString().trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code')
    .toUpperCase(),
  body('category')
    .isIn(['Accommodation', 'Transport', 'Food', 'Activities', 'Shopping', 'Other'])
    .withMessage('Category must be one of: Accommodation, Transport, Food, Activities, Shopping, Other'),
  body('description')
    .isString().trim()
    .isLength({ min: 1, max: 200 }).withMessage('Description must be 1-200 characters')
    .escape(),
  body('paid_by')
    .isString().trim()
    .isLength({ min: 1, max: 100 }).withMessage('Paid by must be 1-100 characters')
    .escape(),
  body('date')
    .isISO8601().withMessage('Date must be valid ISO 8601 date'),
  validateRequest
];

const shareTripValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  body('email')
    .isEmail().withMessage('Valid collaborator email required')
    .normalizeEmail().trim(),
  body('role')
    .isIn(['OWNER', 'EDITOR', 'VIEWER'])
    .withMessage('Role must be OWNER, EDITOR, or VIEWER'),
  validateRequest
];

const updateRoleValidation = [
  param('tripId').isUUID().withMessage('Valid UUID trip ID required'),
  param('userId').isUUID().withMessage('Valid UUID user ID required'),
  body('role')
    .isIn(['OWNER', 'EDITOR', 'VIEWER'])
    .withMessage('Role must be OWNER, EDITOR, or VIEWER'),
  validateRequest
];

module.exports = {
  validateRequest,
  passwordComplexityRegex,
  userRegistrationValidation,
  userLoginValidation,
  tripCreateValidation,
  tripUpdateValidation,
  destinationValidation,
  itineraryValidation,
  expenseValidation,
  shareTripValidation,
  updateRoleValidation
};
