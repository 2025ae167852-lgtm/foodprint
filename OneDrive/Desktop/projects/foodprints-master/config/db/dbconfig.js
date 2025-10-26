require('dotenv').config();
module.exports = {
  development: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: true,
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: {
        /* <----- Add SSL option for Postgres */
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  test: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: true,
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: {
        /* <----- Add SSL option for Postgres */
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  staging: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: true,
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: {
        /* <----- Add SSL option for Postgres */
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: false,
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: {
        /* <----- Add SSL option for Postgres */
        require: true,
        rejectUnauthorized: false,
      },
    } : {},
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};
