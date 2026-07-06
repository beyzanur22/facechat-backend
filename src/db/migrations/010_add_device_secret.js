exports.up = function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    // Cihaza özgü sahiplik kanıtı: sadece ilk kayıtta üretilir ve tekrar döndürülmez.
    // Hesap silme / premium redeem / auth durumu gibi hassas REST çağrıları bunu ister.
    table.string('device_secret_hash').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('device_secret_hash');
  });
};
