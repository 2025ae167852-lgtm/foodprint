'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_storage');
    if (!table.qrcode_url) {
      await queryInterface.addColumn('foodprint_storage', 'qrcode_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_storage');
    if (table.qrcode_url) {
      await queryInterface.removeColumn('foodprint_storage', 'qrcode_url');
    }
  },
};
