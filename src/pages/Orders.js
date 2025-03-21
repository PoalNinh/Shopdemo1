import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Filter,
  Printer, Eye, X, RefreshCw, Check, AlertCircle
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format } from 'date-fns';
import authUtils from '../utils/authUtils';
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
  <div className="p-6 flex justify-center items-center min-h-screen">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
      <span className="text-gray-600">Đang tải dữ liệu...</span>
    </div>
  </div>
);

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [allOrderDetails, setAllOrderDetails] = useState({});
  const [currentOrderDetails, setCurrentOrderDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDetails, setOpenDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
  const fetchData = async () => {
    try {
      const [ordersResponse, detailsResponse] = await Promise.all([
        authUtils.apiRequest('HOADON', 'Find', {}),
        authUtils.apiRequest('HOADONDETAIL', 'Find', {})
      ]);

      // Sắp xếp đơn mới nhất lên đầu
      const sortedOrders = [...ordersResponse].sort((a, b) => {
        // Đảm bảo ngày hợp lệ trước khi so sánh
        const dateA = new Date(a['Ngày']);
        const dateB = new Date(b['Ngày']);

        // Kiểm tra nếu ngày hợp lệ
        const isValidDateA = !isNaN(dateA.getTime());
        const isValidDateB = !isNaN(dateB.getTime());

        if (isValidDateA && isValidDateB) {
          return dateB - dateA; // Sắp xếp giảm dần
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
      // Thêm ID vào danh sách đang xử lý
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
      // Xóa ID khỏi danh sách đang xử lý
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

  const handlePrint = (order) => {
    try {
      setProcessingOrderIds(prev => [...prev, order.IDHOADON]);

      const orderDetails = allOrderDetails[order.IDHOADON] || [];
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write('<div id="print-content"></div>');

      const checkPrintReady = setInterval(() => {
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
      }, 100);
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

      // Format: 20/11/2024 14:34:26
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
              // Đặt thời gian cuối ngày để bao gồm cả ngày kết thúc
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
    <div className="p-3 sm:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Quản lý Hóa đơn</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors">
              {isSyncing ? (
                <>
                  <Spinner color="border-gray-500" />
                  <span>Đang đồng bộ...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Đồng bộ</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition-colors
               ${showFilters
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}>
              <Filter className="w-4 h-4" />
              Bộ lọc {showFilters ? 'đang bật' : ''}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Trạng thái hóa đơn</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full p-2 border rounded-lg">
                  <option value="">Tất cả trạng thái</option>
                  {Object.values(BILL_STATUS).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Trạng thái bàn</label>
                <select
                  value={filters.tableStatus}
                  onChange={(e) => setFilters(prev => ({ ...prev, tableStatus: e.target.value }))}
                  className="w-full p-2 border rounded-lg">
                  <option value="">Tất cả trạng thái bàn</option>
                  {Object.values(TABLE_STATUS).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Khoảng thời gian</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full p-2 border rounded-lg" />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full p-2 border rounded-lg" />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    status: '',
                    dateRange: { start: '', end: '' },
                    tableStatus: ''
                  })}
                  className="w-full p-2 text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors">
                  Xóa tất cả bộ lọc
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo mã HD, bàn, khách hàng..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800">Không tìm thấy hóa đơn</h3>
            <p className="text-gray-500 mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-lg border">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã HD</th>
                      <th className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bàn</th>
                      <th className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân viên</th>
                      <th className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian</th>
                      <th className="px-3 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                      <th className="px-3 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">VAT(10%)</th>
                      <th className="px-3 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Khách trả</th>
                      <th className="px-3 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-3 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentItems.map((order) => (
                      <tr key={order.IDHOADON} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{order.IDHOADON}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{order.IDBAN}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{order['Nhân viên']}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                          {formatDateTime(order['Ngày'])}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                          {Number(order['Tổng tiền']).toLocaleString()}đ
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                          {Number(order['VAT']).toLocaleString()}đ
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                          {Number(order['Khách trả'] ).toLocaleString()}đ
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-1 text-xs rounded-full
                           ${order['Trạng thái'] === BILL_STATUS.PAID
                              ? 'bg-green-100 text-green-800'
                              : order['Trạng thái'] === BILL_STATUS.CANCELLED
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {order['Trạng thái']}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-right">
                          <div className="flex justify-end gap-2">
                            {order['Trạng thái'] === BILL_STATUS.PENDING && (
                              <button
                                onClick={() => handleApproveOrder(order)}
                                disabled={processingOrderIds.includes(order.IDHOADON)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-md hover:text-green-700 transition-colors relative"
                                title="Duyệt phiếu">
                                {processingOrderIds.includes(order.IDHOADON) ? (
                                  <Spinner color="border-green-500" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetails(order.IDHOADON)}
                              disabled={processingOrderIds.includes(order.IDHOADON)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md hover:text-blue-700 transition-colors relative"
                              title="Xem chi tiết">
                              {processingOrderIds.includes(order.IDHOADON) ? (
                                <Spinner color="border-blue-500" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handlePrint(order)}
                              disabled={processingOrderIds.includes(order.IDHOADON)}
                              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-md hover:text-gray-700 transition-colors relative"
                              title="In hóa đơn">
                              {processingOrderIds.includes(order.IDHOADON) ? (
                                <Spinner color="border-gray-500" />
                              ) : (
                                <Printer className="w-4 h-4" />
                              )}
                            </button>
                            {order['Trạng thái'] === BILL_STATUS.PENDING && (
                              <button
                                onClick={() => setDeleteConfirm(order.IDHOADON)}
                                disabled={processingOrderIds.includes(order.IDHOADON)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md hover:text-red-700 transition-colors relative"
                                title="Hủy phiếu">
                                {processingOrderIds.includes(order.IDHOADON) ? (
                                  <Spinner color="border-red-500" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-700">
                {`Hiển thị ${indexOfFirstItem + 1} - ${Math.min(indexOfLastItem, filteredOrders.length)} trong tổng số ${filteredOrders.length} hóa đơn`}
              </div>
              {totalPages > 1 && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
                    Đầu
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else {
                      if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                    }

                    return (
                      <button key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`min-w-[2.5rem] py-2 px-3 rounded-lg transition-colors ${currentPage === pageNumber
                            ? 'bg-blue-500 text-white font-medium'
                            : 'border hover:bg-gray-50 text-gray-700'
                          }`}>
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
                    Cuối
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal xem chi tiết */}
      {openDetails && (
  <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto animate-fade-in">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-4 sm:p-6 mt-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Chi tiết hóa đơn</h2>
          {currentOrder && (
            <p className="text-sm text-gray-500">Mã HĐ: {currentOrder.IDHOADON}</p>
          )}
        </div>
        <button
          onClick={() => setOpenDetails(false)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Thông tin cơ bản */}
      {currentOrder && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 bg-gray-50 p-3 rounded-lg">
          <div>
            <div className="text-sm text-gray-500">Bàn</div>
            <div className="font-medium">{currentOrder.IDBAN}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Nhân viên</div>
            <div className="font-medium">{currentOrder['Nhân viên']}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Ngày giờ</div>
            <div className="font-medium">{formatDateTime(currentOrder['Ngày'])}</div>
          </div>
        </div>
      )}

      {/* Danh sách sản phẩm */}
      <div className="overflow-x-auto rounded-lg border mb-5">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sản phẩm</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ĐVT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn giá</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentOrderDetails.length > 0 ? (
              currentOrderDetails.map((detail, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{detail['Tên sản phẩm']}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{detail['Đơn vị tính']}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                    {Number(detail['Đơn giá']).toLocaleString()}đ
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{detail['Số lượng']}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                    {(Number(detail['Đơn giá']) * Number(detail['Số lượng'])).toLocaleString()}đ
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                  Không có sản phẩm nào trong hóa đơn này
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Thông tin thanh toán */}
      {currentOrder && currentOrderDetails.length > 0 && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Thông tin khách hàng */}
          <div className="md:w-1/2 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium text-gray-800 mb-3">Thông tin khác</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Khách hàng:</span>
                <span className="font-medium">{currentOrder['Khách hàng'] || 'Khách lẻ'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trạng thái:</span>
                <span className={`font-medium ${
                  currentOrder['Trạng thái'] === 'Đã thanh toán' 
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
          <div className="md:w-1/2 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium text-gray-800 mb-3">Thông tin thanh toán</h3>
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
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <button 
          onClick={() => handlePrint(currentOrder)}
          className="px-4 py-2 flex items-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
          <Printer className="w-4 h-4" />
          In hóa đơn
        </button>
        <button 
          onClick={() => setOpenDetails(false)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
          Đóng
        </button>
      </div>
    </div>
  </div>
)}
      {/* Modal xác nhận hủy phiếu */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
            <div className="text-center mb-4">
              <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-red-100 mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Xác nhận hủy phiếu</h3>
              <p className="mt-2 text-gray-600">
                Bạn có chắc chắn muốn hủy hóa đơn <span className="font-medium">{deleteConfirm}</span>?
              </p>
            </div>
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Không
              </button>
              <button
                onClick={() => handleCancelOrder(orders.find(order => order.IDHOADON === deleteConfirm))}
                disabled={processingOrderIds.includes(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
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

      <style jsx>{`
   @keyframes fade-in {
     0% { opacity: 0; }
     100% { opacity: 1; }
   }
   .animate-fade-in {
     animation: fade-in 0.2s ease-out;
   }
   
   /* Thêm hiệu ứng skeleton khi loading */
   .skeleton {
     background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
     background-size: 200% 100%;
     animation: skeleton-loading 1.5s infinite;
   }
   
   @keyframes skeleton-loading {
     0% {
       background-position: 200% 0;
     }
     100% {
       background-position: -200% 0;
     }
   }
   
   /* Thêm hiệu ứng hover mượt mà */
   .hover-scale {
     transition: transform 0.2s ease-in-out;
   }
   
   .hover-scale:hover {
     transform: scale(1.02);
   }
 `}</style>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
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

export default OrderManagement;