// Mirror of PACKS in js/billing.js (credited amount = amount + bonus). Keep in sync.
const P = (cur, amount, bonus) => ({ cur, n: amount + bonus });
module.exports = {
  stars_100: P('star', 100, 0), stars_550: P('star', 500, 50), stars_1200: P('star', 1000, 200),
  stars_2600: P('star', 2000, 600), stars_3600: P('star', 2600, 1000),
  diamonds_10: P('diamond', 10, 0), diamonds_55: P('diamond', 50, 5), diamonds_120: P('diamond', 100, 20),
  diamonds_260: P('diamond', 200, 60), diamonds_360: P('diamond', 260, 100)
};
