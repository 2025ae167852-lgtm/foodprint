'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_qrcode');
    if (!table.qrcode_supplier_product) {
      await queryInterface.addColumn('foodprint_qrcode', 'qrcode_supplier_product', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('foodprint_qrcode');
    if (table.qrcode_supplier_product) {
      await queryInterface.removeColumn('foodprint_qrcode', 'qrcode_supplier_product');
    }
  },
};
