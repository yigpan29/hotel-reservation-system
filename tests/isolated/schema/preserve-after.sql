SELECT 'hotels:' || (to_jsonb(h)-'active')::text FROM hotels h
UNION ALL SELECT 'rooms:' || ((to_jsonb(r)-'active'-'availability') || jsonb_build_object('availbility',r.availability))::text FROM rooms r
UNION ALL SELECT 'users:' || (to_jsonb(u)-'role')::text FROM users u
UNION ALL SELECT 'reservations:' || (to_jsonb(r)-'nightly_price'-'total_price'-'cancelled_at'-'room_type')::text FROM reservations r
UNION ALL SELECT 'payments:' || to_jsonb(p)::text FROM payments p
UNION ALL SELECT 'reviews:' || to_jsonb(r)::text FROM reviews r
ORDER BY 1;
