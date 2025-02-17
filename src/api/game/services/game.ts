/**
 * game service
 */

import { factories } from "@strapi/strapi";
import axios from "axios";
import { JSDOM } from "jsdom";

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

export default factories.createCoreService("api::game.game", () => ({
  populate: async (params) => {
    const gogApiUrl =
      "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Atrending";

    const {
      data: {
        products: [{ slug }],
      },
    } = await axios({ method: "GET", url: gogApiUrl });

    const teste = await getGameInfo(slug);
    console.log(teste);
  },
}));
