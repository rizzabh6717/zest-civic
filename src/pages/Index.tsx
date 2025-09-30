import { Hero } from "@/components/Hero";

const Index = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col relative">
      <Hero 
        title="Empowering Communities Through Civic Engagement"
        description="Report local issues, track resolutions, and participate in community governance. Together, we can build better neighborhoods."
        badgeText="Zentigrity"
        badgeLabel="BETA"
        ctaButtons={[
          { text: "Get Started", href: "#get-started", primary: true }
        ]}
        microDetails={["Community‑driven", "Transparent", "Blockchain‑powered"]}
      />
    </div>
  );
};

export default Index;
