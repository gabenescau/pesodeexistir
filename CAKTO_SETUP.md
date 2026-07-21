# Configuração Cakto — OPE Club (pesodeexistir.online)

## 1. Dados do painel Cakto

| Campo | Valor |
|---|---|
| Client ID | `J2JofAqw8mRNR0ddNMORCui4kEe8xWb2Sxv7MuGf` |
| Client Secret | `c7CFNqZITB1iqIfzHTfxaPWXg4VVl2LDU9QtPXCEi5XuyHL0d7ppSYHDlrFWfgL2VMBxeKF8nAR51jXIK8jJM9lbPBc8jc9d8LaP59OnbcBiT8agWDouzkGWabqHtDJW` |
| Webhook Secret | `gNtaZ8d6vQPt2fxDfgYBXdDq3bAxtYGVEwBfKMR2KygNb3zAcn6VoQ5TYFAsug` |
| Checkout URL | `https://pay.cakto.com.br/yxdvb3z_700613` |
| Offer ID | `yxdvb3z_700613` |
| Site (frontend) | `https://pesodeexistir.online` |

---

## 2. Front-end (já configurado)

**Arquivo:** `src/app/pages/SubscribePage.jsx:47`

O link do checkout já está atualizado:
```js
window.location.href = "https://pay.cakto.com.br/yxdvb3z_700613";
```

---

## 3. Supabase

### Rodar migration
```bash
supabase migration up
```
Cria as tabelas: `subscriptions`, `checkout_sessions`, `webhook_events` e função `map_cakto_status_to_internal()`.

### Fazer deploy da Edge Function
```bash
supabase functions deploy cakto-webhook
```

### Configurar secrets no Supabase (OBRIGATÓRIO)
```bash
supabase secrets set CAKTO_CLIENT_ID=J2JofAqw8mRNR0ddNMORCui4kEe8xWb2Sxv7MuGf
supabase secrets set CAKTO_CLIENT_SECRET=c7CFNqZITB1iqIfzHTfxaPWXg4VVl2LDU9QtPXCEi5XuyHL0d7ppSYHDlrFWfgL2VMBxeKF8nAR51jXIK8jJM9lbPBc8jc9d8LaP59OnbcBiT8agWDouzkGWabqHtDJW
supabase secrets set CAKTO_WEBHOOK_SECRET=gNtaZ8d6vQPt2fxDfgYBXdDq3bAxtYGVEwBfKMR2KygNb3zAcn6VoQ5TYFAsug
```

Endpoint do webhook (já deployado):
```
https://zmgesqhlzafcyqocdxnd.supabase.co/functions/v1/cakto-webhook
```

---

## 4. Configurar webhook no painel Cakto

1. Acesse https://app.cakto.com.br → **Configurações → Webhooks**
2. Clique em **Criar webhook**
3. **URL:** `https://zmgesqhlzafcyqocdxnd.supabase.co/functions/v1/cakto-webhook`
4. **Eventos:** marque todos:
   - `purchase_approved`
   - `subscription_created`
   - `subscription_renewed`
   - `subscription_canceled`
   - `subscription_renewal_refused`
   - `refund`
   - `chargeback`
5. Salve — o `secret` gerado pelo Cakto **deve ser o mesmo** que está configurado no Supabase (`gNtaZ8d6vQPt2fxDfgYBXdDq3bAxtYGVEwBfKMR2KygNb3zAcn6VoQ5TYFAsug`). Se o Cakto gerar outro, copie o novo e atualize:
   ```bash
   supabase secrets set CAKTO_WEBHOOK_SECRET=<novo_secret>
   ```

---

## 5. Vercel (frontend)

No dashboard da Vercel → **pesodeexistir** → **Settings → Environment Variables**:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://zmgesqhlzafcyqocdxnd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (Settings → API → anon public) |

Depois faça deploy:
```bash
vercel --prod
```
Ou conecte o repositório no dashboard — deploys automáticos em cada push.

---

## 6. Checklist final

- [ ] **Migration** rodada: `supabase migration up`
- [ ] **Edge Function** deployada: `supabase functions deploy cakto-webhook`
- [ ] **Secrets** configuradas no Supabase: `CAKTO_CLIENT_ID`, `CAKTO_CLIENT_SECRET`, `CAKTO_WEBHOOK_SECRET`
- [ ] **Webhook** criado no painel Cakto com URL da Edge Function + eventos corretos
- [ ] **Checkout** apontando para `https://pay.cakto.com.br/yxdvb3z_700613` (já configurado no código)
- [ ] **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY** na Vercel
- [ ] Frontend deployado na Vercel

---

## 7. Testar

1. Acesse `https://pesodeexistir.online/assinar`
2. Clique **Assinar agora** → deve ir para `https://pay.cakto.com.br/yxdvb3z_700613`
3. Complete o pagamento
4. O webhook ativa a assinatura automaticamente
5. Volte para `https://pesodeexistir.online/app/inicio` — o acesso deve estar liberado

Logs da Edge Function:
```bash
supabase functions logs cakto-webhook
```
