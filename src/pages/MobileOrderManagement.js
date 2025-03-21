import React, { useState, useEffect } from 'react';
import {
  Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  Eye, Printer, Check, X, AlertCircle, Menu
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import authUtils from '../utils/authUtils';
import { format } from 'date-fns';
import ReactDOM from 'react-dom';
import InvoiceTemplate from './InvoiceTemplate';

const BILL_STATUS = {
  PENDING: 'Phiếu mới',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy'
};

const TABLE_STATUS = {
  OCCUPIED: 'Đang sử dụng',
  AVAILABLE: 'Đã trả bàn'
};

// Tạo component Spinner
const Spinner = ({ size = "h-4 w-4", color = "border-blue-500" }) => (
  <div className={`${size} border-2 ${color} border-t-transparent rounded-full animate-spin`}></div>
);

// Tạo component LoadingOverlay cho loader toàn trang
const LoadingOverlay = () => (
  <div className="p-4 flex justify-center items-center min-h-screen">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
      <span className="text-gray-600">Đang tải dữ liệu...</span>
    </div>
  </div>
);

// Component hiển thị từng mục hóa đơn dưới dạng card
const OrderCard = ({ order, onView, onApprove, onCancel, onPrint, processingOrderIds }) => {
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Không hợp lệ";

      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return "Không hợp lệ";
    }
  };

  const isProcessing = processingOrderIds.includes(order.IDHOADON);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-gray-900">Mã HD: {order.IDHOADON}</h3>
          <p className="text-sm text-gray-600">Bàn: {order.IDBAN}</p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${order['Trạng thái'] === BILL_STATUS.PAID
            ? 'bg-green-100 text-green-800'
            : order['Trạng thái'] === BILL_STATUS.CANCELLED
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
          {order['Trạng thái']}
        </span>
      </div>

      <div className="space-y-1 mb-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Nhân viên:</span>
          <span>{order['Nhân viên']}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Thời gian:</span>
          <span>{formatDateTime(order['Ngày'])}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tổng tiền:</span>
          <span className="font-medium">{Number(order['Tổng tiền']).toLocaleString()}đ</span>
        </div>
      </div>

      <div className="pt-3 border-t flex justify-between">
        <div className="flex gap-1">
          {order['Trạng thái'] === BILL_STATUS.PENDING && (
            <>
              <button
                onClick={() => onApprove(order)}
                disabled={isProcessing}
                className="p-2 text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                {isProcessing ? <Spinner color="border-green-500" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onCancel(order.IDHOADON)}
                disabled={isProcessing}
                className="p-2 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors">
                {isProcessing ? <Spinner color="border-red-500" /> : <X className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onView(order.IDHOADON)}
            disabled={isProcessing}
            className="p-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
            {isProcessing ? <Spinner color="border-blue-500" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onPrint(order)}
            disabled={isProcessing}
            className="p-2 text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
            {isProcessing ? <Spinner color="border-gray-500" /> : <Printer className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const MobileOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [allOrderDetails, setAllOrderDetails] = useState({});
  const [currentOrderDetails, setCurrentOrderDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDetails, setOpenDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // Hiển thị ít mục hơn trên mobile
  const [showFilters, setShowFilters] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [processingOrderIds, setProcessingOrderIds] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    dateRange: { start: '', end: '' },
    tableStatus: '',
  });
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersResponse, detailsResponse] = await Promise.all([
        authUtils.apiRequest('HOADON', 'Find', {}),
        authUtils.apiRequest('HOADONDETAIL', 'Find', {})
      ]);

      // Sắp xếp đơn mới nhất lên đầu
      const sortedOrders = [...ordersResponse].sort((a, b) => {
        const dateA = new Date(a['Ngày']);
        const dateB = new Date(b['Ngày']);

        const isValidDateA = !isNaN(dateA.getTime());
        const isValidDateB = !isNaN(dateB.getTime());

        if (isValidDateA && isValidDateB) {
          return dateB - dateA;
        } else if (isValidDateA) {
          return -1;
        } else if (isValidDateB) {
          return 1;
        }
        return 0;
      });

      const detailsByOrderId = detailsResponse.reduce((acc, detail) => {
        if (!acc[detail.IDHOADON]) acc[detail.IDHOADON] = [];
        acc[detail.IDHOADON].push(detail);
        return acc;
      }, {});

      setOrders(sortedOrders);
      setAllOrderDetails(detailsByOrderId);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Không thể tải dữ liệu');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await fetchData();
      toast.success('Đồng bộ thành công');
    } catch (error) {
      toast.error('Lỗi đồng bộ');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViewDetails = (orderId) => {
    const order = orders.find(order => order.IDHOADON === orderId);
    setCurrentOrder(order);
    setCurrentOrderDetails(allOrderDetails[orderId] || []);
    setOpenDetails(true);
  };

  const handleApproveOrder = async (order) => {
    try {
      setProcessingOrderIds(prev => [...prev, order.IDHOADON]);

      const updatedOrder = {
        ...order,
        'Trạng thái': BILL_STATUS.PAID
      };

      await authUtils.apiRequest('HOADON', 'Edit', { "Rows": [updatedOrder] });

      setOrders(prev => prev.map(o =>
        o.IDHOADON === order.IDHOADON ? updatedOrder : o
      ));

      toast.success('Duyệt phiếu thành công');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Lỗi khi duyệt phiếu');
    } finally {
      setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      setProcessingOrderIds(prev => [...prev, order.IDHOADON]);

      const updatedOrder = {
        ...order,
        'Trạng thái': BILL_STATUS.CANCELLED
      };

      await authUtils.apiRequest('HOADON', 'Edit', { "Rows": [updatedOrder] });

      setOrders(prev => prev.map(o =>
        o.IDHOADON === order.IDHOADON ? updatedOrder : o
      ));

      setDeleteConfirm(null);
      toast.success('Hủy phiếu thành công');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Lỗi khi hủy phiếu');
    } finally {
      setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
    }
  };
  // Thêm hàm generateVietQRUrl vào trong component MobileOrderManagement
  const generateVietQRUrl = (amount, description) => {
    // Format to required VietQR standards
    const bankId = "970422"; // MB Bank BIN
    const accountNo = "7320012003";
    const amountStr = Math.round(amount).toString();
    const encodedDescription = encodeURIComponent(description || "Thanh toan don hang");

    // Generate VietQR URL with static image approach
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amountStr}&addInfo=${encodedDescription}`;
  };
  const [printPreview, setPrintPreview] = useState(null);

  // Thay thế hàm handlePrint
  const handlePrint = (order) => {
    try {
      setProcessingOrderIds(prev => [...prev, order.IDHOADON]);
      const orderDetails = allOrderDetails[order.IDHOADON] || [];

      // Kiểm tra xem có đang chạy trên thiết bị di động không
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Hiển thị xem trước hóa đơn trong ứng dụng thay vì mở cửa sổ mới
        setPrintPreview({
          order,
          orderDetails
        });
      } else {
        // Phương thức in cũ dành cho desktop
        const printWindow = window.open('', '_blank');

        if (!printWindow || printWindow.closed || typeof printWindow.document === 'undefined') {
          toast.error('Không thể mở cửa sổ in. Vui lòng kiểm tra cài đặt popup blocker.');
          setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
          return;
        }

        printWindow.document.write('<div id="print-content"></div>');

        const checkPrintReady = setInterval(() => {
          try {
            const printContent = printWindow.document.getElementById('print-content');
            if (printContent) {
              clearInterval(checkPrintReady);
              ReactDOM.render(<InvoiceTemplate order={order} orderDetails={orderDetails} />, printContent);
              setTimeout(() => {
                printWindow.print();
                printWindow.close();
                setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
              }, 1000);
            }
          } catch (error) {
            clearInterval(checkPrintReady);
            toast.error('Lỗi khi chuẩn bị in');
            setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
          }
        }, 100);
      }

      // Bỏ ID khỏi danh sách đang xử lý nếu là thiết bị di động
      if (isMobile) {
        setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('Lỗi khi in hóa đơn');
      setProcessingOrderIds(prev => prev.filter(id => id !== order.IDHOADON));
    }
  };

  // Hàm an toàn để hiển thị ngày giờ theo định dạng DD/MM/YYYY HH:MM:SS
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Không hợp lệ";
      }

      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error("Lỗi định dạng ngày:", error);
      return "Không hợp lệ";
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchMatch = Object.values(order).some(val =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );

    const statusMatch = !filters.status || order['Trạng thái'] === filters.status;
    const tableStatusMatch = !filters.tableStatus ||
      order['Trạng thái sử dụng bàn'] === filters.tableStatus;

    let dateMatch = true;
    if (filters.dateRange.start || filters.dateRange.end) {
      try {
        const orderDate = new Date(order['Ngày']);
        if (!isNaN(orderDate.getTime())) {
          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            if (!isNaN(startDate.getTime())) {
              dateMatch = dateMatch && orderDate >= startDate;
            }
          }
          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            if (!isNaN(endDate.getTime())) {
              endDate.setHours(23, 59, 59, 999);
              dateMatch = dateMatch && orderDate <= endDate;
            }
          }
        }
      } catch (error) {
        console.error("Lỗi so sánh ngày:", error);
        dateMatch = false;
      }
    }

    return searchMatch && statusMatch && tableStatusMatch && dateMatch;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-800">Quản lý Hóa đơn</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
              {isSyncing ? <Spinner color="border-gray-500" /> : <RefreshCw className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowFilterSheet(true)}
              className={`p-2 rounded-full transition-colors
               ${filters.status || filters.tableStatus || filters.dateRange.start || filters.dateRange.end
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo mã HD, bàn..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" />
        </div>
      </div>

      {/* Hiển thị kết quả lọc */}
      {(filters.status || filters.tableStatus || filters.dateRange.start || filters.dateRange.end) && (
        <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <span className="text-blue-700">Đang lọc:</span>
            {filters.status && (
              <span className="px-2 py-0.5 bg-blue-100 rounded-full text-blue-700">{filters.status}</span>
            )}
            {filters.tableStatus && (
              <span className="px-2 py-0.5 bg-blue-100 rounded-full text-blue-700">{filters.tableStatus}</span>
            )}
            {(filters.dateRange.start || filters.dateRange.end) && (
              <span className="px-2 py-0.5 bg-blue-100 rounded-full text-blue-700">Có lọc ngày</span>
            )}
          </div>
          <button
            onClick={() => setFilters({
              status: '',
              dateRange: { start: '', end: '' },
              tableStatus: ''
            })}
            className="text-blue-600">
            Xóa
          </button>
        </div>
      )}

      {/* Danh sách */}
      <div className="p-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800">Không tìm thấy hóa đơn</h3>
            <p className="text-gray-500 mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <>
            {currentItems.map((order) => (
              <OrderCard
                key={order.IDHOADON}
                order={order}
                onView={handleViewDetails}
                onApprove={handleApproveOrder}
                onCancel={setDeleteConfirm}
                onPrint={handlePrint}
                processingOrderIds={processingOrderIds}
              />
            ))}

            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="py-4 flex justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white border rounded-md disabled:opacity-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1 bg-white px-3 py-2 border rounded-md">
                  <span className="text-gray-700">{currentPage}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-700">{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white border rounded-md disabled:opacity-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal xem chi tiết */}
      {openDetails && (
        <div className="fixed inset-0 bg-black/80 z-50 animate-fade-in">
          <div className="bg-white h-full overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white shadow-sm p-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Chi tiết hóa đơn</h2>
                {currentOrder && (
                  <p className="text-sm text-gray-500">Mã HĐ: {currentOrder.IDHOADON}</p>
                )}
              </div>
              <button
                onClick={() => setOpenDetails(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Thông tin cơ bản */}
              {currentOrder && (
                <div className="grid grid-cols-2 gap-3 mb-5 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500">Bàn</div>
                    <div className="font-medium">{currentOrder.IDBAN}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Nhân viên</div>
                    <div className="font-medium">{currentOrder['Nhân viên']}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-500">Ngày giờ</div>
                    <div className="font-medium">{formatDateTime(currentOrder['Ngày'])}</div>
                  </div>
                </div>
              )}

              {/* Danh sách sản phẩm */}
              <div className="mb-5">
                <h3 className="font-medium text-gray-800 mb-2">Sản phẩm</h3>
                {currentOrderDetails.length > 0 ? (
                  currentOrderDetails.map((detail, index) => (
                    <div key={index} className="bg-white border rounded-lg p-3 mb-2">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{detail['Tên sản phẩm']}</span>
                        <span>{detail['Đơn vị tính']}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>{Number(detail['Đơn giá']).toLocaleString()}đ x {detail['Số lượng']}</span>
                        <span className="font-medium">
                          {(Number(detail['Đơn giá']) * Number(detail['Số lượng'])).toLocaleString()}đ
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-lg text-gray-500">
                    Không có sản phẩm nào trong hóa đơn này
                  </div>
                )}
              </div>

              {/* Thông tin thanh toán */}
              {currentOrder && currentOrderDetails.length > 0 && (
                <>
                  {/* Thông tin khách hàng */}
                  <div className="p-4 border rounded-lg bg-gray-50 mb-3">
                    <h3 className="font-medium text-gray-800 mb-2">Thông tin khác</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Khách hàng:</span>
                        <span className="font-medium">{currentOrder['Khách hàng'] || 'Khách lẻ'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trạng thái:</span>
                        <span className={`font-medium ${currentOrder['Trạng thái'] === 'Đã thanh toán'
                            ? 'text-green-600'
                            : currentOrder['Trạng thái'] === 'Đã hủy'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}>
                          {currentOrder['Trạng thái']}
                        </span>
                      </div>
                      {currentOrder['Ghi chú'] && (
                        <div>
                          <span className="text-gray-600">Ghi chú:</span>
                          <p className="mt-1 text-sm border-l-2 border-gray-300 pl-2 italic">
                            {currentOrder['Ghi chú']}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tổng tiền */}
                  <div className="p-4 border rounded-lg bg-gray-50 mb-5">
                    <h3 className="font-medium text-gray-800 mb-2">Thông tin thanh toán</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tổng tiền hàng:</span>
                        <span className="font-medium">{Number(currentOrder['Tổng tiền']).toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">VAT (10%):</span>
                        <span className="font-medium">{Number(currentOrder['VAT']).toLocaleString()}đ</span>
                      </div>
                      {Number(currentOrder['Giảm giá']) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Giảm giá:</span>
                          <span className="font-medium text-red-600">-{Number(currentOrder['Giảm giá']).toLocaleString()}đ</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-gray-200 flex justify-between font-medium">
                        <span>Thành tiền:</span>
                        <span className="text-blue-700">
                          {(Number(currentOrder['Tổng tiền']) + Number(currentOrder['VAT']) - Number(currentOrder['Giảm giá'] || 0)).toLocaleString()}đ
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Khách trả:</span>
                        <span className="font-medium">{Number(currentOrder['Khách trả']).toLocaleString()}đ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tiền thừa:</span>
                        <span className="font-medium">{Number(currentOrder['Tiền thừa'] || 0).toLocaleString()}đ</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Button in hóa đơn */}
              <div className="pb-6">
                <button
                  onClick={() => handlePrint(currentOrder)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Printer className="w-5 h-5" />
                  In hóa đơn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter sheet (bottom sheet) */}
      {showFilterSheet && (
        <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={() => setShowFilterSheet(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl p-5 animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Bộ lọc</h3>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="p-1 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Trạng thái hóa đơn</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
                    className={`py-2 px-3 text-sm rounded-lg text-center ${!filters.status
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                      }`}>
                    Tất cả
                  </button>
                  {Object.values(BILL_STATUS).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilters(prev => ({ ...prev, status: status }))}
                      className={`py-2 px-3 text-sm rounded-lg text-center ${filters.status === status
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Trạng thái bàn</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, tableStatus: '' }))}
                    className={`py-2 px-3 text-sm rounded-lg text-center ${!filters.tableStatus
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                      }`}>
                    Tất cả
                  </button>
                  {Object.values(TABLE_STATUS).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilters(prev => ({ ...prev, tableStatus: status }))}
                      className={`py-2 px-3 text-sm rounded-lg text-center ${filters.tableStatus === status
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Từ ngày</label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value }
                  }))}
                  className="w-full p-2 border rounded-lg" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Đến ngày</label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value }
                  }))}
                  className="w-full p-2 border rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  onClick={() => {
                    setFilters({
                      status: '',
                      dateRange: { start: '', end: '' },
                      tableStatus: ''
                    });
                  }}
                  className="py-3 border border-gray-300 text-gray-700 rounded-lg">
                  Xóa bộ lọc
                </button>
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="py-3 bg-blue-600 text-white rounded-lg">
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận hủy phiếu */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg w-full max-w-xs p-5">
            <div className="text-center mb-4">
              <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-red-100 mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Xác nhận hủy phiếu</h3>
              <p className="mt-2 text-sm text-gray-600">
                Bạn có chắc chắn muốn hủy hóa đơn <span className="font-medium">{deleteConfirm}</span>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700">
                Không
              </button>
              <button
                onClick={() => handleCancelOrder(orders.find(order => order.IDHOADON === deleteConfirm))}
                disabled={processingOrderIds.includes(deleteConfirm)}
                className="px-4 py-3 bg-red-600 text-white rounded-lg flex items-center justify-center gap-2">
                {processingOrderIds.includes(deleteConfirm) ? (
                  <>
                    <Spinner color="border-white" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  'Hủy phiếu'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal xem trước hóa đơn cho thiết bị di động */}
      {/* Modal xem trước hóa đơn cho thiết bị di động */}
      {printPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 animate-fade-in">
          <div className="bg-white h-full overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white shadow-sm p-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Hóa đơn #{printPreview.order.IDHOADON}</h2>
              </div>
              <button
                onClick={() => setPrintPreview(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Nội dung hóa đơn */}
              <div className="bg-white p-3 mb-5">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">HÓA ĐƠN THANH TOÁN</h2>
                  <p className="text-sm text-gray-600">Ngày: {formatDateTime(printPreview.order['Ngày'])}</p>
                </div>

                <div className="flex justify-between text-sm mb-4">
                  <div>
                    <p><strong>Mã HĐ:</strong> {printPreview.order.IDHOADON}</p>
                    <p><strong>Bàn:</strong> {printPreview.order.IDBAN}</p>
                  </div>
                  <div>
                    <p><strong>Nhân viên:</strong> {printPreview.order['Nhân viên']}</p>
                    <p><strong>Khách hàng:</strong> {printPreview.order['Khách hàng'] || 'Khách lẻ'}</p>
                  </div>
                </div>

                <div className="border-t border-b border-gray-200 py-2 mb-3">
                  <div className="flex font-semibold text-sm mb-2">
                    <div className="w-5/12">Sản phẩm</div>
                    <div className="w-2/12 text-center">Đơn giá</div>
                    <div className="w-2/12 text-center">SL</div>
                    <div className="w-3/12 text-right">Thành tiền</div>
                  </div>

                  {printPreview.orderDetails.map((item, index) => (
                    <div key={index} className="flex text-sm py-1">
                      <div className="w-5/12">{item['Tên sản phẩm']}</div>
                      <div className="w-2/12 text-center">{Number(item['Đơn giá']).toLocaleString()}</div>
                      <div className="w-2/12 text-center">{item['Số lượng']}</div>
                      <div className="w-3/12 text-right">
                        {(Number(item['Đơn giá']) * Number(item['Số lượng'])).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 text-sm mb-5">
                  <div className="flex justify-between">
                    <span>Tổng tiền hàng:</span>
                    <span>{Number(printPreview.order['Tổng tiền']).toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (10%):</span>
                    <span>{Number(printPreview.order['VAT']).toLocaleString()}đ</span>
                  </div>
                  {Number(printPreview.order['Giảm giá']) > 0 && (
                    <div className="flex justify-between">
                      <span>Giảm giá:</span>
                      <span>-{Number(printPreview.order['Giảm giá']).toLocaleString()}đ</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Thành tiền:</span>
                    <span>
                      {(Number(printPreview.order['Tổng tiền']) + Number(printPreview.order['VAT']) - Number(printPreview.order['Giảm giá'] || 0)).toLocaleString()}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Khách trả:</span>
                    <span>{Number(printPreview.order['Khách trả']).toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiền thừa:</span>
                    <span>{Number(printPreview.order['Tiền thừa'] || 0).toLocaleString()}đ</span>
                  </div>
                </div>

                {/* Thêm mã QR */}
                <div className="mt-4 mb-5 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <h3 className="font-medium text-gray-800 mb-2">Quét mã để thanh toán</h3>
                    <div className="flex justify-center">
                      <img
                        src={generateVietQRUrl(
                          Number(printPreview.order['Tổng tiền']) + Number(printPreview.order['VAT']) - Number(printPreview.order['Giảm giá'] || 0),
                          `Thanh toan hoa don #${printPreview.order.IDHOADON}`
                        )}
                        alt="QR Code"
                        className="w-48 h-48 object-contain border p-1 rounded-lg"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGMEYwRjAiLz48dGV4dCB4PSIzMCIgeT0iMTAwIiBmaWxsPSIjODg4ODg4IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+S2jDtG5nIHRo4buDIHThuqNpIG3DoyBRUjwvdGV4dD48L3N2Zz4=';
                          toast.warning('Không thể tải mã QR');
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">MB Bank - 7320012003</p>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600">
                  <p>Cảm ơn quý khách và hẹn gặp lại!</p>
                </div>
              </div>

              {/* Nút chia sẻ hoặc lưu */}
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    // Nút này sẽ có chức năng khác nhau tùy trình duyệt hỗ trợ
                    // Có thể sử dụng Web Share API nếu được hỗ trợ
                    if (navigator.share) {
                      navigator.share({
                        title: `Hóa đơn #${printPreview.order.IDHOADON}`,
                        text: `Hóa đơn thanh toán #${printPreview.order.IDHOADON} - Tổng tiền: ${(Number(printPreview.order['Tổng tiền']) + Number(printPreview.order['VAT']) - Number(printPreview.order['Giảm giá'] || 0)).toLocaleString()}đ`
                      }).catch(err => {
                        toast.error('Không thể chia sẻ hóa đơn');
                      });
                    } else {
                      toast.info('Tính năng chia sẻ không được hỗ trợ trên trình duyệt này');
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                  Chia sẻ hóa đơn
                </button>
                <button
                  onClick={() => setPrintPreview(null)}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        @keyframes slide-up {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
        
        /* Thêm hiệu ứng skeleton khi loading */
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }
        
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default MobileOrderManagement;