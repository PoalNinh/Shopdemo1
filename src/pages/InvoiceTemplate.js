import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

const InvoiceTemplate = ({ order, orderDetails }) => {
  const [qrLoaded, setQrLoaded] = useState(false);

  const formatCurrency = (value) => {
    if (!value) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const calculateTotals = () => {
    const subtotal = Number(order['Tổng tiền']) || 0;
    const vat = Number(order['VAT']);
    const discount = Number(order['Giảm giá']) || 0;
    const total = subtotal + vat - discount;
    const paid = Number(order['Khách trả']) || 0;
    const change = paid - total;
    return { subtotal, vat, discount, total, paid, change };
  };

  const totals = calculateTotals();
  const qrUrl = `https://img.vietqr.io/image/970422-7320012003-compact2.png?amount=${totals.total}&addInfo=Thanh%20toan%20hoa%20don%20so%20${order.IDHOADON}&accountName=NINH%20VAN%20PHUOC`;

  useEffect(() => {
    // Thêm timeout để đảm bảo QR đã được tải
    const img = new Image();
    img.onload = () => setQrLoaded(true);
    img.onerror = () => {
      console.error("QR failed to load, retrying...");
      // Thử lại sau 1 giây nếu lỗi
      setTimeout(() => {
        img.src = qrUrl + '&t=' + new Date().getTime(); // Thêm timestamp để tránh cache
      }, 1000);
    };
    img.src = qrUrl;
    
    // Đảm bảo QR được tải sau một khoảng thời gian cố định
    const timeout = setTimeout(() => {
      if (!qrLoaded) setQrLoaded(true);
    }, 3000); // Timeout sau 3 giây
    
    return () => clearTimeout(timeout);
  }, [qrUrl]);

  return (
    <>
      <style>
        {`
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
          .header {
            text-align: center;
            margin-bottom: 3mm;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
          }
          .invoice-details {
            margin-bottom: 2mm;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border-top: 0.5px solid #ddd;
            border-bottom: 0.5px solid #ddd;
            padding: 1mm;
            text-align: left;
          }
          .total {
            font-weight: bold;
            text-align: right;
            margin-top: 2mm;
          }
          .footer {
            text-align: center;
            margin-top: 3mm;
            font-size: 10px;
          }
          .top-info {
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 2mm;
          }
          @media print {
          #content {
    box-shadow: none;
    padding: 0;
    width: 100%; /* Đảm bảo chiếm toàn bộ không gian in */
    max-width: 80mm; /* Giới hạn độ rộng tối đa */
    margin: 0 auto; /* Căn giữa */
  }
  body {
    margin: 0;
    padding: 0;
    background: none;
  }
            img {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>

      <div id="content">
        {/* Header */}
        <div className="header">
          <div className="company-name">
            <img src="logo1.png" alt="" style={{ width: '20px', display: 'inline' }} /> Goal COFFEE
          </div>
          <div style={{ fontWeight: 'bold' }}>Địa chỉ: Lâm Đồng</div>
          <div>SĐT: 0326132124</div>
        </div>

        {/* Invoice Title */}
        <div className="header">
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '2mm 0' }}>Hóa đơn bán hàng</h2>
          <div style={{ fontWeight: 'bold' }}>Số: {order.IDHOADON}</div>
          <div style={{ fontWeight: 'bold' }}>
            Ngày: {format(new Date(order['Ngày']), 'dd/MM/yyyy')}
          </div>
        </div>

        {/* Customer Info */}
        <div className="top-info">
          <div>Khách hàng: {order['Khách hàng']}</div>
          <div>Bàn: {order.IDBAN}</div>
          <div>Nhân viên: {order['Nhân viên']}</div>
        </div>

        {/* Order Details Table */}
        <table>
          <thead>
            <tr>
              <th>STT.</th>
              <th>TÊN SP</th>
              <th style={{ textAlign: 'right' }}>SL</th>
              <th style={{ textAlign: 'right' }}>ĐƠN GIÁ</th>
              <th style={{ textAlign: 'right' }}>THÀNH TIỀN</th>
            </tr>
          </thead>
          <tbody>
            {orderDetails.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item['Tên sản phẩm']}</td>
                <td style={{ textAlign: 'right' }}>{item['Số lượng']}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item['Đơn giá'])}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item['Đơn giá'] * item['Số lượng'])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ textAlign: 'right', marginTop: '2mm' }}>
          <div>Tổng thành tiền: {formatCurrency(totals.subtotal)}</div>
          <div>Giảm giá: {formatCurrency(totals.discount)}</div>
          <div>VAT (10 %): {formatCurrency(totals.vat)}</div>
          <div className="total">Tổng cộng: {formatCurrency(totals.total)}</div>
          <div>Khách trả: {formatCurrency(totals.paid)}</div>
          <div>Tiền thừa: {formatCurrency(totals.change)}</div>
        </div>

        {/* Note */}
        {order['Ghi chú'] && (
          <div style={{ marginTop: '2mm', fontStyle: 'italic' }}>
            Ghi chú: {order['Ghi chú']}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div style={{ borderTop: '0.5px solid #ddd', paddingTop: '2mm' }}>
            <div style={{ fontStyle: 'italic' }}>Cảm ơn quý khách đã mua hàng!</div>
            <div>Liên hệ Ninh Phước để được hỗ trợ: 0326132124</div>
          </div>
          {/* QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2mm' }}>
            {qrLoaded && (
              <img
                src={qrUrl}
                alt="QR Payment"
                style={{ width: '192px', height: '192px' }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceTemplate;