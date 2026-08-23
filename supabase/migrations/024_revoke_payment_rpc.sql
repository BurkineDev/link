-- ---------------------------------------------------------------------------
-- Migration 024 : retirer les RPC de paiement aux rôles clients
-- ---------------------------------------------------------------------------
-- Les migrations 022 et 023 écrivaient `revoke all ... from public`, en croyant
-- fermer l'accès. C'était insuffisant : Supabase accorde EXECUTE à `anon` et
-- `authenticated` par défaut sur le schéma public, et révoquer au rôle PUBLIC
-- ne retire pas un droit accordé nommément à ces rôles.
--
-- Conséquence, jusqu'à cette migration : n'importe qui pouvait appeler
-- /rest/v1/rpc/apply_subscription_payment. Un vendeur lançait un paiement
-- (ce qui crée la ligne `pending` et lui donne sa référence), ne le réglait
-- pas, appelait la fonction avec cette référence — et repartait avec un
-- abonnement Pro gratuit. Même chemin pour les boosts.
--
-- Seule la clé service doit décider qu'un paiement est encaissé, parce
-- qu'elle seule sert le webhook qui a vu Genius Pay le confirmer.
--
-- Les compteurs (track_shop_link_click, track_shop_page_view,
-- track_page_block_click) restent volontairement ouverts à `anon` : un
-- visiteur doit pouvoir compter son propre tap, et ces fonctions ne savent
-- rien faire d'autre qu'incrémenter.
-- ---------------------------------------------------------------------------

revoke execute on function public.apply_subscription_payment(text)
  from anon, authenticated;

revoke execute on function public.apply_boost_payment(text)
  from anon, authenticated;
