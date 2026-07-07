exports.up = function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    // Sunucu-tarafı yaş kapısı için doğum tarihi. Nullable — mevcut/eski kayıtlar bozulmasın;
    // istemci (BirthdateActivity) kayıt sırasında gönderir, sunucu MIN_AGE'e göre denetler.
    table.date('birthdate').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('birthdate');
  });
};
