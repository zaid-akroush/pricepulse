const { looksLikeUnlabelledPayment, PAYMENT_TYPES } = require('./paymentTerms');

// Keeping a product's price aggregates honest.
//
// currentPrice / lowestPrice / highestPrice were maintained purely as a
// one-way ratchet — Math.min / Math.max against whatever was already stored,
// from several different call sites, and never reconciled against the
// priceHistory rows that are supposed to back them. Two consequences:
//
//  * One bad reading was permanent. A mis-parsed price 100x too high became
//    highestPrice forever, which pinned "% below peak" near 99% and the deal
//    score at 100, so the product sat at the top of every "best deal" list
//    with no code path able to correct it.
//  * Seeded/imported rows could claim a low and a high that no history row
//    supports, so the chart and the summary numbers disagreed.
//
// recordPrice() is now the single way a new observation is written: it
// inserts the history row and recomputes the aggregates FROM that history,
// so the summary can always be derived from the data behind it.

/**
 * Record an observed price for a product and refresh its aggregates.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{id: number}} product
 * @param {number} price
 * @returns {Promise<{currentPrice: number, lowestPrice: number, highestPrice: number}|null>}
 */
async function recordPrice(prisma, product, price, options = {}) {
  if (!(price > 0) || !Number.isFinite(price)) return null;

  // A payment is not a price. Callers that know the listing's payment type
  // pass it; anything that is not an outright purchase is refused outright.
  if (options.paymentType && options.paymentType !== PAYMENT_TYPES.ONE_TIME) {
    console.warn(
      `[price] Refusing ${options.paymentType} price ${price} for product ${product.id} (${product.title || 'untitled'}).`
    );
    return null;
  }

  // And the unlabelled case: a reading far below what this product has always
  // cost is almost never a real sale, it is a monthly figure that lost its
  // "/mo" on the way to us. Recording it would set a lowestPrice nobody can
  // pay and mark the product a blazing deal forever, so it is dropped with a
  // log line instead of quietly poisoning the history.
  const past = await prisma.priceHistory.findMany({
    where: { productId: product.id },
    select: { price: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const check = looksLikeUnlabelledPayment(price, past.map(r => r.price));
  if (check.implausible) {
    console.warn(
      `[price] Refusing implausible price ${price} for product ${product.id}: ` +
      `${Math.round(check.ratio * 100)}% of its median ${check.reference}. Looks like an instalment, not a price.`
    );
    return null;
  }

  await prisma.priceHistory.create({
    data: { productId: product.id, price },
  });

  // Derive the bounds from the history rather than from the previous stored
  // values, so a bad row that is later deleted stops affecting them.
  const bounds = await prisma.priceHistory.aggregate({
    where: { productId: product.id },
    _min: { price: true },
    _max: { price: true },
  });

  const lowestPrice = bounds._min.price ?? price;
  const highestPrice = bounds._max.price ?? price;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      currentPrice: price,
      lowestPrice,
      highestPrice,
      lastChecked: new Date(),
    },
  });

  return { currentPrice: price, lowestPrice, highestPrice };
}

/**
 * Recompute a product's aggregates from its existing history without adding a
 * new observation. Use after deleting history rows, or to repair a row whose
 * bounds were written by the old ratcheting code.
 */
async function reconcileAggregates(prisma, productId) {
  const bounds = await prisma.priceHistory.aggregate({
    where: { productId },
    _min: { price: true },
    _max: { price: true },
  });
  if (bounds._min.price == null) return null;

  const latest = await prisma.priceHistory.findFirst({
    where: { productId },
    orderBy: { recordedAt: 'desc' },
    select: { price: true },
  });

  const data = {
    lowestPrice: bounds._min.price,
    highestPrice: bounds._max.price,
    ...(latest ? { currentPrice: latest.price } : {}),
  };
  await prisma.product.update({ where: { id: productId }, data });
  return data;
}

module.exports = { recordPrice, reconcileAggregates };
