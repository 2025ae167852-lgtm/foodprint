// config/db/db_sequelise.js
require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'foodprint';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || (process.env.DB_DIALECT === 'mysql' ? 3306 : 5432);
const dbDialect = process.env.DB_DIALECT || 'postgres';
const dbSsl = (process.env.DB_SSL === 'true');

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  dialect: dbDialect,
  port: dbPort,
  logging: false,
  dialectOptions: dbSsl ? { ssl: { require: true, rejectUnauthorized: false } } : undefined,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 5),
    min: Number(process.env.DB_POOL_MIN || 0),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
  },
});

sequelize
  .authenticate()
  .then(() => console.log('✅ Database connection established successfully.'))
  .catch((err) => console.error('❌ Unable to connect to the database:', err && err.message ? err.message : err));

module.exports = sequelize;
