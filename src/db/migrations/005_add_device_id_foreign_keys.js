async function backfillMissingUsers(knex, table, columns) {
  // Var olan kayıtlarda users'ta karşılığı olmayan device_id varsa (ör. eski test verisi,
  // admin'in hiç bağlanmamış bir cihazı elle banlaması), FK eklenmeden önce bunlar için
  // boş bir users satırı oluştur. Yoksa ALTER TABLE ... ADD CONSTRAINT bu yüzden patlar.
  for (const column of columns) {
    await knex.raw(
      `INSERT INTO users (device_id)
       SELECT DISTINCT t.${column}
       FROM ${table} t
       LEFT JOIN users u ON u.device_id = t.${column}
       WHERE u.device_id IS NULL
       ON CONFLICT (device_id) DO NOTHING`
    );
  }
}

exports.up = async function up(knex) {
  await backfillMissingUsers(knex, 'bans', ['device_id']);
  await backfillMissingUsers(knex, 'reports', ['reporter_device_id', 'reported_device_id']);
  await backfillMissingUsers(knex, 'blocks', ['blocker_device_id', 'blocked_device_id']);

  // ON DELETE RESTRICT: users satırı asla hard-delete edilmeyecek (bkz. 009 — soft delete),
  // bu yüzden ban/report/block geçmişinin sessizce silinmesini bilerek engelliyoruz.
  await knex.schema.alterTable('bans', (table) => {
    table.foreign('device_id').references('device_id').inTable('users').onDelete('RESTRICT');
  });

  await knex.schema.alterTable('reports', (table) => {
    table.foreign('reporter_device_id').references('device_id').inTable('users').onDelete('RESTRICT');
    table.foreign('reported_device_id').references('device_id').inTable('users').onDelete('RESTRICT');
  });

  await knex.schema.alterTable('blocks', (table) => {
    table.foreign('blocker_device_id').references('device_id').inTable('users').onDelete('RESTRICT');
    table.foreign('blocked_device_id').references('device_id').inTable('users').onDelete('RESTRICT');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('blocks', (table) => {
    table.dropForeign('blocker_device_id');
    table.dropForeign('blocked_device_id');
  });
  await knex.schema.alterTable('reports', (table) => {
    table.dropForeign('reporter_device_id');
    table.dropForeign('reported_device_id');
  });
  await knex.schema.alterTable('bans', (table) => {
    table.dropForeign('device_id');
  });
};
