exports.up = function up(knex) {
  return knex.schema.createTable('bans', (table) => {
    table.increments('id').primary();
    table.string('device_id').notNullable().index();
    table.string('ip_hash').nullable().index();
    table.string('reason').notNullable();
    table.integer('report_count').notNullable().defaultTo(0);
    table.timestamp('banned_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('bans');
};
