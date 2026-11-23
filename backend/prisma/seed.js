const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// imageUrl values are Google Shopping thumbnails fetched once via SerpApi.

const SEED_USERS = [
  {
    name: 'Zaid Akroush',
    email: 'zaid@example.com',
    products: [
      { title: 'Apple iPhone 15 Pro Max 256GB – Natural Titanium', url: 'https://www.apple.com/iphone-15-pro/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRpC9h24ev7xchbRr_bR-IMb1wlNxHNd0_YrUrnNpCBu53_ikc7mEXsankM1crgPXzWWkv2crAUYRTo5ts6ZTQd99bSGV-GyezxPSw8nqo', currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 15 Pro Max' },
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTfx17RAPmvCD0821pp1fCihdNa5YT6cbE22OJleV4YynD_n3JBAtuAL-UIm__WWRgG_CJKRAaloykd3d9aYdCIwvgxRUcs_wt-fDTSE1Yj', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSHfiD0pnwUuwGtMKP09iQC9e9UV6FDrBFLjZtirXZ6S4wGXbJ-DiSPqeXjSvWFvNQWRAJ8IZNDDwdqOegJN531RIvWc_X-sY899yelYMghzX9h679vqIXzAMEl', currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd gen' },
    ],
  },
  {
    name: 'Tim',
    email: 'tim@example.com',
    products: [
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/en/articles/wh1000xm5', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSRO9FgghvbjJfBUF3jbBNNK_Yw66h5S-Onz9UwROciL7kVjFoselP7V88GA9jMurvToIvdZZ3-6xKEMidLVGHKHLlWQrqFG4cw7IF3pBwPLqwbrlfxubg1', currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5' },
      { title: 'Sony PlayStation 5 Console (PS5) Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRq_sYiBLS-sP3GJN4Ptll6wM_cDGaRDMS_hqesJXB0oA9h6xIAxVnJ9CzO48n4slXvGuAMZS6scUlZG1aWdlcPn6BVXq0yPRxgQ2YAeiQ', currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PS5 Slim console' },
      { title: 'Samsung 65" Class QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQEr3d8QwIIwh1qHLEzyX8inLPTk84najHCJlZQGaJ1HFZ0foFyVSMD6hoU0B8saNDmM5_pttqYRWxLClS-4QJp0pKrEBiAjGdN8SGIZcZUdu18Uwc9ma3_', currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K TV' },
    ],
  },
  {
    name: 'Tariq',
    email: 'tariq@example.com',
    products: [
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC Edition', url: 'https://rog.asus.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQNr23vigsU7L8fSt1WPxJhX1zUgrpUkIKC7Fl-3V_lJMjZ5XjyUMTxGlIKf3LOq7CWsYVV1Y-ko810CXglC2ncKgcaTyzLsvATS5E3_lqa', currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super GPU' },
      { title: 'Keychron Q3 Max QMK/VIA Wireless Mechanical Keyboard', url: 'https://www.keychron.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQEm8J_3T3eOAc_AD1ZwVaxxo365yQRji_QeGgIw_o87udbzURGMdwMNI0ODbccbpEaxrwdFCkoxszQBVzRvPkTXDVqNnPJc18hhKWpYd6QpIBL37YFxrHv', currentPrice: 199.00, lowestPrice: 169.00, highestPrice: 219.00, currency: 'USD', serpApiQuery: 'Keychron Q3 mechanical keyboard' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQQwCv21g8iWsV5VTmpx9o0AT6i0eMshx8DFwt-Nn1e14iGizyMk3urXv9C0Qh-pD75Y5b70LWr-SjlHd0RWqDRFhw51cHkD-IuYqTqPNtxDhlBlvbbUx_4', currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
    ],
  },
  {
    name: 'John',
    email: 'john@example.com',
    products: [
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRhv5MVnNyPhU2pbflC2InEDtlvCkrW2zs1s5qLgf6QIPNWMWK27OgVbBYlIp0cK6Wi8skwVDD4LPnLwfKLLes-r6Ywuy3jbClpbsj1UMt_BAZ-c0zlpbPcWQ', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTAjiNerkR2kN5H7imocIjLOGYUnu8mil75OVPS0C83NSniSfgVLfBmaOXWyj01dzHfU4dwJWiqoZDO2QdBqMmpPIwQpOULHXp_L-6X5qBwHWppzcYFmbJa', currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight Aluminum', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcRwqAul_zQ8NmGtkLDtUMXkOAdARTFkxNxw6uOmM-lJ__A9hrLHWLAiMYCMzWuXk6C28NFrbqvKvs8OpUYkIJ8xVHf5QMCeoXb5rNxsVeA', currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm' },
    ],
  },
  {
    name: 'Masa',
    email: 'masa@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRVeHWep4JTJb7l5NALbEs625eURLYaB_vQs3CkGh9nf28xTawomnYeNxqvNRXYflQ5pShL5MLOJw2o9u73bKuzp2E4YKEee2wM0D5nGTbGN3yIOz7e-q4O', currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra' },
      { title: 'Samsung Galaxy Tab S9 Ultra 14.6" Wi-Fi 512GB', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQ0Akuz51DxUZE9MKiSxfjJB9DdmxCaEeeEqFsBaSq9Kks_3UuQfOtZDOVwztqCIxcABSKR7wxZiKdvkfaUVcm7A_AHD860th53tlErIHY', currentPrice: 1099.00, lowestPrice: 899.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy Tab S9 Ultra' },
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS0lkbE3uRN96ID_7kFZCdCcWCQUHi5aBjiVu-ZP5l19MdjCXCqGcRPnd8zwfWnA5W48PV3qV6OgZZnd3vERcRZH1Tp8pyVBgqDKnoYIUNy', currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum' },
    ],
  },
  {
    name: 'Kareem',
    email: 'kareem@example.com',
    products: [
      { title: 'Dell XPS 15 Laptop Intel Core i9 RTX 4070 1TB SSD', url: 'https://www.dell.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQpDKiQsWBmUveKMFuHPq-qpf_wIIfycA-TQ-lvjC_t0qZV3o6bhzt9eOIPTqbZZNGPD8Gq-yABFTKAJ1rCZk-VabIMvMdNwFSIXngAgFHaKRr7LHDuypz07A', currentPrice: 1899.00, lowestPrice: 1699.00, highestPrice: 2199.00, currency: 'USD', serpApiQuery: 'Dell XPS 15 i9 RTX 4070' },
      { title: 'Logitech MX Master 3S Wireless Performance Mouse', url: 'https://www.logitech.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRnggtH9T2J8nqHJ6IB0jq-z6Xo-LtjJBGQH7MLcTGhmxJ_IACSqTMhmYrVd4FgpURhFhF0GOzQYhVhf_GdtgFvc9R-FAqD2_Waxq_-_4CaG6jpMp-RZ05r', currentPrice: 99.99, lowestPrice: 79.99, highestPrice: 109.99, currency: 'USD', serpApiQuery: 'Logitech MX Master 3S mouse' },
      { title: 'Bose SoundLink Max Portable Bluetooth Speaker', url: 'https://www.bose.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS6QAZoCP2IuGzQINOoKO8HkDmPHfTjrHE_sugyExFyrOIGYfVzA8BBWbbklSZW9_s1Q1lRJE3ovgbbnLJw6QPvj1khg-GVug9ptAZzOHQg9IpyDfbicUUH', currentPrice: 399.00, lowestPrice: 349.00, highestPrice: 429.00, currency: 'USD', serpApiQuery: 'Bose SoundLink Max speaker' },
    ],
  },
  {
    name: 'Sofia',
    email: 'sofia@example.com',
    products: [
      { title: 'Microsoft Xbox Series X 1TB Console', url: 'https://www.xbox.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTBbyyurrvHEfYXwQ5r48GbwI8YRNhx05lGnbu4fPHoGBUr86wuyUfQwRzBcYwt8JI4r0C4sYXCJVZQac08dhk1ailDQJaqg_lARrlsZfq6yE_S2e88QGdhtg', currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'Xbox Series X console' },
      { title: 'Nintendo Switch OLED Model White', url: 'https://www.nintendo.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQHEqzdFlsIfdxVOJSRZfQGQoA_dbfmIPW_EVdpq8hldWr4T4QGPjagycCJa8wogSQjwV642NK6a0zjR0wotmiZdi5rHcJfyZkL3k5O2kUo0GYW-wuUhV9R', currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 369.00, currency: 'USD', serpApiQuery: 'Nintendo Switch OLED' },
      { title: 'Google Pixel 8 Pro 256GB Obsidian', url: 'https://store.google.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTYIy1nZQrfXbhe_avqCV1QAzZAeLFe3Dl1FT8LH9bWto3TbC_4V8HHG--ZVqio6yjEALns0ptXqTKrbrpClFrLV43ChPTjA6qSjXEqsGcwV1ydZOJkZRa3', currentPrice: 799.00, lowestPrice: 699.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'Google Pixel 8 Pro 256GB' },
    ],
  },
  {
    name: 'Liam',
    email: 'liam@example.com',
    products: [
      { title: 'Sony Bravia XR 65" OLED 4K Smart TV A95L 2024', url: 'https://www.sony.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRgNNaPgLsAySVC1OlqY9CH3ndfsfq6d8oy6KJXu0wHk_41L9CRIwigNL0k8r_yyImXtFAp5_w8reccIKXtjnOfbj93hC2Sg0Flw_cNjK_SOwLx7f1P3vhR', currentPrice: 2799.00, lowestPrice: 2499.00, highestPrice: 3299.00, currency: 'USD', serpApiQuery: 'Sony Bravia XR OLED 65 inch 4K' },
      { title: 'Apple iPhone 16 Pro Max 256GB – Desert Titanium', url: 'https://www.apple.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQFIxOnWVeB5p1l9F4WYor9-Zm4jKV2dK8KrW4PHhc-WnheybIN1Gq6_sJJlQs8uUUaV2XjgtHJDmFLZxyEecgkrJoVz61rGsurFn12641W', currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 16 Pro Max 256GB' },
      { title: 'Apple TV 4K (3rd Generation) Wi-Fi + Ethernet', url: 'https://www.apple.com/apple-tv-4k/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTBu7RPgN25C6mohkiyVrtKp9R-s8BX07V2TnHUjAkGuPo-2kPHu4MV-m3_Kilhx-qEmkqcd8fU_TFJm2JdahuaPZ7NGlkJ89895pYqkqO_IJuUkyU__8XeLA', currentPrice: 129.00, lowestPrice: 99.00, highestPrice: 149.00, currency: 'USD', serpApiQuery: 'Apple TV 4K 3rd generation' },
    ],
  },
  {
    name: 'Nadia',
    email: 'nadia@example.com',
    products: [
      { title: 'Garmin Fenix 7X Solar Multisport GPS Smartwatch', url: 'https://www.garmin.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTdXvHsZe9uqN-kN2ZXnFjfg_Ji4RPZz_BfJAgzeTd_1HdNQmxeMHINHibX4yAwBty4To0zCA_CY1tkuU3JebEi52pJG28neupREsNSwaKoTCyfBM6N8zxj', currentPrice: 699.00, lowestPrice: 599.00, highestPrice: 799.00, currency: 'USD', serpApiQuery: 'Garmin Fenix 7X Solar smartwatch' },
      { title: 'Kindle Oasis E-reader 32GB Graphite Adjustable Warm Light', url: 'https://www.amazon.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRAyEUzcYHVn3MfxWmjBUZMVIYyy_oXmRY-WHka0T1lZpkcLJVZKvUqOwcnPI3-w8PJgXnBtjb8UyL-psyVJqiZdreNtcbyZsAjylakTYJ8ldzxSyZAp4p0zw', currentPrice: 249.00, lowestPrice: 179.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'Kindle Oasis 32GB e-reader' },
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSRO9FgghvbjJfBUF3jbBNNK_Yw66h5S-Onz9UwROciL7kVjFoselP7V88GA9jMurvToIvdZZ3-6xKEMidLVGHKHLlWQrqFG4cw7IF3pBwPLqwbrlfxubg1', currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5 headphones' },
    ],
  },
  {
    name: 'Alex',
    email: 'alex@example.com',
    products: [
      { title: 'Razer Blade 16 Laptop RTX 4090 Intel i9 32GB RAM', url: 'https://www.razer.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSkRfCngCfa1dACc2MuGIp1xlQ17UMbIbh0ER9PGHEAEiJXkdcw9ftUBXOwogvqyMaAAZt1abHlbAg0U77o9COJEn8lvAmGs5-V2eN-Jqk4eoYHr2rtuk4F', currentPrice: 3499.00, lowestPrice: 2999.00, highestPrice: 3999.00, currency: 'USD', serpApiQuery: 'Razer Blade 16 RTX 4090' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQQwCv21g8iWsV5VTmpx9o0AT6i0eMshx8DFwt-Nn1e14iGizyMk3urXv9C0Qh-pD75Y5b70LWr-SjlHd0RWqDRFhw51cHkD-IuYqTqPNtxDhlBlvbbUx_4', currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
      { title: 'Keychron Q3 Max QMK/VIA Wireless Mechanical Keyboard', url: 'https://www.keychron.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQEm8J_3T3eOAc_AD1ZwVaxxo365yQRji_QeGgIw_o87udbzURGMdwMNI0ODbccbpEaxrwdFCkoxszQBVzRvPkTXDVqNnPJc18hhKWpYd6QpIBL37YFxrHv', currentPrice: 199.00, lowestPrice: 169.00, highestPrice: 219.00, currency: 'USD', serpApiQuery: 'Keychron Q3 Max mechanical keyboard' },
    ],
  },
  {
    name: 'Yasmin',
    email: 'yasmin@example.com',
    products: [
      { title: 'GoPro HERO12 Black – Waterproof Action Camera', url: 'https://gopro.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSlMjE3SLJoiGzHhSrP8Kd6IfquOdA-kkBOihMw_LG3paWcWag7Pyra6XVZ5oEOTFLmlUZcA8tX1qLqBKwTQadRWFzifdsBtHIZIP9vHqc9jwrzHjw_YUTG', currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 399.00, currency: 'USD', serpApiQuery: 'GoPro Hero 12 Black action camera' },
      { title: 'DJI Mini 4 Pro Drone with RC-N2 Controller', url: 'https://www.dji.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSarwp8YSC_G-_oDIZWvUtx7uLmBsyuWo4F32vqMPQOGYH3PlMyHJ3kOvp7_NVeijT-eXvAKCCZgVpWntxcBKPG-Nvs0uLt-Vdb1OpWz8w', currentPrice: 759.00, lowestPrice: 699.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'DJI Mini 4 Pro drone' },
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRhv5MVnNyPhU2pbflC2InEDtlvCkrW2zs1s5qLgf6QIPNWMWK27OgVbBYlIp0cK6Wi8skwVDD4LPnLwfKLLes-r6Ywuy3jbClpbsj1UMt_BAZ-c0zlpbPcWQ', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II mirrorless' },
    ],
  },
  {
    name: 'Omar',
    email: 'omar@example.com',
    products: [
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTfx17RAPmvCD0821pp1fCihdNa5YT6cbE22OJleV4YynD_n3JBAtuAL-UIm__WWRgG_CJKRAaloykd3d9aYdCIwvgxRUcs_wt-fDTSE1Yj', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3 Pro' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTAjiNerkR2kN5H7imocIjLOGYUnu8mil75OVPS0C83NSniSfgVLfBmaOXWyj01dzHfU4dwJWiqoZDO2QdBqMmpPIwQpOULHXp_L-6X5qBwHWppzcYFmbJa', currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4 256GB' },
      { title: 'Anker 747 GaNPrime 150W Desktop Charger', url: 'https://www.anker.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR88Wx1ddix2Y8D6L0J2n4p26QJn34tkdt9T3vTvKqLp3po7Gg9BNHRU50j4hIu49tmgrjhkSQEtaOTij8TTmOqa1F3q47B4fX-N3aWiqI7F6QGxe_ATmKwIg', currentPrice: 89.99, lowestPrice: 69.99, highestPrice: 99.99, currency: 'USD', serpApiQuery: 'Anker GaNPrime 150W charger' },
    ],
  },
  {
    name: 'Elena',
    email: 'elena@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRVeHWep4JTJb7l5NALbEs625eURLYaB_vQs3CkGh9nf28xTawomnYeNxqvNRXYflQ5pShL5MLOJw2o9u73bKuzp2E4YKEee2wM0D5nGTbGN3yIOz7e-q4O', currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra 512GB' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSHfiD0pnwUuwGtMKP09iQC9e9UV6FDrBFLjZtirXZ6S4wGXbJ-DiSPqeXjSvWFvNQWRAJ8IZNDDwdqOegJN531RIvWc_X-sY899yelYMghzX9h679vqIXzAMEl', currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd generation' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcSc6wkohwy80xLIUwQ0Wzm8-1sjjT8VAYAukcqb579g4mJa1Q8KFOS65DUP8IVgD92eUzPaWx-QSyyCFIVg0oohzvR20lceeM1B1tNMbpQ9uW0FlxcSQy52', currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm cellular' },
    ],
  },
  {
    name: 'Marcus',
    email: 'marcus@example.com',
    products: [
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC', url: 'https://rog.asus.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRyFxh-9A0sQEW9tc94ubClXzIrvnUITalZdlw4nAf6oiTx4ljcmEiOlHlkTbl_gO7lBIjK2LDoN40F-zMds26oMi8I0Xo0WZso_TtIZbvn', currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super graphics card' },
      { title: 'Sony PlayStation 5 Console Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRhkeM8RuIXwnE3kegw1asXyOwaaJ_U9518jCnEbF6hjJjKOCCsJAaoB6uLIRCj8z_52xlMtqfy6DGnIJLZcdA0znY12P6otQ5Y1toWh0i-9VuKNZm_RMDC4g', currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PlayStation 5 Slim console' },
      { title: 'Samsung 65" QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSVCxiWLkYQ0qiP7dMeB-fTwYIDlJrG7UkeqdCFdpoRaOH6hQz9xBoLwV1ZtE22HicxUMwI0wpgL2U4qbjNJgQg8pJj3akDbIgZqIF8Hfw3', currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K Q80D' },
    ],
  },
  {
    name: 'Zara',
    email: 'zara@example.com',
    products: [
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS0lkbE3uRN96ID_7kFZCdCcWCQUHi5aBjiVu-ZP5l19MdjCXCqGcRPnd8zwfWnA5W48PV3qV6OgZZnd3vERcRZH1Tp8pyVBgqDKnoYIUNy', currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum cleaner' },
      { title: 'Samsung Galaxy Tab S9 Ultra 14.6" Wi-Fi 512GB', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQ0Akuz51DxUZE9MKiSxfjJB9DdmxCaEeeEqFsBaSq9Kks_3UuQfOtZDOVwztqCIxcABSKR7wxZiKdvkfaUVcm7A_AHD860th53tlErIHY', currentPrice: 1099.00, lowestPrice: 899.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy Tab S9 Ultra 512GB' },
      { title: 'Logitech MX Master 3S Wireless Performance Mouse', url: 'https://www.logitech.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRnggtH9T2J8nqHJ6IB0jq-z6Xo-LtjJBGQH7MLcTGhmxJ_IACSqTMhmYrVd4FgpURhFhF0GOzQYhVhf_GdtgFvc9R-FAqD2_Waxq_-_4CaG6jpMp-RZ05r', currentPrice: 99.99, lowestPrice: 79.99, highestPrice: 109.99, currency: 'USD', serpApiQuery: 'Logitech MX Master 3S wireless mouse' },
    ],
  },
  {
    name: 'Priya',
    email: 'priya@example.com',
    products: [
      { title: 'Apple iPhone 15 Pro Max 256GB – Natural Titanium', url: 'https://www.apple.com/iphone-15-pro/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRpC9h24ev7xchbRr_bR-IMb1wlNxHNd0_YrUrnNpCBu53_ikc7mEXsankM1crgPXzWWkv2crAUYRTo5ts6ZTQd99bSGV-GyezxPSw8nqo', currentPrice: 1199.00, lowestPrice: 1099.00, highestPrice: 1299.00, currency: 'USD', serpApiQuery: 'iPhone 15 Pro Max' },
      { title: 'Bose SoundLink Max Portable Bluetooth Speaker', url: 'https://www.bose.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS6QAZoCP2IuGzQINOoKO8HkDmPHfTjrHE_sugyExFyrOIGYfVzA8BBWbbklSZW9_s1Q1lRJE3ovgbbnLJw6QPvj1khg-GVug9ptAZzOHQg9IpyDfbicUUH', currentPrice: 399.00, lowestPrice: 349.00, highestPrice: 429.00, currency: 'USD', serpApiQuery: 'Bose SoundLink Max speaker' },
      { title: 'Kindle Oasis E-reader 32GB Graphite Adjustable Warm Light', url: 'https://www.amazon.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRAyEUzcYHVn3MfxWmjBUZMVIYyy_oXmRY-WHka0T1lZpkcLJVZKvUqOwcnPI3-w8PJgXnBtjb8UyL-psyVJqiZdreNtcbyZsAjylakTYJ8ldzxSyZAp4p0zw', currentPrice: 249.00, lowestPrice: 179.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'Kindle Oasis 32GB e-reader' },
    ],
  },
  {
    name: 'Hassan',
    email: 'hassan@example.com',
    products: [
      { title: 'Microsoft Xbox Series X 1TB Console', url: 'https://www.xbox.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTBbyyurrvHEfYXwQ5r48GbwI8YRNhx05lGnbu4fPHoGBUr86wuyUfQwRzBcYwt8JI4r0C4sYXCJVZQac08dhk1ailDQJaqg_lARrlsZfq6yE_S2e88QGdhtg', currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'Xbox Series X console' },
      { title: 'ASUS ROG Strix NVIDIA GeForce RTX 4080 Super OC Edition', url: 'https://rog.asus.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQNr23vigsU7L8fSt1WPxJhX1zUgrpUkIKC7Fl-3V_lJMjZ5XjyUMTxGlIKf3LOq7CWsYVV1Y-ko810CXglC2ncKgcaTyzLsvATS5E3_lqa', currentPrice: 999.00, lowestPrice: 949.00, highestPrice: 1199.00, currency: 'USD', serpApiQuery: 'RTX 4080 Super GPU' },
      { title: 'Anker 747 GaNPrime 150W Desktop Charger', url: 'https://www.anker.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR88Wx1ddix2Y8D6L0J2n4p26QJn34tkdt9T3vTvKqLp3po7Gg9BNHRU50j4hIu49tmgrjhkSQEtaOTij8TTmOqa1F3q47B4fX-N3aWiqI7F6QGxe_ATmKwIg', currentPrice: 89.99, lowestPrice: 69.99, highestPrice: 99.99, currency: 'USD', serpApiQuery: 'Anker GaNPrime 150W charger' },
    ],
  },
  {
    name: 'Chloe',
    email: 'chloe@example.com',
    products: [
      { title: 'Apple MacBook Pro 16-inch M3 Pro – Space Black', url: 'https://www.apple.com/macbook-pro/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTfx17RAPmvCD0821pp1fCihdNa5YT6cbE22OJleV4YynD_n3JBAtuAL-UIm__WWRgG_CJKRAaloykd3d9aYdCIwvgxRUcs_wt-fDTSE1Yj', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2699.00, currency: 'USD', serpApiQuery: 'MacBook Pro 16 M3' },
      { title: 'Google Pixel 8 Pro 256GB Obsidian', url: 'https://store.google.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTYIy1nZQrfXbhe_avqCV1QAzZAeLFe3Dl1FT8LH9bWto3TbC_4V8HHG--ZVqio6yjEALns0ptXqTKrbrpClFrLV43ChPTjA6qSjXEqsGcwV1ydZOJkZRa3', currentPrice: 799.00, lowestPrice: 699.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'Google Pixel 8 Pro 256GB' },
      { title: 'GoPro HERO12 Black – Waterproof Action Camera', url: 'https://gopro.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSlMjE3SLJoiGzHhSrP8Kd6IfquOdA-kkBOihMw_LG3paWcWag7Pyra6XVZ5oEOTFLmlUZcA8tX1qLqBKwTQadRWFzifdsBtHIZIP9vHqc9jwrzHjw_YUTG', currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 399.00, currency: 'USD', serpApiQuery: 'GoPro Hero 12 Black action camera' },
    ],
  },
  {
    name: 'Diego',
    email: 'diego@example.com',
    products: [
      { title: 'Sony PlayStation 5 Console (PS5) Slim Disc Edition', url: 'https://www.playstation.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRq_sYiBLS-sP3GJN4Ptll6wM_cDGaRDMS_hqesJXB0oA9h6xIAxVnJ9CzO48n4slXvGuAMZS6scUlZG1aWdlcPn6BVXq0yPRxgQ2YAeiQ', currentPrice: 449.00, lowestPrice: 399.00, highestPrice: 499.00, currency: 'USD', serpApiQuery: 'PS5 Slim console' },
      { title: 'Nintendo Switch OLED Model White', url: 'https://www.nintendo.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQHEqzdFlsIfdxVOJSRZfQGQoA_dbfmIPW_EVdpq8hldWr4T4QGPjagycCJa8wogSQjwV642NK6a0zjR0wotmiZdi5rHcJfyZkL3k5O2kUo0GYW-wuUhV9R', currentPrice: 349.00, lowestPrice: 299.00, highestPrice: 369.00, currency: 'USD', serpApiQuery: 'Nintendo Switch OLED' },
      { title: 'LG UltraGear 27" 4K OLED Gaming Monitor 240Hz', url: 'https://www.lg.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQQwCv21g8iWsV5VTmpx9o0AT6i0eMshx8DFwt-Nn1e14iGizyMk3urXv9C0Qh-pD75Y5b70LWr-SjlHd0RWqDRFhw51cHkD-IuYqTqPNtxDhlBlvbbUx_4', currentPrice: 799.00, lowestPrice: 749.00, highestPrice: 999.00, currency: 'USD', serpApiQuery: 'LG OLED gaming monitor 27 inch' },
    ],
  },
  {
    name: 'Fatima',
    email: 'fatima@example.com',
    products: [
      { title: 'Samsung 65" Class QLED 4K Q80D Smart TV 2024', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQEr3d8QwIIwh1qHLEzyX8inLPTk84najHCJlZQGaJ1HFZ0foFyVSMD6hoU0B8saNDmM5_pttqYRWxLClS-4QJp0pKrEBiAjGdN8SGIZcZUdu18Uwc9ma3_', currentPrice: 1097.00, lowestPrice: 899.00, highestPrice: 1499.00, currency: 'USD', serpApiQuery: 'Samsung 65 QLED 4K TV' },
      { title: 'Apple Watch Series 9 45mm GPS + Cellular – Midnight Aluminum', url: 'https://www.apple.com/apple-watch-series-9/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcRwqAul_zQ8NmGtkLDtUMXkOAdARTFkxNxw6uOmM-lJ__A9hrLHWLAiMYCMzWuXk6C28NFrbqvKvs8OpUYkIJ8xVHf5QMCeoXb5rNxsVeA', currentPrice: 499.00, lowestPrice: 429.00, highestPrice: 529.00, currency: 'USD', serpApiQuery: 'Apple Watch Series 9 45mm' },
      { title: 'Dyson V15 Detect Absolute Cordless Vacuum Cleaner', url: 'https://www.dyson.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS0lkbE3uRN96ID_7kFZCdCcWCQUHi5aBjiVu-ZP5l19MdjCXCqGcRPnd8zwfWnA5W48PV3qV6OgZZnd3vERcRZH1Tp8pyVBgqDKnoYIUNy', currentPrice: 749.00, lowestPrice: 649.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'Dyson V15 Detect vacuum cleaner' },
    ],
  },
  {
    name: 'Noah',
    email: 'noah@example.com',
    products: [
      { title: 'Dell XPS 15 Laptop Intel Core i9 RTX 4070 1TB SSD', url: 'https://www.dell.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQpDKiQsWBmUveKMFuHPq-qpf_wIIfycA-TQ-lvjC_t0qZV3o6bhzt9eOIPTqbZZNGPD8Gq-yABFTKAJ1rCZk-VabIMvMdNwFSIXngAgFHaKRr7LHDuypz07A', currentPrice: 1899.00, lowestPrice: 1699.00, highestPrice: 2199.00, currency: 'USD', serpApiQuery: 'Dell XPS 15 i9 RTX 4070' },
      { title: 'Canon EOS R6 Mark II Mirrorless Camera Body', url: 'https://www.usa.canon.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRhv5MVnNyPhU2pbflC2InEDtlvCkrW2zs1s5qLgf6QIPNWMWK27OgVbBYlIp0cK6Wi8skwVDD4LPnLwfKLLes-r6Ywuy3jbClpbsj1UMt_BAZ-c0zlpbPcWQ', currentPrice: 2499.00, lowestPrice: 2299.00, highestPrice: 2799.00, currency: 'USD', serpApiQuery: 'Canon EOS R6 Mark II' },
      { title: 'DJI Mini 4 Pro Drone with RC-N2 Controller', url: 'https://www.dji.com/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSarwp8YSC_G-_oDIZWvUtx7uLmBsyuWo4F32vqMPQOGYH3PlMyHJ3kOvp7_NVeijT-eXvAKCCZgVpWntxcBKPG-Nvs0uLt-Vdb1OpWz8w', currentPrice: 759.00, lowestPrice: 699.00, highestPrice: 849.00, currency: 'USD', serpApiQuery: 'DJI Mini 4 Pro drone' },
    ],
  },
  {
    name: 'Amara',
    email: 'amara@example.com',
    products: [
      { title: 'Samsung Galaxy S24 Ultra 512GB – Titanium Black', url: 'https://www.samsung.com/', imageUrl: 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRVeHWep4JTJb7l5NALbEs625eURLYaB_vQs3CkGh9nf28xTawomnYeNxqvNRXYflQ5pShL5MLOJw2o9u73bKuzp2E4YKEee2wM0D5nGTbGN3yIOz7e-q4O', currentPrice: 1299.00, lowestPrice: 1099.00, highestPrice: 1419.00, currency: 'USD', serpApiQuery: 'Samsung Galaxy S24 Ultra' },
      { title: 'Apple AirPods Pro (2nd Generation) with MagSafe', url: 'https://www.apple.com/airpods-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSHfiD0pnwUuwGtMKP09iQC9e9UV6FDrBFLjZtirXZ6S4wGXbJ-DiSPqeXjSvWFvNQWRAJ8IZNDDwdqOegJN531RIvWc_X-sY899yelYMghzX9h679vqIXzAMEl', currentPrice: 249.00, lowestPrice: 199.00, highestPrice: 279.00, currency: 'USD', serpApiQuery: 'AirPods Pro 2nd gen' },
      { title: 'Garmin Fenix 7X Solar Multisport GPS Smartwatch', url: 'https://www.garmin.com/', imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTdXvHsZe9uqN-kN2ZXnFjfg_Ji4RPZz_BfJAgzeTd_1HdNQmxeMHINHibX4yAwBty4To0zCA_CY1tkuU3JebEi52pJG28neupREsNSwaKoTCyfBM6N8zxj', currentPrice: 699.00, lowestPrice: 599.00, highestPrice: 799.00, currency: 'USD', serpApiQuery: 'Garmin Fenix 7X Solar smartwatch' },
    ],
  },
  {
    name: 'Victor',
    email: 'victor@example.com',
    products: [
      { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', url: 'https://www.sony.com/en/articles/wh1000xm5', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSRO9FgghvbjJfBUF3jbBNNK_Yw66h5S-Onz9UwROciL7kVjFoselP7V88GA9jMurvToIvdZZ3-6xKEMidLVGHKHLlWQrqFG4cw7IF3pBwPLqwbrlfxubg1', currentPrice: 279.00, lowestPrice: 248.00, highestPrice: 349.00, currency: 'USD', serpApiQuery: 'Sony WH-1000XM5' },
      { title: 'Razer Blade 16 Laptop RTX 4090 Intel i9 32GB RAM', url: 'https://www.razer.com/', imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSkRfCngCfa1dACc2MuGIp1xlQ17UMbIbh0ER9PGHEAEiJXkdcw9ftUBXOwogvqyMaAAZt1abHlbAg0U77o9COJEn8lvAmGs5-V2eN-Jqk4eoYHr2rtuk4F', currentPrice: 3499.00, lowestPrice: 2999.00, highestPrice: 3999.00, currency: 'USD', serpApiQuery: 'Razer Blade 16 RTX 4090' },
      { title: 'Apple iPad Pro 13-inch M4 Wi-Fi 256GB – Space Black', url: 'https://www.apple.com/ipad-pro/', imageUrl: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTAjiNerkR2kN5H7imocIjLOGYUnu8mil75OVPS0C83NSniSfgVLfBmaOXWyj01dzHfU4dwJWiqoZDO2QdBqMmpPIwQpOULHXp_L-6X5qBwHWppzcYFmbJa', currentPrice: 1299.00, lowestPrice: 1199.00, highestPrice: 1399.00, currency: 'USD', serpApiQuery: 'iPad Pro 13 M4' },
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
  console.log('Seeding demo users and wishlists...');
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

  console.log('Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
