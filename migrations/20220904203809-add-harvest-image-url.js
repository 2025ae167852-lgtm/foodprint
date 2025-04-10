'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_harvest');
    if (!table.harvest_image_url) {
      await queryInterface.addColumn('foodprint_harvest', 'harvest_image_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_harvest');
    if (table.harvest_image_url) {
      await queryInterface.removeColumn('foodprint_harvest', 'harvest_image_url');
    }
  },
};
