import { createContext, useContext, useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { rewardApi, normalizeWalletState } from "@/lib/rewards";

const RewardsContext = createContext(null);

// Estado global de XP / Creditos / streak / missoes. O servidor e a fonte da
// verdade; cada acao chama um RPC que devolve o snapshot jsonb atualizado da
// carteira, que aqui e normalizado e exposto as telas.
export function RewardsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const state = await rewardApi.walletState();
      setWallet(normalizeWalletState(state));
      setError("");
      return state;
    } catch (cause) {
      setError("Nao foi possivel atualizar sua carteira. Tente novamente.");
      throw cause;
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const { supabase, isSupabaseReady } = await import("./supabase");
    if (!isSupabaseReady()) {
      if (import.meta.env.PROD) {
        setProducts([]);
        throw new Error("Catalogo da loja indisponivel");
      }
      let localProducts = [];
      try {
        const stored = localStorage.getItem("ope_shop_products_dev");
        if (stored) localProducts = JSON.parse(stored);
      } catch {}
      if (!localProducts || localProducts.length < 5) {
        localProducts = [
          {
            id: "prod-1",
            name: "Livro Físico - Edição OPE",
            description: "Edição física exclusiva impressa com acabamento de luxo e capa dura.",
            category: "book",
            credits_cost: 600,
            real_price: 60,
            min_months_active: 2.5,
            image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
              "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80"
            ],
            external_sku: "BOOK-01",
            active: true
          },
          {
            id: "prod-2",
            name: "Livro Premium - Edição Especial Collector",
            description: "Encadernação em couro vegetal, corte dourado e estojo exclusivo.",
            category: "book_premium",
            credits_cost: 900,
            real_price: 90,
            min_months_active: 5,
            image_url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80"
            ],
            external_sku: "BOOK-PREM-01",
            active: true
          },
          {
            id: "prod-3",
            name: "Box Coleção Filosofia Clássica",
            description: "Box com 3 obras essenciais + marcador em metal + brinde exclusivo.",
            category: "boxes",
            credits_cost: 1400,
            real_price: 140,
            min_months_active: 6,
            image_url: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80",
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80"
            ],
            external_sku: "BOX-01",
            active: true
          },
          {
            id: "prod-4",
            name: "Camiseta Oversized OPE Club",
            description: "Camiseta oversized 100% algodão pima com estampa frontal minimalista.",
            category: "oversized",
            credits_cost: 2000,
            real_price: 189.90,
            min_months_active: 8,
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
              "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80"
            ],
            external_sku: "TSHIRT-01",
            active: true
          },
          {
            id: "prod-5",
            name: "Moletom Street OPE Club",
            description: "Moletom pesado com capuz duplo, bolso canguru e bordado de alta definição.",
            category: "hoodie",
            credits_cost: 2900,
            real_price: 289.90,
            min_months_active: 12,
            image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
              "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80"
            ],
            external_sku: "HOODIE-01",
            active: true
          }
        ];
        try { localStorage.setItem("ope_shop_products_dev", JSON.stringify(localProducts)); } catch {}
      }
      setProducts(localProducts.filter((p) => p.active !== false));
      return localProducts;
    }
    const { data, error } = await supabase
      .from("shop_products")
      // The store catalog is independent from seasonal curation. A product
      // remains purchasable even when it has no season assignment.
      // Use the table shape returned by PostgREST instead of naming optional
      // columns such as images that may not exist in older deployments.
      .select("*")
      .eq("active", true)
      .order("credits_cost", { ascending: true });
    if (error) {
      setError("Nao foi possivel carregar os produtos da loja. Tente novamente.");
      throw error;
    }
    const catalog = (data || []).map((product) => ({
      ...product,
      images: Array.isArray(product.images)
        ? product.images
        : product.image_url
          ? [product.image_url]
          : [],
    }));
    setProducts(catalog);
    return catalog;
  }, []);

  const loadMyRedemptions = useCallback(async () => {
    const { supabase, isSupabaseReady } = await import("./supabase");
    if (!isSupabaseReady()) {
      setMyRedemptions([]);
      return [];
    }
    const { data, error } = await supabase
      .from("shop_redemptions")
      .select("id,user_id,product_id,credits_spent,status,customer_name,customer_email,address_json,tracking_code,notes,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    setMyRedemptions(data || []);
    return data || [];
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setWallet(null);
      setError("");
      setProducts([]);
      setMyRedemptions([]);
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;
    setError("");
    setLoading(true);
    Promise.allSettled([refresh(), loadProducts(), loadMyRedemptions()])
      .then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          setError("Nao foi possivel atualizar sua carteira ou a loja. Tente novamente.");
        }
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.id, refresh, loadProducts, loadMyRedemptions]);

  const applyRpcResult = useCallback((raw) => {
    setWallet(normalizeWalletState(raw));
  }, []);

  const rewardLogin = useCallback(async () => {
    const raw = await rewardApi.rewardLogin();
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const reportReading = useCallback(async (bookId, seconds, interacted) => {
    const raw = await rewardApi.reportReading(bookId, seconds, interacted);
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const rewardPost = useCallback(async (userId, sourceRef) => {
    const raw = await rewardApi.rewardPost(userId, sourceRef);
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const rewardComment = useCallback(async (userId, text) => {
    const raw = await rewardApi.rewardComment(userId, text);
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const rewardLikesReceived = useCallback(async (ownerId) => {
    const raw = await rewardApi.rewardLikesReceived(ownerId);
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const completeDailyMission = useCallback(async () => {
    const raw = await rewardApi.completeDailyMission();
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const completeWeeklyMission = useCallback(async () => {
    const raw = await rewardApi.completeWeeklyMission();
    applyRpcResult(raw);
    return raw;
  }, [applyRpcResult]);

  const redeemProduct = useCallback(async (productId, customerName, customerEmail, address, idempotencyKey) => {
    const raw = await rewardApi.redeemProduct(productId, customerName, customerEmail, address, idempotencyKey);
    if (raw?.wallet) applyRpcResult(raw.wallet);
    await loadMyRedemptions();
    return raw;
  }, [applyRpcResult, loadMyRedemptions]);

  const getMyReferralCode = useCallback(async () => {
    return rewardApi.getMyReferralCode();
  }, []);

  const registerReferral = useCallback(async (code) => {
    return rewardApi.registerReferral(code);
  }, []);

  const referralClaim = useCallback(async (referredUserId) => {
    const raw = await rewardApi.referralClaim(referredUserId);
    if (raw?.wallet) applyRpcResult(raw.wallet);
    return raw;
  }, [applyRpcResult]);

  // Simula adicao de creditos localmente (dev/teste)
  const addCredits = useCallback((amount) => {
    setWallet((prev) => {
      if (!prev) return prev;
      return { ...prev, credits: (prev.credits || 0) + Number(amount) };
    });
  }, []);

  const value = useMemo(() => ({
    wallet,
    loading,
    error,
    products,
    myRedemptions,
    refresh,
    loadProducts,
    loadMyRedemptions,
    rewardLogin,
    reportReading,
    rewardPost,
    rewardComment,
    rewardLikesReceived,
    completeDailyMission,
    completeWeeklyMission,
    redeemProduct,
    getMyReferralCode,
    registerReferral,
    referralClaim,
    addCredits,
  }), [
    wallet, loading, error, products, myRedemptions, refresh, loadProducts, loadMyRedemptions,
    rewardLogin, reportReading, rewardPost, rewardComment, rewardLikesReceived,
    completeDailyMission, completeWeeklyMission, redeemProduct,
    getMyReferralCode, registerReferral, referralClaim, addCredits,
  ]);

  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards must be used within RewardsProvider");
  return ctx;
}
