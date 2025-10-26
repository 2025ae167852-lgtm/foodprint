'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('user');
      
      // Add passwordResetToken if it doesn't exist
      if (!tableDescription.passwordResetToken) {
        await queryInterface.addColumn('user', 'passwordResetToken', {
          type: Sequelize.STRING(255),
          allowNull: true,
        });
        console.log('✅ Added passwordResetToken column to user table');
      }
      
      // Add passwordResetExpires if it doesn't exist
      if (!tableDescription.passwordResetExpires) {
        await queryInterface.addColumn('user', 'passwordResetExpires', {
          type: Sequelize.DATE,
          allowNull: true,
        });
        console.log('✅ Added passwordResetExpires column to user table');
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('user');
      
      if (tableDescription.passwordResetToken) {
        await queryInterface.removeColumn('user', 'passwordResetToken');
        console.log('✅ Removed passwordResetToken column from user table');
      }
      
      if (tableDescription.passwordResetExpires) {
        await queryInterface.removeColumn('user', 'passwordResetExpires');
        console.log('✅ Removed passwordResetExpires column from user table');
      }
    } catch (error) {
      console.error('Migration rollback error:', error);
    }
  }
};






