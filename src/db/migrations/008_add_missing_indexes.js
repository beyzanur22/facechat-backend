exports.up = async function up(knex) {
  await knex.schema.alterTable('bans', (table) => {
    // "Bu cihaz şu an banlı mı?" sorgusu device_id + expires_at'e birlikte bakıyor.
    table.index(['device_id', 'expires_at'], 'bans_device_id_expires_at_index');
  });

  await knex.schema.alterTable('reports', (table) => {
    // Admin panelindeki "en çok raporlanan / en son raporlar" sorguları için.
    table.index(['reported_device_id', 'created_at'], 'reports_reported_device_id_created_at_index');
  });

  // Aynı session içinde aynı çiftin (reporter, reported) birden fazla rapor açmasını
  // artık veritabanı seviyesinde engelliyoruz (önceden sadece uygulama kodu kontrol ediyordu).
  await knex.raw(`
    CREATE UNIQUE INDEX reports_unique_per_session
    ON reports (reporter_device_id, reported_device_id, session_id)
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS reports_unique_per_session');
  await knex.schema.alterTable('reports', (table) => {
    table.dropIndex(['reported_device_id', 'created_at'], 'reports_reported_device_id_created_at_index');
  });
  await knex.schema.alterTable('bans', (table) => {
    table.dropIndex(['device_id', 'expires_at'], 'bans_device_id_expires_at_index');
  });
};
