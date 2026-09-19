-- Migration to fix subscriptions_plan_check constraint
-- Ensures both full plan codes ('ope_club_monthly', 'ope_club_annual') and short plan keys ('monthly', 'annual') as well as friendly names are allowed in check constraint.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (
  plan IN ('ope_club_monthly', 'ope_club_annual', 'monthly', 'annual', 'leitor', 'pensador')
);
