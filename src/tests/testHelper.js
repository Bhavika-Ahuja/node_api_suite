const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Book = require('../models/Book');

let mongoServer;

/**
 * Connect to the in-memory MongoDB instance.
 */
const connectTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Ensure all schema indexes (e.g. unique email) are initialized
  await User.init();
  await Book.init();
};

/**
 * Disconnect and stop the in-memory MongoDB server.
 */
const closeTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

/**
 * Clear all data from all collections.
 */
const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Generate a JWT token for a given user ID.
 */
const generateTestToken = (id, options = {}) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production',
    {
      expiresIn: options.expiresIn || '7d',
    }
  );
};

/**
 * Helper to create a test user in database and return user document, raw password, and auth token.
 */
const createTestUser = async (overrides = {}) => {
  const rawPassword = overrides.password || 'password123';
  const userData = {
    name: overrides.name || 'J.K. Rowling',
    email: overrides.email || `author_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    password: rawPassword,
    role: overrides.role || 'author',
    bio: overrides.bio || 'Author bio',
  };

  const user = await User.create(userData);
  const token = generateTestToken(user._id);

  return {
    user,
    rawPassword,
    token,
  };
};

/**
 * Helper to create a test book in database.
 */
const createTestBook = async (authorId, overrides = {}) => {
  const bookData = {
    title: overrides.title || 'Harry Potter and the Philosopher\'s Stone',
    description: overrides.description || 'A young wizard discovers his magical heritage.',
    price: overrides.price !== undefined ? overrides.price : 19.99,
    genre: overrides.genre || 'Fantasy',
    publishedYear: overrides.publishedYear || 1997,
    inStock: overrides.inStock !== undefined ? overrides.inStock : true,
    author: authorId,
  };

  const book = await Book.create(bookData);
  return book;
};

module.exports = {
  connectTestDB,
  closeTestDB,
  clearTestDB,
  generateTestToken,
  createTestUser,
  createTestBook,
};
