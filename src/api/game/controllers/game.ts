/**
 * game controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::game.game",
  ({ strapi }) => ({
    populate: async (ctx) => {
      const queryOptions = {
        limit: 48,
        order: "desc:trending",
        ...ctx.query,
      };

      await strapi.service("api::game.game").populate(queryOptions);

      ctx.send("FINALIZADO \n");
    },
  })
);
