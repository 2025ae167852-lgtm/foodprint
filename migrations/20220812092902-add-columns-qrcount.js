'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_qrcount');
    if (!table.qrtype) {
      await queryInterface.addColumn('foodprint_qrcount', 'qrtype', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_qrcount');
    if (table.qrtype) {
      await queryInterface.removeColumn('foodprint_qrcount', 'qrtype');
    }
  },
};
