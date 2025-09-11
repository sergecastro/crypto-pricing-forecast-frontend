import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Bell, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const API_BASE = 'https://crypto-pricing-forecast-backend.onrender.com';

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

  history: (symbol, days = 7) =>
    fetch(`${API_BASE}/history/${symbol}?days=${days}`)
      .then((r) => r.json())
      .catch(() => null),
};

const formatChartDate = (timestamp, days) => {
  const date = new Date(timestamp);
  
  if (days === 1) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } else if (days === 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (days === 30) {
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  }
};

const downsampleData = (data, maxPoints = 100) => {
  if (data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
};

const periodLabel = (days) => {
  if (days === 1) return '24-Hour';
  if (days === 7) return '7-Day';
  if (days === 30) return '30-Day';
  if (days === 90) return '90-Day';
  return `${days}-Day`;
};

const ChartSkeleton = () => (
  <div className="w-full h-80 bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
    <div className="flex items-center space-x-2 text-gray-500">
      <Clock className="w-5 h-5 animate-spin" />
      <span>Loading chart data...</span>
    </div>
  </div>
);

// Toast Notification Component
const Toast = ({ show, message, onClose }) => {
  if (!show) return null;
  
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-center">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between max-w-md w-full">
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 text-white hover:text-green-200">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Alert Modal Component
const AlertModal = ({ show, onClose, currentPrice, symbol, alertPrice, setAlertPrice, alertType, setAlertType, setAlerts, setShowToast, setToastMessage }) => {
  if (!show) return null;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!alertPrice || isNaN(alertPrice)) return;
    
    const newAlert = {
      id: Date.now(),
      symbol: symbol.toUpperCase(),
      targetPrice: parseFloat(alertPrice),
      currentPrice: currentPrice,
      type: alertType,
      createdAt: new Date().toLocaleString()
    };
    
    setAlerts(prev => [...prev, newAlert]);
    setAlertPrice('');
    
    // Show success toast
    setToastMessage(`Alert set for ${symbol.toUpperCase()} ${alertType} $${parseFloat(alertPrice).toFixed(2)}`);
    setShowToast(true);
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
    
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Set Price Alert</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Alert when {symbol.toUpperCase()} goes:
            </label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              className="w-full p-2 border rounded-md mb-2"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Target Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              placeholder={`Current: $${currentPrice?.toFixed(2) || '0.00'}`}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Set Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PeriodButtons = ({ value, onChange, disabled = false }) => {
  const options = [
    { label: '24h', days: 1 },
    { label: '7d',  days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
  ];
  
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o.days}
          onClick={() => onChange(o.days)}
          disabled={disabled}
          aria-pressed={value === o.days}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: value === o.days ? '#111' : '#fff',
            color: value === o.days ? '#fff' : disabled ? '#999' : '#111',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

function PriceCard({ title, provider, price, gasFee, isLoading, isBest, onSetAlert }) {
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
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-gray-900">
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {onSetAlert && (
                <button
                  onClick={() => onSetAlert(price)}
                  className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Set price alert"
                >
                  <Bell className="w-4 h-4" />
                </button>
              )}
            </div>
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [prices, setPrices] = useState({ spot: null, dex: null, best: null, gas: null });
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertType, setAlertType] = useState('above');
  const [alerts, setAlerts] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  const fetchPrices = useCallback(async () => {
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
      })
      .finally(() => {
        fetchPrices();
      });
  }, [symbol, fetchPrices]);

  const getBestPriceValue = () =>
    prices.best || Math.min(prices.spot || Infinity, prices.dex || Infinity);

  const handleSetAlert = (currentPrice) => {
    setAlertPrice('');
    setShowAlertModal(true);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await api.history(symbol, selectedPeriod);
        if (response?.prices && Array.isArray(response.prices)) {
          const rawData = response.prices
            .filter(([timestamp, price]) => timestamp && price && !isNaN(price))
            .map(([timestamp, price]) => ({
              timestamp,
              time: formatChartDate(timestamp, selectedPeriod),
              price: Number(price),
            }));
          
          const processedData = downsampleData(rawData, 150);
          setHistory(processedData);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.error('History fetch error:', err);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    if (symbol) fetchHistory();
  }, [symbol, selectedPeriod]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-blue-500 text-2xl font-bold mb-6">Crypto Price Comparison</h1>

      <div className="mb-6 flex items-center flex-wrap gap-2">
        <label htmlFor="coin-select" className="mr-2 font-medium">
          Select Coin:{' '}
        </label>

        <select
          id="coin-select"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="p-2 w-40 border border-gray-300 rounded-md"
        >
          <option value="eth">ETH</option>
          <option value="btc">BTC</option>
          <option value="sol">SOL</option>
          <option value="usdt">USDT</option>
          <option value="ada">ADA</option>
          <option value="matic">MATIC</option>
          <option value="avax">AVAX</option>
          <option value="dot">DOT</option>
          <option value="link">LINK</option>
          <option value="uni">UNI</option>
        </select>

        <button
          onClick={fetchPrices}
          disabled={loading}
          className="p-2 bg-blue-500 text-white rounded flex items-center hover:bg-blue-600 disabled:opacity-50"
          title="Refresh prices"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {showInstallButton && (
          <button
            onClick={handleInstallClick}
            className="p-2 bg-green-500 text-white rounded flex items-center hover:bg-green-600"
          >
            Install App
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <PriceCard
          title="Spot Price"
          provider="CoinGecko"
          price={prices.spot}
          gasFee={null}
          isLoading={loading}
          isBest={prices.spot === getBestPriceValue()}
          onSetAlert={handleSetAlert}
        />
        <PriceCard
          title="DEX Price"
          provider="ParaSwap"
          price={prices.dex}
          gasFee={prices.gas}
          isLoading={loading}
          isBest={prices.dex === getBestPriceValue()}
          onSetAlert={handleSetAlert}
        />
        <PriceCard
          title="Best Price"
          provider="System"
          price={prices.best || getBestPriceValue()}
          gasFee={null}
          isLoading={loading}
          isBest={false}
          onSetAlert={handleSetAlert}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <PeriodButtons 
            value={selectedPeriod} 
            onChange={setSelectedPeriod}
            disabled={historyLoading}
          />
          <h2 className="text-xl font-semibold text-gray-900">
            {periodLabel(selectedPeriod)} Price History
            {historyLoading && (
              <span className="ml-2 text-sm text-gray-500 flex items-center">
                <Clock className="w-4 h-4 animate-spin mr-1" />
                Loading...
              </span>
            )}
          </h2>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          {historyLoading ? (
            <ChartSkeleton />
          ) : history.length > 0 ? (
            <LineChart
              width={Math.min(900, Math.max(600, window.innerWidth - 120))}
              height={320}
              data={history}
              margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value) => [`$${value.toLocaleString()}`, 'Price']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          ) : (
            <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">No chart data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Alerts List */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Active Price Alerts ({alerts.length})</h3>
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{alert.symbol}</span>
                  <span className="mx-2 text-gray-500">
                    {alert.type} ${alert.targetPrice.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-400">
                    (Current: ${alert.currentPrice.toFixed(2)})
                  </span>
                </div>
                <button
                  onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Delete alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Toast
        show={showToast}
        message={toastMessage}
        onClose={() => setShowToast(false)}
      />

      <AlertModal
        show={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        currentPrice={prices.spot}
        symbol={symbol}
        alertPrice={alertPrice}
        setAlertPrice={setAlertPrice}
        alertType={alertType}
        setAlertType={setAlertType}
        setAlerts={setAlerts}
        setShowToast={setShowToast}
        setToastMessage={setToastMessage}
      />
    </div>
  );
}