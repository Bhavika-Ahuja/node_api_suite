const request = require('supertest');
const app = require('../app');

describe('System, Root, and Error Handler Routes', () => {
  describe('GET / (Root API Health & Overview)', () => {
    it('should return 200 OK with welcome message and listing of all endpoints', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Welcome to Book & Auth REST API/i);
      expect(res.body.endpoints).toBeDefined();

      // Verify auth endpoints documented
      expect(res.body.endpoints.auth).toBeDefined();
      expect(res.body.endpoints.auth.register).toBe('POST /api/auth/register');
      expect(res.body.endpoints.auth.login).toBe('POST /api/auth/login');
      expect(res.body.endpoints.auth.me).toBe('GET /api/auth/me (Protected)');

      // Verify books endpoints documented
      expect(res.body.endpoints.books).toBeDefined();
      expect(res.body.endpoints.books.getAllBooks).toBe('GET /api/books');
      expect(res.body.endpoints.books.getAllBooksWithAuthor).toBe('GET /api/books/with-author');
      expect(res.body.endpoints.books.getSingleBook).toBe('GET /api/books/:id');
      expect(res.body.endpoints.books.storeSingleBook).toBe('POST /api/books (Protected)');
      expect(res.body.endpoints.books.storeBulkBooks).toBe('POST /api/books/bulk (Protected)');
    });
  });

  describe('404 Route Not Found Handling', () => {
    it('should return 404 with structured JSON for undefined GET routes', async () => {
      const res = await request(app).get('/api/unknown-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found: GET /api/unknown-endpoint');
    });

    it('should return 404 for undefined POST routes', async () => {
      const res = await request(app)
        .post('/api/unsupported-action')
        .send({ data: 'sample' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found: POST /api/unsupported-action');
    });

    it('should return 404 for unsupported HTTP methods on registered routes', async () => {
      const res = await request(app).delete('/api/books');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found: DELETE /api/books');
    });
  });
});
