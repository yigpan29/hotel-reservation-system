SELECT 'hotels:' || to_jsonb(h)::text FROM hotels h
UNION ALL SELECT 'rooms:' || to_jsonb(r)::text FROM rooms r
UNION ALL SELECT 'users:' || to_jsonb(u)::text FROM users u
UNION ALL SELECT 'reservations:' || to_jsonb(r)::text FROM reservations r
UNION ALL SELECT 'payments:' || to_jsonb(p)::text FROM payments p
UNION ALL SELECT 'reviews:' || to_jsonb(r)::text FROM reviews r
ORDER BY 1;
