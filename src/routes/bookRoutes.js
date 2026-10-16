const express = require('express');
const router = express.Router();
const {
  storeSingleBook,
  storeBooks,
  getAllBooks,
  getAllBooksWithAuthor,
  getBookById,
} = require('../controllers/bookController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public routes for reading books
router.get('/', getAllBooks);
// Specific route for fetching books with populated author details
router.get('/with-author', getAllBooksWithAuthor);
// Single book lookup by ID
router.get('/:id', getBookById);

// Protected routes for storing books (Requires valid JWT token)
// Note: Can use `protect` to enforce login, or `optionalAuth` to allow guest creation with author id
router.post('/', protect, storeSingleBook);
router.post('/bulk', protect, storeBooks);

module.exports = router;
