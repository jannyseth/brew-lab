import { asc, desc, eq } from "drizzle-orm";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { db } from "@/db";
import { branches, orders } from "@/db/schema";
import { tierLabels } from "@/lib/coin-rules";
import { coinBalance, creatorTier } from "@/lib/coins";
import { formatCents } from "@/lib/drink";
import { faqText, FACEBOOK_URL } from "@/lib/faq";
import { isOpenBranch } from "@/lib/licenses";
import { getMenu } from "@/lib/menu";
import { getSession } from "@/lib/session";

export const maxDuration = 30;

// Keep each conversation short so a chat can't run up the AI bill.
const MAX_MESSAGES = 16;
const MAX_CHARS = 600;

const instructions = (signedIn: boolean) => `You are the Brew Lab assistant, the helpful barista-style support chat for Brew Lab, a coffee shop app in the Philippines.
Answer only questions about Brew Lab: the menu, ordering, pickup, branches, bean coins, signature drinks, accounts and privacy.
Use the FAQ below and your tools. Never invent prices, branches, hours, promotions or policies. If you don't know, say so and suggest messaging Brew Lab on Facebook (${FACEBOOK_URL}) or asking branch staff.
You can't place, change or cancel orders, or add or remove coins: explain where in the app the customer can do it.
${signedIn ? "The customer is signed in, so you may look up their own orders and coins with your tools." : "The customer is not signed in; for order or coin questions, ask them to sign in first."}
Reply in the customer's language (English, Filipino or Taglish). Keep answers short, warm and plain: 1-4 sentences, no markdown tables.
Prices are in Philippine pesos.

# FAQ
${faqText()}`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const recent = messages.slice(-MAX_MESSAGES);
  const tooLong = recent.some((m) => m.parts.some((p) => p.type === "text" && p.text.length > MAX_CHARS));
  if (!Array.isArray(messages) || recent.length === 0 || tooLong) {
    return new Response("Message too long.", { status: 400 });
  }

  const session = await getSession();
  const customerId = session?.user.role === "customer" ? session.user.id : null;

  const publicTools = {
    menu: tool({
      description: "The current Brew Lab menu with starting prices.",
      inputSchema: z.object({}),
      execute: async () =>
        (await getMenu()).map((c) => ({
          category: c.name,
          drinks: c.items.map((i) => ({ name: i.name, from: formatCents(i.basePriceCents), description: i.description })),
        })),
    }),
    branches: tool({
      description: "Branches open for orders, with address and opening hours.",
      inputSchema: z.object({}),
      execute: async () =>
        db
          .select({ name: branches.name, address: branches.address, hours: branches.hours })
          .from(branches)
          .where(isOpenBranch)
          .orderBy(asc(branches.name)),
    }),
  };

  const customerTools: ToolSet = customerId
    ? {
        myOrders: tool({
          description: "The signed-in customer's 5 most recent orders and their status.",
          inputSchema: z.object({}),
          execute: async () =>
            (
              await db
                .select({ id: orders.id, status: orders.status, total: orders.totalCents, placed: orders.createdAt, branch: branches.name })
                .from(orders)
                .innerJoin(branches, eq(orders.branchId, branches.id))
                .where(eq(orders.userId, customerId))
                .orderBy(desc(orders.createdAt))
                .limit(5)
            ).map((o) => ({ ...o, total: formatCents(o.total) })),
        }),
        myCoins: tool({
          description: "The signed-in customer's bean coin balance and creator status.",
          inputSchema: z.object({}),
          execute: async () => {
            const [balance, tier] = await Promise.all([coinBalance(customerId), creatorTier(customerId)]);
            return { ...balance, creatorStatus: tierLabels[tier.tier], customersThisQuarter: tier.buyersThisQuarter };
          },
        }),
      }
    : {};

  const result = streamText({
    model: "anthropic/claude-haiku-5.5",
    instructions: instructions(Boolean(customerId)),
    messages: await convertToModelMessages(recent),
    tools: { ...publicTools, ...customerTools },
    stopWhen: isStepCount(4),
    maxOutputTokens: 500,
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
