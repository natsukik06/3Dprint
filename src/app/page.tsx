import { HomeClient } from "@/components/home/HomeClient";
import { HomeShowcaseSection } from "@/components/showcase/HomeShowcaseSection";

// 作成例 are read on the server; the 反映 button in /admin/showcase revalidates this page on demand,
// and the hourly refresh is only a safety net.
export const revalidate = 3600;

export default function Home() {
  return <HomeClient showcase={<HomeShowcaseSection />} />;
}
