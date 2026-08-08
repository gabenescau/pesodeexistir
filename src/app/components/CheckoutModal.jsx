import { useState, useEffect } from "react";
import { ArrowLeft, Check, ChevronRight, X, MapPin, User, Phone, Mail, Package } from "@/lib/icons";

const STEPS = ["Dados", "Endereço", "Confirmação"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                    : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-blue-400" : done ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-3 mb-4 h-px w-10 transition-colors ${
                  done ? "bg-blue-600" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, icon: Icon, required }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--text-secondary)]">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Icon className="size-3.5 text-[var(--text-muted)]" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-colors`}
        />
      </div>
    </div>
  );
}

export function CheckoutModal({ isOpen, onClose, product, paymentMethod = "credits", onConfirm }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateStep1() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nome obrigatório";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errs.email = "E-mail inválido";
    if (!form.phone.trim()) errs.phone = "Telefone obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    if (!form.street.trim()) errs.street = "Rua obrigatória";
    if (!form.number.trim()) errs.number = "Número obrigatório";
    if (!form.neighborhood.trim()) errs.neighborhood = "Bairro obrigatório";
    if (!form.city.trim()) errs.city = "Cidade obrigatória";
    if (!form.state.trim()) errs.state = "Estado obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleNext() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1) {
      if (!validateStep2()) return;
      setLoading(true);
      try {
        const order = {
          id: `order-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          productCategory: product.category,
          paymentMethod,
          creditsCost: paymentMethod === "credits" ? product.credits_cost : null,
          realPrice: paymentMethod === "real" ? (product.real_price || null) : null,
          customer: { name: form.name, email: form.email, phone: form.phone },
          address: {
            cep: form.cep,
            street: form.street,
            number: form.number,
            complement: form.complement,
            neighborhood: form.neighborhood,
            city: form.city,
            state: form.state,
          },
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        // Save to localStorage
        try {
          const existing = JSON.parse(localStorage.getItem("ope_orders") || "[]");
          existing.unshift(order);
          localStorage.setItem("ope_orders", JSON.stringify(existing));
        } catch {}
        await onConfirm(order);
      } finally {
        setLoading(false);
      }
      setStep(2);
      return;
    }
    if (step < 2) setStep((s) => s + 1);
  }

  const isLastStep = step === 1;
  const isDone = step === 2;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isDone ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-t-[20px] sm:rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className="size-4 shrink-0 text-blue-400" />
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">
                {paymentMethod === "credits"
                  ? `${product.credits_cost} créditos`
                  : `R$ ${(product.real_price || 0).toFixed(2)}`}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{product.name}</p>
            </div>
          </div>
          {!isDone && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {!isDone && <StepIndicator current={step} />}

          {isDone ? (
            /* Confirmation screen */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30">
                <Check className="size-8 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Pedido enviado!</h2>
              <p className="mt-2 max-w-[280px] text-sm text-[var(--text-muted)]">
                Seu formulário foi enviado com sucesso. Nossa equipe vai entrar em contato em breve para confirmar e organizar a entrega.
              </p>
              <div className="mt-4 w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3 text-left space-y-1">
                <p className="text-[11px] text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-primary)]">Nome: </span>{form.name}</p>
                <p className="text-[11px] text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-primary)]">E-mail: </span>{form.email}</p>
                <p className="text-[11px] text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-primary)]">Telefone: </span>{form.phone}</p>
                <p className="text-[11px] text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-primary)]">Endereço: </span>{form.street}, {form.number} — {form.city}/{form.state}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-[10px] bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : step === 0 ? (
            /* Step 1: Personal data */
            <div className="space-y-3.5">
              <Field label="Nome completo" value={form.name} onChange={(v) => set("name", v)} placeholder="João da Silva" icon={User} required />
              {errors.name && <p className="text-[11px] text-red-400 -mt-2">{errors.name}</p>}
              <Field label="E-mail" value={form.email} onChange={(v) => set("email", v)} type="email" placeholder="seu@email.com" icon={Mail} required />
              {errors.email && <p className="text-[11px] text-red-400 -mt-2">{errors.email}</p>}
              <Field label="Telefone / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} type="tel" placeholder="(11) 99999-9999" icon={Phone} required />
              {errors.phone && <p className="text-[11px] text-red-400 -mt-2">{errors.phone}</p>}
            </div>
          ) : (
            /* Step 2: Address */
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="CEP" value={form.cep} onChange={(v) => set("cep", v)} placeholder="00000-000" icon={MapPin} />
                <Field label="Número" value={form.number} onChange={(v) => set("number", v)} placeholder="123" required />
              </div>
              {errors.number && <p className="text-[11px] text-red-400 -mt-2">{errors.number}</p>}
              <Field label="Rua / Avenida" value={form.street} onChange={(v) => set("street", v)} placeholder="Rua das Flores" required />
              {errors.street && <p className="text-[11px] text-red-400 -mt-2">{errors.street}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Complemento" value={form.complement} onChange={(v) => set("complement", v)} placeholder="Apto 4B" />
                <Field label="Bairro" value={form.neighborhood} onChange={(v) => set("neighborhood", v)} placeholder="Centro" required />
              </div>
              {errors.neighborhood && <p className="text-[11px] text-red-400 -mt-2">{errors.neighborhood}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade" value={form.city} onChange={(v) => set("city", v)} placeholder="São Paulo" required />
                <Field label="Estado" value={form.state} onChange={(v) => set("state", v)} placeholder="SP" required />
              </div>
              {(errors.city || errors.state) && <p className="text-[11px] text-red-400 -mt-2">{errors.city || errors.state}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isDone && (
          <div className="flex items-center gap-3 border-t border-[var(--border)] px-5 py-4">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded-[8px] border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Voltar
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={handleNext}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {loading ? "Enviando..." : isLastStep ? "Confirmar Pedido" : "Continuar"}
              {!loading && !isLastStep && <ChevronRight className="size-4" />}
              {!loading && isLastStep && <Check className="size-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
