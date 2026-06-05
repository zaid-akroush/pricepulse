require('dotenv').config();
const app = require('./app');
const { startPriceCron } = require('./jobs/priceCron');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PricePulse backend running on port ${PORT}`);
  startPriceCron();
});
