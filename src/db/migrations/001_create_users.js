exports.up = function up(knex) {
  return knex.schema.createTable('users', (table) => {
    // Surrogate anahtar (premium_subscriptions gibi tablolar buna referans verecek).
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Anonim omurga: her kullanıcıda var, misafirler dahil.
    table.string('device_id').notNullable().unique().index();

    // İsteğe bağlı Google girişi (karma model) — sadece hesap bağlayınca dolar.
    table.string('google_id').unique().nullable().index();
    table.string('email').nullable();
    table.string('display_name').nullable();

    // Profil / eşleştirme.
    table.string('gender').notNullable().defaultTo('unknown');
    table.string('region').notNullable().defaultTo('unknown');

    // Premium (Faz 3'te premium_subscriptions ile beslenecek).
    table.boolean('is_premium').notNullable().defaultTo(false);
    table.timestamp('premium_until', { useTz: true }).nullable();

    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('last_seen_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};
