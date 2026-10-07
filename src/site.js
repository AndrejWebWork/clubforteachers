import { resources, topics } from "./data";

export const siteName = "Клуб на наставници";

export const siteDescription =
  "Интерна веб-платформа за идеи, ресурси, обуки и професионална заедница на наставници.";

export const legalUpdated = "30 септември 2026";

export const pages = [
  {
    path: "/",
    title: "Главна табла",
    description: "Преглед на новости, можности, ресурси, календар и разговори за наставници.",
  },
  {
    path: "/profil",
    title: "Мој профил",
    description: "Профил на наставникот: училиште, области, интереси и вештини.",
  },
  {
    path: "/najava",
    title: "Најава",
    description: "Најава за наставници со сметка што ја издава раководителот на клубот.",
    robots: "noindex, nofollow",
  },
  {
    path: "/odjava",
    title: "Одјава",
    description: "Затворање на сесијата на овој уред.",
    robots: "noindex, nofollow",
  },
  {
    path: "/obuki",
    title: "Обуки",
    description: "Отворени, најавени и завршени обуки за професионален развој на наставници.",
  },
  {
    path: "/resursi",
    title: "Ресурси",
    description: "Материјали, водичи и алатки за настава што може да се преземат од платформата.",
  },
  {
    path: "/nastani",
    title: "Настани",
    description: "Претстојни и минати средби, работилници и вебинари на Клубот на наставници.",
  },
  {
    path: "/dokumenti",
    title: "Документи на клубот",
    description: "Папки и документи на програмата, со преземање и поставување во овој прелистувач.",
  },
  {
    path: "/forum",
    title: "Форум",
    description: "Прашања, искуства и идеи меѓу наставници во професионалната заедница.",
  },
  {
    path: "/oglasi",
    title: "Огласна табла",
    description: "Огласи, рокови и можности за наставници во интерната програма.",
  },
  {
    path: "/kalendar",
    title: "Календар",
    description: "Месечен и неделен календар на настани, средби и обуки.",
  },
  {
    path: "/materijali",
    title: "Материјали",
    description: "Видеа и прилози што раководителот ги подготвува за најавените наставници.",
  },
  {
    path: "/admin",
    title: "Админ панел",
    description: "Сметки, видеоматеријали и пошта за раководителот на клубот.",
    robots: "noindex, nofollow",
  },
  {
    path: "/privatnost",
    title: "Политика за приватност",
    description: "Кои податоци ги чува Клубот на наставници, зошто, и кои права ги имате.",
  },
  {
    path: "/uslovi",
    title: "Услови за користење",
    description: "Правила за користење на интерната платформа Клуб на наставници.",
  },
  {
    path: "/kolacinja",
    title: "Политика за колачиња",
    description: "Кои колачиња и локални записи ги користи платформата и како се менува изборот.",
  },
];

export function pageByPath(pathname) {
  if (pathname.startsWith("/resursi/")) {
    const item = resources.find((resource) => pathname === `/resursi/${resource.id}`);
    if (item) return { path: pathname, title: item.title, description: item.detail };
    return {
      path: pathname,
      title: "Ресурсот не е пронајден",
      description: "Бараниот ресурс не постои на платформата Клуб на наставници.",
      robots: "noindex, nofollow",
    };
  }
  if (pathname.startsWith("/forum/") && pathname !== "/forum") {
    const item = topics.find((topic) => pathname === `/forum/${topic.id}`);
    if (item) {
      return {
        path: pathname,
        title: item.title,
        description: `${item.category} · ${item.author}. Дискусија во форумот на Клубот на наставници.`,
      };
    }
    return {
      path: pathname,
      title: "Дискусија",
      description: "Тема од форумот на Клубот на наставници.",
    };
  }
  return pages.find((page) => page.path === pathname) || null;
}
