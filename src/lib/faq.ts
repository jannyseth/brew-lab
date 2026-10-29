import {
  CREATOR_COINS,
  FREE_DRINK_COINS,
  HOLD_DAYS,
  PURCHASE_COINS,
  TIER_THRESHOLDS,
} from "./coin-rules";

export const FACEBOOK_URL = "https://www.facebook.com/nadj.vega";

export type FaqSection = { title: string; items: { q: string; a: string }[] };

export const faq: FaqSection[] = [
  {
    title: "Ordering and pickup",
    items: [
      {
        q: "How do I order?",
        a: "Pick a drink from the menu or build your own, add it to your order, then check out and choose the branch you'll pick up from. You need a free customer account to place an order.",
      },
      {
        q: "How do I pay?",
        a: "You pay at the counter when you pick up your order. The app doesn't take card or e-wallet payments.",
      },
      {
        q: "How do I know when my order is ready?",
        a: "Open Orders and tap your order. Its status updates by itself: Received, Preparing, Ready for pickup, then Picked up.",
      },
      {
        q: "Can I cancel an order?",
        a: "Yes, from the order page, until the branch starts preparing it. After that, please talk to the branch staff.",
      },
      {
        q: "Can I get a receipt?",
        a: "Every order has a receipt you can view, print or download as a PDF from the order page. It's an order receipt, not a BIR official receipt or sales invoice.",
      },
      {
        q: "Which branches can I order from?",
        a: "Checkout lists every branch that's open for orders, with its address and opening hours.",
      },
    ],
  },
  {
    title: "Drinks",
    items: [
      {
        q: "Can I customize a drink?",
        a: "Yes. Every menu drink has options like size, milk, sweetness and extra shots. Build Your Own lets you make a drink from scratch, station by station.",
      },
      {
        q: "Can I save a drink I like?",
        a: "Tap Save drink while customizing. Your saved drinks are under Saved, ready to reorder in one tap.",
      },
    ],
  },
  {
    title: "Bean coins and signature drinks",
    items: [
      {
        q: "What are bean coins?",
        a: `Brew Lab's reward points. You earn ${PURCHASE_COINS} bean coins for every order you pick up, and ${FREE_DRINK_COINS} coins buy any drink, so 15 orders earn a free drink.`,
      },
      {
        q: "When can I spend my coins?",
        a: `Coins can be spent ${HOLD_DAYS} days after the order that earned them is picked up. Until then they show as "on hold" in Rewards.`,
      },
      {
        q: "How do I use my coins?",
        a: `At checkout, tick "Use ${FREE_DRINK_COINS} bean coins for a free drink". The most expensive drink in that order becomes free. If the order is cancelled, the coins come back.`,
      },
      {
        q: "What is a signature drink?",
        a: `A drink you created and published for other customers. Save a drink, then tap "Publish as signature drink" on your Saved page. After the Brew Lab team approves it, it gets its own page and share link. Each time another customer's order includes it, you earn ${CREATOR_COINS} bean coins.`,
      },
      {
        q: "Do I earn coins when I order my own signature drink?",
        a: "You earn the normal coins for your order, but not creator coins. Creator coins only come from other customers' orders.",
      },
      {
        q: "Do I earn coins for sharing on Facebook?",
        a: "No. Sharing is free and up to you. You earn coins when people order your drink, wherever they found it.",
      },
      {
        q: "How do I share my drink on Facebook?",
        a: "Open Rewards or your drink's page and tap Share on Facebook. Facebook opens its own post screen, where you choose what to write and tap Post. Brew Lab never posts for you.",
      },
      {
        q: "What are Gold and Platinum?",
        a: `Creator status, based on how many different customers ordered your signature drinks in the current quarter: Gold at ${TIER_THRESHOLDS.gold}, Platinum at ${TIER_THRESHOLDS.platinum}. Platinum creators earn 1.5 times the coins per order and get a Platinum badge. Status is checked every quarter; if you fall short you drop one level, not to the bottom.`,
      },
      {
        q: "What is the leaderboard?",
        a: "Top drinks ranks signature drinks by how many different customers ordered them. The weekly board starts fresh every Monday, and the Hall of Fame counts all time. You only appear if you chose to, and only your creator name is shown.",
      },
      {
        q: "Can I cash out, sell or transfer coins?",
        a: "No. Bean coins have no cash value and stay on your account. Coins from cancelled orders or misuse, like fake accounts, can be removed.",
      },
    ],
  },
  {
    title: "Accounts and privacy",
    items: [
      {
        q: "I forgot my password.",
        a: "Tap Sign in, then Forgot password, and we'll email you a link to set a new one.",
      },
      {
        q: "I want to open a Brew Lab branch.",
        a: "Sign up as a branch owner. The admin verifies you, then you can add your branch for approval.",
      },
      {
        q: "How is my data used?",
        a: "Only to run your account and orders, as explained in the Privacy Notice. Your real name is never shown publicly.",
      },
    ],
  },
  {
    title: "Still need help?",
    items: [
      {
        q: "How do I reach a person?",
        a: "Message Brew Lab on Facebook, or ask the staff at your branch.",
      },
    ],
  },
];
