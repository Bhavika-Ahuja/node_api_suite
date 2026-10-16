const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const {
  connectTestDB,
  closeTestDB,
  clearTestDB,
  createTestUser,
  generateTestToken,
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

describe('Authentication APIs', () => {
  // ==========================================
  // API 1: POST /api/auth/register
  // ==========================================
  describe('POST /api/auth/register', () => {
    describe('Happy Paths', () => {
      it('should register a new user successfully with all fields (201 Created)', async () => {
        const payload = {
          name: 'J.K. Rowling',
          email: 'jk.rowling@example.com',
          password: 'password123',
          role: 'author',
          bio: 'British author and philanthropist',
        };

        const res = await request(app)
          .post('/api/auth/register')
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User registered successfully');
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);

        // Verify data payload
        expect(res.body.data).toBeDefined();
        expect(res.body.data.name).toBe(payload.name);
        expect(res.body.data.email).toBe(payload.email);
        expect(res.body.data.role).toBe(payload.role);
        expect(res.body.data.bio).toBe(payload.bio);
        expect(res.body.data.id).toBeDefined();
        // Password must never be returned in response
        expect(res.body.data.password).toBeUndefined();

        // Verify user in database and password encryption
        const savedUser = await User.findById(res.body.data.id).select('+password');
        expect(savedUser).not.toBeNull();
        expect(savedUser.password).not.toBe(payload.password);
        const isPasswordHashed = await bcrypt.compare(payload.password, savedUser.password);
        expect(isPasswordHashed).toBe(true);
      });

      it('should register a user with only mandatory fields and apply defaults (201 Created)', async () => {
        const payload = {
          name: 'George Orwell',
          email: 'george.orwell@example.com',
          password: 'secretpassword',
        };

        const res = await request(app)
          .post('/api/auth/register')
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe(payload.name);
        expect(res.body.data.role).toBe('author'); // Schema default
        expect(res.body.data.bio).toBe(''); // Schema default
      });

      it('should normalize email to lowercase and trim extra spaces', async () => {
        const payload = {
          name: '  Arthur Conan Doyle  ',
          email: '  Arthur.Doyle@EXAMPLE.com  ',
          password: 'password123',
        };

        const res = await request(app)
          .post('/api/auth/register')
          .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Arthur Conan Doyle');
        expect(res.body.data.email).toBe('arthur.doyle@example.com');

        const dbUser = await User.findOne({ email: 'arthur.doyle@example.com' });
        expect(dbUser).not.toBeNull();
      });
    });

    describe('Validation & Edge Cases', () => {
      it('should fail when name is missing (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'noname@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide name, email, and password/i);
      });

      it('should fail when email is missing (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'No Email User',
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide name, email, and password/i);
      });

      it('should fail when password is missing (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'No Password User',
            email: 'nopass@example.com',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide name, email, and password/i);
      });

      it('should fail when empty body is sent (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide name, email, and password/i);
      });

      it('should fail when attempting to register with an already existing email (400 Bad Request)', async () => {
        await createTestUser({ email: 'duplicate@example.com' });

        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Second User',
            email: 'duplicate@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/already exists/i);
      });

      it('should fail when registering duplicate email with different casing (400 Bad Request)', async () => {
        await createTestUser({ email: 'duplicate.case@example.com' });

        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Duplicate Case User',
            email: 'DUPLICATE.CASE@EXAMPLE.COM',
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('should fail with invalid email formats (400 Bad Request)', async () => {
        const invalidEmails = [
          'plainaddress',
          '@missingusername.com',
          'username@.com',
          'username@com',
        ];

        for (const invalidEmail of invalidEmails) {
          const res = await request(app)
            .post('/api/auth/register')
            .send({
              name: 'Invalid Email User',
              email: invalidEmail,
              password: 'password123',
            });

          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/valid email/i);
        }
      });

      it('should fail when password is less than 6 characters (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Short Password User',
            email: 'shortpass@example.com',
            password: '12345',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 6 characters/i);
      });

      it('should fail when name exceeds 50 characters (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'A'.repeat(51),
            email: 'longname@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/cannot exceed 50 characters/i);
      });

      it('should fail when an invalid role is provided (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Invalid Role User',
            email: 'badrole@example.com',
            password: 'password123',
            role: 'superadmin', // Not in enum: ['author', 'user', 'admin']
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/`superadmin` is not a valid enum value/i);
      });
    });
  });

  // ==========================================
  // API 2: POST /api/auth/login
  // ==========================================
  describe('POST /api/auth/login', () => {
    describe('Happy Paths', () => {
      it('should log in successfully with valid credentials (200 OK)', async () => {
        const { rawPassword } = await createTestUser({
          email: 'login.user@example.com',
          password: 'correctpassword123',
          name: 'Login User',
          role: 'author',
          bio: 'Bio text',
        });

        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login.user@example.com',
            password: rawPassword,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User logged in successfully');
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);

        // Verify data payload and exclusion of password
        expect(res.body.data).toBeDefined();
        expect(res.body.data.email).toBe('login.user@example.com');
        expect(res.body.data.name).toBe('Login User');
        expect(res.body.data.role).toBe('author');
        expect(res.body.data.bio).toBe('Bio text');
        expect(res.body.data.password).toBeUndefined();

        // Verify token decodes correctly
        const decoded = jwt.verify(
          res.body.token,
          process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production'
        );
        expect(decoded.id).toBe(res.body.data.id.toString());
      });

      it('should log in successfully when email is submitted in uppercase', async () => {
        const { rawPassword } = await createTestUser({
          email: 'caseuser@example.com',
          password: 'password123',
        });

        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'CASEUSER@EXAMPLE.COM',
            password: rawPassword,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('caseuser@example.com');
      });
    });

    describe('Validation & Edge Cases', () => {
      it('should fail when email is missing (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            password: 'password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide email and password/i);
      });

      it('should fail when password is missing (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'user@example.com',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide email and password/i);
      });

      it('should fail when empty body is sent (400 Bad Request)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Please provide email and password/i);
      });

      it('should fail when user with email does not exist (401 Unauthorized)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123',
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Invalid email or password/i);
      });

      it('should fail when password is incorrect (401 Unauthorized)', async () => {
        await createTestUser({
          email: 'wrongpass@example.com',
          password: 'correctpassword',
        });

        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'wrongpass@example.com',
            password: 'incorrectpassword',
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Invalid email or password/i);
      });

      it('should fail when password has wrong casing (case-sensitivity check) (401 Unauthorized)', async () => {
        await createTestUser({
          email: 'casingpass@example.com',
          password: 'Password123',
        });

        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'casingpass@example.com',
            password: 'password123', // Lowercase 'p'
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Invalid email or password/i);
      });
    });
  });

  // ==========================================
  // API 3: GET /api/auth/me
  // ==========================================
  describe('GET /api/auth/me', () => {
    describe('Happy Paths', () => {
      it('should return current user profile when valid Bearer token is provided (200 OK)', async () => {
        const { user, token } = await createTestUser({
          name: 'Profile User',
          email: 'profile@example.com',
          role: 'author',
          bio: 'My author profile',
        });

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data._id).toBe(user._id.toString());
        expect(res.body.data.name).toBe('Profile User');
        expect(res.body.data.email).toBe('profile@example.com');
        expect(res.body.data.role).toBe('author');
        expect(res.body.data.bio).toBe('My author profile');
        // Password and __v must be omitted
        expect(res.body.data.password).toBeUndefined();
        expect(res.body.data.__v).toBeUndefined();
      });
    });

    describe('Authorization & Edge Cases', () => {
      it('should fail when Authorization header is missing (401 Unauthorized)', async () => {
        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/no token provided/i);
      });

      it('should fail when Authorization header does not start with Bearer (401 Unauthorized)', async () => {
        const { token } = await createTestUser();

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Basic ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/no token provided/i);
      });

      it('should fail when Authorization header is Bearer with no token attached (401 Unauthorized)', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer ');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });

      it('should fail when token is invalid or malformed (401 Unauthorized)', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid.jwt.signature');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/token failed or expired/i);
      });

      it('should fail when token is signed with a different secret (401 Unauthorized)', async () => {
        const { user } = await createTestUser();
        const fakeToken = jwt.sign({ id: user._id }, 'wrong_secret_key');

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${fakeToken}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/token failed or expired/i);
      });

      it('should fail when token has expired (401 Unauthorized)', async () => {
        const { user } = await createTestUser();
        const expiredToken = generateTestToken(user._id, { expiresIn: '0s' });

        // Small delay to guarantee expiration
        await new Promise((resolve) => setTimeout(resolve, 50));

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/token failed or expired/i);
      });

      it('should fail if user belonging to token was deleted from database (401 Unauthorized)', async () => {
        const { user, token } = await createTestUser();

        // Delete user after issuing token
        await User.findByIdAndDelete(user._id);

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/no longer exists/i);
      });
    });
  });
});
