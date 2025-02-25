/**
 * game service
 */

import axios from "axios";
import slugify from "slugify";
import { factories } from "@strapi/strapi";
import { JSDOM } from "jsdom";

interface Game {
  coverHorizontal: string;
  genres: { name: string }[];
  id: string;
  developers: string[];
  operatingSystems: string[];
  price: {
    finalMoney: {
      amount: string;
    };
  };
  publishers: string[];
  releaseDate: string;
  screenshots: string[];
  slug: string;
  title: string;
}

const CATEGORY_SERVICE = "api::category.category";
const DEVELOPER_SERVICE = "api::developer.developer";
const GAME_SERVICE = "api::game.game";
const PLATAFORM_SERVICE = "api::plataform.plataform";
const PUBLISHER_SERVICE = "api::publisher.publisher";

const treatException = (error) => {
  const { data: { errors = null } = {} } = error;
  return { error, data: errors };
};

const cleanGameDescription = (description: string) => {
  const cleanedDescription = description
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedDescription;
};

const getGameInfo = async (slug: string) => {
  const gogSlug = slug.replace("-", "_").toLowerCase();

  try {
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
      description: cleanGameDescription(description),
      short_description: cleanGameDescription(shortDescription),
      rating,
    };
  } catch (e) {
    console.log("getGameInfo", treatException(e));
  }
};

const getByName = async (name, entityService) => {
  try {
    const {
      results: [findedEntity = null],
    } = await strapi.service(entityService).find({
      filters: { name },
    });

    return findedEntity;
  } catch (e) {
    console.log("getByName", treatException(e));
  }
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

const createAllProductsData = async (games: Game[]) => {
  const categoryNames = new Set<string>();
  const developerNames = new Set<string>();
  const plataformNames = new Set<string>();
  const publisherNames = new Set<string>();

  games.forEach((product) => {
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

const saveGameImages = async ({
  image,
  game,
  field = "cover",
}: {
  image: string;
  game: Game;
  field: "cover" | "gallery";
}) => {
  try {
    const { data } = await axios.get(image, { responseType: "arraybuffer" });
    const buffer = Buffer.from(data, "base64");

    const FormData = require("form-data");

    const formData: any = new FormData();

    formData.append("refId", game.id);
    formData.append("ref", `${GAME_SERVICE}`);
    formData.append("field", field);
    formData.append("files", buffer, { filename: `${game.slug}.jpg` });

    console.info(`Uploading ${field} image: ${game.slug}.jpg`);

    await axios({
      method: "POST",
      url: `http://localhost:1337/api/upload/`,
      data: formData,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
      },
    });
  } catch (e) {
    console.log("saveGameImages", treatException(e));
  }
};

const createGame = async (games: Game[]) => {
  const gamesPromises = games.map(
    async ({
      coverHorizontal,
      developers,
      genres,
      operatingSystems,
      price,
      publishers,
      releaseDate,
      screenshots,
      slug,
      title,
    }) => {
      const createdGame = await getByName(title, GAME_SERVICE);

      if (createdGame) return;

      const additionalGameInfo = await getGameInfo(slug);
      const newGame: Game = await strapi.service(GAME_SERVICE).create({
        data: {
          name: title,
          slug,
          price: price.finalMoney.amount,
          release_date: new Date(releaseDate),
          categories: await Promise.all(
            genres.map(({ name }) => getByName(name, CATEGORY_SERVICE))
          ),
          plataforms: await Promise.all(
            operatingSystems.map((name) => getByName(name, PLATAFORM_SERVICE))
          ),
          developers: await Promise.all(
            developers.map((name) => getByName(name, DEVELOPER_SERVICE))
          ),
          publisher: await Promise.all(
            publishers.map((name) => getByName(name, PUBLISHER_SERVICE))
          ),
          publishedAt: new Date(),
          ...additionalGameInfo,
        },
      });

      await saveGameImages({
        image: coverHorizontal,
        game: newGame,
        field: "cover",
      });

      await Promise.all(
        screenshots.slice(0, 5).map((url) =>
          saveGameImages({
            image: `${url.replace(
              "{formatter}",
              "product_card_v2_mobile_slider_639"
            )}`,
            game: newGame,
            field: "gallery",
          })
        )
      );

      return newGame;
    }
  );

  await Promise.all(gamesPromises);
};

export default factories.createCoreService("api::game.game", () => ({
  populate: async (params) => {
    const gogApiUrl =
      "https://catalog.gog.com/v1/catalog?limit=48&order=desc%3Atrending";

    const {
      data: { products: games },
    } = await axios.get<{ products: Game[] }>(gogApiUrl);

    await createAllProductsData([games[0]]);
    await createGame([games[0]]);
  },
}));
