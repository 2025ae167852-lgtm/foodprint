require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    dialect: 'postgres',
    logging: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
  test: {
    url: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    dialect: 'postgres',
    logging: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
  staging: {
    url: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    dialect: 'postgres',
    logging: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
  production: {
    url: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
};
