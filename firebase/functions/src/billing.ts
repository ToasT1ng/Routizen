import { deriveIsPremium, type SubscriptionInfo, type User } from "@routizen/core";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { CONFIG } from "./config.js";
import { db } from "./firebaseAdmin.js";

let cachedStripe: Stripe | null = null;
function stripe(): Stripe {
  if (!CONFIG.stripeSecretKey) {
    throw new HttpsError("failed-precondition", "결제가 설정되지 않았습니다(STRIPE_SECRET_KEY).");
  }
  if (!cachedStripe) cachedStripe = new Stripe(CONFIG.stripeSecretKey);
  return cachedStripe;
}

/** Stripe 구독 상태 → 도메인 상태. active/trialing 만 프리미엄, 그 외는 비활성. */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionInfo["status"] {
  return status === "active" || status === "trialing" ? "active" : "canceled";
}

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

/** 구독 이벤트의 대상 uid 해석: metadata.uid 우선, 없으면 stripeCustomerId 로 역조회. */
async function resolveUid(sub: Stripe.Subscription): Promise<string | null> {
  const metaUid = sub.metadata?.uid;
  if (metaUid) return metaUid;
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerIdOf(sub))
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0]!.id;
}

/** Stripe 구독을 user 문서에 반영(subscription + 파생된 isPremium + customerId). */
async function applySubscription(uid: string, sub: Stripe.Subscription): Promise<void> {
  const subscription: SubscriptionInfo = {
    provider: "stripe",
    status: mapStripeStatus(sub.status),
    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
  };
  await db.collection("users").doc(uid).set(
    {
      subscription,
      isPremium: deriveIsPremium(subscription),
      stripeCustomerId: customerIdOf(sub),
    },
    { merge: true },
  );
}

/**
 * 프리미엄 구독 Checkout 세션 생성 (기획 3.5).
 * 로그인 사용자가 호출 → Stripe 고객 확보(최초 1회 생성) → 구독 Checkout 세션 URL 반환.
 * 클라이언트는 반환된 url 로 리다이렉트한다. 결제 성공 반영은 stripeWebhook 가 담당.
 */
export const createCheckoutSession = onCall({ region: CONFIG.region }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  if (!CONFIG.stripePriceId) {
    throw new HttpsError("failed-precondition", "결제가 설정되지 않았습니다(STRIPE_PRICE_ID).");
  }

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
  const user = { uid: snap.id, ...snap.data() } as User;

  // Stripe 고객 확보 — 없으면 생성하고 매핑 저장(웹훅 역조회에도 사용).
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      metadata: { uid },
    });
    customerId = customer.id;
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: CONFIG.stripePriceId, quantity: 1 }],
    client_reference_id: uid,
    // 구독 객체에 uid 를 심어 이후 subscription.* 웹훅에서 바로 대상 식별.
    subscription_data: { metadata: { uid } },
    success_url: `${CONFIG.appUrl}/?checkout=success`,
    cancel_url: `${CONFIG.appUrl}/?checkout=cancel`,
  });

  return { url: session.url };
});

/**
 * Stripe 웹훅 — 서명 검증 후 구독 상태를 user 문서에 반영 (기획 3.5).
 * 결제/갱신/취소 모두 구독 객체를 기준으로 처리한다(단일 진실 공급원).
 * raw body 가 필요하므로 req.rawBody 로 서명을 검증한다.
 */
export const stripeWebhook = onRequest({ region: CONFIG.region }, async (req, res) => {
  if (!CONFIG.stripeWebhookSecret) {
    res.status(500).send("webhook not configured");
    return;
  }
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).send("missing signature");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      req.rawBody,
      signature,
      CONFIG.stripeWebhookSecret,
    );
  } catch (err) {
    res.status(400).send(`signature verification failed: ${(err as Error).message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const uid = session.client_reference_id;
        if (uid && typeof session.subscription === "string") {
          const sub = await stripe().subscriptions.retrieve(session.subscription);
          await applySubscription(uid, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const uid = await resolveUid(sub);
        if (uid) await applySubscription(uid, sub);
        break;
      }
      default:
        // 관심 없는 이벤트는 무시(200 으로 ack).
        break;
    }
  } catch (err) {
    // 처리 실패 시 500 → Stripe 가 재시도하도록.
    res.status(500).send(`handler error: ${(err as Error).message}`);
    return;
  }

  res.status(200).send("ok");
});
