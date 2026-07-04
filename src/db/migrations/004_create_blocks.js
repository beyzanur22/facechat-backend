exports.up = function up(knex) {
  return knex.schema.createTable('blocks', (table) => {
    table.increments('id').primary();
    table.string('blocker_device_id').notNullable().index();
    table.string('blocked_device_id').notNullable().index();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.unique(['blocker_device_id', 'blocked_device_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('blocks');
};
