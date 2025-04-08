import store from '@jeromyfu/app-store-scraper';
import gplay from '@jeromyfu/google-play-scraper';

export const functionDeclarations = [
  {
    name: "app_store_search",
    description:
      "Search for apps on the App Store. Returns a list of apps with the following fields:\n" +
      "- id: App Store ID number\n" +
      "- appId: Bundle ID (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- icon: Icon image URL\n" +
      "- url: App Store URL\n" +
      "- price: Price in USD\n" +
      "- currency: Price currency code\n" +
      "- free: Boolean indicating if app is free\n" +
      "- description: App description\n" +
      "- developer: Developer name\n" +
      "- developerUrl: Developer's App Store URL\n" +
      "- developerId: Developer's ID\n" +
      "- genre: App category name\n" +
      "- genreId: Category ID\n" +
      "- released: Release date (ISO string)",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "Search term (required)",
        },
        num: {
          type: "integer",
          description: "Number of results to retrieve",
        },
        page: {
          type: "integer",
          description: "Page of results to retrieve",
        },
        country: {
          type: "string",
          description: "Two letter country code",
        },
        lang: {
          type: "string",
          description: "Language code for result text",
        },
        idsOnly: {
          type: "boolean",
          description:
            "Skip extra lookup request. Returns array of application IDs only",
        },
      },
    },
  },
  {
    name: "app_store_details",
    description:
      "Get detailed information about an App Store app. Returns an object with:\n" +
      "- id: App Store ID number\n" +
      "- appId: Bundle ID (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- url: App Store URL\n" +
      "- description: Full app description\n" +
      "- icon: Icon URL\n" +
      "- genres: Array of category names\n" +
      "- genreIds: Array of category IDs\n" +
      "- primaryGenre: Main category name\n" +
      "- primaryGenreId: Main category ID\n" +
      "- contentRating: Content rating (e.g. '4+')\n" +
      "- languages: Array of language codes\n" +
      "- size: App size in bytes\n" +
      "- requiredOsVersion: Minimum iOS version required\n" +
      "- released: Initial release date (ISO string)\n" +
      "- updated: Last update date (ISO string)\n" +
      "- releaseNotes: Latest version changes\n" +
      "- version: Current version string\n" +
      "- price: Price in USD\n" +
      "- currency: Price currency code\n" +
      "- free: Boolean indicating if app is free\n" +
      "- developerId: Developer's ID\n" +
      "- developer: Developer name\n" +
      "- developerUrl: Developer's App Store URL\n" +
      "- developerWebsite: Developer's website URL if available\n" +
      "- score: Current rating (0-5)\n" +
      "- reviews: Total number of ratings\n" +
      "- currentVersionScore: Current version rating (0-5)\n" +
      "- currentVersionReviews: Current version review count\n" +
      "- screenshots: Array of screenshot URLs\n" +
      "- ipadScreenshots: Array of iPad screenshot URLs\n" +
      "- appletvScreenshots: Array of Apple TV screenshot URLs\n" +
      "- supportedDevices: Array of supported device IDs\n" +
      "- ratings: Total number of ratings (when ratings option enabled)\n" +
      "- histogram: Rating distribution by star level (when ratings option enabled)",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 553834731). Either this or appId must be provided."
        },
        appId: {
          type: "string",
          description: "Bundle ID (e.g., 'com.midasplayer.apps.candycrushsaga'). Either this or id must be provided."
        },
        country: {
          type: "string",
          description: "Country code to get app details from. Also affects data language."
        },
        lang: {
          type: "string",
          description: "Language code for result text. If not provided, uses country-specific language."
        },
        ratings: {
          type: "boolean",
          description: "Load additional ratings information like ratings count and histogram"
        }
      }
    }
  },
  {
    name: "app_store_reviews",
    description:
      "Get reviews for an App Store app. Returns an array of reviews with:\n" +
      "- id: Review ID\n" +
      "- userName: Reviewer's name\n" +
      "- userUrl: Reviewer's profile URL\n" +
      "- version: App version reviewed\n" +
      "- score: Rating (1-5)\n" +
      "- title: Review title\n" +
      "- text: Review content\n" +
      "- url: Review URL\n" +
      "- updated: Review date (ISO string)",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 553834731). Either this or appId must be provided."
        },
        appId: {
          type: "string",
          description: "Bundle ID (e.g., 'com.midasplayer.apps.candycrushsaga'). Either this or id must be provided."
        },
        country: {
          type: "string",
          description: "Country code to get reviews from"
        },
        page: {
          type: "number",
          description: "Page number to retrieve",
          minimum: 1,
          maximum: 10
        },
        sort: {
          type: "string",
          description: "Sort order (recent or helpful)",
          enum: ["recent", "helpful"]
        }
      }
    }
  },
  {
    name: "app_store_similar",
    description:
      "Get similar apps ('customers also bought') from the App Store. Returns a list of apps with:\n" +
      "- id: App Store ID number\n" +
      "- appId: Bundle ID (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- icon: Icon image URL\n" +
      "- url: App Store URL\n" +
      "- price: Price in USD\n" +
      "- currency: Price currency code\n" +
      "- free: Boolean indicating if app is free\n" +
      "- description: App description\n" +
      "- developer: Developer name\n" +
      "- developerUrl: Developer's App Store URL\n" +
      "- developerId: Developer's ID\n" +
      "- genre: App category name\n" +
      "- genreId: Category ID\n" +
      "- released: Release date (ISO string)",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 553834731). Either this or appId must be provided."
        },
        appId: {
          type: "string",
          description: "Bundle ID (e.g., 'com.midasplayer.apps.candycrushsaga'). Either this or id must be provided."
        }
      }
    }
  },
  {
    name: "app_store_developer",
    description:
      "Get apps by a developer on the App Store. Returns a list of apps with:\n" +
      "- id: App Store ID number\n" +
      "- appId: Bundle ID (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- icon: Icon image URL\n" +
      "- url: App Store URL\n" +
      "- price: Price in USD\n" +
      "- currency: Price currency code\n" +
      "- free: Boolean indicating if app is free\n" +
      "- description: App description\n" +
      "- developer: Developer name\n" +
      "- developerUrl: Developer's App Store URL\n" +
      "- developerId: Developer's ID\n" +
      "- genre: App category name\n" +
      "- genreId: Category ID\n" +
      "- released: Release date (ISO string)",
    parameters: {
      type: "object",
      properties: {
        devId: {
          type: "string",
          description: "iTunes artist ID of the developer (e.g., 284882218 for Facebook)"
        },
        country: {
          type: "string",
          description: "Country code to get app details from. Also affects data language."
        },
        lang: {
          type: "string",
          description: "Language code for result text. If not provided, uses country-specific language."
        }
      }
    }
  },
  {
    name: "app_store_suggest",
    description:
      "Get search suggestions from the App Store. Returns an array of objects with:\n" +
      "- term: Suggested search term\n" +
      "Each suggestion has a priority from 0 (low traffic) to 10000 (most searched)",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "Search term to get suggestions for"
        }
      }
    }
  },
  {
    name: "app_store_ratings",
    description:
      "Get ratings for an App Store app. Returns an object with:\n" +
      "- ratings: Total number of ratings\n" +
      "- histogram: Distribution of ratings by star level (1-5)",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 553834731). Either this or appId must be provided."
        },
        appId: {
          type: "string",
          description: "Bundle ID (e.g., 'com.midasplayer.apps.candycrushsaga'). Either this or id must be provided."
        },
        country: {
          type: "string",
          description: "Country code to get ratings from"
        }
      }
    }
  },
  {
    name: "app_store_version_history",
    description:
      "Get version history for an App Store app. Returns an array of versions with:\n" +
      "- versionDisplay: Version number string\n" +
      "- releaseNotes: Update description\n" +
      "- releaseDate: Release date (YYYY-MM-DD)\n" +
      "- releaseTimestamp: Release date and time (ISO string)",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 444934666)"
        }
      }
    }
  },
  {
    name: "app_store_privacy",
    description:
      "Get privacy details for an App Store app. Returns an object with:\n" +
      "- managePrivacyChoicesUrl: URL to manage privacy choices (if available)\n" +
      "- privacyTypes: Array of privacy data types, each containing:\n" +
      "  - privacyType: Name of the privacy category\n" +
      "  - identifier: Unique identifier for the privacy type\n" +
      "  - description: Detailed description of how data is used\n" +
      "  - dataCategories: Array of data categories, each containing:\n" +
      "    - dataCategory: Category name\n" +
      "    - identifier: Category identifier\n" +
      "    - dataTypes: Array of specific data types collected\n" +
      "  - purposes: Array of purposes for data collection\n" +
      "Note: Currently only available for US App Store.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Numeric App ID (e.g., 553834731)"
        }
      }
    }
  },
  {
    name: "app_store_list",
    description:
      "Get apps from iTunes collections. Returns a list of apps with:\n" +
      "- id: App Store ID number\n" +
      "- appId: Bundle ID (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- icon: Icon image URL\n" +
      "- url: App Store URL\n" +
      "- price: Price in USD\n" +
      "- currency: Price currency code\n" +
      "- free: Boolean indicating if app is free\n" +
      "- description: App description\n" +
      "- developer: Developer name\n" +
      "- developerUrl: Developer's App Store URL\n" +
      "- developerId: Developer's ID\n" +
      "- genre: App category name\n" +
      "- genreId: Category ID\n" +
      "- released: Release date (ISO string)",
    parameters: {
      type: "object",
      properties: {
        collection: {
          type: "string",
          enum: [
            'newapplications',
            'newfreeapplications',
            'newpaidapplications',
            'topfreeapplications',
            'topfreeipadapplications',
            'topgrossingapplications',
            'topgrossingipadapplications',
            'toppaidapplications',
            'toppaidipadapplications'
          ],
          description: "Collection to fetch from. Available collections:\n" +
            "- newapplications: New iOS applications\n" +
            "- newfreeapplications: New free iOS applications\n" +
            "- newpaidapplications: New paid iOS applications\n" +
            "- topfreeapplications: Top free iOS applications\n" +
            "- topfreeipadapplications: Top free iPad applications\n" +
            "- topgrossingapplications: Top grossing iOS applications\n" +
            "- topgrossingipadapplications: Top grossing iPad applications\n" +
            "- toppaidapplications: Top paid iOS applications\n" +
            "- toppaidipadapplications: Top paid iPad applications"
        },
        category: {
          type: "number",
          description: "Category ID to filter by. Available categories:\n" +
            "Main Categories:\n" +
            "- 6000: BUSINESS\n" +
            "- 6001: WEATHER\n" +
            "- 6002: UTILITIES\n" +
            "- 6003: TRAVEL\n" +
            "- 6004: SPORTS\n" +
            "- 6005: SOCIAL_NETWORKING\n" +
            "- 6006: REFERENCE\n" +
            "- 6007: PRODUCTIVITY\n" +
            "- 6008: PHOTO_AND_VIDEO\n" +
            "- 6009: NEWS\n" +
            "- 6010: NAVIGATION\n" +
            "- 6011: MUSIC\n" +
            "- 6012: LIFESTYLE\n" +
            "- 6013: HEALTH_AND_FITNESS\n" +
            "- 6014: GAMES\n" +
            "- 6015: FINANCE\n" +
            "- 6016: ENTERTAINMENT\n" +
            "- 6017: EDUCATION\n" +
            "- 6018: BOOKS\n" +
            "- 6020: MEDICAL\n" +
            "- 6021: MAGAZINES_AND_NEWSPAPERS\n" +
            "- 6022: CATALOGS\n" +
            "- 6023: FOOD_AND_DRINK\n" +
            "- 6024: SHOPPING\n\n" +
            "Games Subcategories:\n" +
            "- 7001: ACTION\n" +
            "- 7002: ADVENTURE\n" +
            "- 7003: ARCADE\n" +
            "- 7004: BOARD\n" +
            "- 7005: CARD\n" +
            "- 7006: CASINO\n" +
            "- 7007: DICE\n" +
            "- 7008: EDUCATIONAL\n" +
            "- 7009: FAMILY\n" +
            "- 7011: MUSIC\n" +
            "- 7012: PUZZLE\n" +
            "- 7013: RACING\n" +
            "- 7014: ROLE_PLAYING\n" +
            "- 7015: SIMULATION\n" +
            "- 7016: SPORTS\n" +
            "- 7017: STRATEGY\n" +
            "- 7018: TRIVIA\n" +
            "- 7019: WORD\n\n" +
            "Magazine Subcategories:\n" +
            "- 13001: POLITICS\n" +
            "- 13002: FASHION\n" +
            "- 13003: HOME\n" +
            "- 13004: OUTDOORS\n" +
            "- 13005: SPORTS\n" +
            "- 13006: AUTOMOTIVE\n" +
            "- 13007: ARTS\n" +
            "- 13008: WEDDINGS\n" +
            "- 13009: BUSINESS\n" +
            "- 13010: CHILDREN\n" +
            "- 13011: COMPUTER\n" +
            "- 13012: FOOD\n" +
            "- 13013: CRAFTS\n" +
            "- 13014: ELECTRONICS\n" +
            "- 13015: ENTERTAINMENT\n" +
            "- 13017: HEALTH\n" +
            "- 13018: HISTORY\n" +
            "- 13019: LITERARY\n" +
            "- 13020: MEN\n" +
            "- 13021: MOVIES_AND_MUSIC\n" +
            "- 13023: FAMILY\n" +
            "- 13024: PETS\n" +
            "- 13025: PROFESSIONAL\n" +
            "- 13026: REGIONAL\n" +
            "- 13027: SCIENCE\n" +
            "- 13028: TEENS\n" +
            "- 13029: TRAVEL\n" +
            "- 13030: WOMEN"
        },
        lang: {
          type: "string",
          description: "Language code for result text. If not provided, uses country-specific language."
        },
        fullDetail: {
          type: "boolean",
          description: "Get full app details including ratings, reviews etc"
        },
        country: {
          type: "string",
          description: "Country code"
        },
        num: {
          type: "number",
          description: "Number of results",
          maximum: 200
        }
      }
    }
  },
  {
    name: "google_play_search",
    description:
      "Search for apps on Google Play. Returns a list of apps with:\n" +
      "- title: App name\n" +
      "- appId: Package name (e.g. 'com.company.app')\n" +
      "- url: Play Store URL\n" +
      "- icon: Icon image URL\n" +
      "- developer: Developer name\n" +
      "- developerId: Developer ID\n" +
      "- priceText: Price display text\n" +
      "- free: Boolean indicating if app is free\n" +
      "- summary: Short description\n" +
      "- scoreText: Rating display text\n" +
      "- score: Rating (0-5)",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "Search term to query apps"
        },
        price: {
          type: "string",
          enum: ["all", "free", "paid"],
          description: "Filter by price: all, free, or paid"
        },
        num: {
          type: "number",
          description: "Number of results to retrieve"
        },
        lang: {
          type: "string",
          description: "Language code for result text"
        },
        country: {
          type: "string",
          description: "Country code to get results from"
        },
        fullDetail: {
          type: "boolean",
          description: "Include full app details in results"
        }
      }
    }
  },
  {
    name: "google_play_details",
    description:
      "Get detailed information about a Google Play app. Returns an object with:\n" +
      "- title: App name\n" +
      "- description: Full app description\n" +
      "- descriptionHTML: Description with HTML formatting\n" +
      "- summary: Short description\n" +
      "- installs: Install count range\n" +
      "- minInstalls: Minimum install count\n" +
      "- maxInstalls: Maximum install count\n" +
      "- score: Average rating (0-5)\n" +
      "- scoreText: Rating display text\n" +
      "- ratings: Total number of ratings\n" +
      "- reviews: Total number of reviews\n" +
      "- histogram: Rating distribution by star level\n" +
      "- price: Price in local currency\n" +
      "- free: Boolean indicating if app is free\n" +
      "- currency: Price currency code\n" +
      "- priceText: Formatted price string\n" +
      "- offersIAP: Boolean indicating in-app purchases\n" +
      "- IAPRange: Price range for in-app purchases\n" +
      "- androidVersion: Minimum Android version required\n" +
      "- androidVersionText: Formatted Android version text\n" +
      "- developer: Developer name\n" +
      "- developerId: Developer ID\n" +
      "- developerEmail: Developer contact email\n" +
      "- developerWebsite: Developer website URL\n" +
      "- developerAddress: Developer physical address\n" +
      "- genre: App category\n" +
      "- genreId: Category ID\n" +
      "- icon: Icon URL\n" +
      "- headerImage: Feature graphic URL\n" +
      "- screenshots: Array of screenshot URLs\n" +
      "- contentRating: Content rating (e.g. 'Everyone')\n" +
      "- contentRatingDescription: Content rating details\n" +
      "- adSupported: Boolean indicating if app shows ads\n" +
      "- released: Release date\n" +
      "- updated: Last update date\n" +
      "- version: Current version string\n" +
      "- recentChanges: Latest version changes\n" +
      "- preregister: Boolean indicating if app is in pre-registration\n" +
      "- editorsChoice: Boolean indicating Editor's Choice status\n" +
      "- features: Array of special features",
    parameters: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Google Play package name (e.g., 'com.google.android.apps.translate')"
        },
        lang: {
          type: "string",
          description: "Language code for result text"
        },
        country: {
          type: "string",
          description: "Country code to check app availability"
        }
      }
    }
  },
  {
    name: "google_play_reviews",
    description:
      "Get reviews for a Google Play app. Returns an array of reviews with:\n" +
      "- id: Review ID string\n" +
      "- userName: Reviewer's name\n" +
      "- userImage: Reviewer's profile image URL\n" +
      "- date: Review date (ISO string)\n" +
      "- score: Rating (1-5)\n" +
      "- scoreText: Rating display text\n" +
      "- title: Review title\n" +
      "- text: Review content\n" +
      "- url: Review URL\n" +
      "- version: App version reviewed\n" +
      "- thumbsUp: Number of thumbs up votes\n" +
      "- replyDate: Developer reply date (if any)\n" +
      "- replyText: Developer reply content (if any)\n" +
      "- criterias: Array of rating criteria (if any)\n" +
      "\nNote: Reviews are returned in the specified language. The total review count\n" +
      "shown in Google Play refers to ratings, not written reviews.",
    parameters: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Package name of the app (e.g., 'com.mojang.minecraftpe')"
        },
        lang: {
          type: "string",
          description: "Language code for reviews"
        },
        country: {
          type: "string",
          description: "Country code"
        },
        sort: {
          type: "string",
          enum: ["newest", "rating", "helpfulness"],
          description: "Sort order: newest, rating, or helpfulness"
        },
        num: {
          type: "number",
          description: "Number of reviews to retrieve. Ignored if paginate is true."
        },
        paginate: {
          type: "boolean",
          description: "Enable pagination with 150 reviews per page"
        },
        nextPaginationToken: {
          type: "string",
          description: "Token for fetching next page of reviews"
        }
      }
    }
  },
  {
    name: "google_play_similar",
    description:
      "Get similar apps from Google Play. Returns a list of apps with:\n" +
      "- url: Play Store URL\n" +
      "- appId: Package name (e.g. 'com.company.app')\n" +
      "- summary: Short description\n" +
      "- developer: Developer name\n" +
      "- developerId: Developer ID\n" +
      "- icon: Icon image URL\n" +
      "- score: Rating (0-5)\n" +
      "- scoreText: Rating display text\n" +
      "- priceText: Price display text\n" +
      "- free: Boolean indicating if app is free\n",
    parameters: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Google Play package name (e.g., 'com.dxco.pandavszombies')"
        },
        lang: {
          type: "string",
          description: "Language code for result text"
        },
        country: {
          type: "string",
          description: "Country code to get results from"
        },
        fullDetail: {
          type: "boolean",
          description: "Include full app details in results, If fullDetail is true, includes all fields from app details endpoint."
        }
      }
    }
  },
  {
    name: "google_play_developer",
    description:
      "Get apps by a developer on Google Play. Returns a list of apps with:\n" +
      "- url: Play Store URL\n" +
      "- appId: Package name (e.g. 'com.company.app')\n" +
      "- title: App name\n" +
      "- summary: Short app description\n" +
      "- developer: Developer name\n" +
      "- developerId: Developer ID\n" +
      "- icon: Icon image URL\n" +
      "- score: Rating (0-5)\n" +
      "- scoreText: Rating display text\n" +
      "- priceText: Price display text\n" +
      "- free: Boolean indicating if app is free\n",
    parameters: {
      type: "object",
      properties: {
        devId: {
          type: "string",
          description: "Developer name (e.g., 'DxCo Games')"
        },
        lang: {
          type: "string",
          description: "Language code for result text"
        },
        country: {
          type: "string",
          description: "Country code to get results from"
        },
        num: {
          type: "number",
          description: "Number of results to retrieve"
        },
        fullDetail: {
          type: "boolean",
          description: "Include full app details in results, If fullDetail is true, includes all fields from app details endpoint."
        }
      }
    }
  },
  {
    name: "google_play_suggest",
    description: "Get search suggestions from Google Play. Returns an array of suggested search terms (up to 5).\n" +
      "Sample response: ['panda pop', 'panda', 'panda games', 'panda run', 'panda pop for free']",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "Search term to get suggestions for (e.g., 'panda')"
        },
        lang: {
          type: "string",
          description: "Language code for suggestions"
        },
        country: {
          type: "string",
          description: "Country code to get suggestions from"
        }
      }
    }
  },
  {
    name: "google_play_permissions",
    description: "Get permissions required by a Google Play app. Returns a list of permissions with:\n" +
      "- permission: Description of the permission (e.g., 'modify storage contents')\n" +
      "- type: Permission category (e.g., 'Storage', 'Network')\n\n" +
      "When short=true, returns just an array of permission strings.\n" +
      "Note: Permissions are returned in the specified language.",
    parameters: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Google Play package name (e.g., 'com.dxco.pandavszombies')"
        },
        lang: {
          type: "string",
          description: "Language code for permission text"
        },
        country: {
          type: "string",
          description: "Country code to check app"
        },
        short: {
          type: "boolean",
          description: "Return only permission names without categories"
        }
      }
    }
  },
  {
    name: "google_play_datasafety",
    description: "Get data safety information for a Google Play app. Returns an object with:\n" +
      "- dataShared: Array of shared data items, each containing:\n" +
      "  - data: Name of the data being shared (e.g., 'User IDs')\n" +
      "  - optional: Boolean indicating if sharing is optional\n" +
      "  - purpose: Comma-separated list of purposes (e.g., 'Analytics, Marketing')\n" +
      "  - type: Category of data (e.g., 'Personal info')\n" +
      "- dataCollected: Array of collected data items with same structure as dataShared\n" +
      "- securityPractices: Array of security practices, each containing:\n" +
      "  - practice: Name of the security practice\n" +
      "  - description: Detailed description of the practice\n" +
      "- privacyPolicyUrl: URL to the app's privacy policy\n\n" +
      "Data types can include: Personal info, Financial info, Messages, Contacts,\n" +
      "App activity, App info and performance, Device or other IDs",
    parameters: {
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Google Play package name (e.g., 'com.dxco.pandavszombies')"
        },
        lang: {
          type: "string",
          description: "Language code for data safety info"
        }
      }
    }
  },
  {
    name: "google_play_categories",
    description: "Get list of all Google Play categories. Returns an array of category identifiers like:\n" +
      "- 'APPLICATION': All applications\n" +
      "- 'GAME': All games\n" +
      "- 'ANDROID_WEAR': Wear OS apps\n" +
      "- 'SOCIAL': Social apps\n" +
      "- 'PRODUCTIVITY': Productivity apps\n" +
      "etc.\n\n" +
      "These category IDs can be used with the google-play-list tool to filter apps by category.\n" +
      "Sample response: ['AUTO_AND_VEHICLES', 'LIBRARIES_AND_DEMO', 'LIFESTYLE', ...]",
    parameters: {
      type: "object",
      properties: {} // No parameters needed
    }
  },
  {
    name: "google_play_list",
    description:
      "Get apps from Google Play collections. Returns a list of apps with:\n" +
      "- url: Play Store URL\n" +
      "- appId: Package name (e.g., 'com.company.app')\n" +
      "- title: App name\n" +
      "- summary: Short description\n" +
      "- developer: Developer name\n" +
      "- developerId: Developer ID\n" +
      "- icon: Icon URL\n" +
      "- score: Rating (0-5)\n" +
      "- scoreText: Rating display text\n" +
      "- priceText: Price display text\n" +
      "- free: Boolean indicating if app is free\n\n" +
      "When fullDetail is true, includes all fields from app details endpoint.",
    parameters: {
      type: "object",
      properties: {
        collection: {
          type: "string",
          enum: ['TOP_FREE', 'TOP_PAID', 'GROSSING', 'TOP_FREE_GAMES', 'TOP_PAID_GAMES', 'TOP_GROSSING_GAMES'],
          description: "Collection to fetch apps from. Available collections:\n" +
                      "- TOP_FREE: Top free applications\n" +
                      "- TOP_PAID: Top paid applications\n" +
                      "- GROSSING: Top grossing applications"
        },
        category: {
          type: "string",
          enum: [
            'APPLICATION', 'ANDROID_WEAR', 'ART_AND_DESIGN', 'AUTO_AND_VEHICLES',
            'BEAUTY', 'BOOKS_AND_REFERENCE', 'BUSINESS', 'COMICS', 'COMMUNICATION',
            'DATING', 'EDUCATION', 'ENTERTAINMENT', 'EVENTS', 'FINANCE',
            'FOOD_AND_DRINK', 'HEALTH_AND_FITNESS', 'HOUSE_AND_HOME',
            'LIBRARIES_AND_DEMO', 'LIFESTYLE', 'MAPS_AND_NAVIGATION', 'MEDICAL',
            'MUSIC_AND_AUDIO', 'NEWS_AND_MAGAZINES', 'PARENTING', 'PERSONALIZATION',
            'PHOTOGRAPHY', 'PRODUCTIVITY', 'SHOPPING', 'SOCIAL', 'SPORTS', 'TOOLS',
            'TRAVEL_AND_LOCAL', 'VIDEO_PLAYERS', 'WATCH_FACE', 'WEATHER', 'GAME',
            'GAME_ACTION', 'GAME_ADVENTURE', 'GAME_ARCADE', 'GAME_BOARD',
            'GAME_CARD', 'GAME_CASINO', 'GAME_CASUAL', 'GAME_EDUCATIONAL',
            'GAME_MUSIC', 'GAME_PUZZLE', 'GAME_RACING', 'GAME_ROLE_PLAYING',
            'GAME_SIMULATION', 'GAME_SPORTS', 'GAME_STRATEGY', 'GAME_TRIVIA',
            'GAME_WORD', 'FAMILY'
          ],
          description: "Category to filter by. Available categories:\n" +
                      "Main Categories:\n" +
                      "- APPLICATION: All applications\n" +
                      "- ANDROID_WEAR: Wear OS apps\n" +
                      "- ART_AND_DESIGN: Art & Design\n" +
                      "- AUTO_AND_VEHICLES: Auto & Vehicles\n" +
                      "- BEAUTY: Beauty\n" +
                      "- BOOKS_AND_REFERENCE: Books & Reference\n" +
                      "- BUSINESS: Business\n" +
                      "- COMICS: Comics\n" +
                      "- COMMUNICATION: Communication\n" +
                      "- DATING: Dating\n" +
                      "- EDUCATION: Education\n" +
                      "- ENTERTAINMENT: Entertainment\n" +
                      "- EVENTS: Events\n" +
                      "- FINANCE: Finance\n" +
                      "- FOOD_AND_DRINK: Food & Drink\n" +
                      "- HEALTH_AND_FITNESS: Health & Fitness\n" +
                      "- HOUSE_AND_HOME: House & Home\n" +
                      "- LIBRARIES_AND_DEMO: Libraries & Demo\n" +
                      "- LIFESTYLE: Lifestyle\n" +
                      "- MAPS_AND_NAVIGATION: Maps & Navigation\n" +
                      "- MEDICAL: Medical\n" +
                      "- MUSIC_AND_AUDIO: Music & Audio\n" +
                      "- NEWS_AND_MAGAZINES: News & Magazines\n" +
                      "- PARENTING: Parenting\n" +
                      "- PERSONALIZATION: Personalization\n" +
                      "- PHOTOGRAPHY: Photography\n" +
                      "- PRODUCTIVITY: Productivity\n" +
                      "- SHOPPING: Shopping\n" +
                      "- SOCIAL: Social\n" +
                      "- SPORTS: Sports\n" +
                      "- TOOLS: Tools\n" +
                      "- TRAVEL_AND_LOCAL: Travel & Local\n" +
                      "- VIDEO_PLAYERS: Video Players\n" +
                      "- WATCH_FACE: Watch Faces\n" +
                      "- WEATHER: Weather\n\n" +
                      "Game Categories:\n" +
                      "- GAME: All Games\n" +
                      "- GAME_ACTION: Action Games\n" +
                      "- GAME_ADVENTURE: Adventure Games\n" +
                      "- GAME_ARCADE: Arcade Games\n" +
                      "- GAME_BOARD: Board Games\n" +
                      "- GAME_CARD: Card Games\n" +
                      "- GAME_CASINO: Casino Games\n" +
                      "- GAME_CASUAL: Casual Games\n" +
                      "- GAME_EDUCATIONAL: Educational Games\n" +
                      "- GAME_MUSIC: Music Games\n" +
                      "- GAME_PUZZLE: Puzzle Games\n" +
                      "- GAME_RACING: Racing Games\n" +
                      "- GAME_ROLE_PLAYING: Role Playing Games\n" +
                      "- GAME_SIMULATION: Simulation Games\n" +
                      "- GAME_SPORTS: Sports Games\n" +
                      "- GAME_STRATEGY: Strategy Games\n" +
                      "- GAME_TRIVIA: Trivia Games\n" +
                      "- GAME_WORD: Word Games\n" +
                      "- FAMILY: Family Games"
        },
        age: {
          type: "string",
          enum: ['FIVE_UNDER', 'SIX_EIGHT', 'NINE_UP'],
          description: "Age range filter (only for FAMILY category). Options: FIVE_UNDER, SIX_EIGHT, NINE_UP"
        },
        num: {
          type: "number",
          description: "Number of apps to retrieve"
        },
        lang: {
          type: "string",
          description: "Language code for result text"
        },
        country: {
          type: "string",
          description: "Country code to get results from"
        },
        fullDetail: {
          type: "boolean",
          description: "Include full app details in results"
        }
      }
    }
  }
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
  app_store_details: async ({ id, appId, country = 'us', lang, ratings = false }) => {
    try {
      const details = await store.app({
        id,
        appId,
        country,
        lang,
        ratings
      });
      return details;
    } catch (error) {
      console.error('Error in app_store_details:', error);
      return { error: 'Failed to fetch App Store details', details: error.message };
    }
  },
  app_store_reviews: async ({ id, appId, country = 'us', page = 1, sort = 'recent' }) => {
    try {
      const reviews = await store.reviews({
        id,
        appId,
        country,
        page,
        sort: sort === "helpful" ? store.sort.HELPFUL : store.sort.RECENT
      });
      return reviews;
    } catch (error) {
      console.error('Error in app_store_reviews:', error);
      return { error: 'Failed to fetch App Store reviews', details: error.message };
    }
  },
  app_store_similar: async ({ id, appId }) => {
    try {
      const similar = await store.similar({ id, appId });
      return similar;
    } catch (error) {
      console.error('Error in app_store_similar:', error);
      return { error: 'Failed to fetch similar apps', details: error.message };
    }
  },
  app_store_developer: async ({ devId, country = 'us', lang }) => {
    try {
      const apps = await store.developer({ devId, country, lang });
      return apps;
    } catch (error) {
      console.error('Error in app_store_developer:', error);
      return { error: 'Failed to fetch developer apps', details: error.message };
    }
  },
  app_store_suggest: async ({ term }) => {
    try {
      const suggestions = await store.suggest({ term });
      return suggestions;
    } catch (error) {
      console.error('Error in app_store_suggest:', error);
      return { error: 'Failed to fetch suggestions', details: error.message };
    }
  },
  app_store_ratings: async ({ id, appId, country = 'us' }) => {
    try {
      const ratings = await store.ratings({ id, appId, country });
      return ratings;
    } catch (error) {
      console.error('Error in app_store_ratings:', error);
      return { error: 'Failed to fetch ratings', details: error.message };
    }
  },
  app_store_version_history: async ({ id }) => {
    try {
      const history = await store.versionHistory({ id });
      return history;
    } catch (error) {
      console.error('Error in app_store_version_history:', error);
      return { error: 'Failed to fetch version history', details: error.message };
    }
  },
  app_store_privacy: async ({ id }) => {
    try {
      const privacy = await store.privacy({ id });
      return privacy;
    } catch (error) {
      console.error('Error in app_store_privacy:', error);
      return { error: 'Failed to fetch privacy details', details: error.message };
    }
  },
  app_store_list: async ({ collection, category, country = 'us', num = 50, lang, fullDetail = false }) => {
    try {
      const results = await store.list({ collection, category, country, num, lang, fullDetail });
      return results;
    } catch (error) {
      console.error('Error in app_store_list:', error);
      return { error: 'Failed to fetch app list', details: error.message };
    }
  },
  google_play_search: async ({ term, price = 'all', num = 20, lang = 'en', country = 'us', fullDetail = false }) => {
    try {
      const results = await gplay.search({ term, price, num, lang, country, fullDetail });
      return results;
    } catch (error) {
      console.error('Error in google_play_search:', error);
      return { error: 'Failed to search Google Play', details: error.message };
    }
  },
  google_play_details: async ({ appId, lang = 'en', country = 'us' }) => {
    try {
      const details = await gplay.app({ appId, lang, country });
      return details;
    } catch (error) {
      console.error('Error in google_play_details:', error);
      return { error: 'Failed to fetch Google Play details', details: error.message };
    }
  },
  google_play_reviews: async ({ appId, lang = 'en', country = 'us', sort = 'newest', num = 100, paginate = false, nextPaginationToken }) => {
    try {
      const sortMap = {
        newest: gplay.sort.NEWEST,
        rating: gplay.sort.RATING,
        helpfulness: gplay.sort.HELPFULNESS
      };

      const reviews = await gplay.reviews({
        appId,
        lang,
        country,
        sort: sortMap[sort],
        num,
        paginate,
        nextPaginationToken
      });

      return {
        reviews: reviews.data,
        nextPage: reviews.nextPaginationToken
      };
    } catch (error) {
      console.error('Error in google_play_reviews:', error);
      return { error: 'Failed to fetch Google Play reviews', details: error.message };
    }
  },
  google_play_similar: async ({ appId, lang = 'en', country = 'us', fullDetail = false }) => {
    try {
      const similar = await gplay.similar({ appId, lang, country, fullDetail });
      return similar;
    } catch (error) {
      console.error('Error in google_play_similar:', error);
      return { error: 'Failed to fetch similar apps', details: error.message };
    }
  },
  google_play_developer: async ({ devId, lang = 'en', country = 'us', num = 60, fullDetail = false }) => {
    try {
      const apps = await gplay.developer({ devId, lang, country, num, fullDetail });
      return apps;
    } catch (error) {
      console.error('Error in google_play_developer:', error);
      return { error: 'Failed to fetch developer apps', details: error.message };
    }
  },
  google_play_suggest: async ({ term, lang = 'en', country = 'us' }) => {
    try {
      const suggestions = await gplay.suggest({ term, lang, country });
      return suggestions;
    } catch (error) {
      console.error('Error in google_play_suggest:', error);
      return { error: 'Failed to fetch suggestions', details: error.message };
    }
  },
  google_play_permissions: async ({ appId, lang = 'en', country = 'us', short = false }) => {
    try {
      const permissions = await gplay.permissions({ appId, lang, country, short });
      return permissions;
    } catch (error) {
      console.error('Error in google_play_permissions:', error);
      return { error: 'Failed to fetch permissions', details: error.message };
    }
  },
  google_play_datasafety: async ({ appId, lang = 'en' }) => {
    try {
      const datasafety = await gplay.datasafety({ appId, lang });
      return datasafety;
    } catch (error) {
      console.error('Error in google_play_datasafety:', error);
      return { error: 'Failed to fetch data safety info', details: error.message };
    }
  },
  google_play_categories: async () => {
    try {
      const categories = await gplay.categories();
      return categories;
    } catch (error) {
      console.error('Error in google_play_categories:', error);
      return { error: 'Failed to fetch categories', details: error.message };
    }
  },
  google_play_list: async ({ collection = 'TOP_FREE', category, age, num = 500, lang = 'en', country = 'us', fullDetail = false }) => {
    try {
      const results = await gplay.list({
        collection,
        category,
        age,
        num,
        lang,
        country,
        fullDetail
      });
      return results;
    } catch (error) {
      console.error('Error in google_play_list:', error);
      return { error: 'Failed to fetch app list', details: error.message };
    }
  }
};
