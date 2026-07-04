const config = require('../config');

/**
 * Supabase access token'ını doğrular. Doğrulamayı Supabase yapar (/auth/v1/user):
 * geçerliyse kullanıcıyı döner, değilse 401 fırlatır. Böylece bizde JWT sırrı/JWKS yönetimi olmaz.
 * Bu çağrı sadece giriş anında (sık değil) yapılır, o yüzden ağ maliyeti önemsiz.
 */
async function verifyAccessToken(accessToken) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY tanımlı değil');
  }

  const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = new Error('Geçersiz veya süresi dolmuş token');
    err.status = 401;
    throw err;
  }

  const user = await res.json();
  const meta = user.user_metadata || {};
  return {
    authUid: user.id, // Supabase auth kullanıcı id'si
    email: user.email || null,
    displayName: meta.full_name || meta.name || null,
  };
}

module.exports = { verifyAccessToken };
