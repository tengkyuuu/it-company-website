export type Project = {
  name: string;
  category: string;
  url: string;
  year: string;
  img: string;
  tags: string[];
  dots: [string, string, string]; // the project's 3 signature colors
};

export const projects: Project[] = [
  {
    name: "FameCRM",
    category: "CRM Platform",
    url: "famecrm.app",
    year: "’25",
    img: "/work/famecrm-landing.webp",
    tags: ["Web App", "SaaS", "Dashboard"],
    dots: ["#7c5cff", "#4f46e5", "#15131f"],
  },
  {
    name: "PhysioPano",
    category: "Healthcare Platform",
    url: "physiopano.com",
    year: "’25",
    img: "/work/physiopano-admin-landing.webp",
    tags: ["Web", "Admin", "Health"],
    dots: ["#22c55e", "#10b981", "#0b1f16"],
  },
  {
    name: "SHM",
    category: "Management Platform",
    url: "shm.app",
    year: "’24",
    img: "/work/shm-landing.webp",
    tags: ["Web App", "Dashboard"],
    dots: ["#3b82f6", "#60a5fa", "#0f1b2e"],
  },
  {
    name: "Rally’s Equities",
    category: "Fintech · Equities",
    url: "rallys-equities.com",
    year: "’24",
    img: "/work/rallys-equities.png",
    tags: ["Web", "Finance", "Charts"],
    dots: ["#16a34a", "#eab308", "#0f1a14"],
  },
  {
    name: "Coffee Shop",
    category: "Ordering Experience",
    url: "coffee.shop",
    year: "’24",
    img: "/work/coffee-shop.png",
    tags: ["Web", "Ordering", "UX"],
    dots: ["#b45309", "#f59e0b", "#3b2417"],
  },
];
