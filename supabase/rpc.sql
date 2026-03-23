-- =============================================================
-- AgriToken — RPC functions
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- -------------------------------------------------------------
-- increment_listing_funding
-- Atomically increments tokens_sold + amount_raised_usd.
-- Also transitions status open → funded when fully subscribed.
-- Called by Edge Functions after payment confirmation.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_listing_funding(
  p_listing_id  uuid,
  p_tokens_added integer,
  p_amount_added numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tokens  integer;
  v_tokens_sold   integer;
BEGIN
  UPDATE crop_listings
     SET tokens_sold      = tokens_sold      + p_tokens_added,
         amount_raised_usd = amount_raised_usd + p_amount_added,
         -- transition to 'funded' if now fully subscribed
         status = CASE
           WHEN (tokens_sold + p_tokens_added) >= total_tokens
                AND status = 'open'
           THEN 'funded'::listing_status
           ELSE status
         END
   WHERE id = p_listing_id
  RETURNING total_tokens, tokens_sold
    INTO v_total_tokens, v_tokens_sold;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing % not found', p_listing_id;
  END IF;
END;
$$;

-- Grant execute to the service role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.increment_listing_funding(uuid, integer, numeric)
  TO service_role;
