import { useSearchParams } from "react-router-dom";
import { SettingsLayout } from "../../components/SettingsLayout";
import { ProfilePage } from "../ProfilePage";

export function SettingsEditProfile() {
  const [, setSearchParams] = useSearchParams();
  return (
    <SettingsLayout
      title="Editar perfil"
      subtitle="Como voce aparece para os outros leitores"
      onBack={() => setSearchParams({})}
    >
      <ProfilePage />
    </SettingsLayout>
  );
}
