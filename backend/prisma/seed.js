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
  {
    name: 'Priya',
    email: 'priya@example.com',
    products: [
      { title: 'Apple iPhone 15 Pro Max 256GB – Natural Titanium', url: 'https://www.apple.com/iphone-15-pro/', imageUrl: IMAGES.iphone, currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 15 Pro Max' },
      { title: 'Bose SoundLink Max Portable Bluetooth Speaker', url: 'https://www.bose.com/', imageUrl: IMAGES.bosespeaker, currentPrice: 399.00, lowestPrice: 349.00, highestPrice: 429.00, currency: 'USD', serpApiQuery: 'Bose SoundLink Max speaker' },
      { title: 'Kindle Oasis E-reader 32GB Graphite Adjustable Warm Light', url: 'https://www.amazon.com/', imageUrl: IMAGES.kindle, currentPrice: 249.00, lowestPrice: 179.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'Kindle Oasis 32GB e-reader' },
    ],
  },
  {
    name: 'Hassan',
    email: 'hassan@example.com',
    products: [
      { title: 'Microsoft Xbox Series X 1TB Console', url: 'https://www.xbox.com/', imageUrl: IMAGES.xboxsx, currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'Xbox Series X console' },
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC Edition', url: 'https://rog.asus.com/', imageUrl: IMAGES.rtx4080, currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super GPU' },
      { title: 'Anker 747 GaNPrime 150W Desktop Charger', url: 'https://www.anker.com/', imageUrl: IMAGES.anker, currentPrice: 89.99, lowestPrice: 69.99, highestPrice: 99.99, currency: 'USD', serpApiQuery: 'Anker GaNPrime 150W charger' },
    ],
  },
  {
    name: 'Chloe',
    email: 'chloe@example.com',
    products: [
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: IMAGES.macbook, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3' },
      { title: 'Google Pixel 8 Pro 256GB Obsidian', url: 'https://store.google.com/', imageUrl: IMAGES.pixel8, currentPrice: 799.00, lowestPrice: 699.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'Google Pixel 8 Pro 256GB' },
      { title: 'GoPro HERO12 Black – Waterproof Action Camera', url: 'https://gopro.com/', imageUrl: IMAGES.gopro, currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 399.00, currency: 'USD', serpApiQuery: 'GoPro Hero 12 Black action camera' },
    ],
  },
  {
    name: 'Diego',
    email: 'diego@example.com',
    products: [
      { title: 'Sony PlayStation 5 Console (PS5) Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: IMAGES.ps5, currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PS5 Slim console' },
      { title: 'Nintendo Switch OLED Model White', url: 'https://www.nintendo.com/', imageUrl: IMAGES.switcholed, currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 369.00, currency: 'USD', serpApiQuery: 'Nintendo Switch OLED' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: IMAGES.monitor, currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
    ],
  },
  {
    name: 'Fatima',
    email: 'fatima@example.com',
    products: [
      { title: 'Samsung 65" Class QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: IMAGES.samsung4k, currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K TV' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight Aluminum', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: IMAGES.applewatch, currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm' },
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: IMAGES.dyson, currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum cleaner' },
    ],
  },
  {
    name: 'Noah',
    email: 'noah@example.com',
    products: [
      { title: 'Dell XPS 15 Laptop Intel Core i9 RTX 4070 1TB SSD', url: 'https://www.dell.com/', imageUrl: IMAGES.dell, currentPrice: 1899.00, lowestPrice: 1699.00, highestPrice: 2199.00, currency: 'USD', serpApiQuery: 'Dell XPS 15 i9 RTX 4070' },
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: IMAGES.canon, currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II' },
      { title: 'DJI Mini 4 Pro Drone with RC-N2 Controller', url: 'https://www.dji.com/', imageUrl: IMAGES.dji, currentPrice: 759.00, lowestPrice: 699.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'DJI Mini 4 Pro drone' },
    ],
  },
  {
    name: 'Amara',
    email: 'amara@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: IMAGES.galaxy, currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: IMAGES.airpods, currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd gen' },
      { title: 'Garmin Fenix 7X Solar Multisport GPS Smartwatch', url: 'https://www.garmin.com/', imageUrl: IMAGES.garmin, currentPrice: 699.00, lowestPrice: 599.00, highestPrice: 799.00, currency: 'USD', serpApiQuery: 'Garmin Fenix 7X Solar smartwatch' },
    ],
  },
  {
    name: 'Victor',
    email: 'victor@example.com',
    products: [
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/en/articles/wh1000xm5', imageUrl: IMAGES.sonyxm5, currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5' },
      { title: 'Razer Blade 16 Laptop RTX 4090 Intel i9 32GB RAM', url: 'https://www.razer.com/', imageUrl: IMAGES.razer, currentPrice: 3499.00, lowestPrice: 2999.00, highestPrice: 3999.00, currency: 'USD', serpApiQuery: 'Razer Blade 16 RTX 4090' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: IMAGES.ipadpro, currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4' },
    ],
  },
];

// A deduplicated pool of every product referenced above, used to generate a
// second batch of users below without hand-authoring each one's product
// list. Dedup key matches the same (serpApiQuery, title) upsert lookup used
// in the seeding loop.
const PRODUCT_POOL = Object.values(
  SEED_USERS.reduce((acc, u) => {
    for (const p of u.products) acc[`${p.serpApiQuery}::${p.title}`] = p;
    return acc;
  }, {})
);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pick `count` distinct random items from an array.
function sample(arr, count) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < count && copy.length; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}

// Programmatically generate more community accounts. Product lists get
// filled out below (top-up pass) so this initial sample only needs to seed
// each account with something to start from.
const EXTRA_NAMES = [
  'Layla', 'Mateo', 'Ines', 'Bilal', 'Sana', 'Theo', 'Aisha', 'Karim',
  'Nadine', 'Felix', 'Rania', 'Lucas', 'Salma', 'Jonas', 'Dania', 'Ryan',
  'Mona', 'Adam', 'Yara', 'Elias',
];
for (const name of EXTRA_NAMES) {
  SEED_USERS.push({
    name,
    email: `${name.toLowerCase()}@example.com`,
    products: sample(PRODUCT_POOL, randInt(2, 4)), // topped up below
  });
}

// Top-up pass: give every user (hand-authored and generated alike) a random
// number of tracked products, so the community and leaderboard pages show
// real variation instead of everyone sitting on the same handful.
// MAX_TRACKED mirrors the backend's per-user wishlist limit
// (backend/src/routes/wishlist.js) — keep the two in step, so seed data can
// never violate the cap the app itself enforces.
const MAX_TRACKED = 25;
const MIN_TRACKED = 4;
for (const u of SEED_USERS) {
  const target = randInt(MIN_TRACKED, Math.min(MAX_TRACKED, PRODUCT_POOL.length));
  const have = new Set(u.products.map(p => `${p.serpApiQuery}::${p.title}`));
  const remainingPool = PRODUCT_POOL.filter(p => !have.has(`${p.serpApiQuery}::${p.title}`));
  const needed = Math.max(0, target - u.products.length);
  u.products.push(...sample(remainingPool, Math.min(needed, remainingPool.length)));
}


// ── Community notes ───────────────────────────────────────────────────────
// Seeded so the notes section, its "Top" ordering and the upvote counts have
// something real to show. Every line below is written to pass the same rules
// the API enforces (services/noteModeration): 10-500 characters, no links,
// no phone numbers, no shouting, no repetition. The seed asserts that rather
// than trusting it — a fixture that the live endpoint would have rejected is
// a bug, not test data.
const NOTE_TEXTS = [
  'Picked this up last month and the price has already dropped twice, worth waiting if you can.',
  'Been tracking this one since spring. It bottoms out around every major sale weekend.',
  'Build quality is solid for the money. No complaints after a few weeks of daily use.',
  'Watch out for the older generation being sold at a similar price, check the model year.',
  'Battery life is noticeably better than the previous version, that alone sold me on it.',
  'Was cheaper at a warehouse club last quarter, so this current price is not the floor.',
  'Shipping took longer than advertised but the item arrived in perfect condition.',
  'If you already own last year model, honestly not worth upgrading at this price.',
  'The bundle version usually appears around the holidays and works out much better value.',
  'Great value once it dips under the average. Setting my alert a little below that.',
  'Reviews elsewhere mention a firmware update fixing the early connection issues.',
  'Colour options seem to be priced differently, the darker one is consistently cheaper.',
  'This has been steady for months, I would not expect a big drop before the next sale.',
  'Bought two of these for the office and both have been completely reliable so far.',
  'Keep an eye on the refurbished listings, they run quite a bit below this number.',
  'The price jumped right before the sale and then came back down, classic pattern.',
  'Compared this against two similar models and it wins clearly on ports and display.',
  'Packaging was minimal but everything was well protected, no damage on arrival.',
];

const { validateNoteText } = require('../src/services/noteModeration');
for (const text of NOTE_TEXTS) {
  const verdict = validateNoteText(text);
  if (!verdict.ok) {
    throw new Error(`Seed note would be rejected by the API ("${verdict.error}"): ${text}`);
  }
}


// Build a believable price series for a seeded product: one reading every few
// days over the past ~3 months, wandering within the product's declared
// low/high, and guaranteed to actually touch both bounds and to end at
// currentPrice — so lowestPrice/highestPrice/currentPrice are all supported
// by real rows instead of asserted.
function buildPriceHistory(p) {
  const POINTS = 24;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lo = Math.min(p.lowestPrice, p.currentPrice);
  const hi = Math.max(p.highestPrice, p.currentPrice);
  const rows = [];

  for (let i = 0; i < POINTS; i++) {
    // A gentle wave through the range, plus jitter, so the chart has shape.
    const t = i / (POINTS - 1);
    const wave = (Math.sin(t * Math.PI * 1.5) + 1) / 2; // 0..1
    const jitter = (Math.random() - 0.5) * (hi - lo) * 0.12;
    let price = lo + wave * (hi - lo) + jitter;
    price = Math.min(hi, Math.max(lo, price));
    rows.push({
      productId: p.__id,
      price: parseFloat(price.toFixed(2)),
      recordedAt: new Date(Date.now() - (POINTS - 1 - i) * 4 * DAY_MS),
    });
  }

  // Pin the extremes and the final value so the aggregates are exact.
  rows[Math.floor(POINTS * 0.25)].price = hi;
  rows[Math.floor(POINTS * 0.7)].price = lo;
  rows[rows.length - 1].price = p.currentPrice;
  return rows;
}

async function main() {
  console.log('Seeding community users and wishlists...');
  // NOTE: every seed account below shares this one weak, publicly-known
  // password. This file is dev-only fixture data for local/demo databases —
  // it must NEVER be run against the production database.
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
        // Each seeded product declares a lowestPrice and highestPrice, but
        // only ONE history row was written (at currentPrice). The chart was
        // then a flat line next to a summary claiming a low and a high that
        // nothing in the data supported — visibly inconsistent on the very
        // page a demo starts on. Generate a plausible series that actually
        // spans the declared range and ends at currentPrice.
        await prisma.priceHistory.createMany({
          data: buildPriceHistory({ ...p, __id: product.id }),
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

  // Follows: each user follows a random 5-15 other users, so the
  // community/leaderboard pages and each account's "following" count have
  // real, varied data instead of everyone having an identical fixed count.
  console.log('Seeding follows...');
  const allUsers = await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const followData = [];
  for (const u of allUsers) {
    const others = allUsers.filter(o => o.id !== u.id).map(o => o.id);
    const followCount = randInt(5, Math.min(15, others.length));
    for (const targetId of sample(others, followCount)) {
      followData.push({ followerId: u.id, followingId: targetId });
    }
  }
  const followResult = await prisma.follow.createMany({ data: followData, skipDuplicates: true });
  console.log(`  ✓ ${followResult.count} follow relationships`);

  // Likes: each user likes a random 5-20 products from the catalog, so
  // "Deal of the day" scoring and each product's like count have real,
  // varied signal instead of an identical fixed count per user.
  console.log('Seeding product likes...');
  const allProducts = await prisma.product.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const likeData = [];
  for (const u of allUsers) {
    const likeCount = randInt(5, Math.min(20, allProducts.length));
    for (const p of sample(allProducts, likeCount)) {
      likeData.push({ userId: u.id, productId: p.id });
    }
  }
  const likeResult = await prisma.productLike.createMany({ data: likeData, skipDuplicates: true });
  console.log(`  ✓ ${likeResult.count} product likes`);

  // Community notes: a random handful of products get notes from random
  // users, so most product pages have discussion without every page carrying
  // an identical block of text. One note per (user, product) pair keeps it
  // looking like a real thread rather than one account talking to itself.
  console.log('Seeding community notes...');
  const noteData = [];
  const usedPairs = new Set();
  const productsWithNotes = sample(allProducts, Math.ceil(allProducts.length * 0.6));
  for (const product of productsWithNotes) {
    for (const u of sample(allUsers, randInt(1, 5))) {
      const pair = `${u.id}:${product.id}`;
      if (usedPairs.has(pair)) continue;
      usedPairs.add(pair);
      noteData.push({
        userId: u.id,
        productId: product.id,
        text: NOTE_TEXTS[randInt(0, NOTE_TEXTS.length - 1)],
        // Spread notes over the past three months so "Newest" ordering shows
        // a real timeline instead of every note sharing one timestamp.
        createdAt: new Date(Date.now() - randInt(1, 90) * 24 * 60 * 60 * 1000),
      });
    }
  }
  const noteResult = await prisma.comment.createMany({ data: noteData, skipDuplicates: true });
  console.log(`  ✓ ${noteResult.count} community notes`);

  // Upvotes on those notes, so the "Top" ordering has something to sort by.
  // A user can't like their own note (the API rejects it), so those pairs are
  // skipped here too.
  console.log('Seeding note upvotes...');
  const allNotes = await prisma.comment.findMany({ select: { id: true, userId: true } });
  const noteLikeData = [];
  for (const note of allNotes) {
    const voters = sample(allUsers.filter(u => u.id !== note.userId), randInt(0, 8));
    for (const voter of voters) {
      noteLikeData.push({ userId: voter.id, commentId: note.id });
    }
  }
  const noteLikeResult = await prisma.commentLike.createMany({ data: noteLikeData, skipDuplicates: true });
  console.log(`  ✓ ${noteLikeResult.count} note upvotes`);

  console.log('Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
