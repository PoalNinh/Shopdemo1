import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './MobilePOS.css'; // Import CSS
import authUtils from '../utils/authUtils';

const MobilePOS = () => {
  // State Management
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [activeOrders, setActiveOrders] = useState(new Map());
  const [categories, setCategories] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const userData = authUtils.getUserData();
  const [appInitialized, setAppInitialized] = useState(false);  // Track if app has initialized

  // Constants
  const CONFIG = {
    cacheTime: 3600000 // 1 hour
  };

  // Refs
  const productGridRef = useRef(null);
  const tableGridRef = useRef(null);

  const generateVietQRUrl = (amount, description) => {
    // Format to required VietQR standards
    const bankId = "970422"; // MB Bank BIN
    const accountNo = "7320012003";
    const amountStr = Math.round(amount).toString();
    const encodedDescription = encodeURIComponent(description || "Thanh toan don hang");

    // Generate VietQR URL with static image approach
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amountStr}&addInfo=${encodedDescription}`;
  };

  // Utilities
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const calculateTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

// Create a set to track active toast messages
const activeToasts = new Set();

// UI Notifications
const showNotification = (message, type = 'success') => {
  // Generate a unique ID for each toast
  const toastId = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  // Optional: prevent duplicate messages
  if (activeToasts.has(message)) {
    return; // Skip duplicate messages
  }
  
  // Track this message
  activeToasts.add(message);
  
  toast[type](message, {
    position: "bottom-left",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    toastId: toastId, // Use unique ID to prevent overwriting
    onClose: () => {
      // Remove from tracking when toast is closed
      activeToasts.delete(message);
    }
  });
};
  
  // Data Cache Functions
  const saveProductsToCache = (products) => {
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('productsTimestamp', Date.now().toString());
  };

  const getProductsFromCache = () => {
    const cached = localStorage.getItem('products');
    const timestamp = localStorage.getItem('productsTimestamp');

    if (cached && timestamp && (Date.now() - parseInt(timestamp) < CONFIG.cacheTime)) {
      return JSON.parse(cached);
    }
    return null;
  };

  const saveTablesToCache = (tables) => {
    localStorage.setItem('tables', JSON.stringify(tables));
    localStorage.setItem('tablesTimestamp', Date.now().toString());
  };

  const getTablesFromCache = () => {
    const cached = localStorage.getItem('tables');
    const timestamp = localStorage.getItem('tablesTimestamp');

    if (cached && timestamp && (Date.now() - parseInt(timestamp) < CONFIG.cacheTime)) {
      return JSON.parse(cached);
    }
    return null;
  };

  const saveCartState = (tableId, cart) => {
    let cartState = JSON.parse(localStorage.getItem('cartState') || '{}');
    cartState[tableId] = cart;
    localStorage.setItem('cartState', JSON.stringify(cartState));
  };

  const getCartState = () => {
    return JSON.parse(localStorage.getItem('cartState') || '{}');
  };

  const saveActiveOrders = (orders) => {
    localStorage.setItem('activeOrders', JSON.stringify(Array.from(orders.entries())));
  };

  const getActiveOrders = () => {
    const saved = localStorage.getItem('activeOrders');
    return saved ? new Map(JSON.parse(saved)) : new Map();
  };

  // Initialize app state
 // Trong hàm loadAppState, thêm logic để đặt mặc định "Khách mua về"
const loadAppState = () => {
  const savedTableId = localStorage.getItem('selectedTableId');
  if (savedTableId) {
    setSelectedTableId(savedTableId);
  } else {
    // Đặt mặc định là "Khách mua về" nếu không có bàn nào được chọn
    const defaultTable = tables.find(t => t['Tên bàn'] === 'Khách mua về');
    if (defaultTable) {
      setSelectedTableId(defaultTable.IDBAN);
      localStorage.setItem('selectedTableId', defaultTable.IDBAN);
    }
  }

  const savedOrders = getActiveOrders();
  setActiveOrders(savedOrders);

  const cartState = getCartState();
  if (savedTableId && cartState[savedTableId]) {
    setCart(cartState[savedTableId]);
  }
};

  // Update network status
  const updateNetworkStatus = () => {
    const wasOnline = isOnline;
    setIsOnline(navigator.onLine);

    if (!navigator.onLine) {
      showNotification('Bạn đang trong chế độ ngoại tuyến', 'warning');
    } else if (!wasOnline && navigator.onLine) {
      syncOfflineTransactions();
    }
  };

  // API Calls
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      let productsData = [];

      // Try to get cached products first
      const cachedProducts = getProductsFromCache();
      if (cachedProducts) {
        productsData = cachedProducts;
        setProducts(productsData);
        setFilteredProducts(productsData);
        processProductCategories(productsData);
      }

      // Only fetch new products if online
      if (navigator.onLine) {
        const response = await authUtils.apiRequest('Sản phẩm', 'Find', {
          Selector: "Filter(Sản phẩm, true)"
        });

        productsData = response;
        setProducts(productsData);
        setFilteredProducts(productsData);

        // Save to cache
        saveProductsToCache(productsData);
        processProductCategories(productsData);
      } else if (!cachedProducts) {
        showNotification('Không thể tải sản phẩm. Vui lòng kiểm tra kết nối mạng.', 'error');
      }

      return productsData;
    } catch (error) {
      console.error('Error fetching products:', error);
      showNotification('Không thể tải danh sách sản phẩm', 'error');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

// Xóa useEffect khỏi fetchTables
const fetchTables = async () => {
  try {
    let tablesData = [];

    // Try to get cached tables first
    const cachedTables = getTablesFromCache();
    if (cachedTables) {
      tablesData = cachedTables;
      setTables(tablesData);
    }

    // Only fetch new tables if online
    if (navigator.onLine) {
      const response = await authUtils.apiRequest('DSBAN', 'Find', {
        Selector: "Filter(DSBAN, true)"
      });

      tablesData = response;
      setTables(tablesData);

      // Save to cache
      saveTablesToCache(tablesData);
      
      // useEffect đã bị xóa khỏi đây
      
    } else if (!cachedTables) {
      showNotification('Không thể tải danh sách bàn. Vui lòng kiểm tra kết nối mạng.', 'error');
    }

    return tablesData;
  } catch (error) {
    console.error('Error fetching tables:', error);
    showNotification('Không thể tải danh sách bàn', 'error');
    return [];
  }
};

// Thêm useEffect mới ở mức cao nhất của component
useEffect(() => {
  if (tables.length > 0 && !selectedTableId) {
    const defaultTable = tables.find(t => t['Tên bàn'] === 'Khách mua về');
    if (defaultTable) {
      setSelectedTableId(defaultTable.IDBAN);
      localStorage.setItem('selectedTableId', defaultTable.IDBAN);
    }
  }
}, [tables, selectedTableId]);

  // Process product categories
  const processProductCategories = (products) => {
    const uniqueCategories = new Set();

    products.forEach(product => {
      if (product['Loại sản phẩm']) {
        uniqueCategories.add(product['Loại sản phẩm']);
      }
    });

    setCategories(uniqueCategories);
  };

  // Filter products by category
  const filterProductsByCategory = (category) => {
    setSelectedCategory(category);

    if (category === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p['Loại sản phẩm'] === category));
    }
  };

  // Filter products by search term
  const handleSearch = (term) => {
    // Store the raw input value
    setSearchTerm(term);

    if (term.trim() === '') {
      // If search is cleared, restore category filtering
      if (selectedCategory !== 'all') {
        filterProductsByCategory(selectedCategory);
      } else {
        setFilteredProducts(products);
      }
    } else {
      try {
        // Create a case-insensitive search that works across languages
        const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const filtered = products.filter(product => {
          // Try both direct string includes and regex test for maximum compatibility
          const productName = product['Tên sản phẩm'] || '';
          return productName.toLowerCase().includes(term.toLowerCase()) ||
            searchRegex.test(productName);
        });

        setFilteredProducts(filtered);
      } catch (error) {
        // Fallback to simple includes if regex fails
        console.error("Search regex error:", error);
        const filtered = products.filter(product => {
          const productName = product['Tên sản phẩm'] || '';
          return productName.toLowerCase().includes(term.toLowerCase());
        });
        setFilteredProducts(filtered);
      }
    }
  };

  // Add product to cart
  const addToCart = (productId, quantity = 1) => {
    if (!selectedTableId) {
      showNotification('Vui lòng chọn bàn trước', 'error');
      setShowTableModal(true);
      return;
    }

    const product = products.find(p => p.IDSP === productId);
    if (!product) return;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === productId);
      let newCart;

      if (existingItem) {
        newCart = prevCart.map(item =>
          item.id === productId ? { ...item, quantity: quantity } : item
        );
      } else {
        newCart = [...prevCart, {
          id: product.IDSP,
          name: product['Tên sản phẩm'],
          price: parseInt(product['Đơn giá']),
          quantity: quantity
        }];
      }

      // Save cart state
      saveCartState(selectedTableId, newCart);

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...newCart]);
      setActiveOrders(newActiveOrders);
      saveActiveOrders(newActiveOrders);

      return newCart;
    });
  };

  // Adjust cart item quantity
  const adjustQuantity = (itemId, amount) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === itemId) {
          return { ...item, quantity: item.quantity + amount };
        }
        return item;
      }).filter(item => item.quantity > 0);

      // Save cart state
      saveCartState(selectedTableId, updatedCart);

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...updatedCart]);
      setActiveOrders(newActiveOrders);
      saveActiveOrders(newActiveOrders);

      return updatedCart;
    });
  };

  // Remove item from cart
  const removeItem = (itemId) => {
    setCart(prevCart => {
      const updatedCart = prevCart.filter(item => item.id !== itemId);

      // Save cart state
      saveCartState(selectedTableId, updatedCart);

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...updatedCart]);
      setActiveOrders(newActiveOrders);
      saveActiveOrders(newActiveOrders);

      return updatedCart;
    });
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    saveCartState(selectedTableId, []);

    // Update active orders
    const newActiveOrders = new Map(activeOrders);
    newActiveOrders.delete(selectedTableId);
    setActiveOrders(newActiveOrders);
    saveActiveOrders(newActiveOrders);

    setShowCartModal(false);
  };

  // Select table
  const selectTable = (tableId) => {
    const table = tables.find(t => t.IDBAN === tableId);
    if (!table) return;

    // Save current cart if exists
    if (selectedTableId && cart.length > 0) {
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...cart]);
      setActiveOrders(newActiveOrders);
      saveActiveOrders(newActiveOrders);
    }

    // Update selected table
    setSelectedTableId(tableId);
    localStorage.setItem('selectedTableId', tableId);

    // Load cart for selected table
    const newCart = activeOrders.has(tableId)
      ? [...activeOrders.get(tableId)]
      : [];
    setCart(newCart);

    // Update table status
    if (table['Tên bàn'] !== 'Khách mua về' && table['Trạng thái'] === 'Trống') {
      const updatedTables = tables.map(t => {
        if (t.IDBAN === tableId) {
          return { ...t, 'Trạng thái': 'Đang sử dụng' };
        }
        return t;
      });
      setTables(updatedTables);
    }

    setShowTableModal(false);
    showNotification(`Đã chọn ${table['Tên bàn']}`);
  };

  // Process payment
  const processPayment = async () => {
    try {
      if (!selectedTableId || cart.length === 0) {
        showNotification('Không có đơn hàng để thanh toán', 'error');
        return;
      }

      setIsLoading(true);

      // Generate invoice ID
      const invoiceId = `INV${Date.now()}`;

      const subtotal = calculateTotal(cart);
      const vat = subtotal * 0.1;
      const total = subtotal + vat;

      // Format current date
      const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
      };

      // Create invoice object
      const invoice = {
        IDHOADON: invoiceId,
        IDBAN: selectedTableId,
        "Ngày": formatDate(new Date()),
        "Tổng tiền": subtotal,
        "VAT": vat,
        "Trạng thái": "Đã thanh toán",
        "Nhân viên": userData?.['Họ và Tên'] || userData?.username,
        "Khách hàng": "Khách hàng",
        "Khách trả": total,
        "Tiền thừa": 0,
        "Trạng thái sự dụng bàn": "Đã trả bàn"
      };

      // Create invoice details
      const invoiceDetails = cart.map(item => ({
        IDHOADONDETAIL: `${invoiceId}_${item.id}`,
        IDHOADON: invoiceId,
        IDSP: item.id,
        "Số lượng": item.quantity
      }));

      // Transaction object for offline storage
      const transaction = {
        invoice,
        invoiceDetails,
        timestamp: Date.now()
      };

      if (navigator.onLine) {
        // Save invoice to system
        await authUtils.apiRequest('HOADON', 'Add', {
          Rows: [invoice]
        }, {
          Properties: {
            Locale: "vi-VN",
            Timezone: "Asia/Ho_Chi_Minh"
          }
        });

        // Save invoice details to system
        await authUtils.apiRequest('HOADONDETAIL', 'Add', {
          Rows: invoiceDetails
        });
      } else {
        // Store transaction for later sync
        storeOfflineTransaction(transaction);
        showNotification('Giao dịch sẽ được đồng bộ khi có kết nối', 'success');
      }

      // Clear current table's cart
      if (selectedTableId) {
        const newActiveOrders = new Map(activeOrders);
        newActiveOrders.delete(selectedTableId);
        setActiveOrders(newActiveOrders);
        saveActiveOrders(newActiveOrders);

        // Reset table state
        const updatedTables = tables.map(t => {
          if (t.IDBAN === selectedTableId && t['Trạng thái'] === 'Đang sử dụng') {
            return { ...t, 'Trạng thái': 'Trống' };
          }
          return t;
        });
        setTables(updatedTables);

        // Reset selected table
        setSelectedTableId(null);
        localStorage.removeItem('selectedTableId');
      }

      // Clear cart and update UI
      setCart([]);
      setShowCheckoutModal(false);
      showNotification('Thanh toán thành công!');

    } catch (error) {
      console.error('Payment error:', error);
      showNotification('Lỗi thanh toán', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Store offline transaction
  const storeOfflineTransaction = (transaction) => {
    let offlineTransactions = JSON.parse(localStorage.getItem('offlineTransactions') || '[]');
    offlineTransactions.push({
      ...transaction,
      processed: false
    });
    localStorage.setItem('offlineTransactions', JSON.stringify(offlineTransactions));
  };

  // Sync offline transactions
  const syncOfflineTransactions = async () => {
    if (!navigator.onLine) return;

    let offlineTransactions = JSON.parse(localStorage.getItem('offlineTransactions') || '[]');
    const unprocessed = offlineTransactions.filter(t => !t.processed);

    if (unprocessed.length === 0) return;

    showNotification(`Đang đồng bộ ${unprocessed.length} giao dịch...`);

    for (const transaction of unprocessed) {
      try {
        // Send transaction to server
        await authUtils.apiRequest('HOADON', 'Add', {
          Rows: [transaction.invoice]
        });

        await authUtils.apiRequest('HOADONDETAIL', 'Add', {
          Rows: transaction.invoiceDetails
        });

        // Mark as processed
        transaction.processed = true;
        showNotification(`Đã đồng bộ hóa đơn ${transaction.invoice.IDHOADON}`);
      } catch (error) {
        console.error('Failed to sync transaction', error);
      }
    }

    // Update localStorage
    localStorage.setItem('offlineTransactions', JSON.stringify(offlineTransactions));

    // Remove processed transactions after 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    offlineTransactions = offlineTransactions.filter(
      t => !t.processed || t.timestamp > oneWeekAgo
    );
    localStorage.setItem('offlineTransactions', JSON.stringify(offlineTransactions));

    showNotification('Đồng bộ dữ liệu hoàn tất');
  };

  // Load more products
  const loadMoreProducts = () => {
    if (isLoading) return;

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };

  // Setup and register page actions
  const setupPageActions = () => {
    if (window.registerPageActions) {
      window.registerPageActions([
        {
          text: 'Đồng bộ',
          onClick: async () => {
            try {
              setIsLoading(true);
              await Promise.all([
                fetchProducts(),
                fetchTables()
              ]);
              showNotification('Đồng bộ thành công!');
            } catch (error) {
              showNotification('Lỗi đồng bộ dữ liệu', 'error');
            } finally {
              setIsLoading(false);
            }
          },
          className: 'px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors',
          icon: <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        },
        {
          text: 'Giỏ hàng ',
          onClick: () => setShowCartModal(true),
          className: 'px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors relative',
          icon: <>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </>
        },
      ]);
    }
  };

  // Initialize app
  useEffect(() => {
    // Only initialize once
    if (appInitialized) return;

    const initializeApp = async () => {
      try {
        setIsLoading(true);

        // Register service worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
        }

        // Load app state
        loadAppState();

        // Setup network status listeners
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();

        // Initialize data
        await Promise.all([
          fetchProducts(),
          fetchTables()
        ]);

        // Sync offline transactions if online
        if (navigator.onLine) {
          syncOfflineTransactions();
        }

        // Setup page actions ONCE
        setupPageActions();

        // Mark as initialized
        setAppInitialized(true);
        showNotification('Ứng dụng đã sẵn sàng!');
      } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Lỗi khởi tạo ứng dụng', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    // Setup scroll event for virtual scrolling
    const handleScroll = () => {
      if (isLoading) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.body.offsetHeight - 200;

      if (scrollPosition >= scrollThreshold) {
        loadMoreProducts();
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      window.removeEventListener('scroll', handleScroll);

      if (window.clearPageActions) {
        window.clearPageActions();
      }
    };
  }, [appInitialized]); // Only run when appInitialized changes

  // Get visible products based on pagination
  const getVisibleProducts = () => {
    return filteredProducts;
  };

  const ProductQuantityControl = ({ product, cart, onQuantityChange }) => {
    // Initialize with the quantity from cart if it exists
    const existingItem = cart.find(item => item.id === product.IDSP);
    const [quantity, setQuantity] = useState(existingItem ? existingItem.quantity : 0);

    // Update local state when cart changes
    useEffect(() => {
      const item = cart.find(item => item.id === product.IDSP);
      setQuantity(item ? item.quantity : 0);
    }, [cart, product.IDSP]);

    const handleIncrease = () => {
      const newQuantity = quantity + 1;
      setQuantity(newQuantity);
      onQuantityChange(product.IDSP, newQuantity);
    };

    const handleDecrease = () => {
      if (quantity > 0) {
        const newQuantity = quantity - 1;
        setQuantity(newQuantity);
        onQuantityChange(product.IDSP, newQuantity);
      }
    };

    const handleInputChange = (e) => {
      const value = parseInt(e.target.value) || 0;
      setQuantity(value);
      onQuantityChange(product.IDSP, value);
    };

    return (
      <div className="flex items-center">
        <button
          onClick={handleDecrease}
          className="w-6 h-6 flex items-center justify-center bg-white border border-red-500 rounded-full"
        >
          <span className="text-red-500 font-bold text-lg leading-none">-</span>
        </button>
        <input
          type="number"
          value={quantity}
          onChange={handleInputChange}
          className="w-10 h-8 text-center border-y border-gray-200 text-sm mx-1"
          min="0"
        />
        <button
          onClick={handleIncrease}
          className="w-6 h-6 flex items-center justify-center bg-white border border-green-500 rounded-full"
        >
          <span className="text-green-500 font-bold text-lg leading-none">+</span>
        </button>
      </div>
    );
  };


  return (
    <div className="w-full bg-gray-50">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="offline-banner">
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Bạn đang trong chế độ ngoại tuyến</span>
          </div>
        </div>
      )}

      {/* Table Selection Badge */}
      <div className="bg-blue-50 m-4 p-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="font-medium">
            {selectedTableId ?
              `Bàn hiện tại: ${tables.find(t => t.IDBAN === selectedTableId)?.['Tên bàn']}` :
              'Chưa chọn bàn'}
          </span>
        </div>
        <button
          onClick={() => setShowTableModal(true)}
          className="px-2 py-1 bg-blue-500 text-white text-sm rounded-lg"
        >
          Đổi bàn
        </button>
      </div>

      <div className="px-4 pb-2">
        {/* Search Bar */}
        <div className="mb-4 sticky top-0 z-10 bg-gray-50 pt-2 pb-3">
          <div className="relative">
            <input
              type="text"
              className="w-full p-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="absolute left-3 top-2.5">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                className="absolute right-3 top-2.5"
                onClick={() => handleSearch('')}
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pb-16">
        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3" ref={productGridRef}>
          {getVisibleProducts().map((product) => (
            <div
              key={product.IDSP}
              className="product-card"
            >
              <img
                src={product['Hình ảnh'] || "https://dummyimage.com/200x200/eee/999.png&text=No+Image"}
                alt={product['Tên sản phẩm']}
                className="product-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://dummyimage.com/200x200/eee/999.png&text=No+Image";
                }}
                onClick={() => {
                  // Find if product is already in cart
                  const existingItem = cart.find(item => item.id === product.IDSP);
                  const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

                  // Use the same logic as onQuantityChange to update cart
                  if (newQuantity > 0) {
                    const existingItemIndex = cart.findIndex(item => item.id === product.IDSP);

                    if (existingItemIndex >= 0) {
                      const newCart = [...cart];
                      newCart[existingItemIndex] = {
                        ...newCart[existingItemIndex],
                        quantity: newQuantity
                      };
                      setCart(newCart);
                      saveCartState(selectedTableId, newCart);
                    } else {
                      const newItem = {
                        id: product.IDSP,
                        name: product['Tên sản phẩm'],
                        price: parseInt(product['Đơn giá']),
                        quantity: newQuantity
                      };
                      const newCart = [...cart, newItem];
                      setCart(newCart);
                      saveCartState(selectedTableId, newCart);
                    }
                  }
                }}
              />
              <div className="p-2 flex-1 flex flex-col justify-between">
                <h3 className="font-medium text-sm line-clamp-2">{product['Tên sản phẩm']}</h3>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-blue-600 font-bold text-sm">
                    {formatCurrency(parseInt(product['Đơn giá']))}
                  </p>
                  <ProductQuantityControl
                    product={product}
                    cart={cart}
                    onQuantityChange={(id, quantity) => {
                      if (quantity > 0) {
                        // Add to cart with specific quantity
                        const existingItemIndex = cart.findIndex(item => item.id === id);

                        if (existingItemIndex >= 0) {
                          const newCart = [...cart];
                          newCart[existingItemIndex] = {
                            ...newCart[existingItemIndex],
                            quantity: quantity
                          };
                          setCart(newCart);
                          saveCartState(selectedTableId, newCart);
                        } else {
                          const newItem = {
                            id: product.IDSP,
                            name: product['Tên sản phẩm'],
                            price: parseInt(product['Đơn giá']),
                            quantity: quantity
                          };
                          const newCart = [...cart, newItem];
                          setCart(newCart);
                          saveCartState(selectedTableId, newCart);
                        }
                      } else {
                        // Remove from cart if quantity is 0
                        const newCart = cart.filter(item => item.id !== id);
                        setCart(newCart);
                        saveCartState(selectedTableId, newCart);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Cart Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowCartModal(true)}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center relative"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {cart.length > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          )}
        </button>
      </div>

      {/* Table Selection Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center">
              <h3 className="text-base font-bold">Chọn bàn</h3>
              <button onClick={() => setShowTableModal(false)} className="p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3" ref={tableGridRef}>
              {tables.map((table) => {
                // Get order details for this table if exists
                const tableOrder = activeOrders.get(table.IDBAN) || [];
                const itemCount = tableOrder.reduce((sum, item) => sum + item.quantity, 0);
                const orderTotal = calculateTotal(tableOrder);

                // Determine if table has an active order
                const hasOrder = tableOrder.length > 0;

                // Check if this is the selected table
                const isSelected = table.IDBAN === selectedTableId;

                // Determine table status class
                const getTableStatusClass = () => {
                  if (table['Tên bàn'] === 'Khách mua về') {
                    return 'bg-gray-100';
                  }
                  return table['Trạng thái'] === 'Đang sử dụng' ? 'bg-yellow-100' : 'bg-green-100';
                };

                return (
                  <div
                    key={table.IDBAN}
                    onClick={() => selectTable(table.IDBAN)}
                    className={`p-3 rounded-lg cursor-pointer ${getTableStatusClass()} ${isSelected ? 'border-2 border-blue-500' : ''}`}
                  >
                    <h3 className="font-bold text-sm">{table['Tên bàn']}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs">Sức chứa: {table['Sức chứa tối đa']} người</p>
                      <p className={`text-xs font-medium ${hasOrder ? 'text-blue-600' : ''}`}>{table['Trạng thái']}</p>
                    </div>
                    {hasOrder && (
                      <div className="mt-2 pt-1 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">Số món:</span>
                          <span className="text-xs font-bold">{itemCount}</span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="text-xs font-medium">Giá trị:</span>
                          <span className="text-xs font-bold text-blue-600">{formatCurrency(orderTotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center">
              <h3 className="text-base font-bold">Giỏ hàng</h3>
              <button onClick={() => setShowCartModal(false)} className="p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  Giỏ hàng trống
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center bg-gray-50 p-2 rounded-lg">
                    <div className="flex-1 mr-2">
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      <p className="text-xs text-gray-600">
                        {formatCurrency(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustQuantity(item.id, -1);
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded-full text-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustQuantity(item.id, 1);
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded-full text-sm"
                      >
                        +
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full text-sm ml-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t bg-white p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold">Tổng cộng:</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(calculateTotal(cart))}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className={`py-2.5 rounded-lg font-bold ${cart.length === 0 ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white'
                    }`}
                >
                  Xóa giỏ hàng
                </button>
                <button
                  onClick={() => {
                    if (cart.length > 0) {
                      setShowCartModal(false);
                      setShowCheckoutModal(true);
                    } else {
                      showNotification('Giỏ hàng trống', 'error');
                    }
                  }}
                  disabled={cart.length === 0}
                  className={`py-2.5 rounded-lg font-bold ${cart.length === 0 ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white'
                    }`}
                >
                  Thanh toán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center">
              <h3 className="text-base font-bold">Thanh toán</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Bàn:</span>
                  <span className="text-sm font-bold">
                    {tables.find(t => t.IDBAN === selectedTableId)?.['Tên bàn']}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Nhân viên:</span>
                  <span className="text-sm font-bold">
                    {userData?.['Họ và Tên'] || userData?.username || 'Nhân viên'}
                  </span>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-3">
                <h4 className="font-medium mb-2 text-sm">Chi tiết đơn hàng</h4>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm border-b pb-2">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(item.price)} x {item.quantity}
                        </div>
                      </div>
                      <span className="font-bold">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border rounded-lg p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tổng tiền hàng:</span>
                    <span className="font-medium">{formatCurrency(calculateTotal(cart))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">VAT (10%):</span>
                    <span className="font-medium">{formatCurrency(calculateTotal(cart) * 0.1)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between items-center text-lg font-bold">
                    <span>Tổng cộng:</span>
                    <span className="text-blue-600">{formatCurrency(calculateTotal(cart) * 1.1)}</span>
                  </div>
                </div>
              </div>

              {/* QR Payment Section */}
              <div className="bg-white border rounded-lg p-3">
                <h4 className="font-medium mb-2 text-sm text-center">Quét mã QR để thanh toán</h4>
                <div className="flex flex-col items-center">
                  <img
                    src={generateVietQRUrl(calculateTotal(cart) * 1.1, `Thanh toan ban ${tables.find(t => t.IDBAN === selectedTableId)?.['Tên bàn']}`)}
                    alt="QR Code thanh toán"
                    className="w-48 h-48 object-contain my-2"
                  />
                  <div className="text-xs text-gray-600 text-center">
                    <p>MB BANK - 7320012003</p>
                    <p className="font-medium mt-1">Quét mã QR bằng ứng dụng ngân hàng để thanh toán</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t bg-white p-3">
              <button
                onClick={processPayment}
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold"
              >
                {isLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer
        position="bottom-left"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default MobilePOS;