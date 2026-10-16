const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Book = require('../models/Book');
const User = require('../models/User');
const {
  connectTestDB,
  closeTestDB,
  clearTestDB,
  createTestUser,
  createTestBook,
} = require('./testHelper');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe('Book Management APIs', () => {
  // ==========================================
  // API 4: POST /api/books
  // ==========================================
  describe('POST /api/books', () => {
    describe('Happy Paths', () => {
      it('should create a single book when authenticated with all fields (201 Created)', async () => {
        const { user, token } = await createTestUser();

        const payload = {
          title: "Harry Potter and the Philosopher's Stone",
          description: 'The story of an orphaned boy who discovers he is a wizard.',
          price: 19.99,
          genre: 'Fantasy',
          publishedYear: 1997,
          inStock: true,
        };

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Book created successfully');

        const bookData = res.body.data;
        expect(bookData._id).toBeDefined();
        expect(bookData.title).toBe(payload.title);
        expect(bookData.description).toBe(payload.description);
        expect(bookData.price).toBe(payload.price);
        expect(bookData.genre).toBe(payload.genre);
        expect(bookData.publishedYear).toBe(payload.publishedYear);
        expect(bookData.inStock).toBe(payload.inStock);
        expect(bookData.author.toString()).toBe(user._id.toString());

        // Verify database persistence
        const dbBook = await Book.findById(bookData._id);
        expect(dbBook).not.toBeNull();
        expect(dbBook.title).toBe(payload.title);
      });

      it('should create a book with minimal fields and apply schema defaults (201 Created)', async () => {
        const { user, token } = await createTestUser();

        const payload = {
          title: 'Minimalist Guide',
          price: 14.5,
        };

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.title).toBe('Minimalist Guide');
        expect(res.body.data.price).toBe(14.5);
        expect(res.body.data.genre).toBe('General'); // Schema default
        expect(res.body.data.inStock).toBe(true); // Schema default
        expect(res.body.data.publishedYear).toBe(new Date().getFullYear()); // Schema default
        expect(res.body.data.description).toBe(''); // Schema default
        expect(res.body.data.author.toString()).toBe(user._id.toString());
      });

      it('should allow creating a book with price = 0 (free book) (201 Created)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Free Open Source Book',
            price: 0,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.price).toBe(0);
      });

      it('should allow specifying an explicit valid author ID in the request body (201 Created)', async () => {
        const { token: callerToken } = await createTestUser({ email: 'caller@example.com' });
        const { user: designatedAuthor } = await createTestUser({ email: 'author@example.com' });

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${callerToken}`)
          .send({
            title: 'Book Authored by Someone Else',
            price: 25.0,
            author: designatedAuthor._id,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.author.toString()).toBe(designatedAuthor._id.toString());
      });

      it('should trim book title upon creation', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: '   Untrimmed Title   ',
            price: 10.0,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe('Untrimmed Title');
      });
    });

    describe('Validation & Edge Cases', () => {
      it('should fail when request is unauthenticated (no token) (401 Unauthorized)', async () => {
        const res = await request(app)
          .post('/api/books')
          .send({
            title: 'Unauthenticated Book',
            price: 15.0,
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/no token provided/i);
      });

      it('should fail when title is missing (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            price: 19.99,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide book title and price/i);
      });

      it('should fail when price is missing (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Book without price',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide book title and price/i);
      });

      it('should fail when body is empty (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide book title and price/i);
      });

      it('should fail when price is negative (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Negative Price Book',
            price: -10,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Price cannot be negative/i);
      });

      it('should fail when title exceeds 150 characters (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'A'.repeat(151),
            price: 10,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/cannot exceed 150 characters/i);
      });

      it('should fail when explicit author ID does not exist in database (404 Not Found)', async () => {
        const { token } = await createTestUser();
        const nonExistentAuthorId = new mongoose.Types.ObjectId();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Book with ghost author',
            price: 20,
            author: nonExistentAuthorId,
          });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Author not found with id/i);
      });

      it('should return 404 when explicit author ID is an invalid ObjectId format', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Invalid Author ID Format',
            price: 20,
            author: 'invalid-id-format',
          });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });

  // ==========================================
  // API 5: POST /api/books/bulk
  // ==========================================
  describe('POST /api/books/bulk', () => {
    describe('Happy Paths', () => {
      it('should store multiple books using { books: [...] } object wrapper (201 Created)', async () => {
        const { user, token } = await createTestUser();

        const payload = {
          books: [
            {
              title: 'Bulk Book 1',
              price: 10.99,
              genre: 'Fiction',
              publishedYear: 2021,
              inStock: true,
            },
            {
              title: 'Bulk Book 2',
              price: 15.5,
              genre: 'Non-Fiction',
              publishedYear: 2022,
              inStock: false,
            },
            {
              title: 'Bulk Book 3',
              price: 22.0,
              genre: 'Science',
              publishedYear: 2023,
            },
          ],
        };

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(3);
        expect(res.body.message).toMatch(/Successfully stored 3 books/i);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(3);

        // Verify author is associated to all books
        res.body.data.forEach((book) => {
          expect(book.author.toString()).toBe(user._id.toString());
          expect(book._id).toBeDefined();
        });

        // Verify persistence in DB
        const count = await Book.countDocuments();
        expect(count).toBe(3);
      });

      it('should store multiple books using direct array body [...] (201 Created)', async () => {
        const { user, token } = await createTestUser();

        const directArray = [
          { title: 'Direct Array Book 1', price: 9.99, genre: 'Drama' },
          { title: 'Direct Array Book 2', price: 12.99, genre: 'Action' },
        ];

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send(directArray);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        expect(res.body.data.length).toBe(2);

        res.body.data.forEach((book) => {
          expect(book.author.toString()).toBe(user._id.toString());
        });
      });

      it('should allow storing a single book in bulk format (201 Created)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({
            books: [{ title: 'Solo Bulk Book', price: 11.99 }],
          });

        expect(res.status).toBe(201);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Solo Bulk Book');
      });

      it('should allow individual books in bulk to specify custom author if author exists', async () => {
        const { token } = await createTestUser();
        const { user: otherAuthor } = await createTestUser({ email: 'other@example.com' });

        const payload = {
          books: [
            { title: 'Default Author Book', price: 10 },
            { title: 'Custom Author Book', price: 20, author: otherAuthor._id },
          ],
        };

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.count).toBe(2);
        expect(res.body.data[1].author.toString()).toBe(otherAuthor._id.toString());
      });
    });

    describe('Validation & Edge Cases', () => {
      it('should fail when unauthenticated (401 Unauthorized)', async () => {
        const res = await request(app)
          .post('/api/books/bulk')
          .send({
            books: [{ title: 'Unauthorized Book', price: 10 }],
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });

      it('should fail when body is empty object (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide an array of books/i);
      });

      it('should fail when books array is empty: { books: [] } (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({ books: [] });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide an array of books/i);
      });

      it('should fail when direct array body is empty: [] (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send([]);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide an array of books/i);
      });

      it('should fail when books is not an array (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({ books: 'not an array' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide an array of books/i);
      });

      it('should fail when any book in the array is missing a title (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({
            books: [
              { title: 'Valid Book', price: 10 },
              { price: 15 }, // Missing title
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Book title is required/i);
      });

      it('should fail when any book in the array has a negative price (400 Bad Request)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .post('/api/books/bulk')
          .set('Authorization', `Bearer ${token}`)
          .send({
            books: [
              { title: 'Valid Book', price: 10 },
              { title: 'Invalid Book', price: -5 },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Price cannot be negative/i);
      });
    });
  });

  // ==========================================
  // API 6: GET /api/books
  // ==========================================
  describe('GET /api/books', () => {
    describe('Happy Paths', () => {
      it('should return count 0 and empty array when database has no books (200 OK)', async () => {
        const res = await request(app).get('/api/books');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(0);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(0);
      });

      it('should retrieve all books sorted by createdAt descending (200 OK)', async () => {
        const { user } = await createTestUser();

        const book1 = await createTestBook(user._id, { title: 'First Book', price: 10 });
        const book2 = await createTestBook(user._id, { title: 'Second Book', price: 20 });
        const book3 = await createTestBook(user._id, { title: 'Third Book', price: 30 });

        const res = await request(app).get('/api/books');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(3);
        // Verify sort order: newest first
        expect(res.body.data[0]._id).toBe(book3._id.toString());
        expect(res.body.data[1]._id).toBe(book2._id.toString());
        expect(res.body.data[2]._id).toBe(book1._id.toString());
      });

      it('should filter books by genre (case-insensitive) (200 OK)', async () => {
        const { user } = await createTestUser();

        await createTestBook(user._id, { title: 'Harry Potter 1', genre: 'Fantasy' });
        await createTestBook(user._id, { title: 'Harry Potter 2', genre: 'Fantasy' });
        await createTestBook(user._id, { title: 'A Brief History of Time', genre: 'Science' });

        // Query with lowercase "fantasy"
        const res = await request(app).get('/api/books?genre=fantasy');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        res.body.data.forEach((book) => {
          expect(book.genre.toLowerCase()).toContain('fantasy');
        });
      });

      it('should filter books by partial genre match (200 OK)', async () => {
        const { user } = await createTestUser();

        await createTestBook(user._id, { title: 'Dune', genre: 'Sci-Fi' });
        await createTestBook(user._id, { title: 'The Hobbit', genre: 'Fantasy' });

        const res = await request(app).get('/api/books?genre=sci');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Dune');
      });

      it('should filter books by inStock=true (200 OK)', async () => {
        const { user } = await createTestUser();

        await createTestBook(user._id, { title: 'In Stock Book', inStock: true });
        await createTestBook(user._id, { title: 'Out of Stock Book', inStock: false });

        const res = await request(app).get('/api/books?inStock=true');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('In Stock Book');
        expect(res.body.data[0].inStock).toBe(true);
      });

      it('should filter books by inStock=false (200 OK)', async () => {
        const { user } = await createTestUser();

        await createTestBook(user._id, { title: 'In Stock Book', inStock: true });
        await createTestBook(user._id, { title: 'Out of Stock Book', inStock: false });

        const res = await request(app).get('/api/books?inStock=false');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Out of Stock Book');
        expect(res.body.data[0].inStock).toBe(false);
      });

      it('should filter books by combining genre and inStock filters (200 OK)', async () => {
        const { user } = await createTestUser();

        await createTestBook(user._id, { title: 'Fantasy In Stock', genre: 'Fantasy', inStock: true });
        await createTestBook(user._id, { title: 'Fantasy Out of Stock', genre: 'Fantasy', inStock: false });
        await createTestBook(user._id, { title: 'Sci-Fi In Stock', genre: 'Sci-Fi', inStock: true });

        const res = await request(app).get('/api/books?genre=Fantasy&inStock=true');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Fantasy In Stock');
      });

      it('should populate author details when includeAuthor=true is passed (200 OK)', async () => {
        const { user } = await createTestUser({
          name: 'Author Name',
          email: 'authorname@example.com',
          role: 'author',
          bio: 'Author Bio',
        });

        await createTestBook(user._id, { title: 'Populated Author Book' });

        const res = await request(app).get('/api/books?includeAuthor=true');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        const book = res.body.data[0];
        expect(typeof book.author).toBe('object');
        expect(book.author.name).toBe('Author Name');
        expect(book.author.email).toBe('authorname@example.com');
        expect(book.author.role).toBe('author');
        expect(book.author.bio).toBe('Author Bio');
        expect(book.author.password).toBeUndefined();
      });

      it('should return author as ObjectId string only when includeAuthor is not set (200 OK)', async () => {
        const { user } = await createTestUser();
        await createTestBook(user._id, { title: 'Unpopulated Author Book' });

        const res = await request(app).get('/api/books');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(typeof res.body.data[0].author).toBe('string');
        expect(res.body.data[0].author).toBe(user._id.toString());
      });

      it('should be publicly accessible without authentication', async () => {
        const { user } = await createTestUser();
        await createTestBook(user._id);

        const res = await request(app).get('/api/books');
        expect(res.status).toBe(200);
      });
    });

    describe('Edge Cases', () => {
      it('should return count 0 and empty data array when genre filter does not match any book', async () => {
        const { user } = await createTestUser();
        await createTestBook(user._id, { genre: 'Fantasy' });

        const res = await request(app).get('/api/books?genre=NonExistentGenreXYZ');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
        expect(res.body.data).toEqual([]);
      });
    });
  });

  // ==========================================
  // API 7: GET /api/books/with-author
  // ==========================================
  describe('GET /api/books/with-author', () => {
    describe('Happy Paths', () => {
      it('should return empty list when no books exist (200 OK)', async () => {
        const res = await request(app).get('/api/books/with-author');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(0);
        expect(res.body.data).toEqual([]);
        expect(res.body.message).toMatch(/Fetched all books with author details successfully/i);
      });

      it('should retrieve all books with populated author details (200 OK)', async () => {
        const { user: author1 } = await createTestUser({
          name: 'Author One',
          email: 'author1@example.com',
          role: 'author',
          bio: 'Bio for author one',
        });
        const { user: author2 } = await createTestUser({
          name: 'Author Two',
          email: 'author2@example.com',
          role: 'author',
          bio: 'Bio for author two',
        });

        await createTestBook(author1._id, { title: 'Book by Author 1', price: 10 });
        await createTestBook(author2._id, { title: 'Book by Author 2', price: 20 });

        const res = await request(app).get('/api/books/with-author');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        expect(res.body.data.length).toBe(2);

        res.body.data.forEach((book) => {
          expect(book.author).toBeDefined();
          expect(typeof book.author).toBe('object');
          expect(book.author.name).toBeDefined();
          expect(book.author.email).toBeDefined();
          expect(book.author.role).toBeDefined();
          expect(book.author.bio).toBeDefined();
          expect(book.author.createdAt).toBeDefined();
          // Sensitive data must never be exposed
          expect(book.author.password).toBeUndefined();
          expect(book.author.__v).toBeUndefined();
        });
      });

      it('should sort books in descending order of creation (createdAt: -1)', async () => {
        const { user } = await createTestUser();
        const olderBook = await createTestBook(user._id, { title: 'Older Book' });
        const newerBook = await createTestBook(user._id, { title: 'Newer Book' });

        const res = await request(app).get('/api/books/with-author');

        expect(res.status).toBe(200);
        expect(res.body.data[0]._id).toBe(newerBook._id.toString());
        expect(res.body.data[1]._id).toBe(olderBook._id.toString());
      });

      it('should be accessible without authentication (public route)', async () => {
        const res = await request(app).get('/api/books/with-author');
        expect(res.status).toBe(200);
      });
    });

    describe('Edge Cases', () => {
      it('should handle books whose author user record was deleted gracefully', async () => {
        const { user } = await createTestUser();
        await createTestBook(user._id, { title: 'Orphaned Book' });

        // Delete the user from database
        await User.findByIdAndDelete(user._id);

        const res = await request(app).get('/api/books/with-author');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].title).toBe('Orphaned Book');
        expect(res.body.data[0].author).toBeNull();
      });
    });
  });

  // ==========================================
  // API 8: GET /api/books/:id
  // ==========================================
  describe('GET /api/books/:id', () => {
    describe('Happy Paths', () => {
      it('should retrieve a single book by ID with populated author details (200 OK)', async () => {
        const { user } = await createTestUser({
          name: 'George R.R. Martin',
          email: 'grrm@example.com',
          role: 'author',
          bio: 'A Song of Ice and Fire creator',
        });

        const createdBook = await createTestBook(user._id, {
          title: 'A Game of Thrones',
          description: 'Winter is coming.',
          price: 24.99,
          genre: 'Epic Fantasy',
          publishedYear: 1996,
          inStock: true,
        });

        const res = await request(app).get(`/api/books/${createdBook._id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const book = res.body.data;
        expect(book._id).toBe(createdBook._id.toString());
        expect(book.title).toBe('A Game of Thrones');
        expect(book.description).toBe('Winter is coming.');
        expect(book.price).toBe(24.99);
        expect(book.genre).toBe('Epic Fantasy');
        expect(book.publishedYear).toBe(1996);
        expect(book.inStock).toBe(true);

        // Verify author population
        expect(book.author).toBeDefined();
        expect(typeof book.author).toBe('object');
        expect(book.author._id).toBe(user._id.toString());
        expect(book.author.name).toBe('George R.R. Martin');
        expect(book.author.email).toBe('grrm@example.com');
        expect(book.author.role).toBe('author');
        expect(book.author.bio).toBe('A Song of Ice and Fire creator');
        expect(book.author.password).toBeUndefined();
      });

      it('should be publicly accessible without authentication', async () => {
        const { user } = await createTestUser();
        const book = await createTestBook(user._id);

        const res = await request(app).get(`/api/books/${book._id}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('Corner & Error Cases (404 Not Found)', () => {
      it('should return 404 when book ID is a valid ObjectId but does not exist in DB', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();

        const res = await request(app).get(`/api/books/${nonExistentId}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(new RegExp(`Book not found with id: ${nonExistentId}`, 'i'));
      });

      it('should return 404 when book ID is an invalid format (CastError)', async () => {
        const invalidId = 'not-a-valid-mongodb-id';

        const res = await request(app).get(`/api/books/${invalidId}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(new RegExp(`Resource not found with id: ${invalidId}`, 'i'));
      });

      it('should return 404 when book ID is a short numeric string', async () => {
        const res = await request(app).get('/api/books/12345');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });
});
