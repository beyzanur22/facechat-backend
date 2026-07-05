exports.up = function up(knex) {
  return knex.schema.createTable('audit_log', (table) => {
    table.bigIncrements('id').primary();
    // Şu an tek paylaşılan ADMIN_TOKEN var, kişi bazlı admin hesabı yok —
    // bu yüzden "kim" bilgisini şimdilik isteğin IP hash'iyle tutuyoruz.
    // İleride kişi bazlı admin login eklenince buraya gerçek admin_id yazılacak.
    table.string('admin_identifier').notNullable();
    table.string('action').notNullable(); // ban | unban
    table.string('target_device_id').nullable().index();
    table.string('reason').nullable();
    table.jsonb('metadata').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now()).index();
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('audit_log');
};
