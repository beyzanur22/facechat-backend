exports.up = function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.string('device_id').primary();
    table.string('gender').notNullable().defaultTo('unknown');
    table.string('region').notNullable().defaultTo('unknown');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('last_seen_at').defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};
