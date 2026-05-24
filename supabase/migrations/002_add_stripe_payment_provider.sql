-- Add payment providers used by the checkout integrations.
alter type public.payment_provider add value if not exists 'pawapay';
alter type public.payment_provider add value if not exists 'stripe';
