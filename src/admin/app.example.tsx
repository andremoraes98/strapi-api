import type { StrapiApp } from "@strapi/strapi/admin";

export default {
  config: {
    locales: [],
    tutorials: false,
    notifications: { releases: false },
  },
  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
