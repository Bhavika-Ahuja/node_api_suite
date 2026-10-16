const redis = require("ioredis");


const redisClient = new redis({
    host: 'localhost',
    port: 6379,

})

redisClient.on("connect", () => {
    console.log("Redis connected");
});

redisClient.on("error", (err) => {
    console.error("Redis error", err);
});

module.exports = redisClient;