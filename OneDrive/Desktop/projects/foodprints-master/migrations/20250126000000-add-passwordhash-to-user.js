'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if passwordHash column already exists
      const tableDescription = await queryInterface.describeTable('user');
      
      if (!tableDescription.passwordHash) {
        await queryInterface.addColumn('user', 'passwordHash', {
          type: Sequelize.STRING(255),
          allowNull: true,
        });
        console.log('✅ Added passwordHash column to user table');
      } else {
        console.log('⚠️ passwordHash column already exists in user table');
      }
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('user');
      
      if (tableDescription.passwordHash) {
        await queryInterface.removeColumn('user', 'passwordHash');
        console.log('✅ Removed passwordHash column from user table');
      }
    } catch (error) {
      console.error('Migration rollback error:', error);
    }
  }
};






