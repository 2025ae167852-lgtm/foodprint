require('dotenv').config(); // Make sure dotenv is required

// Ensure essential environment variables are present
if (
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD ||
  !process.env.DB_NAME ||
  !process.env.DB_HOST ||
  !process.env.DB_PORT ||
  !process.env.DB_DIALECT
) {
  throw new Error('Missing essential database environment variables.');
}

module.exports = {
  production: {
    username: process.env.DB_USER, // DB user from .env
    password: process.env.DB_PASSWORD, // DB password from .env
    database: process.env.DB_NAME, // DB name from .env
    host: process.env.DB_HOST, // DB host from .env
    port: parseInt(process.env.DB_PORT, 10), // DB port from .env, ensure it's a number
    dialect: process.env.DB_DIALECT, // DB dialect from .env
    logging: process.env.NODE_ENV === 'production' ? false : console.log, // Disable logging in production, enable in other environments
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false, // SSL option from .env
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5, // Default max pool size to 5 if not defined in .env
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0, // Default min pool size to 0 if not defined in .env
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000, // Default acquire timeout to 30s if not defined
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000, // Default idle timeout to 10s if not defined
    },
  },
};
