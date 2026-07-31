import { useSearchParams } from "react-router-dom";
import { SettingsHub } from "./settings/SettingsHub";
import { SettingsEditProfile } from "./settings/SettingsEditProfile";
import { SettingsAccount } from "./settings/SettingsAccount";
import { SettingsSecurity } from "./settings/SettingsSecurity";
import { SettingsNotifications } from "./settings/SettingsNotifications";
import { SettingsAppearance } from "./settings/SettingsAppearance";
import { SettingsSubscription } from "./settings/SettingsSubscription";
import { SettingsCollections } from "./settings/SettingsCollections";
import { SettingsHelp } from "./settings/SettingsHelp";

// Router fino: le ?aba= e renderiza o Hub (padrao) ou a sub-tela correspondente.
// Mantem compatibilidade com o antigo ?aba=perfil.
export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const aba = searchParams.get("aba") || "hub";

  switch (aba) {
    case "perfil": return <SettingsEditProfile />;
    case "conta": return <SettingsAccount />;
    case "seguranca": return <SettingsSecurity />;
    case "notificacoes": return <SettingsNotifications />;
    case "aparencia": return <SettingsAppearance />;
    case "assinatura": return <SettingsSubscription />;
    case "colecoes": return <SettingsCollections />;
    case "ajuda": return <SettingsHelp />;
    case "hub":
    default:
      return <SettingsHub />;
  }
}
