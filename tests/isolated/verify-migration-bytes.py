"""Keep shared migrations byte-identical and preserve published legacy checksums."""
from pathlib import Path
import zlib

root = Path(__file__).resolve().parents[2] / 'hotel-reservation-system-backend/src/main/resources/db'
canonical, legacy = root / 'migration', root / 'legacy-hu05'
for name in ['V1__legacy_schema.sql', 'V2__booking_foundations.sql', 'V8__checkout_orders.sql']:
    assert (canonical / name).read_bytes().replace(b'\r\n', b'\n') == (legacy / name).read_bytes().replace(b'\r\n', b'\n'), name
for name, expected in [('V3__tracked_demonstration_history.sql', 497165249), ('V4__reservation_notifications.sql', 177359749)]:
    # Flyway CRC32 ignores line endings (and a possible UTF-8 BOM).
    crc = 0
    for line in (legacy / name).read_text(encoding='utf-8-sig').splitlines():
        crc = zlib.crc32(line.encode('utf-8'), crc)
    assert crc == expected, (name, crc, expected)
print('SHARED_MIGRATION_BYTES_AND_PUBLISHED_CHECKSUMS_OK')
