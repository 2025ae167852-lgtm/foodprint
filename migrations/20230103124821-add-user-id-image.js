'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('user');
    if (!table.user_identifier_image_url) {
      await queryInterface.addColumn('user', 'user_identifier_image_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('user');
    if (table.user_identifier_image_url) {
      await queryInterface.removeColumn('user', 'user_identifier_image_url');
    }
  },
};
