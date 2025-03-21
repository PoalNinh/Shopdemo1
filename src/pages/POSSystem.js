import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './POSSystem.css';
import authUtils from '../utils/authUtils';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

const POSSystem = () => {
  // State Management
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [activeOrders, setActiveOrders] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastKeystrokeTime, setLastKeystrokeTime] = useState(Date.now());
  const [loadingText, setLoadingText] = useState('Đang tải dữ liệu...');

  // References
  const barcodeInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const categoryFilterRef = useRef(null);
  const priceFilterRef = useRef(null);
  const customerDisplayWindow = useRef(null);
  const userData = authUtils.getUserData();
  // User data
  const nhanvien = userData?.['Họ và Tên'] || userData?.username

  // Constants
  const CONFIG = {
    timeouts: {
      notification: 2000,
      barcodeBuffer: 100
    },
    customerDisplayUrl: 'customer-display.html'
  };

  // Format utilities
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const calculateTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const generateId = (prefix) => {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}${timestamp}${random}`;
  };

  const formatInputCurrency = (input) => {
    // Xóa tất cả ký tự không phải số
    let value = input.value.replace(/[^\d]/g, '');

    // Chuyển thành số
    let number = parseInt(value) || 0;

    // Format số theo định dạng tiền tệ Việt Nam
    let formattedValue = new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(number);

    // Cập nhật giá trị input
    input.value = formattedValue;

    // Lưu giá trị số thực vào data attribute
    input.dataset.value = number;

    return number;
  };

  const getNumericValue = (input) => {
    return parseInt(input.dataset.value) || 0;
  };

  // UI Notifications
  const activeToasts = new Set();

  const showNotification = (message, type = 'success') => {
    // Prevent duplicate messages
    if (activeToasts.has(message)) {
      return;
    }

    activeToasts.add(message);

    const toastId = Date.now();

    toast[type](message, {
      position: "bottom-left",
      autoClose: CONFIG.timeouts.notification,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      toastId: toastId,
      onClose: () => {
        activeToasts.delete(message);
      }
    });
  };
  // Toggle loading state
  const showLoading = (message = 'Đang tải dữ liệu...') => {
    setLoadingText(message);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  // API Calls
  const fetchProducts = async () => {
    try {
      showLoading('Đang tải sản phẩm...');
      const response = await authUtils.apiRequest('Sản phẩm', 'Find', {
        Selector: "Filter(Sản phẩm, true)"
      });

      setProducts(response);
      setFilteredProducts(response);

      // Extract categories
      const categoryCounts = response.reduce((acc, product) => {
        const category = product['Loại sản phẩm'];
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const extractedCategories = Object.keys(categoryCounts)
        .sort()
        .map(category => ({
          name: category,
          count: categoryCounts[category]
        }));

      setCategories(extractedCategories);

      return response;
    } catch (error) {
      console.error('Error fetching products:', error);
      showNotification('Không thể tải danh sách sản phẩm', 'error');
      return [];
    } finally {
      hideLoading();
    }
  };

  const fetchTables = async () => {
    try {
      showLoading('Đang tải danh sách bàn...');
      const response = await authUtils.apiRequest('DSBAN', 'Find', {
        Selector: "Filter(DSBAN, true)"
      });

      setTables(response);
      return response;
    } catch (error) {
      console.error('Error fetching tables:', error);
      showNotification('Không thể tải danh sách bàn', 'error');
      return [];
    } finally {
      hideLoading();
    }
  };

  const saveInvoice = async (invoice, details) => {
    await authUtils.apiRequest('HOADON', 'Add', { Rows: [invoice] });
    await authUtils.apiRequest('HOADONDETAIL', 'Add', { Rows: details });
  };

  // Filter products
  const filterProducts = () => {
    const filtered = products.filter(product => {
      const matchesSearch = product['Tên sản phẩm'].toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product['Loại sản phẩm'] === categoryFilter;
      const matchesPrice = checkPriceRange(product['Đơn giá'], priceFilter);

      return matchesSearch && matchesCategory && matchesPrice;
    });


    setFilteredProducts(filtered);
  };

  const checkPriceRange = (price, range) => {
    if (range === 'all') return true;

    const [min, max] = range.split('-').map(Number);
    price = parseInt(price);

    if (max) {
      return price >= min && price < max;
    }
    return price >= min;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPriceFilter('all');
    setFilteredProducts(products);
    showNotification('Đã đặt lại bộ lọc');
  };

  // Cart operations
  const addToCart = (productId) => {
    // Check if table is selected
    if (!selectedTableId) {
      showNotification('Vui lòng chọn bàn trước khi gọi món!', 'error');
      setShowTableModal(true); // Automatically open table selection
      return;
    }

    const product = products.find(p => p.IDSP === productId);
    if (!product) {
      showNotification('Không tìm thấy sản phẩm!', 'error');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === productId);
      let newCart;

      if (existingItem) {
        newCart = prevCart.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        newCart = [...prevCart, {
          id: product.IDSP,
          name: product['Tên sản phẩm'],
          price: parseInt(product['Đơn giá']),
          quantity: 1
        }];
      }

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...newCart]);
      setActiveOrders(newActiveOrders);

      // Update customer display
      updateCustomerDisplay(newCart);

      return newCart;
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => {
      const newCart = prevCart.filter(item => item.id !== productId);

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...newCart]);
      setActiveOrders(newActiveOrders);

      // Update customer display
      updateCustomerDisplay(newCart);

      showNotification('Đã xóa sản phẩm khỏi giỏ hàng');
      return newCart;
    });
  };

  const adjustQuantity = (productId, amount) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === productId) {
          return { ...item, quantity: item.quantity + amount };
        }
        return item;
      });

      const item = updatedCart.find(item => item.id === productId);

      if (item && item.quantity <= 0) {
        if (window.confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
          const filteredCart = updatedCart.filter(item => item.id !== productId);

          // Update active orders
          const newActiveOrders = new Map(activeOrders);
          newActiveOrders.set(selectedTableId, [...filteredCart]);
          setActiveOrders(newActiveOrders);

          // Update customer display
          updateCustomerDisplay(filteredCart);

          return filteredCart;
        } else {
          return prevCart.map(item => {
            if (item.id === productId) {
              return { ...item, quantity: 1 };
            }
            return item;
          });
        }
      }

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...updatedCart]);
      setActiveOrders(newActiveOrders);

      // Update customer display
      updateCustomerDisplay(updatedCart);

      return updatedCart;
    });
  };

  const clearCart = () => {
    if (cart.length === 0) return;

    if (window.confirm('Bạn có muốn xóa toàn bộ giỏ hàng?')) {
      setCart([]);

      // Update active orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, []);
      setActiveOrders(newActiveOrders);

      // Update customer display
      updateCustomerDisplay([]);

      showNotification('Đã xóa toàn bộ giỏ hàng');
    }
  };

  // Table operations
  const selectTable = (tableId) => {
    const table = tables.find(t => t.IDBAN === tableId);
    if (!table) return;

    // Save current cart if exists
    if (selectedTableId && cart.length > 0) {
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(selectedTableId, [...cart]);
      setActiveOrders(newActiveOrders);
    }

    // Update selected table
    setSelectedTableId(tableId);

    // Load cart for this table
    const tableCart = activeOrders.get(tableId) || [];
    setCart(tableCart);

    // Update table status if needed
    if (table['Tên bàn'] !== 'Khách mua về' && table['Trạng thái'] === 'Trống') {
      const updatedTables = tables.map(t =>
        t.IDBAN === tableId ? { ...t, 'Trạng thái': 'Đang sử dụng' } : t
      );
      setTables(updatedTables);
    }

    // Update customer display
    updateCustomerDisplay(tableCart, table);

    showNotification(`Đã chuyển sang ${table['Tên bàn']}`);
    setShowTableModal(false);
  };

  // Transfer table
  const transferTable = async (targetTableId) => {
    try {
      showLoading('Đang chuyển bàn...');

      const sourceTableId = selectedTableId;
      const sourceTable = tables.find(t => t.IDBAN === sourceTableId);
      const targetTable = tables.find(t => t.IDBAN === targetTableId);

      // Update tables status
      const updatedTables = tables.map(t => {
        if (t.IDBAN === sourceTableId && t['Tên bàn'] !== 'Khách mua về') {
          return { ...t, 'Trạng thái': 'Trống' };
        }
        if (t.IDBAN === targetTableId && t['Tên bàn'] !== 'Khách mua về') {
          return { ...t, 'Trạng thái': 'Đang sử dụng' };
        }
        return t;
      });
      setTables(updatedTables);

      // Transfer orders
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.set(targetTableId, [...cart]);
      newActiveOrders.delete(sourceTableId);
      setActiveOrders(newActiveOrders);

      // Update selected table
      setSelectedTableId(targetTableId);

      // Update customer display
      updateCustomerDisplay(cart, targetTable);

      showNotification(`Đã chuyển từ ${sourceTable['Tên bàn']} sang ${targetTable['Tên bàn']}`);
      setShowTransferModal(false);

    } catch (error) {
      console.error('Lỗi chuyển bàn:', error);
      showNotification('Có lỗi xảy ra khi chuyển bàn!', 'error');
    } finally {
      hideLoading();
    }
  };

  // Customer display operations
  const openCustomerDisplay = () => {
    if (customerDisplayWindow.current && !customerDisplayWindow.current.closed) {
      customerDisplayWindow.current.close();
    }

    const width = 800;
    const height = 600;
    const left = window.screen.width - width;

    customerDisplayWindow.current = window.open(
      CONFIG.customerDisplayUrl,
      'CustomerDisplay',
      `width=${width},height=${height},left=${left},top=0`
    );

    customerDisplayWindow.current.onload = () => updateCustomerDisplay();
  };

  const updateCustomerDisplay = (cartData = cart, tableInfo = null) => {
    if (!customerDisplayWindow.current || customerDisplayWindow.current.closed) return;

    try {
      const total = calculateTotal(cartData);

      // Get current table info if not provided
      const currentTable = tableInfo || tables.find(t => t.IDBAN === selectedTableId);
      const tableData = currentTable ? {
        id: currentTable.IDBAN,
        name: currentTable['Tên bàn'],
        capacity: currentTable['Sức chứa tối đa'],
        status: currentTable['Trạng thái']
      } : null;

      customerDisplayWindow.current.postMessage({
        type: 'updateCart',
        cart: cartData,
        totals: {
          subtotal: total,
          vat: total * 0.1,
          discount: 0,
          total: total * 1.1
        },
        tableInfo: tableData
      }, window.location.origin);
    } catch (error) {
      console.error('Lỗi khi cập nhật màn hình phụ:', error);
    }
  };

  // Payment process
  const processPayment = async () => {
    try {
      showLoading('Đang xử lý thanh toán...');

      // Kiểm tra giỏ hàng
      if (!cart || cart.length === 0) {
        throw new Error('EMPTY_CART');
      }

      // Kiểm tra nhân viên
      if (!nhanvien?.trim()) {
        throw new Error('INVALID_EMPLOYEE');
      }

      // Get form values
      const formElements = document.getElementById('checkoutForm').elements;
      const customer = formElements.customerInput?.value?.trim() || 'Khách lẻ';
      const discount = parseFloat(formElements.discountInput?.value || '0');
      const paidAmountInput = formElements.paidAmount;
      const paidAmount = getNumericValue(paidAmountInput);
      const note = formElements.noteInput?.value?.trim() || '';

      // Validate values
      if (isNaN(discount) || discount < 0) {
        throw new Error('INVALID_DISCOUNT');
      }

      if (isNaN(paidAmount) || paidAmount <= 0) {
        throw new Error('INVALID_PAID_AMOUNT');
      }

      // Calculate totals
      const total = calculateTotal(cart);
      if (total <= 0) {
        throw new Error('INVALID_TOTAL');
      }

      const vat = total * 0.1;
      const finalAmount = total + vat - discount;

      if (paidAmount < finalAmount) {
        throw new Error('INSUFFICIENT_PAYMENT');
      }
      const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
      };
      const change = paidAmount - finalAmount;

      // Create invoice object
      const invoiceId = generateId('INV');
      const invoice = {
        IDHOADON: invoiceId,
        IDBAN: selectedTableId,
        "Ngày": formatDate(new Date()),
        "Nhân viên": nhanvien,
        "Khách hàng": customer,
        "Tổng tiền": total,
        "VAT": vat,
        "Giảm giá": discount,
        "Khách trả": paidAmount,
        "Tiền thừa": change,
        "Ghi chú": note,
        "Trạng thái": "Đã thanh toán"
      };

      // Create invoice details
      const invoiceDetails = cart.map(item => ({
        IDHOADONDETAIL: `${invoiceId}_${item.id}`,
        IDHOADON: invoiceId,
        IDSP: item.id,
        "Số lượng": item.quantity
      }));

      // Save to database
      await saveInvoice(invoice, invoiceDetails);

      // Print invoice
      try {
        await printReceipt({
          id: invoiceId,
          tableId: selectedTableId,
          employee: nhanvien,
          customer,
          date: new Date().toISOString(),
          total,
          vat,
          discount,
          paidAmount,
          change,
          note,
          items: [...cart]
        });
      } catch (printError) {
        console.warn('Không thể in hóa đơn:', printError);
        showNotification('Thanh toán thành công nhưng không thể in hóa đơn', 'warning');
      }

      // Reset state
      resetAfterPayment();
      setShowCheckoutModal(false);

      showNotification('Thanh toán thành công!', 'success');
    } catch (error) {
      console.error('Lỗi thanh toán:', error);

      // Handle specific errors
      const errorMessages = {
        'EMPTY_CART': 'Giỏ hàng trống!',
        'INVALID_EMPLOYEE': 'Vui lòng chọn nhân viên thanh toán!',
        'INVALID_TOTAL': 'Tổng tiền không hợp lệ!',
        'INVALID_DISCOUNT': 'Giảm giá không hợp lệ!',
        'INVALID_PAID_AMOUNT': 'Số tiền thanh toán không hợp lệ!',
        'INSUFFICIENT_PAYMENT': 'Số tiền khách trả không đủ!',
        'NETWORK_ERROR': 'Lỗi kết nối! Vui lòng kiểm tra lại.',
        'DATABASE_ERROR': 'Lỗi lưu dữ liệu! Vui lòng thử lại.'
      };

      const message = errorMessages[error.message] || 'Có lỗi xảy ra khi thanh toán!';
      showNotification(message, 'error');
    } finally {
      hideLoading();
    }
  };

  const resetAfterPayment = () => {
    // Clear active order
    if (selectedTableId) {
      const newActiveOrders = new Map(activeOrders);
      newActiveOrders.delete(selectedTableId);
      setActiveOrders(newActiveOrders);

      // Reset table status
      const updatedTables = tables.map(t => {
        if (t.IDBAN === selectedTableId && t['Tên bàn'] !== 'Khách mua về') {
          return { ...t, 'Trạng thái': 'Trống' };
        }
        return t;
      });
      setTables(updatedTables);

      // Reset selected table
      setSelectedTableId(null);
    }

    // Clear cart
    setCart([]);
  };

  const printReceipt = async (paymentData) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const receiptHtml = generateReceiptHtml(paymentData);

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();

    // Print after a small delay to ensure loading
    return new Promise((resolve) => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        resolve();
      }, 250);
    });
  };

  const generateReceiptHtml = (paymentData) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Hóa đơn - ${paymentData.id}</title>
          <style>
              /* Receipt styles */
              body {
                  font-family: Verdana, sans-serif;
                  font-size: 12px;
                  line-height: 1.2;
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  background-color: #f0f0f0;
              }

              #content {
                  width: 80mm;
                  background-color: white;
                  padding: 5mm;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }

              .header, .footer {
                  text-align: center;
                  margin: 3mm 0;
              }

              .invoice-details {
                  margin: 2mm 0;
              }

              table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 10px;
              }

              th, td {
                  padding: 1mm;
                  text-align: left;
                  border-bottom: 0.5px solid #ddd;
              }

              .total {
                  text-align: right;
                  margin-top: 2mm;
                  font-weight: bold;
              }

              @media print {
                  body { margin: 0; padding: 0; }
                  #content { box-shadow: none; }
              }
          </style>
      </head>
      <body>
          <div id="content">
              <div class="header">
                  <div class="company-name"><strong>Goal COFFEE</strong></div>
                  <div><strong>Địa chỉ: Lâm Đồng</strong></div>
                  <div>SĐT: 0326132124</div>
              </div>

              <div style="text-align: center;">
                  <h2><strong>Hóa đơn bán hàng</strong></h2>
                  <div><strong>Số: ${paymentData.id}</strong></div>
                  <div><strong>Ngày: ${new Date(paymentData.date).toLocaleString()}</strong></div>
              </div>

              <div class="invoice-details">
                  <div>Khách hàng: ${paymentData.customer}</div>
                  <div>Nhân viên: ${paymentData.employee}</div>
              </div>

              <table>
                  <thead>
                      <tr>
                          <th>TÊN SP</th>
                          <th>SL</th>
                          <th>ĐƠN GIÁ</th>
                          <th>THÀNH TIỀN</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${paymentData.items.map(item => `
                          <tr>
                              <td>${item.name}</td>
                              <td>${item.quantity}</td>
                              <td>${formatCurrency(item.price)}</td>
                              <td style="text-align: right">
                                  ${formatCurrency(item.price * item.quantity)}
                              </td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>

              <div class="total">
                  <div>Tổng tiền hàng: ${formatCurrency(paymentData.total)}</div>
                  <div>VAT (10%): ${formatCurrency(paymentData.vat)}</div>
                  <div>Giảm giá: ${formatCurrency(paymentData.discount)}</div>
                  <div class="total">
                      Tổng cộng: ${formatCurrency(paymentData.total + paymentData.vat - paymentData.discount)}
                  </div>
                  <div>Khách trả: ${formatCurrency(paymentData.paidAmount)}</div>
                  <div>Tiền thừa: ${formatCurrency(paymentData.change)}</div>
              </div>

              <div style="margin-top: 10px;">
                  <i>Ghi chú: ${paymentData.note || ''}</i>
              </div>

              <div class="footer">
                  <hr>
                  <i>Cảm ơn quý khách đã mua hàng!</i>
                  <p>Liên hệ Ninh Phước để được hỗ trợ: 0326132124</p>
              </div>
          </div>
      </body>
      </html>
    `;
  };

  // Focus management
  const toggleAutoFocus = (enable) => {
    setAutoFocusEnabled(enable);
    if (enable && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const handleBarcodeInput = (event) => {
    const currentTime = Date.now();

    if (currentTime - lastKeystrokeTime > CONFIG.timeouts.barcodeBuffer) {
      setBarcodeBuffer('');
    }

    setLastKeystrokeTime(currentTime);

    if (event.key === 'Enter') {
      event.preventDefault();
      const barcode = event.target.value.trim();
      if (barcode) {
        processBarcodeInput(barcode);
        event.target.value = '';
      }
      setBarcodeBuffer('');
    }

    if (autoFocusEnabled && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current.focus(), 100);
    }
  };

  const processBarcodeInput = (barcode) => {
    const product = products.find(p => p.IDSP === barcode);
    if (product) {
      addToCart(barcode);
    } else {
      showNotification('Không tìm thấy sản phẩm với mã này!', 'error');
    }
  };

  // Keyboard shortcuts
  const handleKeyboardShortcuts = (e) => {
    switch (true) {
      case e.key === 'F2': // Search
        e.preventDefault();
        toggleAutoFocus(false);
        searchInputRef.current?.focus();
        break;

      case e.key === 'F4': // Quick checkout
        e.preventDefault();
        if (cart.length > 0 && selectedTableId) {
          setShowCheckoutModal(true);
        } else if (cart.length === 0) {
          showNotification('Giỏ hàng trống!', 'error');
        } else if (!selectedTableId) {
          showNotification('Vui lòng chọn bàn trước khi thanh toán!', 'error');
        }
        break;

      case e.key === 'Escape': // Clear cart
        e.preventDefault();
        clearCart();
        break;

      case e.ctrlKey && e.key.toLowerCase() === 'b': // Barcode focus
        e.preventDefault();
        toggleAutoFocus(true);
        barcodeInputRef.current?.focus();
        break;

      case e.key === 'F1': // Reset filters
        e.preventDefault();
        resetFilters();
        break;

      case e.key === 'F5': // Sync data
        e.preventDefault();
        syncData();
        break;
    }
  };

  // Data synchronization
  // Data synchronization
  const syncData = async () => {
    try {
      showLoading('Đang đồng bộ dữ liệu...');

      const [newProducts, newTables] = await Promise.all([
        fetchProducts(),
        fetchTables()
      ]);

      setProducts(newProducts);
      setFilteredProducts(newProducts);
      setTables(newTables);

      showNotification('Đồng bộ dữ liệu thành công!');
    } catch (error) {
      console.error('Lỗi đồng bộ:', error);
      showNotification('Lỗi đồng bộ dữ liệu. Vui lòng thử lại!', 'error');
    } finally {
      hideLoading();
    }
  };

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      if (!nhanvien) {
        showNotification('Không thể khởi tạo ứng dụng. Thiếu thông tin nhân viên!', 'error');
        return;
      }

      try {
        showLoading('Đang khởi tạo ứng dụng...');

        // Restore saved state if exists
        const savedState = localStorage.getItem('posState');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            setActiveOrders(new Map(state.activeOrders));
            setSelectedTableId(state.selectedTableId);
            if (state.tables && state.tables.length > 0) {
              setTables(state.tables);
            }
          } catch (parseError) {
            console.error('Lỗi khôi phục trạng thái:', parseError);
          }
        }

        // Fetch initial data
        const [fetchedProducts, fetchedTables] = await Promise.all([
          fetchProducts(),
          fetchTables()
        ]);

        // Initialize state with fetched data if not already set
        if (products.length === 0) setProducts(fetchedProducts);
        if (filteredProducts.length === 0) setFilteredProducts(fetchedProducts);
        if (tables.length === 0) setTables(fetchedTables);

        // Restore cart if there was a selected table
        if (selectedTableId) {
          const tableCart = activeOrders.get(selectedTableId) || [];
          setCart(tableCart);
        }

        // Đăng ký các nút và trường tìm kiếm lên header
        if (window.registerPageActions) {
          window.registerPageActions([
            {
              text: 'Đồng bộ',
              onClick: syncData,
              className: 'px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors',
              icon: <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            },
            {
              text: 'Chọn bàn',
              onClick: () => setShowTableModal(true),
              className: 'px-3 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors',
              icon: <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            },
            {
              text: 'Màn hình phụ',
              onClick: openCustomerDisplay,
              className: 'px-3 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors',
              icon: <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            },

          ]);
        }

        showNotification('Khởi tạo ứng dụng thành công!');
      } catch (error) {
        console.error('Lỗi khởi tạo:', error);
        showNotification('Không thể khởi tạo ứng dụng. Vui lòng thử lại!', 'error');
      } finally {
        hideLoading();
      }
    };

    initializeApp();

    // Set up event listeners
    window.addEventListener('keydown', handleKeyboardShortcuts);

    // Save state before window close
    const handleBeforeUnload = () => {
      const state = {
        activeOrders: Array.from(activeOrders.entries()),
        selectedTableId,
        tables
      };
      localStorage.setItem('posState', JSON.stringify(state));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Hủy đăng ký các nút khi component unmount
      if (window.clearPageActions) {
        window.clearPageActions();
      }

      // Close customer display window if open
      if (customerDisplayWindow.current && !customerDisplayWindow.current.closed) {
        customerDisplayWindow.current.close();
      }
    };
  }, []); // Empty dependency array for initialization

  // Watch for filter changes
  useEffect(() => {
    filterProducts();
  }, [searchTerm, categoryFilter, priceFilter]);

  // Calculate cart totals
  const subtotal = calculateTotal(cart);
  const vat = subtotal * 0.1;
  const total = subtotal + vat;

  // Get table name for display
  const selectedTableName = selectedTableId
    ? tables.find(t => t.IDBAN === selectedTableId)?.['Tên bàn'] || 'Đang chọn bàn...'
    : 'Chọn bàn';

  // Main JSX - Đã điều chỉnh để hoạt động với MainLayout và đưa các nút lên header
  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-700">{loadingText}</p>
          </div>
        </div>
      )}

      {/* POS Content - Đã bỏ header cố định và chỉ để lại các tính năng cần thiết */}
      <div className="p-4">
        {/* Barcode Scanner */}
        <div className="bg-white shadow-sm p-3 mb-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h2 className="text-lg font-medium mr-4">Quét mã sản phẩm</h2>
              <div className="relative">
                <input
                  type="text"
                  ref={barcodeInputRef}
                  className="px-3 py-1.5 border rounded-lg w-56 text-sm"
                  placeholder="Nhập hoặc quét mã sản phẩm..."
                  autoComplete="off"
                  onKeyDown={handleBarcodeInput}
                />
                <button
                  onClick={() => {
                    toggleAutoFocus(true);
                    barcodeInputRef.current?.focus();
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg ml-2"
                >
                  Quét mã
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  ref={searchInputRef}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="px-3 py-1.5 border rounded-lg w-48 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                  ref={categoryFilterRef}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Tất cả danh mục</option>
                  {categories.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>

                <select
                  ref={priceFilterRef}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                >
                  <option value="all">Tất cả giá</option>
                  <option value="0-20000">0đ - 20,000đ</option>
                  <option value="20000-50000">20,000đ - 50,000đ</option>
                  <option value="50000+">Trên 50,000đ</option>
                </select>

                <button
                  onClick={resetFilters}
                  className="flex items-center justify-center w-8 h-8 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Hiển thị tên bàn đang chọn */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Bàn hiện tại:</span>
              <span className="text-sm font-bold text-blue-600">{selectedTableName}</span>
            </div>
          </div>


        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Product List */}
          <div className="flex-grow bg-white rounded-lg shadow-lg overflow-hidden h-[calc(100vh-12rem)]">
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.IDSP}
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border"
                    onClick={() => addToCart(product.IDSP)}
                  >
                    <div className="mb-2">
                      <img
                        src={product['Hình ảnh'] || "https://dummyimage.com/400x400/eee/999.png&text=No+Image"}
                        alt={product['Tên sản phẩm']}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://dummyimage.com/400x400/eee/999.png&text=No+Image";
                        }}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                      {product['Tên sản phẩm']}
                    </h3>
                    <p className="text-blue-600 font-semibold">
                      {formatCurrency(parseInt(product['Đơn giá']))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Section */}
          <div className="w-full lg:w-1/3 bg-white rounded-lg shadow-lg flex flex-col h-[calc(100vh-12rem)]">
            {/* Cart Header */}
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Giỏ hàng</h2>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className={`px-2 py-1 rounded-lg text-sm flex items-center ${cart.length === 0 ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xóa tất cả
                </button>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  Giỏ hàng trống
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-gray-600">{formatCurrency(item.price)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => adjustQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => adjustQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary */}
            <div className="border-t bg-gray-50 p-4 space-y-3 flex-shrink-0">
              {/* Subtotal */}
              <div className="flex justify-between items-center text-gray-600">
                <span>Tạm tính:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>

              {/* VAT */}
              <div className="flex justify-between items-center text-gray-600">
                <span>VAT (10%):</span>
                <span className="font-medium">{formatCurrency(vat)}</span>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-2"></div>

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Tổng tiền:</span>
                <span className="font-bold text-xl text-blue-600">{formatCurrency(total)}</span>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  if (cart.length === 0) {
                    showNotification('Giỏ hàng trống!', 'error');
                  } else if (!selectedTableId) {
                    showNotification('Vui lòng chọn bàn trước khi thanh toán!', 'error');
                    setShowTableModal(true);
                  } else {
                    setShowCheckoutModal(true);
                  }
                }}
                disabled={cart.length === 0 || !selectedTableId}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center space-x-2
                ${cart.length === 0 || !selectedTableId ?
                    'bg-blue-300 cursor-not-allowed' :
                    'bg-blue-600 hover:bg-blue-700 text-white transition-colors'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Thanh toán</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Table Selection Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Chọn bàn</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    if (!selectedTableId) {
                      showNotification('Vui lòng chọn bàn trước khi chuyển!', 'error');
                      return;
                    }
                    if (cart.length === 0) {
                      showNotification('Không có món để chuyển!', 'error');
                      return;
                    }

                    const selectedTable = tables.find(t => t.IDBAN === selectedTableId);
                    if (selectedTable['Tên bàn'] === 'Khách mua về') {
                      showNotification('Không thể chuyển từ bàn mang về!', 'error');
                      return;
                    }

                    setShowTransferModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center space-x-2"
                  disabled={!selectedTableId || cart.length === 0}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Chuyển bàn</span>
                </button>
                <button
                  onClick={() => setShowTableModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {tables.map((table) => {
                const hasOrder = activeOrders.has(table.IDBAN) &&
                  activeOrders.get(table.IDBAN).length > 0;
                const isCurrentTable = selectedTableId === table.IDBAN;

                // Table status class
                let statusClass = "";
                if (table['Tên bàn'] === 'Khách mua về') {
                  statusClass = "bg-gray-100 border-gray-200 hover:bg-gray-200";
                } else {
                  statusClass = hasOrder || table['Trạng thái'] === 'Đang sử dụng' ?
                    "bg-yellow-100 border-yellow-200 hover:bg-yellow-200" :
                    "bg-green-100 border-green-200 hover:bg-green-200";
                }

                // Order total if exists
                const tableOrders = activeOrders.get(table.IDBAN) || [];
                const orderTotal = calculateTotal(tableOrders);

                return (
                  <div
                    key={table.IDBAN}
                    onClick={() => selectTable(table.IDBAN)}
                    className={`p-4 rounded-lg cursor-pointer border-2 ${statusClass} ${isCurrentTable ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <h3 className="font-bold">{table['Tên bàn']}</h3>
                    <p className="text-sm">Sức chứa: {table['Sức chứa tối đa']} người</p>

                    {table['Tên bàn'] !== 'Khách mua về' && (
                      <p className={`text-sm font-medium ${hasOrder ? 'text-yellow-600' : ''}`}>
                        {table['Trạng thái']}
                      </p>
                    )}

                    {hasOrder && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm font-medium text-blue-600">
                          Đơn hiện tại: {formatCurrency(orderTotal)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex space-x-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
                <span>Bàn trống</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-100 rounded mr-2"></div>
                <span>Đang có khách</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-100 rounded mr-2"></div>
                <span>Bàn đang chọn</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Chuyển bàn</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-lg font-medium">
                Đang chuyển từ: {tables.find(t => t.IDBAN === selectedTableId)?.['Tên bàn']}
              </p>
              <p className="text-gray-600">Tổng món: {cart.length}</p>
              <p className="text-gray-600">Tổng tiền: {formatCurrency(subtotal)}</p>
            </div>

            <div className="mb-4">
              <h3 className="font-medium mb-2">Chọn bàn để chuyển đến:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tables
                  .filter(table =>
                    table.IDBAN !== selectedTableId && // Không phải bàn hiện tại
                    table['Tên bàn'] !== 'Khách mua về' && // Không phải bàn mang về
                    (!activeOrders.has(table.IDBAN) || // Không có đơn hàng
                      activeOrders.get(table.IDBAN).length === 0)
                  )
                  .map(table => (
                    <div
                      key={table.IDBAN}
                      onClick={() => transferTable(table.IDBAN)}
                      className="p-4 bg-green-100 rounded-lg cursor-pointer hover:bg-green-200 transition-colors"
                    >
                      <h4 className="font-medium">{table['Tên bàn']}</h4>
                      <p className="text-sm text-gray-600">Sức chứa: {table['Sức chứa tối đa']} người</p>
                      <p className="text-sm text-gray-600">Trạng thái: {table['Trạng thái']}</p>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <h2 className="text-2xl font-bold mb-4">Thanh toán</h2>

            <form id="checkoutForm">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bàn</label>
                  <input
                    type="text"
                    value={selectedTableName}
                    readOnly
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nhân viên</label>
                  <input
                    type="text"
                    id="employeeInput"
                    value={nhanvien}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Khách hàng</label>
                  <input
                    type="text"
                    id="customerInput"
                    defaultValue="Khách lẻ"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                  />
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Tổng tiền hàng:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (10%):</span>
                  <span>{formatCurrency(vat)}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Giảm giá</label>
                  <input
                    type="number"
                    id="discountInput"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                    defaultValue="0"
                    onChange={(e) => {
                      // Update final total in the form
                      const discountAmount = parseFloat(e.target.value) || 0;
                      const finalTotal = document.getElementById('finalTotal');
                      if (finalTotal) {
                        finalTotal.textContent = formatCurrency(subtotal + vat - discountAmount);
                      }
                    }}
                  />
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Tổng cộng:</span>
                  <span id="finalTotal">{formatCurrency(total)}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Khách trả</label>
                  <input
                    type="text"
                    defaultValue={0}
                    id="paidAmount"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                    onChange={(e) => {
                      // Format the currency and calculate change
                      const input = e.target;
                      formatInputCurrency(input);

                      // Calculate change
                      const paidAmount = getNumericValue(input);
                      const finalTotalText = document.getElementById('finalTotal').textContent;
                      const finalTotal = parseFloat(finalTotalText.replace(/[^\d]/g, ''));
                      const change = Math.max(0, paidAmount - finalTotal);

                      document.getElementById('changeAmount').textContent = formatCurrency(change);
                    }}
                  />
                </div>
                <div className="flex justify-between text-lg">
                  <span>Tiền thừa:</span>
                  <span id="changeAmount">0đ</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
                  <textarea
                    id="noteInput"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 h-20"
                  ></textarea>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={processPayment}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Xác nhận thanh toán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast container for notifications */}
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
        style={{ zIndex: 9999 }}
      />
    </div>
  );
};

export default POSSystem;