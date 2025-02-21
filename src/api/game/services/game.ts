/**
 * game service
 */

import axios from "axios";
import slugify from "slugify";
import { factories } from "@strapi/strapi";
import { JSDOM } from "jsdom";

interface Product {
  genres: { name: string }[];
  developers: string[];
  operatingSystems: string[];
  publishers: string[];
}

const DEVELOPER_SERVICE = "api::developer.developer";
const PUBLISHER_SERVICE = "api::publisher.publisher";
const CATEGORY_SERVICE = "api::category.category";
const PLATAFORM_SERVICE = "api::plataform.plataform";

const getGameInfo = async (slug: string) => {
  const gogSlug = slug.replace("-", "_").toLowerCase();

  const { data } = await axios.get(`https://www.gog.com/game/${gogSlug}`);
  const {
    window: { document },
  } = new JSDOM(data);
  const rawDescription = document.querySelector(".description");
  const description = rawDescription.innerHTML;
  const shortDescription = rawDescription.textContent.slice(0, 160);

  const ratingElement = document.querySelector(".age-restrictions__icon use");
  const rating = ratingElement
    ? ratingElement
        .getAttribute("xlink:href")
        .replace(/_/g, "")
        .replace("#", "")
    : "BR0";

  return {
    description,
    shortDescription,
    rating,
  };
};

const getByName = async (name, entityService) => {
  const {
    results: [findedEntity = null],
  } = await strapi.service(entityService).find({
    filters: { name },
  });

  return findedEntity;
};

const createSimpleInstance = async (name, entityService) => {
  const hasItem = await getByName(name, entityService);

  if (hasItem) return;

  await strapi.service(entityService).create({
    data: {
      name,
      slug: slugify(name, { strict: true, lower: true }),
    },
  });
};

const createAllProductsData = async (products: Product[]) => {
  const categoryNames = new Set<string>();
  const developerNames = new Set<string>();
  const plataformNames = new Set<string>();
  const publisherNames = new Set<string>();

  products.forEach((product) => {
    const {
      genres: categories,
      developers,
      operatingSystems: plataforms,
      publishers,
    } = product;

    categories.forEach(({ name: categoryName }) =>
      categoryNames.add(categoryName)
    );
    developers.forEach((developerName) => developerNames.add(developerName));
    plataforms.forEach((plataformName) => plataformNames.add(plataformName));
    publishers.forEach((publisherName) => publisherNames.add(publisherName));
  });

  const createFromNames = (set: Set<string>, entityService) =>
    Array.from(set).map((name) => createSimpleInstance(name, entityService));

  await Promise.all([
    ...createFromNames(categoryNames, CATEGORY_SERVICE),
    ...createFromNames(developerNames, DEVELOPER_SERVICE),
    ...createFromNames(plataformNames, PLATAFORM_SERVICE),
    ...createFromNames(publisherNames, PUBLISHER_SERVICE),
  ]);
};

export default factories.createCoreService("api::game.game", () => ({
  populate: async (params) => {
    const gogApiUrl =
      "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Atrending";

    const {
      data: { products },
    } = await axios.get<{ products: Product[] }>(gogApiUrl);

    createAllProductsData([products[2], products[3]]);
  },
}));
