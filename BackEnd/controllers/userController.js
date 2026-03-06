import userService from '../services/userService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * User Controller
 * Handles HTTP requests for user management
 */

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private/Admin
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAllUsers(req.query);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Users retrieved successfully')
  );
});

/**
 * @route   POST /api/users
 * @desc    Create a new user (by admin)
 * @access  Private/Admin
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, status, warehouse, warehouses } = req.body;

  const user = await userService.createUser({
    name,
    email,
    password,
    role,
    status,
    warehouse,
    warehouses,
  });

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, { user }, 'User created successfully')
  );
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user: user.toSafeObject() }, 'User retrieved successfully')
  );
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private/Admin
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user }, 'User updated successfully')
  );
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private/Admin
 */
export const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'User deleted successfully')
  );
});

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  await userService.changePassword(req.user.id, currentPassword, newPassword);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Password changed successfully')
  );
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const updateData = { ...req.body };
  
  // If a file was uploaded, add the path to updateData
  if (req.file) {
    updateData.profileImage = `/uploads/profiles/${req.file.filename}`;
  }

  const user = await userService.updateProfile(req.user.id, updateData);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user }, 'Profile updated successfully')
  );
});

/**
 * @route   PUT /api/users/update-currency
 * @desc    Update user's preferred currency
 * @access  Private
 */
export const updateCurrency = asyncHandler(async (req, res) => {
  const { currency } = req.body;
  
  if (!currency || !['PKR', 'USD'].includes(currency)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid currency. Must be PKR or USD');
  }

  const user = await userService.updateProfile(req.user.id, { currency });

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, { user }, 'Currency updated successfully')
  );
});
