const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
  throw new Error('DATABASE_URL is required');
}

// Determine dialect from DATABASE_URL or DB_DIALECT
let dialect = 'postgres'; // default
if (connectionString.startsWith('mysql://')) {
  dialect = 'mysql';
} else if (process.env.DB_DIALECT) {
  dialect = process.env.DB_DIALECT;
}

const dialectOptions = {};

// Only add SSL for PostgreSQL
if (dialect === 'postgres' && process.env.DB_SSL !== 'false') {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false
  };
}

const sequelize = new Sequelize(connectionString, {
  dialect: dialect,
  protocol: dialect === 'mysql' ? 'mysql' : 'postgres',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  dialectOptions: Object.keys(dialectOptions).length > 0 ? dialectOptions : undefined,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
  },
});

sequelize
  .authenticate()
  .then(() => {
    console.log(`✅ Database connected successfully (${dialect.toUpperCase()})`);
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
  });

module.exports = sequelize;
