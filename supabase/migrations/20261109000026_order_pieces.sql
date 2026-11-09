-- Orders with more than one piece (a set of 4 or 6 chairs, or several items in one order): every piece is inspected.
-- 1) orders.items: what was ordered (product, name, category, quantity), saved at checkout.
-- 2) orders.pieces: the pieces to inspect, worked out here from the items when the order is created
--    ("Chair 1 of 4" ... "Chair 4 of 4"); empty = the order is one piece (all older orders).
-- 3) detection_logs.piece: which piece a saved scan is for.
-- 4) The stage rules check every piece: Detect Defects needs a saved scan for each piece, and delivery needs each piece's
--    latest scan to pass (or an admin to approve it as a false alarm). One-piece orders work as before.
-- Pending orders placed before this, for one product with a quantity of 2 or more, get their pieces too.
-- Safe to run more than once.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pieces TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.detection_logs ADD COLUMN IF NOT EXISTS piece TEXT;

-- "Chair" for the Chairs category, "Table" for Tables...; else the product's own name
CREATE OR REPLACE FUNCTION public.piece_word(p_category TEXT, p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_category
        WHEN 'Chairs' THEN 'Chair' WHEN 'Tables' THEN 'Table' WHEN 'Beds' THEN 'Bed'
        WHEN 'Cabinets' THEN 'Cabinet' WHEN 'Office Furniture' THEN 'Desk' WHEN 'Storage' THEN 'Unit'
        ELSE COALESCE(NULLIF(p_name, ''), 'Piece') END
$$;

-- The pieces of an order. One item: "Chair 1 of 4"...; several items: "Ash Dining Chair 1 of 4", "Ash Dining Table".
CREATE OR REPLACE FUNCTION public.order_piece_list(p_items JSONB, p_name TEXT, p_category TEXT, p_quantity INT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    item JSONB;
    q INT;
    many BOOLEAN := COALESCE(jsonb_array_length(p_items), 0) > 1;
    result TEXT[] := '{}';
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        p_items := jsonb_build_array(jsonb_build_object('name', p_name, 'category', p_category, 'quantity', COALESCE(p_quantity, 1)));
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        q := LEAST(GREATEST(COALESCE((item->>'quantity')::INT, 1), 1), 99);
        FOR i IN 1..q LOOP
            result := result || CASE
                WHEN many AND q = 1 THEN item->>'name'
                WHEN many THEN format('%s %s of %s', item->>'name', i, q)
                WHEN q = 1 THEN NULL
                ELSE format('%s %s of %s', public.piece_word(item->>'category', item->>'name'), i, q) END;
        END LOOP;
    END LOOP;
    RETURN array_remove(result, NULL);
END;
$$;

-- worked out by the database when the order is created, so it cannot be set by hand
CREATE OR REPLACE FUNCTION public.set_order_pieces()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.pieces := public.order_piece_list(NEW.items, NEW.product_name, NEW.product_category, NEW.quantity);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_pieces ON public.orders;
CREATE TRIGGER set_order_pieces
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_order_pieces();

UPDATE public.orders
   SET pieces = public.order_piece_list(items, product_name, product_category, quantity)
 WHERE extended_status = 'pending' AND cardinality(pieces) = 0 AND COALESCE(quantity, 1) > 1 AND product_name NOT LIKE '% more';

-- The stage rules (same as migration 015, now piece by piece when an order has pieces)
CREATE OR REPLACE FUNCTION public.enforce_order_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rule_gate TEXT;
    stage_since TIMESTAMPTZ;
    latest RECORD;
    missing TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.extended_status IS DISTINCT FROM 'pending' THEN
            RAISE EXCEPTION 'New orders must start at "Pending" (got "%")', public.order_status_label(NEW.extended_status);
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.extended_status IS NOT DISTINCT FROM OLD.extended_status THEN
        RETURN NEW;  -- other columns changed; no stage move
    END IF;

    SELECT gate INTO rule_gate
    FROM public.order_status_transitions
    WHERE from_status = COALESCE(OLD.extended_status, 'pending') AND to_status = NEW.extended_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid stage move: "%" -> "%"',
            public.order_status_label(COALESCE(OLD.extended_status, 'pending')), public.order_status_label(NEW.extended_status);
    END IF;

    IF rule_gate = 'scan_done' THEN
        SELECT h.entered_at INTO stage_since FROM public.order_stage_history h
        WHERE h.order_id = NEW.id AND h.left_at IS NULL
        ORDER BY h.entered_at DESC LIMIT 1;
        IF cardinality(NEW.pieces) > 0 THEN
            SELECT string_agg(p, ', ') INTO missing FROM unnest(NEW.pieces) p
            WHERE NOT EXISTS (SELECT 1 FROM public.detection_logs d
                              WHERE d.order_id = NEW.id AND d.piece = p AND d.created_at >= COALESCE(stage_since, '-infinity'));
            IF missing IS NOT NULL THEN
                RAISE EXCEPTION 'Detect Defects is not finished: save a defect scan for %', missing;
            END IF;
        ELSIF NOT EXISTS (
            SELECT 1 FROM public.detection_logs d
            WHERE d.order_id = NEW.id AND d.created_at >= COALESCE(stage_since, '-infinity')
        ) THEN
            RAISE EXCEPTION 'Detect Defects is not finished: run and save a defect scan for this order first';
        END IF;
    ELSIF rule_gate = 'scan_passed' THEN
        IF cardinality(NEW.pieces) > 0 THEN
            SELECT string_agg(p, ', ') INTO missing FROM unnest(NEW.pieces) p
            WHERE NOT EXISTS (
                SELECT 1 FROM (SELECT overall_result, review_status FROM public.detection_logs d
                               WHERE d.order_id = NEW.id AND d.piece = p ORDER BY d.created_at DESC LIMIT 1) l
                WHERE l.overall_result = 'pass' OR l.review_status = 'approved');
            IF missing IS NOT NULL THEN
                RAISE EXCEPTION 'Not every piece has passed: %. After corrective action, send the order back to Upload for re-inspection (or ask an admin to review a false alarm)', missing;
            END IF;
        ELSE
            SELECT overall_result, review_status INTO latest FROM public.detection_logs
            WHERE order_id = NEW.id ORDER BY created_at DESC LIMIT 1;
            IF NOT FOUND OR (latest.overall_result IS DISTINCT FROM 'pass' AND latest.review_status IS DISTINCT FROM 'approved') THEN
                RAISE EXCEPTION 'The latest defect scan of this order did not pass. After corrective action, send it back to Upload for re-inspection (or ask an admin to review a false alarm)';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
