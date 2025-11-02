const Sequelize = require('sequelize');
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    'User',
    {
      ID: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      firstName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      middleName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: 'email',
      },
      phoneNumber: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: 'phoneNumber',
      },
      role: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      registrationChannel: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      nationalIdPhotoHash: {
        type: DataTypes.BLOB,
        allowNull: true,
      },
      user_identifier_image_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      passwordResetToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'user',
      timestamps: false,
    }
  );
};
