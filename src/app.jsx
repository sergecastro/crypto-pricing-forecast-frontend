import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const API_BASE = 'http://localhost:8020';

const api = {
  spotPrice: (symbol) =>
    fetch(`${API_BASE}/price/spot?coin=${symbol}`).then((r) => r.json()).catch(() => null),
  dexQuote: (symbol) =>
    fetch(`${API_BASE}/dex/paraswap_quote?sell_token=USDC&buy_token=${symbol.toUpperCase()}&amount=10000`)
      .then((r) => r.json())
      .catch(() => null),
  bestPrice: (symbol) =>
    fetch(`${API_BASE}/best_price?symbol=${symbol}`).then((r) => r.json()).catch(() => null),
  ethGas: () =>
    fetch(`${API_BASE}/fees/eth`).then((r) => r.json()).catch(() => null),
  history: (symbol) =>
    fetch(`${API_BASE}/history/${symbol}`).then((r) => r.json()).catch(() => null),
};

function PriceCard({ title, provider, price, gasFee, isLoading, isBest }) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-4 ${isBest ? 'ring-2 ring-green-500' : ''} h-full flex flex-col justify-between`}
    >
      {isBest && (
        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full inline-block mb-2">BEST PRICE</div>
      )}
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{provider}</p>
      </div>
      <div className={`${isLoading ? 'animate-pulse bg-gray-200 h-6 w-20 rounded' : ''}`}>
        {!isLoading && price !== null ? (
          <div>
            <span className="text-xl font-bold text-gray-900">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {gasFee !== null && title === 'DEX Price' && (
              <p className="text-sm text-gray-500">
                + ${gasFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Gas
              </p>
            )}
          </div>
        ) : (
          !isLoading && <span className="text-xl font-bold text-red-500">N/A</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState('eth');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [prices, setPrices] = useState({ spot: null, dex: null, best: null, gas: null });
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    console.log('Setting up beforeinstallprompt listener');
    const handler = (e) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      console.log('Install button clicked, showing prompt');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  const fetchPrices = useCallback(async () => {
    console.log(`fetchPrices called, demoMode: ${demoMode}`);
    if (demoMode) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const demoMultiplier =
          symbol === 'btc'
            ? 20
            : symbol === 'eth'
            ? 1
            : symbol === 'sol'
            ? 0.5
            : symbol === 'usdt'
            ? 0.00025
            : 0.0001;
        setPrices({
          spot: 2345.67 * demoMultiplier,
          dex: 2351.20 * demoMultiplier,
          best: 2348.50 * demoMultiplier,
          gas: 5.0,
        });
      }, 800);
      return;
    }

    setLoading(true);
    try {
      console.log(`Fetching DEX quote and gas for symbol: ${symbol}`);
      const [spot, dex, best, ethGas] = await Promise.all([
        api.spotPrice(symbol),
        api.dexQuote(symbol),
        api.bestPrice(symbol),
        symbol === 'eth' ? api.ethGas() : Promise.resolve(null),
      ]);

      let dexPrice = null;
      if (dex?.price?.destAmount && parseInt(dex.price.destAmount) > 0) {
        dexPrice = 10000 / (parseInt(dex.price.destAmount) / 10 ** dex.price.destDecimals);
      }
      if (dexPrice !== null && (isNaN(dexPrice) || !isFinite(dexPrice))) {
        dexPrice = null;
      }
      const gasFee =
        dex?.price?.gasCostUSD
          ? parseFloat(dex.price.gasCostUSD)
          : symbol === 'eth' && ethGas?.result?.ProposeGasPrice
          ? parseFloat(ethGas.result.ProposeGasPrice) * 0.000000001 * 21000 * 4000
          : null;

      setPrices({
        spot: spot?.price || null,
        dex: dexPrice,
        best: best?.best_price?.price_usd || null,
        gas: gasFee,
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setPrices({ spot: 'Error', dex: 'Error', best: 'Error', gas: null });
    } finally {
      setLoading(false);
    }
  }, [symbol, demoMode]);

  useEffect(() => {
    api.spotPrice(symbol)
      .then((data) => {
        if (data?.price) setDemoMode(false);
        else fetchPrices();
      })
      .catch(() => fetchPrices());
  }, [symbol]);

  const getBestPriceValue = () => prices.best || Math.min(prices.spot || Infinity, prices.dex || Infinity);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.history(symbol);
        if (response?.prices) {
          const formattedHistory = response.prices.map(([timestamp, price]) => ({
            time: new Date(timestamp).toLocaleDateString(),
            price: price,
          }));
          setHistory(formattedHistory);
        }
      } catch (err) {
        console.error('History fetch error:', err);
        setHistory([]);
      }
    };
    fetchHistory();
  }, [symbol]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-blue-500">Crypto Price Comparison</h1>
      <div className="mb-4 flex items-center">
        <label htmlFor="coin-select" className="mr-2">
          Select Coin:{' '}
        </label>
        <select
          id="coin-select"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="p-2 w-32 border border-gray-300 rounded-md"
        >
          <option value="eth">ETH</option>
          <option value="btc">BTC</option>
          <option value="sol">SOL</option>
          <option value="usdt">USDT</option>
          <option value="ada">ADA</option>
        </select>
        <button
          onClick={fetchPrices}
          disabled={loading}
          className="ml-2 p-2 bg-blue-500 text-white rounded flex items-center"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {showInstallButton && (
          <button
            onClick={handleInstallClick}
            className="ml-2 p-2 bg-green-500 text-white rounded flex items-center"
          >
            Install App
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PriceCard
          title="Spot Price"
          provider="CoinGecko"
          price={prices.spot}
          gasFee={null}
          isLoading={loading}
          isBest={prices.spot === getBestPriceValue()}
        />
        <PriceCard
          title="DEX Price"
          provider="ParaSwap"
          price={prices.dex}
          gasFee={prices.gas}
          isLoading={loading}
          isBest={prices.dex === getBestPriceValue()}
        />
        <PriceCard
          title="Best Price"
          provider="System"
          price={prices.best || getBestPriceValue()}
          gasFee={null}
          isLoading={loading}
          isBest={false}
        />
      </div>
      {/* New Chart Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">7-Day Price History</h2>
        {console.log('History data:', history)}
        <LineChart width={600} height={300} data={history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" stroke="#8884d8" />
        </LineChart>
      </div>
    </div>
  );
}