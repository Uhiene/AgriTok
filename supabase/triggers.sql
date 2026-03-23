-- ============================================================
-- Notification trigger: fires when investment status changes
-- ============================================================
-- Run this in Supabase SQL Editor.
-- Creates a SECURITY DEFINER function so it can insert into
-- notifications without being blocked by RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_investment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_name  text;
  v_crop_type     text;
  v_farmer_id     uuid;
BEGIN
  -- Only act when status transitions TO 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN

    -- Fetch listing details
    SELECT description, crop_type, farmer_id
      INTO v_listing_name, v_crop_type, v_farmer_id
      FROM public.crop_listings
     WHERE id = NEW.listing_id;

    -- Notify investor
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      NEW.investor_id,
      'Investment Confirmed',
      'Your investment in "' || COALESCE(v_listing_name, v_crop_type) || '" has been confirmed. Your tokens are now active.',
      'investment',
      false
    );

    -- Notify farmer (if farmer exists)
    IF v_farmer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, read)
      VALUES (
        v_farmer_id,
        'New Investment Received',
        'A new investor has funded your ' || COALESCE(v_crop_type, 'crop') || ' listing. Your funding goal is getting closer.',
        'investment',
        false
      );
    END IF;

  END IF;

  -- Act when status transitions TO 'paid_out'
  IF NEW.status = 'paid_out' AND (OLD.status IS DISTINCT FROM 'paid_out') THEN

    SELECT description, crop_type
      INTO v_listing_name, v_crop_type
      FROM public.crop_listings
     WHERE id = NEW.listing_id;

    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      NEW.investor_id,
      'Payout Received',
      'Your harvest payout for "' || COALESCE(v_listing_name, v_crop_type) || '" has been processed. Check your wallet.',
      'payout',
      false
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_investment_status_change ON public.investments;

CREATE TRIGGER on_investment_status_change
  AFTER UPDATE OF status ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_investment_status_change();
