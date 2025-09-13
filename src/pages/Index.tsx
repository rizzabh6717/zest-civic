import { Hero } from "@/components/Hero";

const Index = () => {
  return (
    <div className="w-screen min-h-screen flex flex-col relative">
      <Hero 
        title="Where algorithms become art."
        description="A minimal hero with a neural canvas — crisp, elegant, and quietly expressive. Built with React, Three.js, and a custom CPPN shader."
        badgeText="Generative Surfaces"
        badgeLabel="NEW"
        ctaButtons={[
          { text: "Get started", href: "#get-started", primary: true },
          { text: "View showcase", href: "#showcase" }
        ]}
        microDetails={["Low‑weight font", "Tight tracking", "Subtle motion"]}
      />
    </div>
  );
};

export default Index;
