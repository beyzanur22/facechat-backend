exports.up = function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    // KVKK "hesabımı sil" akışı: satır gerçekten silinmez (bans/reports/blocks FK'leri
    // ve platform güvenliği için), sadece kişisel alanlar boşaltılır ve bu alan doldurulur.
    table.timestamp('deleted_at', { useTz: true }).nullable().index();
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('deleted_at');
  });
};
