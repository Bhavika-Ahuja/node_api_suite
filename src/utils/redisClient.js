const Redis = require('ioredis');

let redisClient;

if (process.env.NODE_ENV === 'test') {
  // In test environment, provide a safe mock client to keep unit/integration
  // tests isolated, fast, and free of external Redis dependencies or stale cache.
  redisClient = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    flushall: async () => 'OK',
    quit: async () => 'OK',
    on: () => {},
  };
} else {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = Number(process.env.REDIS_PORT) || 6379;

  redisClient = new Redis({
    host,
    port,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      // Don't retry infinitely if Redis is offline
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });

  redisClient.on('connect', () => {
    console.log('Redis connected');
  });

  redisClient.on('error', (err) => {
    // Prevent unhandled errors from crashing the process
    console.warn(`Redis connection error: ${err.message}`);
  });
}

module.exports = redisClient;