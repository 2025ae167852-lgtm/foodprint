'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_harvest');
    if (!table.blockchain_explorer_url) {
      await queryInterface.addColumn('foodprint_harvest', 'blockchain_explorer_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_harvest');
    if (table.blockchain_explorer_url) {
      await queryInterface.removeColumn('foodprint_harvest', 'blockchain_explorer_url');
    }
  },
};
