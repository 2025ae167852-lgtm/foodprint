module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('foodprint_weeklyview');
    if (!tableDescription.harvest_image_url) {
      await queryInterface.addColumn('foodprint_weeklyview', 'harvest_image_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('foodprint_weeklyview', 'harvest_image_url');
  },
};
