module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('foodprint_harvest');
    if (!tableDescription.channel) {
      await queryInterface.addColumn('foodprint_harvest', 'channel', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('foodprint_harvest', 'channel');
  },
};
