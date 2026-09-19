import { useSearchParams } from "react-router-dom";
import { Hash } from "@/lib/icons";
import { SettingsLayout, SettingsSection } from "../../components/SettingsLayout";
import { CollectionsPanel } from "../../components/CollectionsPanel";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";

export function SettingsCollections() {
  const [, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { collections } = useData();
  const total = collections.filter((c) => c.user_id === user?.id).length;

  return (
    <SettingsLayout
      title="Minhas colecoes"
      subtitle="Agrupe livros e autores que importam para voce"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={Hash} label={`${total} ${total === 1 ? "colecao" : "colecoes"}`}>
        <div className="p-3 sm:p-4">
          <CollectionsPanel ownerId={user?.id} ownerName={user?.user_metadata?.name || "Voce"} />
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
