exports.up = function up(knex) {
  return knex.schema.createTable('reports', (table) => {
    table.increments('id').primary();
    table.string('reporter_device_id').notNullable().index();
    table.string('reported_device_id').notNullable().index();
    table.string('session_id').notNullable();
    table.string('reason').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('reports');
};
