import store from '@jeromyfu/app-store-scraper';
import gplay from '@jeromyfu/google-play-scraper';

export const functionDeclarations = [
  {
    name: "app_store_search",
    description:
      "Search for apps on the App Store. Returns a list of apps with details like ID, bundle ID, title, icon, URL, price, description, developer, genre, and release date.",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "Search term (required)",
        },
        num: {
          type: "integer",
          description: "Number of results to retrieve (default: 50)",
        },
        page: {
          type: "integer",
          description: "Page of results to retrieve (default: 1)",
        },
        country: {
          type: "string",
          description: "Two letter country code (default: us)",
        },
        lang: {
          type: "string",
          description: "Language code for result text (default: en-us)",
        },
        idsOnly: {
          type: "boolean",
          description:
            "Skip extra lookup request. Returns array of application IDs only (default: false)",
        },
      },
      required: ["term"],
    },
  },
];

export const availableFunctions = {
  app_store_search: async ({ term, num = 50, page = 1, country = "us", lang = "en-us", idsOnly = false }) => {
    try {
      const results = await store.search({ term, num, page, country, lang, idsOnly });
      return results;
    } catch (error) {
      console.error('Error in app_store_search:', error);
      return { error: 'Failed to search App Store', details: error.message };
    }
  },
};
