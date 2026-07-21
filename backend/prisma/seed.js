const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Product image placeholders: self-contained inline SVG data URIs so they
// always render with no external service or network dependency.
const P = (label, bg = '1e293b', fg = 'f97316') => {
  const safe = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
    `<rect width='400' height='400' fill='#${bg}'/>` +
    `<text x='50%' y='50%' fill='#${fg}' font-family='Arial,Helvetica,sans-serif' font-size='26' ` +
    `font-weight='bold' text-anchor='middle' dominant-baseline='middle'>${safe}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const IMAGES = {
  iphone:      P('iPhone 15 Pro', '1a1a2e', 'f97316'),
  macbook:     P('MacBook Pro', '1e293b', '94a3b8'),
  airpods:     P('AirPods Pro', 'f8fafc', '1e293b'),
  applewatch:  P('Apple Watch', '0f172a', 'f97316'),
  ipadpro:     P('iPad Pro', '1e293b', 'e2e8f0'),
  sonyxm5:     P('Sony XM5', '0f172a', 'f1f5f9'),
  ps5:         P('PS5', '003087', 'ffffff'),
  samsung4k:   P('Samsung 65" TV', '1d4ed8', 'ffffff'),
  rtx4080:     P('RTX 4080', '16a34a', 'ffffff'),
  dell:        P('Dell XPS 15', '0369a1', 'ffffff'),
  canon:       P('Canon EOS R6', '991b1b', 'ffffff'),
  galaxy:      P('Galaxy S24', '1d4ed8', 'c7d2fe'),
  logitech:    P('MX Master 3S', '0369a1', 'ffffff'),
  keyboard:    P('Keychron Q3', '7c3aed', 'ffffff'),
  bosespeaker: P('Bose SoundLink', '1e293b', 'f97316'),
  galaxytab:   P('Galaxy Tab S9', '1d4ed8', 'e0e7ff'),
  monitor:     P('LG OLED 27"', '111827', '6ee7b7'),
  dyson:       P('Dyson V15', 'dc2626', 'ffffff'),
  xboxsx:      P('Xbox Series X', '107c10', 'ffffff'),
  switcholed:  P('Nintendo Switch', 'e4000f', 'ffffff'),
  pixel8:      P('Pixel 8 Pro', '4285f4', 'ffffff'),
  sonytv:      P('Sony Bravia XR', '1a1a2e', 'f1f5f9'),
  iphone16:    P('iPhone 16 Pro', '2d2d2d', 'e5e5e5'),
  appletv:     P('Apple TV 4K', '1c1c1e', 'f97316'),
  garmin:      P('Garmin Fenix 7', '2d6a4f', 'ffffff'),
  kindle:      P('Kindle Oasis', 'f4a261', '1e293b'),
  razer:       P('Razer Blade 16', '00ff00', '111111'),
  gopro:       P('GoPro Hero 12', '1d4ed8', 'ffffff'),
  dji:         P('DJI Mini 4 Pro', '374151', 'f97316'),
  anker:       P('Anker Charger', '1e293b', '22d3ee'),
};

const SEED_USERS = [
  {
    name: 'Raneem',
    email: 'raneem@example.com',
    products: [
      { title: 'Apple iPhone 15 Pro Max 256GB – Natural Titanium', url: 'https://www.apple.com/iphone-15-pro/', imageUrl: IMAGES.iphone, currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 15 Pro Max' },
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: IMAGES.macbook, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: IMAGES.airpods, currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd gen' },
    ],
  },
  {
    name: 'Tim',
    email: 'tim@example.com',
    products: [
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/en/articles/wh1000xm5', imageUrl: IMAGES.sonyxm5, currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5' },
      { title: 'Sony PlayStation 5 Console (PS5) Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: IMAGES.ps5, currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PS5 Slim console' },
      { title: 'Samsung 65" Class QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: IMAGES.samsung4k, currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K TV' },
    ],
  },
  {
    name: 'Tariq',
    email: 'tariq@example.com',
    products: [
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC Edition', url: 'https://rog.asus.com/', imageUrl: IMAGES.rtx4080, currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super GPU' },
      { title: 'Keychron Q3 Max QMK/VIA Wireless Mechanical Keyboard', url: 'https://www.keychron.com/', imageUrl: IMAGES.keyboard, currentPrice: 199.00, lowestPrice: 169.00, highestPrice: 219.00, currency: 'USD', serpApiQuery: 'Keychron Q3 mechanical keyboard' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: IMAGES.monitor, currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
    ],
  },
  {
    name: 'John',
    email: 'john@example.com',
    products: [
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: IMAGES.canon, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: IMAGES.ipadpro, currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight Aluminum', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: IMAGES.applewatch, currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm' },
    ],
  },
  {
    name: 'Masa',
    email: 'masa@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: IMAGES.galaxy, currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra' },
      { title: 'Samsung Galaxy Tab S9 Ultra 14.6" Wi-Fi 512GB', url: 'https://www.samsung.com/', imageUrl: IMAGES.galaxytab, currentPrice: 1099.00, lowestPrice: 899.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy Tab S9 Ultra' },
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: IMAGES.dyson, currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum' },
    ],
  },
  {
    name: 'Kareem',
    email: 'kareem@example.com',
    products: [
      { title: 'Dell XPS 15 Laptop Intel Core i9 RTX 4070 1TB SSD', url: 'https://www.dell.com/', imageUrl: IMAGES.dell, currentPrice: 1899.00, lowestPrice: 1699.00, highestPrice: 2199.00, currency: 'USD', serpApiQuery: 'Dell XPS 15 i9 RTX 4070' },
      { title: 'Logitech MX Master 3S Wireless Performance Mouse', url: 'https://www.logitech.com/', imageUrl: IMAGES.logitech, currentPrice: 99.99, lowestPrice: 79.99, highestPrice: 109.99, currency: 'USD', serpApiQuery: 'Logitech MX Master 3S mouse' },
      { title: 'Bose SoundLink Max Portable Bluetooth Speaker', url: 'https://www.bose.com/', imageUrl: IMAGES.bosespeaker, currentPrice: 399.00, lowestPrice: 349.00, highestPrice: 429.00, currency: 'USD', serpApiQuery: 'Bose SoundLink Max speaker' },
    ],
  },
  {
    name: 'Sofia',
    email: 'sofia@example.com',
    products: [
      { title: 'Microsoft Xbox Series X 1TB Console', url: 'https://www.xbox.com/', imageUrl: IMAGES.xboxsx, currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'Xbox Series X console' },
      { title: 'Nintendo Switch OLED Model White', url: 'https://www.nintendo.com/', imageUrl: IMAGES.switcholed, currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 369.00, currency: 'USD', serpApiQuery: 'Nintendo Switch OLED' },
      { title: 'Google Pixel 8 Pro 256GB Obsidian', url: 'https://store.google.com/', imageUrl: IMAGES.pixel8, currentPrice: 799.00, lowestPrice: 699.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'Google Pixel 8 Pro 256GB' },
    ],
  },
  {
    name: 'Liam',
    email: 'liam@example.com',
    products: [
      { title: 'Sony Bravia XR 65" OLED 4K Smart TV A95L 2024', url: 'https://www.sony.com/', imageUrl: IMAGES.sonytv, currentPrice: 2799.00, lowestPrice: 2499.00, highestPrice: 3299.00, currency: 'USD', serpApiQuery: 'Sony Bravia XR OLED 65 inch 4K' },
      { title: 'Apple iPhone 16 Pro Max 256GB – Desert Titanium', url: 'https://www.apple.com/', imageUrl: IMAGES.iphone16, currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 16 Pro Max 256GB' },
      { title: 'Apple TV 4K (3rd Generation) Wi-Fi + Ethernet', url: 'https://www.apple.com/apple-tv-4k/', imageUrl: IMAGES.appletv, currentPrice: 129.00, lowestPrice: 99.00, highestPrice: 149.00, currency: 'USD', serpApiQuery: 'Apple TV 4K 3rd generation' },
    ],
  },
  {
    name: 'Nadia',
    email: 'nadia@example.com',
    products: [
      { title: 'Garmin Fenix 7X Solar Multisport GPS Smartwatch', url: 'https://www.garmin.com/', imageUrl: IMAGES.garmin, currentPrice: 699.00, lowestPrice: 599.00, highestPrice: 799.00, currency: 'USD', serpApiQuery: 'Garmin Fenix 7X Solar smartwatch' },
      { title: 'Kindle Oasis E-reader 32GB Graphite Adjustable Warm Light', url: 'https://www.amazon.com/', imageUrl: IMAGES.kindle, currentPrice: 249.00, lowestPrice: 179.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'Kindle Oasis 32GB e-reader' },
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/', imageUrl: IMAGES.sonyxm5, currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5 headphones' },
    ],
  },
  {
    name: 'Alex',
    email: 'alex@example.com',
    products: [
      { title: 'Razer Blade 16 Laptop RTX 4090 Intel i9 32GB RAM', url: 'https://www.razer.com/', imageUrl: IMAGES.razer, currentPrice: 3499.00, lowestPrice: 2999.00, highestPrice: 3999.00, currency: 'USD', serpApiQuery: 'Razer Blade 16 RTX 4090' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: IMAGES.monitor, currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
      { title: 'Keychron Q3 Max QMK/VIA Wireless Mechanical Keyboard', url: 'https://www.keychron.com/', imageUrl: IMAGES.keyboard, currentPrice: 199.00, lowestPrice: 169.00, highestPrice: 219.00, currency: 'USD', serpApiQuery: 'Keychron Q3 Max mechanical keyboard' },
    ],
  },
  {
    name: 'Yasmin',
    email: 'yasmin@example.com',
    products: [
      { title: 'GoPro HERO12 Black – Waterproof Action Camera', url: 'https://gopro.com/', imageUrl: IMAGES.gopro, currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 399.00, currency: 'USD', serpApiQuery: 'GoPro Hero 12 Black action camera' },
      { title: 'DJI Mini 4 Pro Drone with RC-N2 Controller', url: 'https://www.dji.com/', imageUrl: IMAGES.dji, currentPrice: 759.00, lowestPrice: 699.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'DJI Mini 4 Pro drone' },
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: IMAGES.canon, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II mirrorless' },
    ],
  },
  {
    name: 'Omar',
    email: 'omar@example.com',
    products: [
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: IMAGES.macbook, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3 Pro' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: IMAGES.ipadpro, currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4 256GB' },
      { title: 'Anker 747 GaNPrime 150W Desktop Charger', url: 'https://www.anker.com/', imageUrl: IMAGES.anker, currentPrice: 89.99, lowestPrice: 69.99, highestPrice: 99.99, currency: 'USD', serpApiQuery: 'Anker GaNPrime 150W charger' },
    ],
  },
  {
    name: 'Elena',
    email: 'elena@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: IMAGES.galaxy, currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra 512GB' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: IMAGES.airpods, currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd generation' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: IMAGES.applewatch, currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm cellular' },
    ],
  },
  {
    name: 'Marcus',
    email: 'marcus@example.com',
    products: [
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC', url: 'https://rog.asus.com/', imageUrl: IMAGES.rtx4080, currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super graphics card' },
      { title: 'Sony PlayStation 5 Console Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: IMAGES.ps5, currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PlayStation 5 Slim console' },
      { title: 'Samsung 65" QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: IMAGES.samsung4k, currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K Q80D' },
    ],
  },
  {
    name: 'Zara',
    email: 'zara@example.com',
    products: [
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: IMAGES.dyson, currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum cleaner' },
      { title: 'Samsung Galaxy Tab S9 Ultra 14.6" Wi-Fi 512GB', url: 'https://www.samsung.com/', imageUrl: IMAGES.galaxytab, currentPrice: 1099.00, lowestPrice: 899.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy Tab S9 Ultra 512GB' },
      { title: 'Logitech MX Master 3S Wireless Performance Mouse', url: 'https://www.logitech.com/', imageUrl: IMAGES.logitech, currentPrice: 99.99, lowestPrice: 79.99, highestPrice: 109.99, currency: 'USD', serpApiQuery: 'Logitech MX Master 3S wireless mouse' },
    ],
  },
];

async function main() {
  console.log('Seeding community users and wishlists...');
  const password = await bcrypt.hash('password123', 10);

  for (const userData of SEED_USERS) {
    // Upsert user
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: { name: userData.name, email: userData.email, password },
    });

    for (const p of userData.products) {
      // Upsert product
      let product = await prisma.product.findFirst({
        where: { serpApiQuery: p.serpApiQuery, title: p.title },
      });
      if (!product) {
        product = await prisma.product.create({
          data: { ...p, source: 'seed', lastChecked: new Date() },
        });
        await prisma.priceHistory.create({
          data: { productId: product.id, price: p.currentPrice },
        });
      }

      // Upsert wishlist item
      await prisma.wishlistItem.upsert({
        where: { userId_productId: { userId: user.id, productId: product.id } },
        update: {},
        create: { userId: user.id, productId: product.id, targetPrice: parseFloat((p.currentPrice * 0.9).toFixed(2)) },
      });
    }

    console.log(`  ✓ ${userData.name}`);
  }

  console.log('Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
