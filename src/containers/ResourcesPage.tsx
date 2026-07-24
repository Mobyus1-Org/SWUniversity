import ResourcesList from "@/components/Resources/ResourcesList";
import { globalBackgroundStyle } from "@/util/style-const";

function ResourcesPage() {
  return <div className={`p-20 border h-[85vh] ${globalBackgroundStyle}
      text-left text-4xl font-bold flex flex-col gap-12`}>
    <h1>Useful Resources</h1>
    <ResourcesList />
  </div>;
}

export default ResourcesPage;
