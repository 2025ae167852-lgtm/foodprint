const dotenv = require('dotenv');
dotenv.config();

const { Sequelize } = require('sequelize');

const config = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT || 'mariadb',
  logging: process.env.DB_LOGGING === 'true',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
  },
  dialectOptions:
    process.env.DB_SSL === 'true'
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
};

const sequelize = process.env.DB_URL
  ? new Sequelize(process.env.DB_URL, config)
  : new Sequelize(config.database, config.username, config.password, config);

module.exports = sequelize;
