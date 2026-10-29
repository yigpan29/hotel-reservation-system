DO $$ DECLARE row record; d text; expression text; BEGIN
  FOR row IN SELECT * FROM compatibility_fingerprints LOOP
    expression := CASE row.table_name WHEN 'rooms' THEN 'to_jsonb(x)-''capacity''' WHEN 'reservations' THEN 'to_jsonb(x)-''adults''-''children''-''room_type''' ELSE 'to_jsonb(x)' END;
    EXECUTE format('SELECT md5(coalesce(string_agg((%s)::text,chr(10) ORDER BY (%s)::text),'''')) FROM %I x %s',expression,expression,row.table_name,CASE WHEN row.table_name='flyway_schema_history' THEN 'WHERE installed_rank<=4' ELSE '' END) INTO d;
    IF d<>row.digest THEN RAISE EXCEPTION 'Original rows modified: %',row.table_name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM reservations WHERE adults IS NOT NULL OR children IS NOT NULL OR room_type IS NOT NULL) THEN RAISE EXCEPTION 'Invented historical fields'; END IF;
END $$;
SELECT 'HU05_LINEAGE_ORIGINAL_ROWS_AND_HISTORY_PRESERVED';
