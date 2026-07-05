exports.up = function up(knex) {
  return knex.schema.createTable('premium_subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // users.id (UUID) referans alınıyor, device_id değil — bir kullanıcı hesap değiştirse/
    // yeni cihaza geçse bile abonelik geçmişi kişiye (id) bağlı kalsın.
    // ON DELETE CASCADE: users hiçbir zaman hard-delete edilmeyecek (bkz. 009) ama
    // teorik olarak silinirse, sahipsiz abonelik satırı anlamsız veri olur — o yüzden burada
    // 005'teki RESTRICT'in aksine CASCADE kullandık.
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');

    table.string('provider').notNullable(); // google_play | app_store | stripe (web için)
    table.string('product_id').notNullable();
    table.string('purchase_token').notNullable().unique(); // aynı makbuz iki kez kullanılamaz
    table.string('status').notNullable().defaultTo('active'); // active | expired | cancelled | refunded
    table.timestamp('starts_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index(['user_id', 'status']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('premium_subscriptions');
};
