// Starter menu photos: free-licensed images from Wikimedia Commons, cropped and
// colour-graded to one house look, served from /public/menu. The admin can
// replace any of them; uploaded photos are stored in the database instead.

export type PhotoCredit = { drink: string; title: string; author: string; license: string; source: string };

export const DEFAULT_PHOTO_CREDITS: Record<string, PhotoCredit> = {
  espresso: {
    drink: "Espresso",
    title: "Long Black - 17 GRAMS 2024-02-05",
    author: "Andy Li",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Long_Black_-_17_GRAMS_2024-02-05.jpg",
  },
  americano: {
    drink: "Americano",
    title: "Long black - Cafe Coho 2025-10-30",
    author: "Andy Li",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Long_black_-_Cafe_Coho_2025-10-30.jpg",
  },
  latte: {
    drink: "Caffè Latte",
    title: "Espresso single shot coffee",
    author: "Unknown (released to the public domain)",
    license: "Public domain",
    source: "https://commons.wikimedia.org/wiki/File:Espresso_single_shot_coffee.jpg",
  },
  cappuccino: {
    drink: "Cappuccino",
    title: "Cappuccino, cookies, flowers in glass",
    author: "Deepak-nsk",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Cappuccino,_cookies,_flowers_in_glass.jpg",
  },
  "flat-white": {
    drink: "Flat White",
    title: "Flat White by Nijat Zayidov",
    author: "Tokimemooo",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Flat_White_by_Nijat_Zayidov.jpg",
  },
  "caramel-macchiato": {
    drink: "Caramel Macchiato",
    title: "Coffee in Taproom ‘t Blauwe Theehuis 2024-11-26",
    author: "Andy Li",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Coffee_in_Taproom_%E2%80%98t_Blauwe_Theehuis_2024-11-26.jpg",
  },
  mocha: {
    drink: "Caffè Mocha",
    title: "Mocha - Garden Café Brighton 2023-12-30",
    author: "Andy Li",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Mocha_-_Garden_Caf%C3%A9_Brighton_2023-12-30.jpg",
  },
  "cold-brew": {
    drink: "Cold Brew",
    title: "Iced cold brew coffee",
    author: "Roland Tanglao",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Iced_cold_brew_coffee.jpg",
  },
  "vanilla-cream-cold-brew": {
    drink: "Vanilla Cream Cold Brew",
    title: "Iced Coffee Cream Latte - CK Bistro 2024-06-23",
    author: "Andy Li",
    license: "CC0",
    source: "https://commons.wikimedia.org/wiki/File:Iced_Coffee_Cream_Latte_-_CK_Bistro_2024-06-23.jpg",
  },
  "build-your-own": {
    drink: "Build Your Own",
    title: "Roasted coffee beans",
    author: "MarkSweep",
    license: "Public domain",
    source: "https://commons.wikimedia.org/wiki/File:Roasted_coffee_beans.jpg",
  },
};

/** The photo for a drink: the admin's upload if there is one, else the starter photo. */
export function menuPhotoUrl(slug: string, imageKey: string | null | undefined) {
  if (imageKey) return `/api/images/${imageKey}`;
  return DEFAULT_PHOTO_CREDITS[slug] ? `/menu/${slug}.webp` : null;
}
